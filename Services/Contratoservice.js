/**
 * ContratoService.gs — regras de negócio dos CONTRATOS (cadastro de contrato, alteração,
 * suspensão, reativação, desativação e renovação). Só usa Repositories e Utils.
 * Cada operação roda dentro de executarComTrava() e grava no Histórico.
 *
 * Situações permitidas:
 *   Ativo -> Suspenso (suspenderContrato)      Suspenso -> Ativo (reativarContrato)
 *   Ativo/Suspenso -> Encerrado (encerrarContrato, com data de desligamento)
 *   Encerrado é definitivo; um novo vínculo é um NOVO contrato (renovarContrato).
 */

/* ===================== FÓRMULA DA COLUNA DURAÇÃO ===================== */

/** Separador de argumentos das fórmulas conforme o idioma da planilha (pt_BR usa ";"). */
function obterSeparadorDeFormulas() {
  const local = obterPlanilha().getSpreadsheetLocale();
  return /^(pt|es|de|fr|it|nl|ru|tr|pl)/i.test(local) ? ';' : ',';
}

/**
 * Duração como fórmula (como na planilha antiga): fim - início + 1, vazio se faltar data.
 * Usa o separador do idioma da planilha; se der erro, tenta o outro e confere o resultado.
 */
function aplicarFormulaDeDuracao(aba, linhas) {
  if (!linhas.length) return;
  const mapa = mapearColunasPorCabecalho(aba, CONFIG.COLUNAS.FUNCIONARIOS);
  const a = mapa.indices.INICIO - mapa.indices.DURACAO;
  const b = mapa.indices.FIM - mapa.indices.DURACAO;
  const faixa = aba.getRange(linhas[0], mapa.indices.DURACAO + 1, linhas.length, 1);
  const montar = function (s) {
    return '=IF(AND(ISNUMBER(RC[' + a + '])' + s + 'ISNUMBER(RC[' + b + ']))' + s + 'RC[' + b + ']-RC[' + a + ']+1' + s + '"")';
  };
  const tentar = function (s) {
    try {
      faixa.setFormulasR1C1(linhas.map(function () { return [montar(s)]; }));
      SpreadsheetApp.flush();
      return faixa.getDisplayValues().every(function (r) { return String(r[0]).charAt(0) !== '#'; });
    } catch (e) {
      return false;
    }
  };
  const preferido = obterSeparadorDeFormulas();
  const alternativo = preferido === ';' ? ',' : ';';
  if (!tentar(preferido) && !tentar(alternativo)) {
    throw new Error('[Migracao] Não consegui gravar a fórmula de Duração (nenhum separador de fórmulas funcionou).');
  }
}

/** Reaplica a fórmula de Duração em todas as linhas da aba Funcionários (só mexe nessa coluna). */
function corrigirFormulaDeDuracao() {
  const aba = obterAbaPorChave('FUNCIONARIOS');
  const ultima = aba.getLastRow();
  if (ultima <= CONFIG.LINHA_CABECALHO) return 'Nenhuma linha em Funcionários.';
  const linhas = [];
  for (let r = CONFIG.LINHA_CABECALHO + 1; r <= ultima; r++) linhas.push(r);
  aplicarFormulaDeDuracao(aba, linhas);
  const texto = 'Fórmula de Duração aplicada em ' + linhas.length + ' linhas.';
  Logger.log(texto);
  return texto;
}

/* ===================== VALIDAÇÃO E MONTAGEM ===================== */

function obterContratoOuErro(idContrato) {
  const contrato = buscarContratoPorId(idContrato);
  if (!contrato) throw new Error('[Contrato] Contrato não encontrado: ' + idContrato);
  return contrato;
}

/** Converte os dados informados para os tipos certos (Date ou vazio) e valida o vínculo. */
function normalizarDadosDoContrato(dados) {
  const texto = function (v) { return valorVazio(v) ? '' : String(v).trim(); };
  const data = function (v, rotulo) {
    if (valorVazio(v)) return '';
    const d = converterData(v);
    if (!d) throw new Error('[Contrato] ' + rotulo + ' inválido: "' + v + '". Use dd/MM/aaaa.');
    return d;
  };
  const saida = {
    VINCULO: texto(dados.VINCULO), CARGO: texto(dados.CARGO), SETOR: texto(dados.SETOR),
    INICIO: data(dados.INICIO, 'Início do contrato'), FIM: data(dados.FIM, 'Fim do contrato'),
    OBSERVACOES: texto(dados.OBSERVACOES)
  };
  const canonico = CONFIG.TIPOS_VINCULO.filter(function (t) { return chaveDoNome(t) === chaveDoNome(saida.VINCULO); })[0];
  if (!canonico) {
    throw new Error('[Contrato] Tipo de vínculo inválido: "' + saida.VINCULO + '". Valores aceitos: ' + CONFIG.TIPOS_VINCULO.join(', '));
  }
  saida.VINCULO = canonico;
  return saida;
}

