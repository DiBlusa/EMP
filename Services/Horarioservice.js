/**
 * HorarioService.gs — horários semanais (De/Até de segunda a sexta), uma linha por FUNCIONÁRIO.
 * O horário fica ligado à pessoa (ID_FUNCIONARIO) e continua o mesmo quando o contrato é renovado.
 * Horários são guardados como texto "HH:mm".
 */

function normalizarHorario(valor) {
  if (valorVazio(valor)) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, CONFIG.FUSO, 'HH:mm');
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(valor).trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new Error('[Horário] Horário inválido: "' + valor + '". Use HH:mm (ex.: 08:00).');
  }
  return (m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2];
}

/** Valida a semana inteira e devolve { SEG_DE, SEG_ATE, ... } normalizado (texto HH:mm ou vazio). */
function normalizarHorariosDaSemana(horarios) {
  const origem = horarios || {};
  const saida = {};
  CONFIG.DIAS.forEach(function (dia) {
    const chaveDe = dia.SIGLA + '_DE';
    const chaveAte = dia.SIGLA + '_ATE';
    const de = normalizarHorario(origem[chaveDe]);
    const ate = normalizarHorario(origem[chaveAte]);
    if ((de === '') !== (ate === '')) throw new Error('[Horário] ' + dia.NOME + ': informe De e Até, ou deixe os dois em branco.');
    if (de !== '' && de >= ate) throw new Error('[Horário] ' + dia.NOME + ': o horário final deve ser depois do inicial.');
    saida[chaveDe] = de;
    saida[chaveAte] = ate;
  });
  return saida;
}

function horarioDaLinha(registro, chave) {
  try { return normalizarHorario(registro[chave]); } catch (e) { return String(registro[chave]); }
}

/** Grava o horário de uma pessoa (chamar dentro da trava). Retorna { criado, alterados }. */
function gravarHorarioDoFuncionario(pessoa, horarios) {
  const existente = buscarHorarioDoFuncionario(pessoa.ID_FUNCIONARIO);
  if (!existente) {
    const algum = Object.keys(horarios).some(function (k) { return horarios[k] !== ''; });
    if (!algum) return { criado: false, alterados: [] };
    const registro = { ID_FUNCIONARIO: pessoa.ID_FUNCIONARIO, NOME: pessoa.NOME };
    Object.keys(horarios).forEach(function (k) { registro[k] = horarios[k]; });
    inserirHorarios([registro]);
    registrarHistorico({
      ID_FUNCIONARIO: pessoa.ID_FUNCIONARIO, OPERACAO: CONFIG.OPERACOES.CADASTRO, CAMPO: 'Horário', NOVO_VALOR: 'Horário cadastrado'
    });
    return { criado: true, alterados: Object.keys(horarios).filter(function (k) { return horarios[k] !== ''; }) };
  }
  const novos = {};
  Object.keys(horarios).forEach(function (k) {
    if (horarioDaLinha(existente, k) !== horarios[k]) novos[k] = horarios[k];
  });
  if (!Object.keys(novos).length) return { criado: false, alterados: [] };
  const diff = atualizarHorario(existente._linha, novos);
  registrarHistorico(Object.keys(diff.depois).map(function (k) {
    return {
      ID_FUNCIONARIO: pessoa.ID_FUNCIONARIO, OPERACAO: CONFIG.OPERACOES.ALTERACAO,
      CAMPO: 'Horário — ' + CONFIG.COLUNAS.HORARIOS[k], VALOR_ANTERIOR: diff.antes[k], NOVO_VALOR: diff.depois[k]
    };
  }));
  return { criado: false, alterados: Object.keys(diff.depois) };
}

function salvarHorarioDoFuncionario(idFuncionario, horarios) {
  return executarComTrava(function () {
    const pessoa = buscarFuncionarioPorId(idFuncionario);
    if (!pessoa) throw new Error('[Horário] Funcionário não encontrado: ' + idFuncionario);
    return gravarHorarioDoFuncionario(pessoa, normalizarHorariosDaSemana(horarios));
  });
}

/** Aplica o MESMO horário a várias pessoas. Valida tudo antes de gravar qualquer uma. */
function aplicarHorarioAVarios(idsFuncionarios, horarios) {
  return executarComTrava(function () {
    const normalizados = normalizarHorariosDaSemana(horarios);
    const pessoas = (idsFuncionarios || []).map(function (id) {
      const pessoa = buscarFuncionarioPorId(id);
      if (!pessoa) throw new Error('[Horário] Funcionário não encontrado: ' + id);
      return pessoa;
    });
    if (!pessoas.length) throw new Error('[Horário] Nenhum funcionário informado.');
    let alterados = 0;
    pessoas.forEach(function (pessoa) {
      const r = gravarHorarioDoFuncionario(pessoa, normalizados);
      if (r.criado || r.alterados.length) alterados++;
    });
    return { total: pessoas.length, alterados: alterados };
  });
}
function minutosDoHorario(hhmm) {
  const p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

/** O turno pode ser usado por esse vínculo? Manhã+Tarde só Estágio; Integral só PSS e Cargo; Manhã e Tarde, todos. */
function turnoPermitidoParaVinculo(turno, vinculo) {
  const J = CONFIG.JORNADA;
  if (turno === J.TURNO_MANHA_TARDE) return J.VINCULOS_MANHA_TARDE.indexOf(vinculo) >= 0;
  if (turno === J.TURNO_INTEGRAL) return J.VINCULOS_INTEGRAL.indexOf(vinculo) >= 0;
  return true;
}

/** Minutos de almoço: PSS e Cargo sempre 60; Estágio 30 só no dia Manhã+Tarde; demais 0. */
function minutosDeAlmoco(vinculo, turno) {
  const J = CONFIG.JORNADA;
  if (J.ALMOCO_MIN_POR_VINCULO[vinculo] !== undefined) return J.ALMOCO_MIN_POR_VINCULO[vinculo];
  if (J.VINCULOS_MANHA_TARDE.indexOf(vinculo) >= 0 && turno === J.TURNO_MANHA_TARDE) return J.ALMOCO_MIN_ESTAGIO_MANHA_TARDE;
  return 0;
}

/**
 * Jornada de um dia, a partir dos dados reais da pessoa (função pura).
 * vinculo: 'Estágio' | 'PSS' | 'Cargo'; turno: turno da Distribuição no dia (ou vazio);
 * de/ate: horário cadastrado em Horários no dia ("HH:mm" ou vazio).
 * Sem horário cadastrado, só o turno Integral tem horário padrão (08:00–17:00).
 * Retorna null quando não há como saber o horário; senão
 * { de, ate, almocoMin, jornadaMin, origem: 'Horários' | 'Padrão do turno Integral' }.
 */
function calcularJornadaDoDia(vinculo, turno, de, ate) {
  const J = CONFIG.JORNADA;
  let ini = valorVazio(de) ? '' : normalizarHorario(de);
  let fim = valorVazio(ate) ? '' : normalizarHorario(ate);
  let origem = 'Horários';
  if (!ini || !fim) {
    if (turno !== J.TURNO_INTEGRAL) return null;
    ini = J.HORARIO_INTEGRAL.DE;
    fim = J.HORARIO_INTEGRAL.ATE;
    origem = 'Padrão do turno Integral';
  }
  const almoco = minutosDeAlmoco(vinculo, turno);
  const bruto = minutosDoHorario(fim) - minutosDoHorario(ini);
  return { de: ini, ate: fim, almocoMin: almoco, jornadaMin: Math.max(0, bruto - almoco), origem: origem };
}
