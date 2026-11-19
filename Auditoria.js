/**
 * Auditoria.gs — conferência dos dados, listas suspensas, gatilhos e desempenho.
 * Tudo aqui é leitura, exceto aplicarValidacoesNasAbas() (só coloca listas suspensas)
 * e configurarAutomacoes() (só mexe em gatilhos).
 */

/* ===================== AUDITORIA DE DADOS ===================== */

/**
 * Cruza os dados já lidos e devolve a lista de problemas [{ nivel: 'ERRO'|'AVISO', texto }].
 * Função "pura": recebe os dados em d = { contratos, ferias, preferencias, horarios, distribuicao, hoje }.
 */
function auditarDados(d) {
  const problemas = [];
  const erro = function (t) { problemas.push({ nivel: 'ERRO', texto: t }); };
  const aviso = function (t) { problemas.push({ nivel: 'AVISO', texto: t }); };
  const txt = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };
  const ST = CONFIG.STATUS_CONTRATO;
  const SF = CONFIG.STATUS_FERIAS;
  const statusContrato = Object.keys(ST).map(function (k) { return ST[k]; });
  const statusFerias = Object.keys(SF).map(function (k) { return SF[k]; });

  // ---- contratos ----
  const contratoPorId = {};
  const contratosPorPessoa = {};
  const idsPorNome = {};
  d.contratos.forEach(function (c) {
    const id = txt(c.ID_CONTRATO);
    const idf = txt(c.ID_FUNCIONARIO);
    const rotulo = txt(c.NOME) + ' (' + (id || 'sem ID') + ')';
    if (!id) erro('Contrato sem ID: ' + txt(c.NOME) + ' (linha ' + c._linha + ' de Funcionários).');
    else {
      if (contratoPorId[id]) erro('ID de contrato repetido: ' + id + '.');
      contratoPorId[id] = c;
      if (!idEhValido(id, CONFIG.IDS.PREFIXO_CONTRATO)) aviso('ID de contrato fora do padrão: ' + id + '.');
    }
    if (!idf) erro('Contrato sem ID de funcionário: ' + rotulo + '.');
    else (contratosPorPessoa[idf] = contratosPorPessoa[idf] || []).push(c);
    if (idf) { const k = chaveDoNome(c.NOME); idsPorNome[k] = idsPorNome[k] || {}; idsPorNome[k][idf] = true; }
    if (statusContrato.indexOf(txt(c.STATUS)) < 0) erro('Status de contrato inválido em ' + rotulo + ': "' + txt(c.STATUS) + '".');
    if (CONFIG.TIPOS_VINCULO.indexOf(txt(c.VINCULO)) < 0) erro('Tipo de vínculo inválido em ' + rotulo + ': "' + txt(c.VINCULO) + '".');
    const temIni = c.INICIO !== '';
    const temFim = c.FIM !== '';
    if (temIni !== temFim) erro('Contrato com só uma das datas: ' + rotulo + '.');
    if (temIni && temFim && compararDatas(c.FIM, c.INICIO) < 0) erro('Contrato com fim antes do início: ' + rotulo + '.');
    if (txt(c.STATUS) === ST.ATIVO && temFim && compararDatas(c.FIM, d.hoje) < 0) {
      aviso('Contrato vencido e ainda Ativo: ' + rotulo + ' (fim em ' + formatarData(c.FIM) + ').');
    }
  });
  Object.keys(contratosPorPessoa).forEach(function (idf) {
    const lista = contratosPorPessoa[idf];
    const nomes = {};
    lista.forEach(function (c) { nomes[txt(c.NOME)] = true; });
    if (Object.keys(nomes).length > 1) erro('A pessoa ' + idf + ' tem nomes diferentes nos contratos: ' + Object.keys(nomes).join(' | ') + '.');
    const ativos = lista.filter(function (c) { return txt(c.STATUS) === ST.ATIVO; });
    if (ativos.length > 1) aviso(txt(lista[0].NOME) + ' (' + idf + ') tem ' + ativos.length + ' contratos Ativos ao mesmo tempo.');
  });
  Object.keys(idsPorNome).forEach(function (k) {
    const ids = Object.keys(idsPorNome[k]);
    if (ids.length > 1) aviso('Mesmo nome com IDs de funcionário diferentes (' + ids.join(', ') + '): possível pessoa duplicada.');
  });

  // ---- férias ----
  const porContrato = {};
  d.ferias.forEach(function (f) {
    const rotulo = txt(f.NOME) + ' ' + txt(f.PERIODO) + ' (linha ' + f._linha + ' de Férias)';
    const idc = txt(f.ID_CONTRATO);
    const c = idc ? contratoPorId[idc] : null;
    if (!idc) aviso('Férias sem contrato vinculado: ' + rotulo + '.');
    else if (!c) erro('Férias apontam para contrato inexistente (' + idc + '): ' + rotulo + '.');
    else {
      (porContrato[idc] = porContrato[idc] || []).push(f);
      if (txt(f.ID_FUNCIONARIO) !== txt(c.ID_FUNCIONARIO)) erro('Férias com ID de funcionário diferente do contrato: ' + rotulo + '.');
      if (txt(f.NOME) !== txt(c.NOME)) aviso('Nome nas férias difere do contrato: ' + rotulo + ' (contrato: ' + txt(c.NOME) + ').');
    }
    if (CONFIG.PERIODOS_FERIAS.indexOf(txt(f.PERIODO)) < 0) erro('Período inválido em ' + rotulo + ': "' + txt(f.PERIODO) + '".');
    const status = txt(f.STATUS);
    if (statusFerias.indexOf(status) < 0) erro('Status de férias inválido em ' + rotulo + ': "' + status + '".');
    const temIni = f.INICIO !== '';
    const temFim = f.FIM !== '';
    if (temIni !== temFim) erro('Férias com só uma das datas: ' + rotulo + '.');
    if ((status === SF.PREVISTA || status === SF.TIRADA) && !(temIni && temFim)) erro('Férias "' + status + '" sem datas: ' + rotulo + '.');
    if (status === SF.SEM_DIREITO && (temIni || temFim)) aviso('Férias "Sem direito" com datas: ' + rotulo + '.');
    if (temIni && temFim) {
      if (compararDatas(f.FIM, f.INICIO) < 0) erro('Férias com fim antes do início: ' + rotulo + '.');
      else {
        const calc = diasEntreDatas(f.INICIO, f.FIM);
        if (txt(f.DIAS) === '' || Number(f.DIAS) !== calc) aviso('Dias diferentes do calculado em ' + rotulo + ': planilha "' + txt(f.DIAS) + '", datas dão ' + calc + '.');
        if (c && c.INICIO !== '' && c.FIM !== '' && (compararDatas(f.INICIO, c.INICIO) < 0 || compararDatas(f.FIM, c.FIM) > 0)) {
          aviso('Férias fora do período do contrato: ' + rotulo + '.');
        }
        if (status === SF.PREVISTA && compararDatas(f.FIM, d.hoje) < 0) aviso('Férias Prevista com fim no passado (a rotina marcará Tirada): ' + rotulo + '.');
        if (status === SF.TIRADA && compararDatas(f.FIM, d.hoje) >= 0) aviso('Férias Tirada que ainda não terminaram: ' + rotulo + '.');
      }
    }
  });
  Object.keys(porContrato).forEach(function (idc) {
    const lista = porContrato[idc];
    const vistos = {};
    lista.forEach(function (f) {
      const p = txt(f.PERIODO);
      if (vistos[p]) erro('Período ' + p + ' repetido no contrato ' + idc + '.');
      vistos[p] = true;
    });
    if (vistos['2º'] && !vistos['1º']) aviso('O contrato ' + idc + ' tem período 2º sem o 1º.');
    const comDatas = lista.filter(function (f) { return f.INICIO !== '' && f.FIM !== ''; });
    comDatas.forEach(function (x, i) {
      comDatas.forEach(function (y, j) {
        if (i < j && compararDatas(x.INICIO, y.FIM) <= 0 && compararDatas(x.FIM, y.INICIO) >= 0) {
          erro('Períodos ' + txt(x.PERIODO) + ' e ' + txt(y.PERIODO) + ' se sobrepõem no contrato ' + idc + '.');
        }
      });
    });
  });

  // ---- preferências ----
  d.preferencias.forEach(function (p) {
    const idc = txt(p.ID_CONTRATO);
    if (!idc) aviso('Preferência sem contrato vinculado: ' + txt(p.NOME) + '.');
    else if (!contratoPorId[idc]) aviso('Preferência aponta para contrato inexistente (' + idc + '): ' + txt(p.NOME) + '.');
  });

  // ---- horários ----
  const vistosHorario = {};
  const horarioPorPessoa = {};
  d.horarios.forEach(function (h) {
    const idf = txt(h.ID_FUNCIONARIO);
    horarioPorPessoa[idf] = {};
    CONFIG.DIAS.forEach(function (dia) {
      horarioPorPessoa[idf][dia.SIGLA + '_DE'] = horarioDaLinha(h, dia.SIGLA + '_DE');
      horarioPorPessoa[idf][dia.SIGLA + '_ATE'] = horarioDaLinha(h, dia.SIGLA + '_ATE');
    });
    if (!contratosPorPessoa[idf]) erro('Horário de funcionário inexistente: ' + txt(h.NOME) + ' (' + idf + ').');
    if (vistosHorario[idf]) erro('Mais de uma linha de horário para ' + idf + '.');
    vistosHorario[idf] = true;
    try { normalizarHorariosDaSemana(h); } catch (e) { erro('Horário inválido de ' + txt(h.NOME) + ': ' + e.message); }
  });

  // ---- distribuição ----
  const vistosDist = {};
  d.distribuicao.forEach(function (x) {
    const idf = txt(x.ID_FUNCIONARIO);
    const lista = contratosPorPessoa[idf];
    if (!lista) erro('Distribuição de funcionário inexistente: ' + txt(x.NOME) + ' (' + idf + ').');
    else if (!lista.some(function (c) { return txt(c.STATUS) === ST.ATIVO; })) {
      if (CONFIG.DIAS.some(function (dia) { return txt(x[dia.DISTRIBUICAO]) !== ''; })) aviso(txt(x.NOME) + ' está na distribuição do balcão sem contrato Ativo.');
    }
    if (vistosDist[idf]) erro('Mais de uma linha de distribuição para ' + idf + '.');
    vistosDist[idf] = true;
    const vinculo = lista ? vinculoAtualDoFuncionario({ contratos: lista }) : '';
    const horario = horarioPorPessoa[idf];
    const J = CONFIG.JORNADA;
    CONFIG.DIAS.forEach(function (dia) {
      let turno;
      try { turno = normalizarTurno(x[dia.DISTRIBUICAO]); } catch (e) { erro('Distribuição de ' + txt(x.NOME) + ' (' + dia.NOME + '): ' + e.message); return; }
      if (!turno || !lista) return;
      if (!turnoPermitidoParaVinculo(turno, vinculo)) {
        aviso('Distribuição de ' + txt(x.NOME) + ' (' + dia.NOME + '): "' + turno + '" não vale para ' + vinculo +
          (turno === J.TURNO_MANHA_TARDE ? ' (use "' + J.TURNO_INTEGRAL + '").' : '.'));
      } else if (turno === J.TURNO_MANHA_TARDE && horario) {
        const de = txt(horario[dia.SIGLA + '_DE']);
        const ate = txt(horario[dia.SIGLA + '_ATE']);
        const ok = J.HORARIOS_MANHA_TARDE.some(function (h) { return h.DE === de && h.ATE === ate; });
        if (de && ate && !ok) {
          aviso('Horário de ' + txt(x.NOME) + ' (' + dia.NOME + ') é ' + de + '–' + ate + ', mas Manhã+Tarde deve ser ' +
            J.HORARIOS_MANHA_TARDE.map(function (h) { return h.DE + '–' + h.ATE; }).join(' ou ') + '.');
        }
      }
    });
  });
  // ---- presença ----
  const vistosPresenca = {};
  const idsDePresenca = {};
  (d.presencas || []).forEach(function (p) {
    const idf = txt(p.ID_FUNCIONARIO);
    const rotulo = txt(p.NOME) + ' em ' + formatarData(p.DATA) + ' (linha ' + p._linha + ' de Presença)';
    if (!converterData(p.DATA)) erro('Presença com data inválida (linha ' + p._linha + ' de Presença).');
    if (!contratosPorPessoa[idf]) erro('Presença de funcionário inexistente: ' + rotulo + '.');
    try { normalizarStatusDePresenca(p.STATUS); } catch (e) { erro('Situação de presença inválida em ' + rotulo + ': "' + txt(p.STATUS) + '".'); }
    const chave = idf + '|' + formatarData(p.DATA);
    if (vistosPresenca[chave]) erro('Presença duplicada: ' + rotulo + '.');
    vistosPresenca[chave] = true;
    const idRegistro = txt(p.ID_REGISTRO);
    if (!idRegistro) erro('Presença sem ID de registro (linha ' + p._linha + ' de Presença).');
    else {
      if (idsDePresenca[idRegistro]) erro('ID de registro de presença repetido: ' + idRegistro + '.');
      idsDePresenca[idRegistro] = true;
    }
  });
  return problemas;
}