function validarDadosDoContrato(d) {
  const temInicio = d.INICIO !== '';
  const temFim = d.FIM !== '';
  if (temInicio !== temFim) throw new Error('[Contrato] Informe início e fim do contrato, ou deixe os dois em branco.');
  if (temInicio) validarIntervaloDeDatas(d.INICIO, d.FIM, 'Contrato');
  if (CONFIG.CARGOS.length && d.CARGO) exigirNaLista(d.CARGO, CONFIG.CARGOS, 'Cargo');
  if (CONFIG.SETORES.length && d.SETOR) exigirNaLista(d.SETOR, CONFIG.SETORES, 'Setor');
}

function montarRegistroDoContrato(idFuncionario, nome, d, idContrato) {
  return {
    ID_CONTRATO: idContrato, ID_FUNCIONARIO: idFuncionario, NOME: nome,
    CARGO: d.CARGO, SETOR: d.SETOR, VINCULO: d.VINCULO, INICIO: d.INICIO, FIM: d.FIM,
    DURACAO: '', STATUS: CONFIG.STATUS_CONTRATO.ATIVO, DESLIGAMENTO: '', OBSERVACOES: d.OBSERVACOES
  };
}

function acrescentarObservacao(atual, nova) {
  const linha = '[' + formatarData(hojeNormalizado()) + '] ' + nova;
  return valorVazio(atual) ? linha : String(atual).trim() + ' | ' + linha;
}

/** Datas comparam por dia; textos por conteúdo. */
function campoDoContratoMudou(atual, novo) {
  if (novo instanceof Date) return compararDatas(atual, novo) !== 0;
  return String(atual === null || atual === undefined ? '' : atual).trim() !== String(novo);
}

/* ===================== OPERAÇÕES (todas dentro da trava, exceto inserirNovoContrato) ===================== */

/** Insere o contrato e aplica a fórmula de Duração. Chamar DENTRO da trava. Retorna o registro com _linha. */
function inserirNovoContrato(idFuncionario, nome, dados) {
  const d = normalizarDadosDoContrato(dados);
  validarDadosDoContrato(d);
  const repetido = listarContratosDoFuncionario(idFuncionario).some(function (c) {
    return d.INICIO !== '' && compararDatas(c.INICIO, d.INICIO) === 0 && compararDatas(c.FIM, d.FIM) === 0;
  });
  if (repetido) throw new Error('[Contrato] Esse funcionário já tem um contrato com o mesmo período.');
  const registro = montarRegistroDoContrato(idFuncionario, nome, d, gerarProximoIdContrato());
  const linhas = inserirContratos([registro]);
  aplicarFormulaDeDuracao(obterAbaPorChave('FUNCIONARIOS'), linhas);
  registro._linha = linhas[0];
  return registro;
}

/** Muda status (e campos extras), grava nota nas Observações e registra no Histórico. */
function trocarStatusDoContrato(contrato, novoStatus, operacao, camposExtras, nota) {
  const campos = { STATUS: novoStatus };
  Object.keys(camposExtras || {}).forEach(function (k) { campos[k] = camposExtras[k]; });
  if (nota) campos.OBSERVACOES = acrescentarObservacao(contrato.OBSERVACOES, nota);
  const diff = atualizarContrato(contrato._linha, campos);
  registrarAlteracaoNoHistorico(operacao, contrato.ID_FUNCIONARIO, contrato.ID_CONTRATO, diff);
  return diff;
}

function alterarDadosDoContrato(idContrato, campos) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    const chaves = Object.keys(campos || {});
    if (!chaves.length) throw new Error('[Contrato] Nenhum campo informado para alterar.');
    chaves.forEach(function (k) {
      if (CONFIG.CAMPOS_EDITAVEIS_CONTRATO.indexOf(k) < 0) {
        throw new Error('[Contrato] Campo não editável: ' + k + '. O status muda só por suspender, reativar, desativar ou renovar.');
      }
    });
    const proposto = {};
    CONFIG.CAMPOS_EDITAVEIS_CONTRATO.forEach(function (k) { proposto[k] = contrato[k]; });
    chaves.forEach(function (k) { proposto[k] = campos[k]; });
    const d = normalizarDadosDoContrato(proposto);
    validarDadosDoContrato(d);
    const novos = {};
    chaves.forEach(function (k) { if (campoDoContratoMudou(contrato[k], d[k])) novos[k] = d[k]; });
    if (!Object.keys(novos).length) return { ID_CONTRATO: contrato.ID_CONTRATO, alterados: [] };
    const diff = atualizarContrato(contrato._linha, novos);
    registrarAlteracaoNoHistorico(CONFIG.OPERACOES.ALTERACAO, contrato.ID_FUNCIONARIO, contrato.ID_CONTRATO, diff);
    return { ID_CONTRATO: contrato.ID_CONTRATO, alterados: Object.keys(diff.depois) };
  });
}

