/**
 * DistribuicaoRepository.gs — distribuição do balcão (aba Distribuição).
 */
function listarDistribuicao() {
  return listarRegistros('DISTRIBUICAO');
}

function buscarDistribuicaoDoFuncionario(idFuncionario) {
  const alvo = String(idFuncionario).trim();
  return listarDistribuicao().find(function (r) { return String(r.ID_FUNCIONARIO).trim() === alvo; }) || null;
}

function inserirDistribuicao(registros) {
  return inserirRegistros('DISTRIBUICAO', registros);
}

function atualizarDistribuicao(numeroLinha, campos) {
  return atualizarRegistro('DISTRIBUICAO', numeroLinha, campos);
}