/** Lê todas as abas, confere as regras acima e também a coluna Duração e os gatilhos. Não grava nada. */
function validarIntegridadeDosDados() {
  const dados = {
    contratos: listarContratos(), ferias: listarFerias(), preferencias: listarPreferencias(),
    horarios: listarHorarios(), distribuicao: listarDistribuicao(), presencas: listarPresencas(), hoje: hojeNormalizado()
  };
  const problemas = auditarDados(dados);

  try {
    const aba = obterAbaPorChave('FUNCIONARIOS');
    const mapa = mapearColunasPorCabecalho(aba, CONFIG.COLUNAS.FUNCIONARIOS);
    const ultima = aba.getLastRow();
    if (ultima > CONFIG.LINHA_CABECALHO) {
      const valores = aba.getRange(CONFIG.LINHA_CABECALHO + 1, mapa.indices.DURACAO + 1, ultima - CONFIG.LINHA_CABECALHO, 1).getDisplayValues();
      const comErro = valores.filter(function (v) { return String(v[0]).charAt(0) === '#'; }).length;
      if (comErro) problemas.push({ nivel: 'ERRO', texto: comErro + ' célula(s) da coluna Duração com erro de fórmula (rode corrigirFormulaDeDuracao).' });
    }
  } catch (e) {
    problemas.push({ nivel: 'AVISO', texto: 'Não foi possível conferir a coluna Duração: ' + e.message });
  }

  const gatilhos = ScriptApp.getProjectTriggers().map(function (g) { return { funcao: g.getHandlerFunction() }; });
  const cls = classificarGatilhos(gatilhos, funcaoExiste);
  cls.faltando.forEach(function (n) { problemas.push({ nivel: 'AVISO', texto: 'Gatilho esperado não instalado: ' + n + ' (rode configurarAutomacoes).' }); });
  cls.duplicados.forEach(function (i) { problemas.push({ nivel: 'ERRO', texto: 'Gatilho duplicado: ' + gatilhos[i].funcao + ' (rode configurarAutomacoes).' }); });
  cls.semFuncao.forEach(function (i) { problemas.push({ nivel: 'ERRO', texto: 'Gatilho aponta para função que não existe: ' + gatilhos[i].funcao + ' (rode configurarAutomacoes).' }); });
  cls.desconhecidos.forEach(function (i) { problemas.push({ nivel: 'AVISO', texto: 'Gatilho que não é do sistema: ' + gatilhos[i].funcao + '.' }); });

  const erros = problemas.filter(function (p) { return p.nivel === 'ERRO'; });
  const avisos = problemas.filter(function (p) { return p.nivel === 'AVISO'; });
  const linhas = [
    'AUDITORIA DOS DADOS (somente leitura)',
    'Contratos: ' + dados.contratos.length + ' | Férias: ' + dados.ferias.length + ' | Preferências: ' + dados.preferencias.length +
      ' | Horários: ' + dados.horarios.length + ' | Distribuição: ' + dados.distribuicao.length + ' | Presenças: ' + dados.presencas.length + ' | Histórico: ' + Math.max(0, obterAbaPorChave('HISTORICO').getLastRow() - CONFIG.LINHA_CABECALHO),
    'Erros: ' + erros.length + ' | Avisos: ' + avisos.length, ''
  ];
  if (erros.length) { linhas.push('ERROS:'); erros.forEach(function (p) { linhas.push('  - ' + p.texto); }); linhas.push(''); }
  if (avisos.length) { linhas.push('AVISOS:'); avisos.forEach(function (p) { linhas.push('  - ' + p.texto); }); }
  if (!problemas.length) linhas.push('Nenhum problema encontrado.');
  const texto = linhas.join('\n');
  Logger.log(texto);
  return { erros: erros.length, avisos: avisos.length, texto: texto, problemas: problemas };
}

