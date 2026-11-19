/**
 * DashboardService.gs — CÁLCULO dos números da aba Consulta (nada de formatação aqui).
 * Só lê os Repositories e devolve um objeto simples; o desenho fica em UI/Consulta.gs.
 */

function nomeCurto(nome) {
  const partes = String(nome === null || nome === undefined ? '' : nome).trim().split(/\s+/);
  return partes.length > 2 ? partes[0] + ' ' + partes[partes.length - 1] : partes.join(' ');
}

/** 0 = segunda ... 4 = sexta; -1 = fim de semana. */
function indiceDoDiaUtil(data) {
  const p = partesDaData(data);
  const w = new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  return w >= 1 && w <= 5 ? w - 1 : -1;
}

function pluralizarTexto(n, singular, plural) {
  return n + ' ' + (n === 1 ? singular : plural);
}

/** Anos oferecidos na lista suspensa: do ano passado a 2 anos à frente, mais o escolhido e os que têm férias. */
function listarAnosDoCalendario(hoje, ano, ferias) {
  const atual = partesDaData(hoje).ano;
  const mapa = {};
  for (let a = atual - 1; a <= atual + 2; a++) mapa[a] = true;
  mapa[ano] = true;
  ferias.forEach(function (f) {
    if (f.INICIO !== '' && converterData(f.INICIO)) mapa[partesDaData(converterData(f.INICIO)).ano] = true;
    if (f.FIM !== '' && converterData(f.FIM)) mapa[partesDaData(converterData(f.FIM)).ano] = true;
  });
  return Object.keys(mapa).map(Number).sort(function (x, y) { return x - y; });
}

function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function doisDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * Reúne tudo que a Consulta mostra. hoje = Date; ano = ano do calendário de férias;
 * atualizadoEm = texto "dd/MM/aaaa HH:mm" (vem de fora para o cálculo ser testável).
 */
