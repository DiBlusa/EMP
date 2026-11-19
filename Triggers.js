/**
 * Triggers.gs — automações programadas. Nesta etapa: apenas a AUDITORIA dos gatilhos existentes (somente leitura).
 * Os gatilhos novos entram na Etapa 3/6, sem duplicar os existentes.
 */

/** Lista os gatilhos do projeto no log: função, tipo de evento e origem. Não altera nada. */
function auditarGatilhos() {
  const gatilhos = ScriptApp.getProjectTriggers();
  const linhas = gatilhos.map(function (g) {
    return g.getHandlerFunction() + ' | evento: ' + g.getEventType() + ' | origem: ' + g.getTriggerSource();
  });
  const texto = linhas.length ? linhas.join('\n') : 'Nenhum gatilho encontrado neste projeto.';
  Logger.log('GATILHOS (' + gatilhos.length + '):\n' + texto);
  return linhas;
}

/** Remove os gatilhos do projeto que chamam a função informada. Retorna quantos foram removidos. */
function removerGatilhoPorNome(nomeFuncao) {
  let removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === nomeFuncao) {
      ScriptApp.deleteTrigger(g);
      removidos++;
    }
  });
  return removidos;
}

/** Alvo do gatilho diário: cria períodos que faltam e marca como Tirada o que já terminou. */
function executarRotinaDiariaDeFerias() {
  const r = sincronizarFeriasDosContratos(false);
  Logger.log(formatarResultadoDaRotinaDeFerias(r));
  atualizarConsultaSemErro();
  return r;
}

/** Mostra no log o que a rotina FARIA, sem gravar nada. */
function simularRotinaDeFerias() {
  const texto = formatarResultadoDaRotinaDeFerias(sincronizarFeriasDosContratos(true));
  Logger.log(texto);
  return texto;
}

function formatarResultadoDaRotinaDeFerias(r) {
  const linhas = [r.simulado ? 'SIMULAÇÃO (nada gravado)' : 'ROTINA DE FÉRIAS EXECUTADA'];
  const secao = function (titulo, lista) {
    linhas.push(titulo + ' (' + lista.length + ')' + (lista.length ? ':' : ''));
    lista.forEach(function (x) { linhas.push('  - ' + x); });
  };
  secao('Períodos 1º criados como Pendente', r.criados);
  secao('Previstas que viraram Tirada', r.tiradas);
  if (r.semVinculo.length) secao('Ignorados: a pessoa tem férias sem contrato vinculado', r.semVinculo);
  return linhas.join('\n');
}

/** Cria o gatilho diário se ainda não existir (nunca duplica). Retorna true se criou agora. */
function instalarGatilhoDiarioDeFerias() {
  const existe = ScriptApp.getProjectTriggers().some(function (g) {
    return g.getHandlerFunction() === 'executarRotinaDiariaDeFerias';
  });
  if (existe) return false;
  ScriptApp.newTrigger('executarRotinaDiariaDeFerias').timeBased().everyDays(1).atHour(CONFIG.FERIAS.HORA_ROTINA_DIARIA).create();
  return true;
}

/** Mostra no log quais períodos Pendente/Aguardando teriam as datas limpas. Não grava nada. */
function simularLimpezaDeDatasDeFerias() {
  const r = limparDatasDosPeriodosEmAberto(true);
  const texto = 'SIMULAÇÃO (nada gravado) — datas a limpar em períodos Pendente/Aguardando (' + r.total + ')' +
    (r.total ? ':\n  - ' + r.periodos.join('\n  - ') : '');
  Logger.log(texto);
  return texto;
}

/** Limpa de verdade (pede confirmação). Prevista e Tirada nunca são alteradas. */
function executarLimpezaDeDatasDeFerias() {
  const previa = limparDatasDosPeriodosEmAberto(true);
  if (!previa.total) {
    mostrarTextoNaJanela('Limpeza de datas', 'Nenhum período Pendente ou Aguardando tem datas. Nada a fazer.');
    return 'Nada a fazer.';
  }
  const pergunta = 'Remover início, fim e dias de ' + previa.total + ' período(s) Pendente/Aguardando?\n' +
    'Prevista e Tirada não são alteradas. O status não muda. Fica registrado no Histórico.';
  if (!pedirConfirmacaoDoUsuario('Limpeza de datas', pergunta)) return 'Cancelado.';
  const r = limparDatasDosPeriodosEmAberto(false);
  const texto = 'LIMPEZA EXECUTADA (' + r.total + ')\n  - ' + r.periodos.join('\n  - ');
  Logger.log(texto);
  mostrarTextoNaJanela('Limpeza de datas', 'Datas removidas em ' + r.total + ' período(s). A lista está em Execuções > Registros.');
  return texto;
}