/* ===================== LISTAS SUSPENSAS ===================== */

function montarRegrasDeValidacao() {
  const valoresDe = function (objeto) { return Object.keys(objeto).map(function (k) { return objeto[k]; }); };
  const regras = [
    { aba: 'FUNCIONARIOS', coluna: 'VINCULO', valores: CONFIG.TIPOS_VINCULO },
    { aba: 'FUNCIONARIOS', coluna: 'STATUS', valores: valoresDe(CONFIG.STATUS_CONTRATO) },
    { aba: 'FERIAS', coluna: 'PERIODO', valores: CONFIG.PERIODOS_FERIAS },
    { aba: 'FERIAS', coluna: 'STATUS', valores: valoresDe(CONFIG.STATUS_FERIAS) },
    { aba: 'FERIAS', coluna: 'DESEJA_15', valores: ['Sim'] },
    { aba: 'PREFERENCIAS', coluna: 'DESEJA_DIVIDIR', valores: ['Sim', 'Não'] }
  ];
  if (CONFIG.CARGOS.length) regras.push({ aba: 'FUNCIONARIOS', coluna: 'CARGO', valores: CONFIG.CARGOS });
  if (CONFIG.SETORES.length) {
    regras.push({ aba: 'FUNCIONARIOS', coluna: 'SETOR', valores: CONFIG.SETORES });
    regras.push({ aba: 'DISTRIBUICAO', coluna: 'SETOR', valores: CONFIG.SETORES });
  }
  CONFIG.DIAS.forEach(function (dia) { regras.push({ aba: 'DISTRIBUICAO', coluna: dia.DISTRIBUICAO, valores: CONFIG.TURNOS }); });
  return regras;
}

