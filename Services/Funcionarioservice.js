/**
 * FuncionarioService.gs — regras de negócio da PESSOA: cadastro, novo vínculo e alteração de nome.
 * Funcionário (ID_FUNCIONARIO) e contrato (ID_CONTRATO) são entidades diferentes: a pessoa é uma só,
 * os contratos ao longo do tempo são vários.
 */

function normalizarNomeCompleto(nome) {
  const limpo = String(nome === null || nome === undefined ? '' : nome).replace(/\s+/g, ' ').trim();
  if (limpo.split(' ').length < 2) throw new Error('[Funcionário] Informe o nome completo (nome e sobrenome).');
  return limpo;
}

/** Cadastra a pessoa e o primeiro contrato. Dados: NOME, VINCULO, INICIO, FIM, CARGO, SETOR, OBSERVACOES. */
function cadastrarFuncionario(dados) {
  return executarComTrava(function () {
    const nome = normalizarNomeCompleto(dados.NOME);
    const existentes = buscarFuncionariosPorNome(nome);
    if (existentes.length) {
      throw new Error('[Funcionário] "' + nome + '" já está cadastrado(a) (' + existentes[0].ID_FUNCIONARIO +
        '). Para um novo vínculo, use renovar contrato.');
    }
    const d = normalizarDadosDoContrato(dados);
    validarDadosDoContrato(d);
    const idFuncionario = gerarProximoIdFuncionario();
    const contrato = inserirNovoContrato(idFuncionario, nome, dados);
    registrarHistorico({
      ID_FUNCIONARIO: idFuncionario, ID_CONTRATO: contrato.ID_CONTRATO, OPERACAO: CONFIG.OPERACOES.CADASTRO,
      CAMPO: 'Funcionário', NOVO_VALOR: nome
    });
    return { ID_FUNCIONARIO: idFuncionario, ID_CONTRATO: contrato.ID_CONTRATO };
  });
}

/** Novo contrato para quem já está cadastrado e NÃO tem contrato Ativo/Suspenso (ex.: volta depois de sair). */
function adicionarContratoAoFuncionario(idFuncionario, dados) {
  return executarComTrava(function () {
    const pessoa = buscarFuncionarioPorId(idFuncionario);
    if (!pessoa) throw new Error('[Funcionário] Funcionário não encontrado: ' + idFuncionario);
    const emAberto = pessoa.contratos.filter(function (c) { return c.STATUS !== CONFIG.STATUS_CONTRATO.ENCERRADO; });
    if (emAberto.length) {
      throw new Error('[Funcionário] ' + pessoa.NOME + ' já tem contrato ' + emAberto[0].STATUS + ' (' +
        emAberto[0].ID_CONTRATO + '). Use renovar contrato ou desative o atual primeiro.');
    }
    const contrato = inserirNovoContrato(pessoa.ID_FUNCIONARIO, pessoa.NOME, dados);
    registrarHistorico({
      ID_FUNCIONARIO: pessoa.ID_FUNCIONARIO, ID_CONTRATO: contrato.ID_CONTRATO, OPERACAO: CONFIG.OPERACOES.CADASTRO,
      CAMPO: 'Contrato', NOVO_VALOR: contrato.ID_CONTRATO
    });
    return { ID_FUNCIONARIO: pessoa.ID_FUNCIONARIO, ID_CONTRATO: contrato.ID_CONTRATO };
  });
}

/** Atualiza o nome nas abas que repetem o nome (vínculo é pelo ID). Retorna quantas linhas mudaram. */
function atualizarNomeNasOutrasAbas(idFuncionario, novoNome) {
  let total = 0;
  [
    { listar: listarFerias, atualizar: atualizarPeriodoDeFerias },
    { listar: listarPreferencias, atualizar: atualizarPreferencia },
    { listar: listarHorarios, atualizar: atualizarHorario },
    { listar: listarDistribuicao, atualizar: atualizarDistribuicao }
  ].forEach(function (aba) {
    aba.listar().forEach(function (r) {
      if (String(r.ID_FUNCIONARIO).trim() === idFuncionario && r.NOME !== novoNome) {
        aba.atualizar(r._linha, { NOME: novoNome });
        total++;
      }
    });
  });
  return total;
}