function calcularDadosDaConsulta(hoje, ano, atualizadoEm) {
  const ST = CONFIG.STATUS_CONTRATO;
  const SF = CONFIG.STATUS_FERIAS;
  const contratos = listarContratos();
  const contratoPorId = {};
  const pessoas = {};
  contratos.forEach(function (c) {
    contratoPorId[String(c.ID_CONTRATO).trim()] = c;
    const id = String(c.ID_FUNCIONARIO).trim();
    if (!pessoas[id]) pessoas[id] = { id: id, nome: c.NOME, ativo: null, suspenso: false };
    if (c.STATUS === ST.ATIVO) pessoas[id].ativo = c;
    if (c.STATUS === ST.SUSPENSO) pessoas[id].suspenso = true;
  });
  const listaPessoas = Object.keys(pessoas).map(function (id) { return pessoas[id]; });
  const ativas = listaPessoas.filter(function (p) { return p.ativo; });
  const contratosAtivos = ativas.map(function (p) { return p.ativo; });

  // ---- balcão ----
  const indiceHoje = indiceDoDiaUtil(hoje);
  const dist = listarDistribuicao().filter(function (d) { return pessoas[String(d.ID_FUNCIONARIO).trim()] && pessoas[String(d.ID_FUNCIONARIO).trim()].ativo; });
  dist.sort(function (a, b) { return String(a.NOME).localeCompare(String(b.NOME), 'pt-BR'); });
  const linhasBalcao = dist.map(function (d) {
    return {
      nome: nomeCurto(d.NOME), posicao: String(d.POSICAO),
      dias: CONFIG.DIAS.map(function (dia) { return String(d[dia.DISTRIBUICAO]).trim(); })
    };
  });
  const conta = function (i, turno) {
    const J = CONFIG.JORNADA;
    return linhasBalcao.filter(function (l) { return l.dias[i] === turno || l.dias[i] === J.TURNO_MANHA_TARDE || l.dias[i] === J.TURNO_INTEGRAL; }).length;
  };
  const totaisManha = CONFIG.DIAS.map(function (_, i) { return conta(i, 'Manhã'); });
  const totaisTarde = CONFIG.DIAS.map(function (_, i) { return conta(i, 'Tarde'); });

  // ---- férias ----
  const ferias = listarFerias();
  const deFeriasHoje = {};
  ferias.forEach(function (f) {
    if ((f.STATUS === SF.PREVISTA || f.STATUS === SF.TIRADA) && f.INICIO !== '' && f.FIM !== '' &&
        dataEstaNoIntervalo(hoje, f.INICIO, f.FIM)) deFeriasHoje[String(f.ID_FUNCIONARIO).trim()] = true;
  });
  const emAberto = function (status) {
    return ferias.filter(function (f) {
      const c = contratoPorId[String(f.ID_CONTRATO).trim()];
      return f.STATUS === status && c && c.STATUS === ST.ATIVO;
    }).map(function (f) { return nomeCurto(f.NOME) + ' (' + f.PERIODO + ')'; });
  };
  const pendentes = emAberto(SF.PENDENTE);
  const aguardando = emAberto(SF.AGUARDANDO);

  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const primeiro = criarData(ano, m, 1);
    const ultimo = criarData(ano, m, ultimoDiaDoMes(ano, m));
    const linhas = ferias.filter(function (f) {
      return f.INICIO !== '' && f.FIM !== '' && compararDatas(f.INICIO, ultimo) <= 0 && compararDatas(f.FIM, primeiro) >= 0;
    }).map(function (f) {
      const ini = compararDatas(f.INICIO, primeiro) < 0 ? primeiro : converterData(f.INICIO);
      const fim = compararDatas(f.FIM, ultimo) > 0 ? ultimo : converterData(f.FIM);
      return { chave: ini.getTime(), nome: nomeCurto(f.NOME), status: f.STATUS,
        intervalo: doisDigitos(partesDaData(ini).dia) + '–' + doisDigitos(partesDaData(fim).dia) };
    }).sort(function (a, b) { return a.chave - b.chave || a.nome.localeCompare(b.nome, 'pt-BR'); })
      .map(function (x) { return { nome: x.nome, intervalo: x.intervalo, status: x.status }; });
    meses.push({ mes: m, linhas: linhas, nivel: 0 });
  }
  // nível de concentração (0 a 3), relativo ao mês com mais períodos do ano
  const maiorMes = meses.reduce(function (maior, x) { return Math.max(maior, x.linhas.length); }, 0);
  meses.forEach(function (x) { x.nivel = x.linhas.length === 0 ? 0 : Math.min(3, Math.ceil(3 * x.linhas.length / maiorMes)); });

  // ---- contratos e avisos ----
  const limite = somarDiasData(hoje, CONFIG.CONSULTA.DIAS_AVISO_VENCIMENTO);
  const vencidos = contratosAtivos.filter(function (c) { return c.FIM !== '' && compararDatas(c.FIM, hoje) < 0; });
  const aVencer = contratosAtivos.filter(function (c) {
    return c.FIM !== '' && compararDatas(c.FIM, hoje) >= 0 && compararDatas(c.FIM, limite) <= 0;
  });
  const diasAteOFim = function (c) { return diasEntreDatas(hoje, c.FIM) - 1; }; // negativo = já venceu
  const contratosAtencao = vencidos.map(function (c) { return { nome: nomeCurto(c.NOME), fim: formatarData(c.FIM), dias: diasAteOFim(c), nivel: 'critico' }; })
    .concat(aVencer.map(function (c) { return { nome: nomeCurto(c.NOME), fim: formatarData(c.FIM), dias: diasAteOFim(c), nivel: 'atencao' }; }))
    .sort(function (a, b) { return a.dias - b.dias; });
  const avisos = [];
  if (pendentes.length) avisos.push({ nivel: 'critico', texto: pluralizarTexto(pendentes.length, 'período de férias Pendente', 'períodos de férias Pendentes') + ' (ainda não conversei).' });
  if (aguardando.length) avisos.push({ nivel: 'atencao', texto: pluralizarTexto(aguardando.length, 'período de férias Aguardando resposta', 'períodos de férias Aguardando resposta') + '.' });
  if (vencidos.length) {
    avisos.push({ nivel: 'critico', texto: pluralizarTexto(vencidos.length, 'contrato vencido e ainda Ativo', 'contratos vencidos e ainda Ativos') + ': ' +
      vencidos.map(function (c) { return nomeCurto(c.NOME) + ' (' + formatarData(c.FIM) + ')'; }).join(', ') + '.' });
  }
  if (aVencer.length) {
    avisos.push({ nivel: 'atencao', texto: pluralizarTexto(aVencer.length, 'contrato vence', 'contratos vencem') + ' em até ' + CONFIG.CONSULTA.DIAS_AVISO_VENCIMENTO + ' dias: ' +
      aVencer.map(function (c) { return nomeCurto(c.NOME) + ' (' + formatarData(c.FIM) + ')'; }).join(', ') + '.' });
  }
  if (!avisos.length) avisos.push({ nivel: 'ok', texto: 'Nenhum aviso.' });

  const dataHoje = partesDaData(hoje);
  return {
    atualizadoEm: atualizadoEm, hoje: formatarData(hoje),
    kpis: {
      equipeAtiva: ativas.length,
      suspensos: listaPessoas.filter(function (p) { return !p.ativo && p.suspenso; }).length,
      balcaoManhaHoje: indiceHoje >= 0 ? totaisManha[indiceHoje] : null,
      balcaoTardeHoje: indiceHoje >= 0 ? totaisTarde[indiceHoje] : null,
      deFeriasHoje: Object.keys(deFeriasHoje).length,
      contratosAVencer: aVencer.length,
      contratosVencidos: vencidos.length
    },
    avisos: avisos,
    contratosAtencao: contratosAtencao,
    balcao: {
      indiceHoje: indiceHoje, nomeHoje: indiceHoje >= 0 ? CONFIG.DIAS[indiceHoje].NOME : '',
      diasNomes: CONFIG.DIAS.map(function (d) { return d.NOME.substring(0, 3); }),
      linhas: linhasBalcao, totaisManha: totaisManha, totaisTarde: totaisTarde
    },
    ferias: {
      ano: ano, anos: listarAnosDoCalendario(hoje, ano, ferias), mesAtual: dataHoje.ano === ano ? dataHoje.mes : 0,
      meses: meses, pendentes: pendentes, aguardando: aguardando
    }
  };
}