/** Coloca listas suspensas (que recusam valores fora da lista) nas colunas de status, vínculo, período e turnos. */
function aplicarValidacoesNasAbas() {
  const linhas = [];
  montarRegrasDeValidacao().forEach(function (r) {
    const aba = obterAbaPorChave(r.aba);
    const mapa = mapearColunasPorCabecalho(aba, CONFIG.COLUNAS[r.aba]);
    const total = aba.getMaxRows() - CONFIG.LINHA_CABECALHO;
    aba.getRange(CONFIG.LINHA_CABECALHO + 1, mapa.indices[r.coluna] + 1, total, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(r.valores, true).setAllowInvalid(false).build());
    linhas.push(CONFIG.ABAS[r.aba] + ' › ' + CONFIG.COLUNAS[r.aba][r.coluna] + ': ' + r.valores.join(', '));
  });
  const texto = 'LISTAS SUSPENSAS APLICADAS (' + linhas.length + ')\n  - ' + linhas.join('\n  - ');
  Logger.log(texto);
  return texto;
}

/* ===================== GATILHOS ===================== */

/** Tipo ("function", "object", "undefined"...) do nome global; "erro" se não der para checar. */
function tipoDoNome(nome) {
  try { return new Function('return typeof ' + nome)(); } catch (e) { return 'erro'; }
}

