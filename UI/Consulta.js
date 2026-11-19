/**
 * Consulta.gs (UI) — desenha a aba "Consulta" (dashboard institucional) a partir dos números de DashboardService.
 *
 * Grade: 18 colunas lógicas de conteúdo (k = 1..18) + 5 colunas estreitas de respiro após as colunas 3, 6, 9, 12 e 15.
 * Cartões de indicadores = 3 colunas; cartões do calendário e do resumo = 6 e 9 colunas (atravessam o respiro).
 * montarLayoutDaConsulta() é "pura" (só monta células, estilos e medidas); aplicarLayoutNaConsulta() escreve na aba.
 */

/** Coluna física (1 = A) da coluna lógica k. */
function colunaDoGrid(k) {
  return 1 + k + Math.floor((k - 1) / 3);
}

function largurasDaConsulta() {
  const larguras = [];
  for (let c = 1; c <= CONFIG.CONSULTA.COLUNAS; c++) larguras.push(20);
  for (let k = 1; k <= 18; k++) larguras[colunaDoGrid(k) - 1] = 56;
  for (let g = 1; g <= 5; g++) larguras[colunaDoGrid(3 * g)] = 12;
  return larguras;
}

/** Estilos nomeados (dados puros: servem para desenhar e para a prévia). */
function estilosDaConsulta() {
  const c = CONFIG.CONSULTA.CORES;
  const mes = function (fundo, cor) { return { tamanho: 11, negrito: true, cor: cor, fundo: fundo }; };
  const mesContagem = function (fundo, cor) { return { tamanho: 9, cor: cor, fundo: fundo, alinhar: 'right' }; };
  return {
    tituloPainel: { tamanho: 20, negrito: true, cor: c.BRANCO },
    subtituloPainel: { tamanho: 11, cor: c.AZUL_CLARO },
    infoPainel: { tamanho: 10, cor: c.BRANCO, alinhar: 'right' },
    infoPainelFraca: { tamanho: 9, cor: c.AZUL_CLARO, alinhar: 'right' },
    tituloSecao: { tamanho: 13, negrito: true, cor: c.AZUL_ESCURO },
    secaoDireita: { tamanho: 10, negrito: true, cor: c.AZUL_MEDIO, alinhar: 'right' },
    seletorAno: { tamanho: 12, negrito: true, cor: c.AZUL_ESCURO, fundo: c.BRANCO, alinhar: 'center' },
    kpiRotulo: { tamanho: 9, negrito: true, cor: c.CINZA_ESCURO, alinhar: 'center' },
    kpiValor: { tamanho: 28, negrito: true, cor: c.AZUL_ESCURO, alinhar: 'center' },
    kpiLegenda: { tamanho: 9, cor: c.CINZA_ESCURO, alinhar: 'center' },
    alerta: { tamanho: 10, cor: c.CINZA_ESCURO },
    legenda: { tamanho: 9, cor: c.CINZA_ESCURO },
    cabTabela: { tamanho: 9, negrito: true, cor: c.AZUL_ESCURO, fundo: c.AZUL_CLARO },
    cabTabelaHoje: { tamanho: 9, negrito: true, cor: c.BRANCO, fundo: c.AZUL_MEDIO },
    textoTabela: { tamanho: 10, cor: c.CINZA_ESCURO },
    textoTabelaFraco: { tamanho: 9, cor: c.CINZA_ESCURO },
    chipManha: { tamanho: 9, negrito: true, cor: c.AZUL_ESCURO, fundo: c.AZUL_CLARO },
    chipTarde: { tamanho: 9, negrito: true, cor: c.BRANCO, fundo: c.AZUL_MEDIO },
    chipIntegral: { tamanho: 9, negrito: true, cor: c.BRANCO, fundo: c.AZUL_ESCURO },
    chipIntegralPss: { tamanho: 9, negrito: true, cor: c.BRANCO, fundo: c.CINZA_ESCURO },
    chipVazio: { tamanho: 9, cor: c.CINZA_MEDIO },
    chipVazioHoje: { tamanho: 9, cor: c.CINZA_MEDIO, fundo: c.CINZA_CLARO },
    totalTabela: { tamanho: 10, negrito: true, cor: c.AZUL_ESCURO, fundo: c.CINZA_CLARO },
    totalHoje: { tamanho: 10, negrito: true, cor: c.AZUL_ESCURO, fundo: c.AZUL_CLARO },
    mesN0: mes(c.CINZA_CLARO, c.CINZA_ESCURO), mesN1: mes(c.AZUL_CLARO, c.AZUL_ESCURO),
    mesN2: mes(c.AZUL_MEDIO, c.BRANCO), mesN3: mes(c.AZUL_ESCURO, c.BRANCO),
    mesContagemN0: mesContagem(c.CINZA_CLARO, c.CINZA_ESCURO), mesContagemN1: mesContagem(c.AZUL_CLARO, c.AZUL_ESCURO),
    mesContagemN2: mesContagem(c.AZUL_MEDIO, c.BRANCO), mesContagemN3: mesContagem(c.AZUL_ESCURO, c.BRANCO),
    cartaoCorpo: { tamanho: 9, cor: c.CINZA_ESCURO, alinhar: 'left', vertical: 'top', quebra: true },
    cartaoVazio: { tamanho: 9, italico: true, cor: c.CINZA_MEDIO, alinhar: 'left', vertical: 'top', quebra: true },
    resumoCab: { tamanho: 11, negrito: true, cor: c.AZUL_ESCURO, fundo: c.BRANCO },
    resumoContagem: { tamanho: 11, negrito: true, cor: c.AZUL_MEDIO, fundo: c.BRANCO, alinhar: 'right' },
    resumoCorpo: { tamanho: 10, cor: c.CINZA_ESCURO, alinhar: 'left', vertical: 'top', quebra: true },
    rodape: { tamanho: 8, cor: c.CINZA_MEDIO }
  };
}

