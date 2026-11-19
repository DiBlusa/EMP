/**
 * DataUtils.gs — cálculos e conversões de datas (fuso America/Sao_Paulo).
 * Datas são normalizadas para 12:00 do dia, evitando erros de horário de verão/fuso.
 * Requer que o fuso do projeto Apps Script seja America/Sao_Paulo.
 */
function partesDaData(data) {
  const p = Utilities.formatDate(data, CONFIG.FUSO, 'yyyy-MM-dd').split('-').map(Number);
  return { ano: p[0], mes: p[1], dia: p[2] };
}

function criarData(ano, mes, dia) {
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  const ok = d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
  return ok ? d : null;
}

function normalizarData(data) {
  const p = partesDaData(data);
  return new Date(p.ano, p.mes - 1, p.dia, 12, 0, 0);
}

function hojeNormalizado() {
  return normalizarData(new Date());
}

/** Aceita Date ou texto dd/MM/yyyy. Retorna null para vazio, "-" ou valor inválido. */
function converterData(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : normalizarData(valor);
  if (typeof valor !== 'string') return null;
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(valor);
  return m ? criarData(Number(m[3]), Number(m[2]), Number(m[1])) : null;
}

function formatarData(valor) {
  const d = converterData(valor);
  return d ? Utilities.formatDate(d, CONFIG.FUSO, CONFIG.FORMATO_DATA) : '';
}

/** Quantidade de dias entre as datas, contando início e fim. Null se alguma for inválida. */
function diasEntreDatas(inicio, fim) {
  const a = converterData(inicio);
  const b = converterData(fim);
  if (!a || !b) return null;
  const pa = partesDaData(a);
  const pb = partesDaData(b);
  const ms = Date.UTC(pb.ano, pb.mes - 1, pb.dia) - Date.UTC(pa.ano, pa.mes - 1, pa.dia);
  return Math.round(ms / 86400000) + 1;
}

function somarDiasData(data, dias) {
  const d = converterData(data);
  if (!d) return null;
  const p = partesDaData(d);
  return normalizarData(new Date(p.ano, p.mes - 1, p.dia + dias, 12, 0, 0));
}

/** Soma meses mantendo o dia, ou o último dia do mês quando o dia não existir. */
function somarMesesData(data, meses) {
  const d = converterData(data);
  if (!d) return null;
  const p = partesDaData(d);
  const alvo = new Date(p.ano, p.mes - 1 + meses, 1, 12, 0, 0);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return criarData(alvo.getFullYear(), alvo.getMonth() + 1, Math.min(p.dia, ultimoDia));
}

/** Retorna -1, 0 ou 1. Null se alguma data for inválida. */
function compararDatas(a, b) {
  const da = converterData(a);
  const db = converterData(b);
  if (!da || !db) return null;
  return da.getTime() < db.getTime() ? -1 : (da.getTime() > db.getTime() ? 1 : 0);
}

function dataEstaNoIntervalo(data, inicio, fim) {
  const c1 = compararDatas(data, inicio);
  const c2 = compararDatas(data, fim);
  return c1 !== null && c2 !== null && c1 >= 0 && c2 <= 0;
}

/** "dd/MM/yyyy HH:mm" a partir de um Date (vazio se não for data). */
function formatarDataHora(valor) {
  if (!(valor instanceof Date) || isNaN(valor.getTime())) return '';
  return Utilities.formatDate(valor, CONFIG.FUSO, 'dd/MM/yyyy HH:mm');
}