function funcaoExiste(nome) {
  return tipoDoNome(nome) === 'function';
}

/**
 * Classifica os gatilhos (por posição na lista): manter, duplicados, semFuncao (a função não existe mais),
 * desconhecidos (função existe mas não é do sistema) e faltando (esperados que não estão instalados).
 */
function classificarGatilhos(gatilhos, existe) {
  const esperados = CONFIG.AUTOMACAO.GATILHOS_ESPERADOS;
  const r = { manter: [], duplicados: [], semFuncao: [], desconhecidos: [], faltando: [] };
  const vistos = {};
  gatilhos.forEach(function (g, i) {
    if (!existe(g.funcao)) { r.semFuncao.push(i); return; }
    if (esperados.indexOf(g.funcao) < 0) { r.desconhecidos.push(i); return; }
    if (vistos[g.funcao]) { r.duplicados.push(i); return; }
    vistos[g.funcao] = true;
    r.manter.push(i);
  });
  esperados.forEach(function (nome) { if (!vistos[nome]) r.faltando.push(nome); });
  return r;
}

/** Deixa exatamente um gatilho de cada esperado: remove duplicados e gatilhos de funções que não existem mais. */
function configurarAutomacoes() {
  const reais = ScriptApp.getProjectTriggers();
  const lista = reais.map(function (g) { return { funcao: g.getHandlerFunction() }; });
  const cls = classificarGatilhos(lista, funcaoExiste);
  const log = [];
  cls.duplicados.concat(cls.semFuncao).forEach(function (i) {
    ScriptApp.deleteTrigger(reais[i]);
    log.push('Removido: ' + lista[i].funcao + (cls.semFuncao.indexOf(i) >= 0 ? ' (função não existe mais)' : ' (duplicado)'));
  });
  if (cls.faltando.indexOf('executarRotinaDiariaDeFerias') >= 0 && instalarGatilhoDiarioDeFerias()) {
    log.push('Instalado: executarRotinaDiariaDeFerias (todo dia, por volta das ' + CONFIG.FERIAS.HORA_ROTINA_DIARIA + 'h)');
  }
  cls.desconhecidos.forEach(function (i) { log.push('Mantido (não é do sistema): ' + lista[i].funcao); });
  if (!log.length) log.push('Nada a fazer: os gatilhos já estão corretos.');
  const texto = 'AUTOMAÇÕES\n  - ' + log.join('\n  - ');
  Logger.log(texto);
  return texto;
}