function corDoStatusDeFerias(status) {
  const c = CONFIG.CONSULTA.CORES;
  const SF = CONFIG.STATUS_FERIAS;
  if (status === SF.PENDENTE) return c.VERMELHO;
  if (status === SF.AGUARDANDO) return c.AMARELO;
  if (status === SF.PREVISTA) return c.AZUL_MEDIO;
  if (status === SF.TIRADA) return c.VERDE;
  return c.CINZA_MEDIO;
}

function coresDoAviso(nivel) {
  const c = CONFIG.CONSULTA.CORES;
  if (nivel === 'critico') return { barra: c.VERMELHO, fundo: c.VERMELHO_FUNDO };
  if (nivel === 'atencao') return { barra: c.AMARELO, fundo: c.AMARELO_FUNDO };
  if (nivel === 'ok') return { barra: c.VERDE, fundo: c.VERDE_FUNDO };
  return { barra: c.AZUL_MEDIO, fundo: c.AZUL_CLARO };
}

/** Texto com um marcador colorido no início de cada linha: devolve { texto, runs }. */
function montarTextoComMarcadores(linhas, marcador) {
  const sinal = marcador || '●';
  let texto = '';
  const runs = [];
  linhas.forEach(function (l, i) {
    if (i > 0) texto += '\n';
    runs.push({ ini: texto.length, fim: texto.length + sinal.length, cor: l.cor, negrito: true });
    texto += sinal + '  ' + l.texto;
  });
  return { texto: texto, runs: runs };
}

