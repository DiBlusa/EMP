/**
 * PlanilhaUtils.gs — acesso genérico às abas: colunas localizadas pelo CABEÇALHO,
 * leitura/gravação em lote e trava. Os Repositories usam só estas funções.
 * Registros são objetos com as chaves de CONFIG.COLUNAS (ex.: ID_CONTRATO) mais _linha.
 */
// a planilha ativa é guardada durante a execução (evita chamar o serviço a cada leitura)
let planilhaEmCache = null;

function obterPlanilha() {
  if (planilhaEmCache) return planilhaEmCache;
  const p = SpreadsheetApp.getActiveSpreadsheet();
  if (!p) throw new Error('[PlanilhaUtils] Nenhuma planilha ativa. Use o script vinculado à planilha do sistema.');
  planilhaEmCache = p;
  return p;
}

function obterAbaPorChave(chave) {
  const nome = CONFIG.ABAS[chave];
  if (!nome) throw new Error('[PlanilhaUtils] Aba desconhecida: ' + chave);
  const aba = obterPlanilha().getSheetByName(nome);
  if (!aba) throw new Error('[PlanilhaUtils] A aba "' + nome + '" não foi encontrada.');
  return aba;
}

function obterColunasDaAba(chave) {
  const colunas = CONFIG.COLUNAS[chave];
  if (!colunas) throw new Error('[PlanilhaUtils] Sem definição de colunas para: ' + chave);
  return colunas;
}

/** Localiza cada coluna pelo texto do cabeçalho. Falha listando os cabeçalhos ausentes. */
/** Localiza as colunas a partir de uma linha de cabeçalho já lida. */
function mapearColunasDoCabecalho(linhaDoCabecalho, colunas, nomeDaAba) {
  const porTexto = {};
  linhaDoCabecalho.forEach(function (t, i) {
    const k = normalizarTexto(t);
    if (k && !(k in porTexto)) porTexto[k] = i;
  });
  const indices = {};
  const ausentes = [];
  Object.keys(colunas).forEach(function (chave) {
    const i = porTexto[normalizarTexto(colunas[chave])];
    if (i === undefined) ausentes.push(colunas[chave]); else indices[chave] = i;
  });
  if (ausentes.length) {
    const nome = typeof nomeDaAba === 'function' ? nomeDaAba() : nomeDaAba; // o nome só é consultado se houver erro
    throw new Error('[PlanilhaUtils] Cabeçalhos ausentes na aba "' + nome + '": ' + ausentes.join(', '));
  }
  return { indices: indices, largura: linhaDoCabecalho.length };
}

/** Localiza cada coluna pelo texto do cabeçalho. Falha listando os cabeçalhos ausentes. */
function mapearColunasPorCabecalho(aba, colunas) {
  const largura = aba.getLastColumn();
  if (largura < 1) throw new Error('[PlanilhaUtils] A aba "' + aba.getName() + '" está vazia (sem cabeçalho).');
  const linha = aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, largura).getValues()[0];
  return mapearColunasDoCabecalho(linha, colunas, function () { return aba.getName(); });
}

function valoresSaoIguais(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  const na = (a === null || a === undefined) ? '' : String(a);
  const nb = (b === null || b === undefined) ? '' : String(b);
  return na === nb;
}

/** Lê todos os registros em uma única chamada. Linhas totalmente vazias são ignoradas. */
function lerRegistrosDaAba(aba, colunas) {
  const todos = aba.getDataRange().getValues(); // uma única leitura: cabeçalho + dados
  const mapa = mapearColunasDoCabecalho(todos[CONFIG.LINHA_CABECALHO - 1] || [], colunas, function () { return aba.getName(); });
  const registros = [];
  for (let i = CONFIG.LINHA_CABECALHO; i < todos.length; i++) {
    const linha = todos[i];
    const vazia = linha.every(function (c) { return c === '' || c === null; });
    if (vazia) continue;
    const reg = { _linha: i + 1 };
    Object.keys(mapa.indices).forEach(function (k) { reg[k] = linha[mapa.indices[k]]; });
    registros.push(reg);
  }
  return registros;
}

