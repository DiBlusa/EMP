/**
 * ValidacaoUtils.gs — validações e normalização de texto. Lança erros com mensagens claras.
 */
/** Vazio: null, "", só espaços ou "-" (marcador da planilha antiga). */
function valorVazio(valor) {
  if (valor === null || valor === undefined) return true;
  const t = String(valor).trim();
  return t === '' || t === CONFIG.VALOR_VAZIO_LEGADO;
}

/** Minúsculas, sem acentos, espaços colapsados. Usado só para comparar textos. */
function normalizarTexto(valor) {
  const t = (valor === null || valor === undefined) ? '' : String(valor);
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function chaveDoNome(nome) {
  return normalizarTexto(nome);
}

function exigirCampos(registro, chaves, contexto) {
  const faltando = chaves.filter(function (k) { return valorVazio(registro[k]); });
  if (faltando.length) {
    throw new Error('[' + (contexto || 'Validação') + '] Campos obrigatórios ausentes: ' + faltando.join(', '));
  }
}

function exigirNaLista(valor, lista, rotulo) {
  const alvo = normalizarTexto(valor);
  const ok = lista.some(function (item) { return normalizarTexto(item) === alvo; });
  if (!ok) {
    throw new Error('[Validação] ' + rotulo + ' inválido: "' + valor + '". Valores aceitos: ' + lista.join(', '));
  }
}

function validarIntervaloDeDatas(inicio, fim, rotulo) {
  const nome = rotulo || 'Período';
  if (!converterData(inicio) || !converterData(fim)) {
    throw new Error('[Validação] ' + nome + ': data de início ou fim inválida.');
  }
  if (compararDatas(inicio, fim) > 0) {
    throw new Error('[Validação] ' + nome + ': a data final é anterior à inicial.');
  }
}