function montarLayoutDaConsulta(d) {
  const K = CONFIG.CONSULTA;
  const C = K.CORES;
  const celulas = {};
  const specs = [];
  const alturas = {};
  const col = colunaDoGrid;
  const larg = function (k1, k2) { return col(k2) - col(k1) + 1; };
  const colocar = function (linha, k, valor) { celulas[linha + ',' + col(k)] = valor; };
  const fundo = function (cor, linha, k1, k2, nl) { specs.push({ tipo: 'fundo', cor: cor, r: linha, c: col(k1), nl: nl || 1, nc: larg(k1, k2) }); };
  const estilo = function (nome, linha, k1, k2, nl) { specs.push({ tipo: 'estilo', nome: nome, r: linha, c: col(k1), nl: nl || 1, nc: larg(k1, k2) }); };
  // estilo sobre colunas FÍSICAS (usado nos dias da tabela, que ocupam trechos contínuos, sem vãos entre eles)
  const estiloFisico = function (nome, linha, cIni, cFim, nl) { specs.push({ tipo: 'estilo', nome: nome, r: linha, c: cIni, nl: nl || 1, nc: cFim - cIni + 1 }); };
  const mesclar = function (linha, k1, k2, nl) { specs.push({ tipo: 'mesclar', r: linha, c: col(k1), nl: nl || 1, nc: larg(k1, k2) }); };
  const borda = function (modo, cor, espessura, linha, k1, k2, nl) {
    specs.push({ tipo: 'borda', modo: modo, cor: cor, espessura: espessura, r: linha, c: col(k1), nl: nl || 1, nc: larg(k1, k2) });
  };
  const altura = function (linha, px) { alturas[linha] = px; };
  const rico = function (linha, k, texto, runs) {
    celulas[linha + ',' + col(k)] = texto;
    specs.push({ tipo: 'rico', r: linha, c: col(k), texto: texto, runs: runs });
  };
  const recuo = function (t) { return '  ' + t; };
  const NOMES_DOS_MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

  // ================= 1) cabeçalho institucional =================
  specs.push({ tipo: 'fundo', cor: C.AZUL_ESCURO, r: 1, c: 1, nl: 4, nc: K.COLUNAS });
  altura(1, 10); altura(2, 36); altura(3, 22); altura(4, 22);
  const kTitulo = K.RESERVAR_ESPACO_BRASAO ? 3 : 1;
  colocar(2, kTitulo, K.TITULO); estilo('tituloPainel', 2, kTitulo, 12);
  colocar(3, kTitulo, K.ORGAO + (K.SETOR ? '   ·   Setor: ' + K.SETOR : '')); estilo('subtituloPainel', 3, kTitulo, 12);
  if (K.BRASAO_URL) specs.push({ tipo: 'imagem', r: 2, c: col(1), nl: 3, nc: larg(1, 2), url: K.BRASAO_URL });
  colocar(2, 18, 'Atualizado em ' + d.atualizadoEm); estilo('infoPainel', 2, 13, 18);
  rico(3, 18, '●  Dados atualizados', [{ ini: 0, fim: 1, cor: '#7BD389', negrito: true }]); estilo('infoPainel', 3, 13, 18);
  colocar(4, 18, 'Atualização automática diária (' + CONFIG.FERIAS.HORA_ROTINA_DIARIA + 'h) e a cada operação nas telas'); estilo('infoPainelFraca', 4, 7, 18);
  altura(5, 14);

  // ================= 2) indicadores principais =================
  const kp = d.kpis;
  const balcaoHoje = d.balcao.indiceHoje >= 0 ? 'hoje · ' + d.balcao.nomeHoje.toLowerCase() : 'fim de semana';
  const corVencer = kp.contratosVencidos > 0 ? C.VERMELHO : (kp.contratosAVencer > 0 ? C.AMARELO : C.CINZA_MEDIO);
  const cartoes = [
    { rotulo: '👥  EQUIPE ATIVA', valor: kp.equipeAtiva, legenda: 'contratos ativos', cor: C.AZUL_MEDIO },
    { rotulo: '⏸️  SUSPENSOS', valor: kp.suspensos, legenda: 'contratos suspensos', cor: C.CINZA_MEDIO },
    { rotulo: '☀️  BALCÃO · MANHÃ', valor: kp.balcaoManhaHoje === null ? '—' : kp.balcaoManhaHoje, legenda: balcaoHoje, cor: C.AZUL_MEDIO },
    { rotulo: '🌆  BALCÃO · TARDE', valor: kp.balcaoTardeHoje === null ? '—' : kp.balcaoTardeHoje, legenda: balcaoHoje, cor: C.AZUL_ESCURO },
    { rotulo: '🏖️  DE FÉRIAS HOJE', valor: kp.deFeriasHoje, legenda: 'em período de férias', cor: C.VERDE },
    { rotulo: '⏳  CONTRATOS A VENCER', valor: kp.contratosAVencer,
      legenda: 'em até ' + K.DIAS_AVISO_VENCIMENTO + ' dias' + (kp.contratosVencidos ? ' · ' + kp.contratosVencidos + ' vencido(s)' : ''), cor: corVencer }
  ];
  cartoes.forEach(function (cartao, i) {
    const k1 = 3 * i + 1;
    const k3 = 3 * i + 3;
    const meio = 3 * i + 2;
    fundo(C.BRANCO, 6, k1, k3, 3);
    colocar(6, meio, cartao.rotulo); estilo('kpiRotulo', 6, meio, meio);
    colocar(7, meio, cartao.valor); estilo('kpiValor', 7, meio, meio);
    colocar(8, meio, cartao.legenda); estilo('kpiLegenda', 8, meio, meio);
    borda('cima', cartao.cor, 'SOLID_THICK', 6, k1, k3, 1);
  });
  altura(6, 28); altura(7, 48); altura(8, 24); altura(9, 20);

  // ================= 3) pendências e avisos =================
  let r = 10;
  colocar(r, 1, 'Pendências e avisos'); estilo('tituloSecao', r, 1, 18); altura(r, 30);
  d.avisos.forEach(function (aviso, i) {
    const linha = r + 1 + i;
    const cores = coresDoAviso(aviso.nivel);
    fundo(cores.fundo, linha, 1, 18, 1);
    borda('esquerda', cores.barra, 'SOLID_THICK', linha, 1, 1, 1);
    rico(linha, 1, '●  ' + aviso.texto, [{ ini: 0, fim: 1, cor: cores.barra, negrito: true }]);
    estilo('alerta', linha, 1, 18);
    altura(linha, 30);
  });
  r = r + d.avisos.length + 1;
  altura(r, 20);
  r += 1;

  // ================= 4) organização do balcão =================
  colocar(r, 1, 'Organização do balcão'); estilo('tituloSecao', r, 1, 12); altura(r, 30);
  colocar(r, 18, d.balcao.indiceHoje >= 0 ? 'Hoje: ' + d.balcao.nomeHoje : 'Hoje: fim de semana'); estilo('secaoDireita', r, 13, 18);
  const legendaTurnos = '██  Manhã          ██  Tarde          ██  Manhã+Tarde (estágio)          ██  Integral (PSS e Cargo)';
  const marca = function (trecho, cor) { const i = legendaTurnos.indexOf(trecho); return { ini: i, fim: i + 2, cor: cor }; };
  rico(r + 1, 1, legendaTurnos, [
    marca('██  Manhã', C.AZUL_CLARO), marca('██  Tarde', C.AZUL_MEDIO),
    marca('██  Manhã+Tarde', C.AZUL_ESCURO), marca('██  Integral', C.CINZA_ESCURO)]);
  estilo('legenda', r + 1, 1, 18); altura(r + 1, 24);
  const cabecalho = r + 2;
  const nLinhas = d.balcao.linhas.length;
  const corpoInicio = cabecalho + 1;
  const totais = corpoInicio + Math.max(nLinhas, 1);
  const fimTabela = totais + 1;
  fundo(C.BRANCO, cabecalho, 1, 18, fimTabela - cabecalho + 1);
  const kDia = function (i) { return 9 + 2 * i; };
  // cada dia ocupa um trecho contínuo: do seu início até a coluna antes do início do próximo dia (o último vai até a coluna 18)
  const trechoDoDia = function (i) { return [col(kDia(i)), i === 4 ? col(18) : col(kDia(i + 1)) - 1]; };
  const hoje = d.balcao.indiceHoje;
  colocar(cabecalho, 1, recuo('FUNCIONÁRIO')); colocar(cabecalho, 6, recuo('POSIÇÃO'));
  estilo('cabTabela', cabecalho, 1, 8);
  d.balcao.diasNomes.forEach(function (nome, i) {
    colocar(cabecalho, kDia(i), recuo(nome.toUpperCase()));
    estiloFisico(i === hoje ? 'cabTabelaHoje' : 'cabTabela', cabecalho, trechoDoDia(i)[0], trechoDoDia(i)[1]);
  });
  altura(cabecalho, 28);
  const exibicaoDoTurno = { 'Manhã': 'Manhã', 'Tarde': 'Tarde', 'Manhã+Tarde': 'Manhã+Tarde', 'Integral': 'Integral' };
  const estiloDoTurno = { 'Manhã': 'chipManha', 'Tarde': 'chipTarde', 'Manhã+Tarde': 'chipIntegral', 'Integral': 'chipIntegralPss' };
  d.balcao.linhas.forEach(function (l, i) {
    const linha = corpoInicio + i;
    colocar(linha, 1, recuo(l.nome)); estilo('textoTabela', linha, 1, 5);
    colocar(linha, 6, recuo(l.posicao)); estilo('textoTabelaFraco', linha, 6, 8);
    l.dias.forEach(function (turno, j) {
      if (exibicaoDoTurno[turno]) {
        colocar(linha, kDia(j), recuo(exibicaoDoTurno[turno])); estiloFisico(estiloDoTurno[turno], linha, trechoDoDia(j)[0], trechoDoDia(j)[1]);
      } else {
        colocar(linha, kDia(j), recuo('—')); estiloFisico(j === hoje ? 'chipVazioHoje' : 'chipVazio', linha, trechoDoDia(j)[0], trechoDoDia(j)[1]);
      }
    });
    altura(linha, 26);
  });
  if (!nLinhas) { colocar(corpoInicio, 1, recuo('Ninguém na distribuição do balcão.')); estilo('textoTabelaFraco', corpoInicio, 1, 18); altura(corpoInicio, 26); }
  colocar(totais, 1, recuo('Total manhã')); colocar(totais + 1, 1, recuo('Total tarde'));
  estilo('totalTabela', totais, 1, 8, 2);
  d.balcao.totaisManha.forEach(function (v, j) { colocar(totais, kDia(j), recuo(String(v))); });
  d.balcao.totaisTarde.forEach(function (v, j) { colocar(totais + 1, kDia(j), recuo(String(v))); });
  CONFIG.DIAS.forEach(function (_, j) { estiloFisico(j === hoje ? 'totalHoje' : 'totalTabela', totais, trechoDoDia(j)[0], trechoDoDia(j)[1], 2); });
  if (nLinhas > 1) borda('horizontal', C.BRANCO, 'SOLID_MEDIUM', corpoInicio, 1, 18, nLinhas);
  altura(totais, 26); altura(totais + 1, 26);
  r = fimTabela + 1;
  altura(r, 20);
  r += 1;

  // ================= 5) calendário de férias =================
  colocar(r, 1, K.TITULO_FERIAS); estilo('tituloSecao', r, 1, 12); altura(r, 30);
  colocar(r, 17, 'Ano:'); estilo('secaoDireita', r, 17, 17);
  colocar(r, 18, d.ferias.ano); estilo('seletorAno', r, 18, 18);
  borda('caixa', C.AZUL_MEDIO, 'SOLID', r, 18, 18, 1);
  const celulaAno = { linha: r, coluna: col(18) };
  const legendaStatus = [
    { texto: 'Prevista', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.PREVISTA) },
    { texto: 'Aguardando resposta', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.AGUARDANDO) },
    { texto: 'Pendente', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.PENDENTE) },
    { texto: 'Tirada', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.TIRADA) }
  ];
  let textoLegenda = '';
  const runsLegenda = [];
  legendaStatus.forEach(function (item) {
    runsLegenda.push({ ini: textoLegenda.length, fim: textoLegenda.length + 1, cor: item.cor, negrito: true });
    textoLegenda += '●  ' + item.texto + '          ';
  });
  textoLegenda += 'Quanto mais escuro o mês, maior a concentração de férias.';
  rico(r + 1, 1, textoLegenda, runsLegenda); estilo('legenda', r + 1, 1, 18); altura(r + 1, 24);
  const inicioCartoes = r + 2;
  for (let q = 0; q < 4; q++) {
    const cab = inicioCartoes + q * 3;
    let maisLinhas = 1;
    for (let j = 0; j < 3; j++) {
      const mes = d.ferias.meses[q * 3 + j];
      const k1 = 6 * j + 1;
      const k6 = 6 * j + 6;
      const atual = d.ferias.mesAtual === mes.mes;
      colocar(cab, k1, recuo(NOMES_DOS_MESES[mes.mes - 1] + (atual ? '  ·  MÊS ATUAL' : '')));
      colocar(cab, k6, mes.linhas.length ? mes.linhas.length + (mes.linhas.length === 1 ? ' período  ' : ' períodos  ') : '—  ');
      estilo('mesN' + mes.nivel, cab, k1, k6 - 1); estilo('mesContagemN' + mes.nivel, cab, k6, k6);
      fundo(C.BRANCO, cab + 1, k1, k6, 1);
      mesclar(cab + 1, k1, k6, 1);
      if (mes.linhas.length) {
        const t = montarTextoComMarcadores(mes.linhas.map(function (x) { return { cor: corDoStatusDeFerias(x.status), texto: x.nome + '  ·  ' + x.intervalo }; }));
        rico(cab + 1, k1, t.texto, t.runs); estilo('cartaoCorpo', cab + 1, k1, k6, 1);
      } else {
        colocar(cab + 1, k1, 'Sem férias neste mês'); estilo('cartaoVazio', cab + 1, k1, k6, 1);
      }
      if (atual) borda('caixa', C.AZUL_MEDIO, 'SOLID_THICK', cab, k1, k6, 2);
      maisLinhas = Math.max(maisLinhas, mes.linhas.length);
    }
    altura(cab, 28); altura(cab + 1, Math.max(44, maisLinhas * 16 + 14)); altura(cab + 2, 12);
  }
  r = inicioCartoes + 12;

  // ================= 6) resumo de pendências =================
  altura(r, 8);
  r += 1;
  colocar(r, 1, 'Resumo de pendências'); estilo('tituloSecao', r, 1, 18); altura(r, 30);
  const blocos = [
    { k1: 1, k2: 6, titulo: 'Férias pendentes', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.PENDENTE),
      linhas: d.ferias.pendentes.map(function (t) { return { cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.PENDENTE), texto: t }; }) },
    { k1: 7, k2: 12, titulo: 'Aguardando resposta', cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.AGUARDANDO),
      linhas: d.ferias.aguardando.map(function (t) { return { cor: corDoStatusDeFerias(CONFIG.STATUS_FERIAS.AGUARDANDO), texto: t }; }) },
    { k1: 13, k2: 18, titulo: 'Contratos que precisam de atenção', cor: C.AMARELO,
      linhas: d.contratosAtencao.map(function (x) {
        const quando = x.dias < 0 ? 'venceu há ' + (-x.dias) + (x.dias === -1 ? ' dia' : ' dias') : (x.dias === 0 ? 'vence hoje' : 'vence em ' + x.dias + (x.dias === 1 ? ' dia' : ' dias'));
        return { cor: x.nivel === 'critico' ? C.VERMELHO : C.AMARELO, texto: x.nome + '  ·  ' + x.fim + '  (' + quando + ')' };
      }) }
  ];
  const cabResumo = r + 1;
  const corpoResumo = r + 2;
  let maisLinhasResumo = 1;
  blocos.forEach(function (b) {
    colocar(cabResumo, b.k1, recuo(b.titulo)); colocar(cabResumo, b.k2, b.linhas.length + '  ');
    estilo('resumoCab', cabResumo, b.k1, b.k2 - 1); estilo('resumoContagem', cabResumo, b.k2, b.k2);
    borda('cima', b.cor, 'SOLID_THICK', cabResumo, b.k1, b.k2, 1);
    fundo(C.BRANCO, corpoResumo, b.k1, b.k2, 1);
    mesclar(corpoResumo, b.k1, b.k2, 1);
    if (b.linhas.length) {
      const t = montarTextoComMarcadores(b.linhas);
      rico(corpoResumo, b.k1, t.texto, t.runs);
    } else {
      colocar(corpoResumo, b.k1, 'Nenhuma pendência.');
    }
    estilo('resumoCorpo', corpoResumo, b.k1, b.k2, 1);
    maisLinhasResumo = Math.max(maisLinhasResumo, b.linhas.length);
  });
  altura(cabResumo, 30); altura(corpoResumo, Math.max(44, maisLinhasResumo * 17 + 16));
  r = corpoResumo + 1;
  altura(r, 14);
  r += 1;
  colocar(r, 1, 'Fonte: abas Funcionários, Férias, Horários e Distribuição  ·  ' + K.ORGAO); estilo('rodape', r, 1, 18); altura(r, 22);

  return { totalLinhas: r + 1, celulas: celulas, specs: specs, alturas: alturas, celulaAno: celulaAno, anos: d.ferias.anos };
}