function alterarNomeDoFuncionario(idFuncionario, novoNome) {
  return executarComTrava(function () {
    const pessoa = buscarFuncionarioPorId(idFuncionario);
    if (!pessoa) throw new Error('[Funcionário] Funcionário não encontrado: ' + idFuncionario);
    const nome = normalizarNomeCompleto(novoNome);
    const outros = buscarFuncionariosPorNome(nome).filter(function (p) { return p.ID_FUNCIONARIO !== pessoa.ID_FUNCIONARIO; });
    if (outros.length) throw new Error('[Funcionário] Já existe outro funcionário com o nome "' + nome + '" (' + outros[0].ID_FUNCIONARIO + ').');
    if (pessoa.NOME === nome) return { ID_FUNCIONARIO: idFuncionario, alterado: false };
    pessoa.contratos.forEach(function (c) { atualizarContrato(c._linha, { NOME: nome }); });
    const outrasAbas = atualizarNomeNasOutrasAbas(idFuncionario, nome);
    registrarHistorico({
      ID_FUNCIONARIO: idFuncionario, OPERACAO: CONFIG.OPERACOES.ALTERACAO,
      CAMPO: 'Nome completo', VALOR_ANTERIOR: pessoa.NOME, NOVO_VALOR: nome
    });
    return { ID_FUNCIONARIO: idFuncionario, alterado: true, linhasEmOutrasAbas: outrasAbas };
  });
}

/**
 * Alinha o texto do nome em Férias, Preferências, Horários e Distribuição ao nome do contrato
 * (o vínculo entre as abas já é pelo ID). Com simular = true só lista o que mudaria.
 */
function sincronizarNomesComOsContratos(simular) {
  return executarComTrava(function () {
    const nomePorId = {};
    listarFuncionarios().forEach(function (p) { nomePorId[String(p.ID_FUNCIONARIO).trim()] = p.NOME; });
    const abas = [
      { rotulo: 'Férias', listar: listarFerias, atualizar: atualizarPeriodoDeFerias },
      { rotulo: 'Preferências', listar: listarPreferencias, atualizar: atualizarPreferencia },
      { rotulo: 'Horários', listar: listarHorarios, atualizar: atualizarHorario },
      { rotulo: 'Distribuição', listar: listarDistribuicao, atualizar: atualizarDistribuicao }
    ];
    const resultado = { simulado: !!simular, linhas: [] };
    const antigosPorPessoa = {};
    abas.forEach(function (aba) {
      aba.listar().forEach(function (r) {
        const id = String(r.ID_FUNCIONARIO).trim();
        const certo = nomePorId[id];
        if (!certo || r.NOME === certo) return;
        resultado.linhas.push(aba.rotulo + ' linha ' + r._linha + ': "' + r.NOME + '" -> "' + certo + '"');
        (antigosPorPessoa[id] = antigosPorPessoa[id] || {})[r.NOME] = true;
        if (!simular) aba.atualizar(r._linha, { NOME: certo });
      });
    });
    if (!simular) {
      Object.keys(antigosPorPessoa).forEach(function (id) {
        registrarHistorico({
          ID_FUNCIONARIO: id, OPERACAO: CONFIG.OPERACOES.ALTERACAO, CAMPO: 'Nome completo (alinhado ao contrato)',
          VALOR_ANTERIOR: Object.keys(antigosPorPessoa[id]).join(' | '), NOVO_VALOR: nomePorId[id]
        });
      });
    }
    return resultado;
  });
}
/** Vínculo vigente da pessoa: o do contrato Ativo; sem Ativo, o do último contrato. Vazio se não houver contrato. */
function vinculoAtualDoFuncionario(pessoa) {
  const contratos = (pessoa && pessoa.contratos) || [];
  const ativo = contratos.filter(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.ATIVO; })[0];
  const contrato = ativo || contratos[contratos.length - 1];
  return contrato ? String(contrato.VINCULO).trim() : '';
}
