/**
 * DistribuicaoService.gs — distribuição do balcão: por funcionário, setor, posição e o turno
 * (Manhã, Tarde, Manhã+Tarde ou Integral) de cada dia útil. Independente de Horários.
 * Manhã+Tarde é exclusivo de Estágio e Integral é exclusivo de PSS e Cargo (CONFIG.JORNADA).
 */

function normalizarTurno(valor) {
  if (valorVazio(valor)) return '';
  const canonico = CONFIG.TURNOS.filter(function (t) { return chaveDoNome(t) === chaveDoNome(valor); })[0];
  if (!canonico) throw new Error('[Distribuição] Turno inválido: "' + valor + '". Valores aceitos: ' + CONFIG.TURNOS.join(', ') + ' (ou vazio).');
  return canonico;
}

/**
 * Cria ou atualiza a linha da pessoa. Dados aceitos: SETOR, POSICAO, SEGUNDA..SEXTA, OBSERVACOES.
 * Só grava o que mudou. Não apaga linhas: para tirar alguém do balcão, esvazie os dias.
 */
function salvarDistribuicaoDoFuncionario(idFuncionario, dados) {
  return executarComTrava(function () {
    const pessoa = buscarFuncionarioPorId(idFuncionario);
    if (!pessoa) throw new Error('[Distribuição] Funcionário não encontrado: ' + idFuncionario);
    const origem = dados || {};
    const permitidos = ['SETOR', 'POSICAO', 'OBSERVACOES'].concat(CONFIG.DIAS.map(function (d) { return d.DISTRIBUICAO; }));
    Object.keys(origem).forEach(function (k) {
      if (permitidos.indexOf(k) < 0) throw new Error('[Distribuição] Campo desconhecido: ' + k + '.');
    });
    const valores = {};
    Object.keys(origem).forEach(function (k) {
      const eDia = CONFIG.DIAS.some(function (d) { return d.DISTRIBUICAO === k; });
      valores[k] = eDia ? normalizarTurno(origem[k]) : (valorVazio(origem[k]) ? '' : String(origem[k]).trim());
    });
    if (valores.SETOR && CONFIG.SETORES.length) exigirNaLista(valores.SETOR, CONFIG.SETORES, 'Setor');
    const vinculo = vinculoAtualDoFuncionario(pessoa);
    // só os dias que mudam são conferidos: dados antigos fora da regra não impedem outras alterações (a Auditoria aponta)
    const exigirTurnoDoVinculo = function (k, turno) {
      if (!turno || turnoPermitidoParaVinculo(turno, vinculo)) return;
      const dia = CONFIG.DIAS.filter(function (d) { return d.DISTRIBUICAO === k; })[0];
      const J = CONFIG.JORNADA;
      const sugestao = turno === J.TURNO_MANHA_TARDE ? ' Para ' + vinculo + ', use "' + J.TURNO_INTEGRAL + '".'
        : (J.VINCULOS_MANHA_TARDE.indexOf(vinculo) >= 0 ? ' Para ' + vinculo + ', use "' + J.TURNO_MANHA_TARDE + '".' : '');
      throw new Error('[Distribuição] ' + dia.NOME + ': o turno "' + turno + '" não vale para o vínculo ' + (vinculo || '(sem vínculo)') + '.' + sugestao);
    };

    const existente = buscarDistribuicaoDoFuncionario(idFuncionario);
    if (!existente) {
      const contratos = pessoa.contratos;
      const ultimo = contratos[contratos.length - 1];
      const registro = { ID_FUNCIONARIO: idFuncionario, NOME: pessoa.NOME, SETOR: ultimo ? ultimo.SETOR : '', POSICAO: '', OBSERVACOES: '' };
      CONFIG.DIAS.forEach(function (d) { registro[d.DISTRIBUICAO] = ''; });
      Object.keys(valores).forEach(function (k) { registro[k] = valores[k]; });
      CONFIG.DIAS.forEach(function (d) { exigirTurnoDoVinculo(d.DISTRIBUICAO, registro[d.DISTRIBUICAO]); });
      inserirDistribuicao([registro]);
      registrarHistorico({
        ID_FUNCIONARIO: idFuncionario, OPERACAO: CONFIG.OPERACOES.CADASTRO, CAMPO: 'Distribuição', NOVO_VALOR: 'Incluído(a) na distribuição'
      });
      return { criado: true, alterados: Object.keys(valores) };
    }
    const novos = {};
    Object.keys(valores).forEach(function (k) {
      if (String(existente[k] === null || existente[k] === undefined ? '' : existente[k]).trim() !== valores[k]) novos[k] = valores[k];
    });
    if (!Object.keys(novos).length) return { criado: false, alterados: [] };
    CONFIG.DIAS.forEach(function (d) { if (d.DISTRIBUICAO in novos) exigirTurnoDoVinculo(d.DISTRIBUICAO, novos[d.DISTRIBUICAO]); });
    const diff = atualizarDistribuicao(existente._linha, novos);
    registrarHistorico(Object.keys(diff.depois).map(function (k) {
      return {
        ID_FUNCIONARIO: idFuncionario, OPERACAO: CONFIG.OPERACOES.ALTERACAO,
        CAMPO: 'Distribuição — ' + CONFIG.COLUNAS.DISTRIBUICAO[k], VALOR_ANTERIOR: diff.antes[k], NOVO_VALOR: diff.depois[k]
      };
    }));
    return { criado: false, alterados: Object.keys(diff.depois) };
  });
}