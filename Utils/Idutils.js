/**
 * IdUtils.gs — geração de IDs únicos (FUNC-0001, CONT-0001).
 * O contador fica em ScriptProperties e nunca fica abaixo do maior ID já existente.
 * IMPORTANTE: chamar dentro de executarComTrava() para evitar IDs repetidos.
 */
function formatarId(prefixo, numero) {
  return prefixo + '-' + String(numero).padStart(CONFIG.IDS.DIGITOS, '0');
}

function extrairNumeroDoId(id, prefixo) {
  const m = new RegExp('^' + prefixo + '-(\\d+)$').exec(String(id === null || id === undefined ? '' : id).trim());
  return m ? Number(m[1]) : 0;
}

function idEhValido(id, prefixo) {
  return extrairNumeroDoId(id, prefixo) > 0;
}

/** Reserva "quantidade" IDs sequenciais, considerando os já existentes. */
function reservarIds(prefixo, quantidade, idsExistentes) {
  const props = PropertiesService.getScriptProperties();
  const chave = 'ULTIMO_ID_' + prefixo;
  let maior = Number(props.getProperty(chave) || 0);
  (idsExistentes || []).forEach(function (id) {
    maior = Math.max(maior, extrairNumeroDoId(id, prefixo));
  });
  const ids = [];
  for (let i = 1; i <= quantidade; i++) ids.push(formatarId(prefixo, maior + i));
  props.setProperty(chave, String(maior + quantidade));
  return ids;
}

function proximoIdFuncionario(idsExistentes) {
  return reservarIds(CONFIG.IDS.PREFIXO_FUNCIONARIO, 1, idsExistentes)[0];
}

function proximoIdContrato(idsExistentes) {
  return reservarIds(CONFIG.IDS.PREFIXO_CONTRATO, 1, idsExistentes)[0];
}