/**
 * FeriasRepository.gs — períodos de férias (aba Férias) e preferências (aba Preferências).
 * Nunca apaga registros: férias já realizadas são preservadas.
 */
function listarFerias() {
  return listarRegistros('FERIAS');
}

function listarFeriasDoContrato(idContrato) {
  const alvo = String(idContrato).trim();
  return listarFerias().filter(function (r) { return String(r.ID_CONTRATO).trim() === alvo; });
}

function listarFeriasDoFuncionario(idFuncionario) {
  const alvo = String(idFuncionario).trim();
  return listarFerias().filter(function (r) { return String(r.ID_FUNCIONARIO).trim() === alvo; });
}

/** Usado para evitar período duplicado (mesmo contrato + mesmo 1º/2º). */
function buscarPeriodoDeFerias(idContrato, periodo) {
  return listarFeriasDoContrato(idContrato).find(function (r) {
    return String(r.PERIODO).trim() === String(periodo).trim();
  }) || null;
}

function inserirFerias(registros) {
  return inserirRegistros('FERIAS', registros);
}

function atualizarPeriodoDeFerias(numeroLinha, campos) {
  return atualizarRegistro('FERIAS', numeroLinha, campos);
}

// ---- Preferências ----
function listarPreferencias() {
  return listarRegistros('PREFERENCIAS');
}

function buscarPreferenciaDoContrato(idContrato) {
  const alvo = String(idContrato).trim();
  return listarPreferencias().find(function (r) { return String(r.ID_CONTRATO).trim() === alvo; }) || null;
}

function inserirPreferencias(registros) {
  return inserirRegistros('PREFERENCIAS', registros);
}

function atualizarPreferencia(numeroLinha, campos) {
  return atualizarRegistro('PREFERENCIAS', numeroLinha, campos);
}