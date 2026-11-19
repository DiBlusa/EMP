/**
 * HistoricoRepository.gs — trilha de alterações (aba Histórico). Somente acrescenta registros.
 */
function obterUsuarioAtual() {
  try {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'sistema';
  } catch (e) {
    return 'sistema';
  }
}

function formatarValorDoHistorico(valor) {
  if (valor instanceof Date) return formatarData(valor);
  return (valor === null || valor === undefined) ? '' : valor;
}

/** Entrada: { ID_FUNCIONARIO, ID_CONTRATO, OPERACAO, CAMPO, VALOR_ANTERIOR, NOVO_VALOR }. Aceita lista. */
function registrarHistorico(entradas) {
  const lista = Array.isArray(entradas) ? entradas : [entradas];
  const agora = new Date();
  const usuario = obterUsuarioAtual();
  const registros = lista.map(function (e) {
    exigirCampos(e, ['OPERACAO'], 'HistoricoRepository');
    return {
      DATA_HORA: e.DATA_HORA || agora,
      USUARIO: e.USUARIO || usuario,
      ID_FUNCIONARIO: e.ID_FUNCIONARIO || '',
      ID_CONTRATO: e.ID_CONTRATO || '',
      OPERACAO: e.OPERACAO,
      CAMPO: e.CAMPO || '',
      VALOR_ANTERIOR: formatarValorDoHistorico(e.VALOR_ANTERIOR),
      NOVO_VALOR: formatarValorDoHistorico(e.NOVO_VALOR)
    };
  });
  return inserirRegistros('HISTORICO', registros);
}

/** Registra uma entrada por campo alterado, a partir do retorno { antes, depois } de atualizar(). */
function registrarAlteracaoNoHistorico(operacao, idFuncionario, idContrato, diff) {
  const campos = Object.keys(diff.depois || {});
  if (!campos.length) return [];
  return registrarHistorico(campos.map(function (k) {
    return {
      ID_FUNCIONARIO: idFuncionario,
      ID_CONTRATO: idContrato,
      OPERACAO: operacao,
      CAMPO: CONFIG.COLUNAS.FUNCIONARIOS[k] || CONFIG.COLUNAS.FERIAS[k] || k,
      VALOR_ANTERIOR: diff.antes[k],
      NOVO_VALOR: diff.depois[k]
    };
  }));
}

/** Filtros opcionais: { ID_FUNCIONARIO, ID_CONTRATO, OPERACAO }. */
function listarHistorico(filtros) {
  const f = filtros || {};
  return listarRegistros('HISTORICO').filter(function (r) {
    return Object.keys(f).every(function (k) { return String(r[k]).trim() === String(f[k]).trim(); });
  });
}