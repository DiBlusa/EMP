/**
 * FuncionarioRepository.gs — visão por PESSOA (ID_FUNCIONARIO) sobre a aba Funcionários.
 * Reaproveita o ContratoRepository: a escrita de linhas passa por ele.
 */
/** Pessoas distintas, cada uma com a lista de seus contratos. */
function listarFuncionarios() {
  const mapa = {};
  const ordem = [];
  listarContratos().forEach(function (c) {
    const id = String(c.ID_FUNCIONARIO).trim();
    if (!id) return;
    if (!mapa[id]) {
      mapa[id] = { ID_FUNCIONARIO: id, NOME: c.NOME, contratos: [] };
      ordem.push(id);
    }
    mapa[id].contratos.push(c);
  });
  return ordem.map(function (id) { return mapa[id]; });
}

function buscarFuncionarioPorId(idFuncionario) {
  const alvo = String(idFuncionario).trim();
  return listarFuncionarios().find(function (p) { return p.ID_FUNCIONARIO === alvo; }) || null;
}

/** Compara nomes sem acento, caixa ou espaços extras. */
function buscarFuncionariosPorNome(nome) {
  const alvo = chaveDoNome(nome);
  return listarFuncionarios().filter(function (p) {
    return chaveDoNome(p.NOME) === alvo;
  });
}

function listarIdsDeFuncionario() {
  return listarContratos().map(function (r) { return r.ID_FUNCIONARIO; }).filter(Boolean);
}

function gerarProximoIdFuncionario() {
  return proximoIdFuncionario(listarIdsDeFuncionario());
}