function inserirRegistrosNaAba(aba, colunas, registros, formatos) {
  if (!registros || !registros.length) return [];
  const mapa = mapearColunasPorCabecalho(aba, colunas);
  const matriz = registros.map(function (r) {
    const linha = new Array(mapa.largura).fill('');
    Object.keys(mapa.indices).forEach(function (k) {
      if (r[k] !== undefined && r[k] !== null) linha[mapa.indices[k]] = r[k];
    });
    return linha;
  });
  const inicio = Math.max(aba.getLastRow(), CONFIG.LINHA_CABECALHO) + 1;
  const fim = inicio + matriz.length - 1;
  if (aba.getMaxRows() < fim) aba.insertRowsAfter(aba.getMaxRows(), fim - aba.getMaxRows());
  // o formato vem antes dos valores: com formato de texto ("@"), "08:00" não vira hora do Sheets
  Object.keys(formatos || {}).forEach(function (k) {
    if (mapa.indices[k] !== undefined) {
      aba.getRange(inicio, mapa.indices[k] + 1, matriz.length, 1).setNumberFormat(formatos[k]);
    }
  });
  aba.getRange(inicio, 1, matriz.length, mapa.largura).setValues(matriz);
  return matriz.map(function (_, i) { return inicio + i; });
}

/**
 * Atualiza só os campos informados (não reescreve a linha inteira, preservando fórmulas).
 * Retorna { antes, depois } apenas com os campos que realmente mudaram (útil para o Histórico).
 */
function atualizarRegistroNaAba(aba, colunas, numeroLinha, campos, formatos) {
  if (numeroLinha <= CONFIG.LINHA_CABECALHO || numeroLinha > aba.getLastRow()) {
    throw new Error('[PlanilhaUtils] Linha inválida para atualização: ' + numeroLinha);
  }
  const mapa = mapearColunasPorCabecalho(aba, colunas);
  const atuais = aba.getRange(numeroLinha, 1, 1, mapa.largura).getValues()[0];
  const antes = {};
  const depois = {};
  Object.keys(campos).forEach(function (k) {
    if (campos[k] === undefined) return;
    if (mapa.indices[k] === undefined) throw new Error('[PlanilhaUtils] Campo desconhecido: ' + k);
    const novo = campos[k] === null ? '' : campos[k];
    const atual = atuais[mapa.indices[k]];
    if (valoresSaoIguais(atual, novo)) return;
    const celula = aba.getRange(numeroLinha, mapa.indices[k] + 1);
    if (formatos && formatos[k]) celula.setNumberFormat(formatos[k]);
    celula.setValue(novo);
    antes[k] = atual;
    depois[k] = novo;
  });
  return { antes: antes, depois: depois };
}

// Atalhos por chave de aba (usados pelos Repositories)
function listarRegistros(chave) {
  return lerRegistrosDaAba(obterAbaPorChave(chave), obterColunasDaAba(chave));
}

function inserirRegistros(chave, registros) {
  return inserirRegistrosNaAba(obterAbaPorChave(chave), obterColunasDaAba(chave),
    registros, CONFIG.COLUNAS_FORMATO[chave]);
}

function atualizarRegistro(chave, numeroLinha, campos) {
  return atualizarRegistroNaAba(obterAbaPorChave(chave), obterColunasDaAba(chave),
    numeroLinha, campos, CONFIG.COLUNAS_FORMATO[chave]);
}

/** Executa a função com trava de script; libera a trava mesmo em caso de erro. */
function executarComTrava(funcao) {
  const trava = LockService.getScriptLock();
  try {
    trava.waitLock(CONFIG.TRAVA_ESPERA_MS);
  } catch (e) {
    throw new Error('[PlanilhaUtils] Sistema ocupado: não foi possível obter a trava. Tente novamente em instantes.');
  }
  try {
    return funcao();
  } finally {
    SpreadsheetApp.flush();
    trava.releaseLock();
  }
}