/* ===================== DESEMPENHO ===================== */

/** Mede o tempo das leituras e cálculos principais (somente leitura). Tempos acima de 3 s merecem atenção. */
function medirDesempenho() {
  const linhas = ['DESEMPENHO (ms)'];
  const medir = function (rotulo, funcao) {
    const inicio = Date.now();
    const resultado = funcao();
    const ms = Date.now() - inicio;
    linhas.push('  ' + rotulo + ': ' + ms + ' ms' + (Array.isArray(resultado) ? ' (' + resultado.length + ' linhas)' : '') + (ms > 3000 ? '  <-- lento' : ''));
  };
  medir('Ler contratos', listarContratos);
  medir('Ler férias', listarFerias);
  medir('Ler horários', listarHorarios);
  medir('Ler distribuição', listarDistribuicao);
  medir('Ler histórico', listarHistorico);
  medir('Calcular dados da Consulta', function () { return calcularDadosDaConsulta(hojeNormalizado(), partesDaData(hojeNormalizado()).ano, ''); });
  medir('Simular rotina de férias', function () { return sincronizarFeriasDosContratos(true).criados; });
  medir('Auditar dados', function () { return validarIntegridadeDosDados().problemas; });
  const texto = linhas.join('\n');
  Logger.log(texto);
  return texto;
}

/* ===================== CORREÇÃO DE NOMES ===================== */

function formatarResultadoDaCorrecaoDeNomes(r) {
  const linhas = [(r.simulado ? 'SIMULAÇÃO (nada gravado)' : 'CORREÇÃO EXECUTADA') + ' — nomes alinhados ao do contrato (' + r.linhas.length + ')'];
  r.linhas.forEach(function (x) { linhas.push('  - ' + x); });
  return linhas.join('\n');
}

/** Mostra no log quais nomes (Férias, Preferências, Horários, Distribuição) seriam alinhados ao nome do contrato. */
function simularCorrecaoDeNomes() {
  const texto = formatarResultadoDaCorrecaoDeNomes(sincronizarNomesComOsContratos(true));
  Logger.log(texto);
  return texto;
}

/** Alinha os nomes (pede confirmação). O vínculo entre as abas é sempre pelo ID; só o texto do nome muda. */
function executarCorrecaoDeNomes() {
  const previa = sincronizarNomesComOsContratos(true);
  if (!previa.linhas.length) {
    mostrarTextoNaJanela('Correção de nomes', 'Todos os nomes já estão iguais aos dos contratos.');
    return 'Nada a fazer.';
  }
  if (!pedirConfirmacaoDoUsuario('Correção de nomes', previa.linhas.length + ' linha(s) terão o nome alinhado ao do contrato. Continuar?')) return 'Cancelado.';
  const texto = formatarResultadoDaCorrecaoDeNomes(sincronizarNomesComOsContratos(false));
  Logger.log(texto);
  mostrarTextoNaJanela('Correção de nomes', texto);
  return texto;
}

/* ===================== ABAS ANTIGAS (_Legado) ===================== */

function alternarAbasLegado(ocultar) {
  const log = [];
  CONFIG.ABAS_LEGADO.forEach(function (nome) {
    const aba = obterPlanilha().getSheetByName(nome + CONFIG.SUFIXO_LEGADO);
    if (!aba || aba.isSheetHidden() === ocultar) return;
    if (ocultar) aba.hideSheet(); else aba.showSheet();
    log.push((ocultar ? 'Ocultada: ' : 'Reexibida: ') + aba.getName());
  });
  const texto = log.length ? log.join('\n') : (ocultar ? 'Nenhuma aba legado visível.' : 'Nenhuma aba legado oculta.');
  Logger.log(texto);
  return texto;
}

/** Esconde (não apaga) as abas _Legado. Para voltar a ver: reexibirAbasLegado. */
function ocultarAbasLegado() {
  return alternarAbasLegado(true);
}

function reexibirAbasLegado() {
  return alternarAbasLegado(false);
}