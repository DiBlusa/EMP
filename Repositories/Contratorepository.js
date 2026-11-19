/**
 * ContratoRepository.gs — leitura e gravação de CONTRATOS (uma linha por contrato na aba Funcionários).
 * Só acessa a planilha; regras de negócio ficam nos Services.
 */
function listarContratos() {
  return listarRegistros('FUNCIONARIOS');
}

function buscarContratoPorId(idContrato) {
  const alvo = String(idContrato).trim();
  return listarContratos().find(function (r) { return String(r.ID_CONTRATO).trim() === alvo; }) || null;
}

function listarContratosDoFuncionario(idFuncionario) {
  const alvo = String(idFuncionario).trim();
  return listarContratos().filter(function (r) { return String(r.ID_FUNCIONARIO).trim() === alvo; });
}

function listarIdsDeContrato() {
  return listarContratos().map(function (r) { return r.ID_CONTRATO; }).filter(Boolean);
}

function gerarProximoIdContrato() {
  return proximoIdContrato(listarIdsDeContrato());
}

function inserirContratos(registros) {
  return inserirRegistros('FUNCIONARIOS', registros);
}

/** Retorna { antes, depois } com os campos alterados. */
function atualizarContrato(numeroLinha, campos) {
  return atualizarRegistro('FUNCIONARIOS', numeroLinha, campos);
}