/** Notação A1 calculada aqui mesmo (sem chamar o Sheets): linha, coluna, nº de linhas, nº de colunas. */
function notacaoA1(linha, coluna, nLinhas, nColunas) {
  const letras = function (n) {
    let t = '';
    while (n > 0) { const resto = (n - 1) % 26; t = String.fromCharCode(65 + resto) + t; n = Math.floor((n - 1) / 26); }
    return t;
  };
  return letras(coluna) + linha + ':' + letras(coluna + nColunas - 1) + (linha + nLinhas - 1);
}

function aplicarEstiloNaLista(lista, e) {
  if (e.tamanho) lista.setFontSize(e.tamanho);
  lista.setFontWeight(e.negrito ? 'bold' : 'normal');
  lista.setFontStyle(e.italico ? 'italic' : 'normal');
  if (e.cor) lista.setFontColor(e.cor);
  if (e.fundo) lista.setBackground(e.fundo);
  if (e.alinhar) lista.setHorizontalAlignment(e.alinhar);
  if (e.vertical) lista.setVerticalAlignment(e.vertical);
  if (e.quebra) lista.setWrap(true);
}

function aplicarLayoutNaConsulta(aba, layout) {
  const colunas = CONFIG.CONSULTA.COLUNAS;
  const C = CONFIG.CONSULTA.CORES;
  const total = layout.totalLinhas;

  // 1) limpar tudo (conteúdo, formato, mesclagens, validações e regras); imagens inseridas à mão são preservadas
  const tudo = aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns());
  tudo.breakApart();
  tudo.clearDataValidations();
  aba.clear();
  aba.clearConditionalFormatRules();
  if (aba.getMaxRows() < total + 1) aba.insertRowsAfter(aba.getMaxRows(), total + 1 - aba.getMaxRows());
  if (aba.getMaxColumns() < colunas) aba.insertColumnsAfter(aba.getMaxColumns(), colunas - aba.getMaxColumns());
  aba.setHiddenGridlines(true);
  aba.setTabColor(C.AZUL_MEDIO);

  // 2) larguras (agrupadas) e alturas (agrupadas)
  const larguras = largurasDaConsulta();
  for (let i = 0; i < larguras.length;) {
    let j = i;
    while (j + 1 < larguras.length && larguras[j + 1] === larguras[i]) j++;
    aba.setColumnWidths(i + 1, j - i + 1, larguras[i]);
    i = j + 1;
  }
  const linhasComAltura = Object.keys(layout.alturas).map(Number).sort(function (a, b) { return a - b; });
  for (let i = 0; i < linhasComAltura.length;) {
    let j = i;
    while (j + 1 < linhasComAltura.length && linhasComAltura[j + 1] === linhasComAltura[j] + 1 &&
           layout.alturas[linhasComAltura[j + 1]] === layout.alturas[linhasComAltura[i]]) j++;
    aba.setRowHeights(linhasComAltura[i], j - i + 1, layout.alturas[linhasComAltura[i]]);
    i = j + 1;
  }

  // 3) fundo da página, fonte e valores (uma única gravação)
  const area = aba.getRange(1, 1, total, colunas);
  area.setBackground(C.CINZA_CLARO).setFontFamily('Roboto').setFontSize(10).setFontColor(C.CINZA_ESCURO).setVerticalAlignment('middle');
  const matriz = [];
  for (let r = 1; r <= total; r++) {
    const linha = [];
    for (let c = 1; c <= colunas; c++) {
      const v = layout.celulas[r + ',' + c];
      linha.push(v === undefined ? '' : v);
    }
    matriz.push(linha);
  }
  area.setValues(matriz);

  // 4) fundos (áreas que não se sobrepõem) e depois estilos, agrupados para poucas chamadas
  const porCor = {};
  const porEstilo = {};
  layout.specs.forEach(function (s) {
    if (s.tipo === 'fundo') (porCor[s.cor] = porCor[s.cor] || []).push(notacaoA1(s.r, s.c, s.nl, s.nc));
    if (s.tipo === 'estilo') (porEstilo[s.nome] = porEstilo[s.nome] || []).push(notacaoA1(s.r, s.c, s.nl, s.nc));
  });
  Object.keys(porCor).forEach(function (cor) { aba.getRangeList(porCor[cor]).setBackground(cor); });
  const estilos = estilosDaConsulta();
  Object.keys(porEstilo).forEach(function (nome) { aplicarEstiloNaLista(aba.getRangeList(porEstilo[nome]), estilos[nome]); });

  // 5) mesclagens, bordas, texto rico (marcadores coloridos) e imagem do brasão
  layout.specs.forEach(function (s) {
    if (s.tipo === 'mesclar') aba.getRange(s.r, s.c, s.nl, s.nc).merge();
    else if (s.tipo === 'borda') {
      const faixa = aba.getRange(s.r, s.c, s.nl, s.nc);
      const estilo = SpreadsheetApp.BorderStyle[s.espessura];
      if (s.modo === 'horizontal') faixa.setBorder(null, null, null, null, false, true, s.cor, estilo);
      else if (s.modo === 'cima') faixa.setBorder(true, null, null, null, null, null, s.cor, estilo);
      else if (s.modo === 'esquerda') faixa.setBorder(null, true, null, null, null, null, s.cor, estilo);
      else faixa.setBorder(true, true, true, true, null, null, s.cor, estilo);
    } else if (s.tipo === 'rico') {
      const construtor = SpreadsheetApp.newRichTextValue().setText(s.texto);
      s.runs.forEach(function (run) {
        let e = SpreadsheetApp.newTextStyle().setForegroundColor(run.cor);
        if (run.negrito) e = e.setBold(true);
        construtor.setTextStyle(run.ini, run.fim, e.build());
      });
      aba.getRange(s.r, s.c).setRichTextValue(construtor.build());
    } else if (s.tipo === 'imagem') {
      aba.getRange(s.r, s.c, s.nl, s.nc).merge();
      aba.getRange(s.r, s.c).setFormula('=IMAGE("' + s.url + '")');
    }
  });

  // 6) o ano do calendário é uma lista suspensa; mudar o ano refaz a Consulta (onEdit)
  aba.getRange(layout.celulaAno.linha, layout.celulaAno.coluna).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(layout.anos.map(String), true).setAllowInvalid(true).build());
}