function suspenderContrato(idContrato, motivo) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    if (contrato.STATUS !== CONFIG.STATUS_CONTRATO.ATIVO) {
      throw new Error('[Contrato] Só é possível suspender contrato Ativo. Status atual: ' + contrato.STATUS + '.');
    }
    trocarStatusDoContrato(contrato, CONFIG.STATUS_CONTRATO.SUSPENSO, CONFIG.OPERACOES.SUSPENSAO, {},
      'Suspenso' + (valorVazio(motivo) ? '' : ': ' + String(motivo).trim()));
    return { ID_CONTRATO: contrato.ID_CONTRATO, STATUS: CONFIG.STATUS_CONTRATO.SUSPENSO };
  });
}

function reativarContrato(idContrato) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    if (contrato.STATUS !== CONFIG.STATUS_CONTRATO.SUSPENSO) {
      throw new Error('[Contrato] Só é possível reativar contrato Suspenso. Status atual: ' + contrato.STATUS + '.');
    }
    trocarStatusDoContrato(contrato, CONFIG.STATUS_CONTRATO.ATIVO, CONFIG.OPERACOES.REATIVACAO, {}, 'Reativado');
    return { ID_CONTRATO: contrato.ID_CONTRATO, STATUS: CONFIG.STATUS_CONTRATO.ATIVO };
  });
}

/** Encerra o contrato (definitivo). Sem data informada, usa hoje. O "Fim do contrato" não é alterado. */
function encerrarContrato(idContrato, dataDesligamento, motivo) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    if (contrato.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO) {
      throw new Error('[Contrato] Esse contrato já está Encerrado.');
    }
    const data = valorVazio(dataDesligamento) ? hojeNormalizado() : converterData(dataDesligamento);
    if (!data) throw new Error('[Contrato] Data de desligamento inválida: "' + dataDesligamento + '". Use dd/MM/aaaa.');
    if (contrato.INICIO !== '' && compararDatas(data, contrato.INICIO) < 0) {
      throw new Error('[Contrato] A data de desligamento é anterior ao início do contrato (' + formatarData(contrato.INICIO) + ').');
    }
    trocarStatusDoContrato(contrato, CONFIG.STATUS_CONTRATO.ENCERRADO, CONFIG.OPERACOES.DESATIVACAO,
      { DESLIGAMENTO: data }, 'Desativado' + (valorVazio(motivo) ? '' : ': ' + String(motivo).trim()));
    return { ID_CONTRATO: contrato.ID_CONTRATO, STATUS: CONFIG.STATUS_CONTRATO.ENCERRADO, DESLIGAMENTO: formatarData(data) };
  });
}

/**
 * Renovação: cria um contrato NOVO para a mesma pessoa e encerra o anterior (que fica guardado).
 * Vínculo, cargo e setor repetem o anterior se não forem informados; as datas são obrigatórias
 * quando o vínculo tem datas.
 */
function renovarContrato(idContratoAnterior, dadosNovoContrato) {
  return executarComTrava(function () {
    const anterior = obterContratoOuErro(idContratoAnterior);
    const informado = dadosNovoContrato || {};
    const dados = {};
    ['VINCULO', 'CARGO', 'SETOR'].forEach(function (k) { dados[k] = valorVazio(informado[k]) ? anterior[k] : informado[k]; });
    ['INICIO', 'FIM', 'OBSERVACOES'].forEach(function (k) { dados[k] = informado[k]; });
    const novoD = normalizarDadosDoContrato(dados);
    if (novoD.INICIO !== '' && compararDatas(novoD.INICIO, anterior.FIM) < 0) {
      throw new Error('[Contrato] O novo contrato começa antes do fim do anterior (' + formatarData(anterior.FIM) + ').');
    }
    const novo = inserirNovoContrato(anterior.ID_FUNCIONARIO, anterior.NOME, dados);
    if (anterior.STATUS !== CONFIG.STATUS_CONTRATO.ENCERRADO) {
      trocarStatusDoContrato(anterior, CONFIG.STATUS_CONTRATO.ENCERRADO, CONFIG.OPERACOES.RENOVACAO, {},
        'Renovado: novo contrato ' + novo.ID_CONTRATO);
    }
    registrarHistorico({
      ID_FUNCIONARIO: anterior.ID_FUNCIONARIO, ID_CONTRATO: novo.ID_CONTRATO, OPERACAO: CONFIG.OPERACOES.RENOVACAO,
      CAMPO: 'Contrato', VALOR_ANTERIOR: anterior.ID_CONTRATO, NOVO_VALOR: novo.ID_CONTRATO
    });
    return { ID_FUNCIONARIO: anterior.ID_FUNCIONARIO, ID_CONTRATO_ANTERIOR: anterior.ID_CONTRATO, ID_CONTRATO_NOVO: novo.ID_CONTRATO };
  });
}