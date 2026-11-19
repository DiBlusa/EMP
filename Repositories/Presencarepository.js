/**
 * PresencaRepository.gs — leitura e gravação dos REGISTROS de presença (aba Presença).
 * A aba é criada na primeira gravação. Um registro por funcionário por dia (ID_FUNCIONARIO + DATA).
 */

function abaDePresencaExiste() {
  return obterPlanilha().getSheetByName(CONFIG.ABAS.PRESENCA) !== null;
}

/** Cria a aba Presença (cabeçalho, formatos e lista suspensa de status) se ainda não existir. */
function garantirAbaDePresenca() {
  const planilha = obterPlanilha();
  const existente = planilha.getSheetByName(CONFIG.ABAS.PRESENCA);
  if (existente) {
    acrescentarColunasNovasDePresenca(existente);
    mapearColunasPorCabecalho(existente, CONFIG.COLUNAS.PRESENCA); // confere os cabeçalhos
    return existente;
  }
  const anterior = planilha.getActiveSheet();
  const aba = planilha.insertSheet(CONFIG.ABAS.PRESENCA, planilha.getNumSheets());
  const colunas = CONFIG.COLUNAS.PRESENCA;
  const cabecalho = Object.keys(colunas).map(function (k) { return colunas[k]; });
  aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold').setBackground('#e8eaed');
  aba.setFrozenRows(1);
  const mapa = mapearColunasPorCabecalho(aba, colunas);
  Object.keys(CONFIG.COLUNAS_FORMATO.PRESENCA).forEach(function (k) {
    aba.getRange(2, mapa.indices[k] + 1, aba.getMaxRows() - 1, 1).setNumberFormat(CONFIG.COLUNAS_FORMATO.PRESENCA[k]);
  });
  const valores = Object.keys(CONFIG.STATUS_PRESENCA).map(function (k) { return CONFIG.STATUS_PRESENCA[k]; });
  aba.getRange(2, mapa.indices.STATUS + 1, aba.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(false).build());
  if (anterior) SpreadsheetApp.setActiveSheet(anterior);
  return aba;
}

/**
 * Abas criadas antes de existirem as colunas de CONFIG.PRESENCA.COLUNAS_ACRESCENTADAS ganham esses cabeçalhos
 * no fim da linha 1 (com o formato da coluna). Os registros existentes não são alterados. Idempotente.
 */
function acrescentarColunasNovasDePresenca(aba) {
  const colunas = CONFIG.COLUNAS.PRESENCA;
  const largura = Math.max(aba.getLastColumn(), 1);
  const cabecalho = aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, largura).getValues()[0].map(normalizarTexto);
  const faltando = CONFIG.PRESENCA.COLUNAS_ACRESCENTADAS.filter(function (k) { return cabecalho.indexOf(normalizarTexto(colunas[k])) < 0; });
  if (!faltando.length) return 0;
  if (aba.getMaxColumns() < largura + faltando.length) aba.insertColumnsAfter(aba.getMaxColumns(), largura + faltando.length - aba.getMaxColumns());
  faltando.forEach(function (k, i) {
    const coluna = largura + 1 + i;
    aba.getRange(CONFIG.LINHA_CABECALHO, coluna).setValue(colunas[k]).setFontWeight('bold').setBackground('#e8eaed');
    const formato = CONFIG.COLUNAS_FORMATO.PRESENCA[k];
    if (formato && aba.getMaxRows() > CONFIG.LINHA_CABECALHO) {
      aba.getRange(CONFIG.LINHA_CABECALHO + 1, coluna, aba.getMaxRows() - CONFIG.LINHA_CABECALHO, 1).setNumberFormat(formato);
    }
  });
  return faltando.length;
}

let colunasDePresencaConferidas = false; // confere uma vez por execução

function listarPresencas() {
  if (!abaDePresencaExiste()) return [];
  if (!colunasDePresencaConferidas) {
    acrescentarColunasNovasDePresenca(obterAbaPorChave('PRESENCA'));
    colunasDePresencaConferidas = true;
  }
  return listarRegistros('PRESENCA');
}

/** Registros entre duas datas (inclusive), numa única leitura da aba. */
function listarPresencasDoPeriodo(inicio, fim) {
  return listarPresencas().filter(function (r) { return dataEstaNoIntervalo(r.DATA, inicio, fim); });
}

function listarPresencasDaData(data) {
  const alvo = formatarData(data);
  return listarPresencas().filter(function (r) { return formatarData(r.DATA) === alvo; });
}

function buscarPresenca(idFuncionario, data) {
  const alvo = formatarData(data);
  const id = String(idFuncionario).trim();
  return listarPresencas().find(function (r) { return String(r.ID_FUNCIONARIO).trim() === id && formatarData(r.DATA) === alvo; }) || null;
}

function inserirPresencas(registros) {
  garantirAbaDePresenca();
  return inserirRegistros('PRESENCA', registros);
}

function atualizarPresenca(numeroLinha, campos) {
  return atualizarRegistro('PRESENCA', numeroLinha, campos);
}

/** IDs PRES-0001... sem repetir os já existentes. Chamar dentro da trava. */
function gerarIdsDePresenca(quantidade, idsExistentes) {
  return reservarIds(CONFIG.IDS.PREFIXO_PRESENCA, quantidade, idsExistentes);
}