/** Linha onde está o título do calendário (e, na mesma linha, o seletor de ano). 0 se a aba ainda não foi desenhada. */
function linhaDoSeletorDeAno(aba) {
  const ultima = aba.getLastRow();
  if (ultima < 1) return 0;
  const valores = aba.getRange(1, 2, ultima, 1).getValues();
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).trim() === CONFIG.CONSULTA.TITULO_FERIAS) return i + 1;
  }
  return 0;
}

function lerAnoDaConsulta(aba) {
  try {
    const linha = linhaDoSeletorDeAno(aba);
    if (linha) {
      const v = Number(aba.getRange(linha, CONFIG.CONSULTA.COLUNA_ANO).getValue());
      if (v >= 2000 && v <= 2100) return Math.floor(v);
    }
  } catch (e) { /* aba nova ou vazia */ }
  return partesDaData(hojeNormalizado()).ano;
}

/** Recalcula e redesenha a aba Consulta. */
function atualizarConsulta() {
  const planilha = obterPlanilha();
  let aba = planilha.getSheetByName(CONFIG.ABAS.CONSULTA);
  if (!aba) aba = planilha.insertSheet(CONFIG.ABAS.CONSULTA, 0);
  const ano = lerAnoDaConsulta(aba);
  const agora = Utilities.formatDate(new Date(), CONFIG.FUSO, 'dd/MM/yyyy HH:mm');
  const layout = montarLayoutDaConsulta(calcularDadosDaConsulta(hojeNormalizado(), ano, agora));
  aplicarLayoutNaConsulta(aba, layout);
  return { linhas: layout.totalLinhas, ano: ano };
}

/** Nunca deixa uma falha da Consulta atrapalhar quem a chamou. */
function atualizarConsultaSemErro() {
  try {
    atualizarConsulta();
  } catch (e) {
    Logger.log('Consulta não atualizada: ' + e.message);
  }
}

/** Usada depois das operações das telas: respeita CONFIG.CONSULTA.ATUALIZAR_APOS_OPERACAO. */
function atualizarConsultaAposOperacao() {
  if (CONFIG.CONSULTA.ATUALIZAR_APOS_OPERACAO) atualizarConsultaSemErro();
}