/**
 * Menu.gs — menu da planilha e ponte entre a tela (DialogFuncionario.html) e os Services.
 * Nenhuma regra de negócio aqui: só abre a tela, converte datas e chama os Services.
 */

function onOpen() {
  criarMenuDeFuncionarios();
}

function criarMenuDeFuncionarios() {
  SpreadsheetApp.getUi()
    .createMenu('👥 Funcionários')
    .addItem('➕ Cadastrar funcionário', 'abrirCadastrarFuncionario')
    .addItem('🔁 Renovar contrato', 'abrirRenovarContrato')
    .addItem('✏️ Alterar dados do contrato', 'abrirAlterarContrato')
    .addItem('👤 Alterar nome', 'abrirAlterarNome')
    .addSeparator()
    .addItem('⏸️ Suspender contrato', 'abrirSuspenderContrato')
    .addItem('▶️ Reativar contrato', 'abrirReativarContrato')
    .addItem('⛔ Desativar (encerrar) contrato', 'abrirDesativarContrato')
    .addSeparator()
    .addItem('🏖️ Atualizar período de férias', 'abrirAtualizarFerias')
    .addItem('✂️ Dividir férias (15 + 15)', 'abrirDividirFerias')
    .addItem('🚫 Marcar sem direito a férias', 'abrirSemDireitoAFerias')
    .addItem('🔄 Rodar rotina de férias agora', 'rodarRotinaDeFeriasPeloMenu')
    .addItem('⏰ Ativar rotina diária de férias', 'ativarRotinaDiariaPeloMenu')
    .addSeparator()
    .addItem('🕘 Horários de trabalho', 'abrirHorarios')
    .addItem('🗂️ Distribuição do balcão', 'abrirDistribuicao')
    .addItem('📋 Lista de presença', 'abrirListaDePresenca')
    .addSeparator()
    .addItem('📊 Atualizar Consulta', 'atualizarConsultaPeloMenu')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🛠️ Manutenção')
      .addItem('✅ Auditar dados', 'auditarDadosPeloMenu')
      .addItem('📝 Aplicar listas suspensas nas abas', 'aplicarValidacoesPeloMenu')
      .addItem('⚙️ Configurar automações', 'configurarAutomacoesPeloMenu')
      .addItem('⏱️ Medir desempenho', 'medirDesempenhoPeloMenu')
      .addItem('🔍 Verificar instalação', 'verificarInstalacao'))
    .addToUi();
}

/** Usado pelos arquivos HTML: <?!= incluirArquivoHtml('Styles/Estilos') ?> */
function incluirArquivoHtml(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** Abre uma tela (HTML em UI/) como janela modal. */
function abrirDialogoModal(arquivo, operacao, largura, altura, titulo) {
  const modelo = HtmlService.createTemplateFromFile(arquivo);
  modelo.operacaoInicial = operacao;
  SpreadsheetApp.getUi().showModalDialog(modelo.evaluate().setWidth(largura).setHeight(altura), titulo);
}

function abrirCadastrarFuncionario() { abrirDialogoModal('UI/DialogFuncionario', 'cadastrar', 540, 640, 'Funcionários'); }
function abrirRenovarContrato() { abrirDialogoModal('UI/DialogFuncionario', 'renovar', 540, 640, 'Funcionários'); }
function abrirAlterarContrato() { abrirDialogoModal('UI/DialogFuncionario', 'alterar', 540, 640, 'Funcionários'); }
function abrirAlterarNome() { abrirDialogoModal('UI/DialogFuncionario', 'nome', 540, 640, 'Funcionários'); }
function abrirSuspenderContrato() { abrirDialogoModal('UI/DialogFuncionario', 'suspender', 540, 640, 'Funcionários'); }
function abrirReativarContrato() { abrirDialogoModal('UI/DialogFuncionario', 'reativar', 540, 640, 'Funcionários'); }
function abrirDesativarContrato() { abrirDialogoModal('UI/DialogFuncionario', 'desativar', 540, 640, 'Funcionários'); }

/* ===================== FUNÇÕES CHAMADAS PELA TELA (google.script.run) ===================== */

/** "2027-03-01" (campo de data) -> "01/03/2027". Outros formatos passam como vieram. */
function converterDataIsoParaBr(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor === null || valor === undefined ? '' : valor).trim());
  return m ? m[3] + '/' + m[2] + '/' + m[1] : valor;
}

/** Dados da tela. Só textos e números (Date não atravessa o google.script.run). */
function obterDadosDoDialogo() {
  return {
    vinculos: CONFIG.TIPOS_VINCULO,
    cargos: CONFIG.CARGOS,
    setores: CONFIG.SETORES,
    status: CONFIG.STATUS_CONTRATO,
    contratos: listarContratos().map(function (c) {
      return {
        id: String(c.ID_CONTRATO), idFuncionario: String(c.ID_FUNCIONARIO), nome: String(c.NOME),
        status: String(c.STATUS), vinculo: String(c.VINCULO), cargo: String(c.CARGO), setor: String(c.SETOR),
        inicio: formatarData(c.INICIO), fim: formatarData(c.FIM), observacoes: String(c.OBSERVACOES)
      };
    })
  };
}

/** Recebe a operação escolhida na tela, chama o Service certo e devolve a mensagem para o usuário. */
function processarOperacaoDoDialogo(operacao, payload) {
  const p = payload || {};
  const campos = {};
  Object.keys(p.campos || {}).forEach(function (k) {
    campos[k] = (k === 'INICIO' || k === 'FIM') ? converterDataIsoParaBr(p.campos[k]) : p.campos[k];
  });
  switch (operacao) {
    case 'cadastrar': {
      const r = cadastrarFuncionario(campos);
      return 'Cadastrado(a): ' + normalizarNomeCompleto(campos.NOME) + ' (' + r.ID_FUNCIONARIO + ' / ' + r.ID_CONTRATO + ').';
    }
    case 'alterar': {
      const r = alterarDadosDoContrato(p.idContrato, campos);
      return r.alterados.length
        ? 'Contrato ' + r.ID_CONTRATO + ' alterado: ' + r.alterados.map(function (k) { return CONFIG.COLUNAS.FUNCIONARIOS[k]; }).join(', ') + '.'
        : 'Nada foi alterado.';
    }
    case 'renovar': {
      const r = renovarContrato(p.idContrato, campos);
      return 'Contrato ' + r.ID_CONTRATO_ANTERIOR + ' encerrado. Novo contrato: ' + r.ID_CONTRATO_NOVO + '.';
    }
    case 'nome': {
      const r = alterarNomeDoFuncionario(p.idFuncionario, p.novoNome);
      return r.alterado
        ? 'Nome alterado (e atualizado em ' + r.linhasEmOutrasAbas + ' linhas de outras abas).'
        : 'O nome já era esse.';
    }
    case 'suspender':
      return 'Contrato ' + suspenderContrato(p.idContrato, p.motivo).ID_CONTRATO + ' suspenso.';
    case 'reativar':
      return 'Contrato ' + reativarContrato(p.idContrato).ID_CONTRATO + ' reativado.';
    case 'desativar': {
      const r = encerrarContrato(p.idContrato, converterDataIsoParaBr(p.data), p.motivo);
      return 'Contrato ' + r.ID_CONTRATO + ' desativado em ' + r.DESLIGAMENTO + '.';
    }
    default:
      throw new Error('Operação desconhecida: ' + operacao);
  }
}

/* ===================== FÉRIAS ===================== */
function abrirAtualizarFerias() { abrirDialogoModal('UI/DialogFerias', 'atualizar', 560, 640, 'Férias'); }
function abrirDividirFerias() { abrirDialogoModal('UI/DialogFerias', 'dividir', 560, 640, 'Férias'); }
function abrirSemDireitoAFerias() { abrirDialogoModal('UI/DialogFerias', 'semdireito', 560, 640, 'Férias'); }

function cortarTextoParaJanela(texto) {
  return texto.length > 1500 ? texto.substring(0, 1500) + '\n...\n(lista completa em Execuções > Registros)' : texto;
}

/** Mostra o que a rotina faria e, se você confirmar, executa. */
function rodarRotinaDeFeriasPeloMenu() {
  const ui = SpreadsheetApp.getUi();
  const previa = sincronizarFeriasDosContratos(true);
  const texto = formatarResultadoDaRotinaDeFerias(previa);
  Logger.log(texto);
  if (!previa.criados.length && !previa.tiradas.length) {
    ui.alert('Rotina de férias', cortarTextoParaJanela(texto) + '\n\nNada a fazer.', ui.ButtonSet.OK);
    return;
  }
  if (ui.alert('Rotina de férias', cortarTextoParaJanela(texto) + '\n\nExecutar agora?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const final = formatarResultadoDaRotinaDeFerias(sincronizarFeriasDosContratos(false));
  Logger.log(final);
  ui.alert('Rotina de férias', cortarTextoParaJanela(final), ui.ButtonSet.OK);
}

function ativarRotinaDiariaPeloMenu() {
  const criou = instalarGatilhoDiarioDeFerias();
  SpreadsheetApp.getUi().alert(criou
    ? 'Pronto: a rotina de férias vai rodar todo dia, por volta das ' + CONFIG.FERIAS.HORA_ROTINA_DIARIA + 'h.'
    : 'A rotina diária de férias já estava ativada.');
}

/** Dados da tela de férias (só textos e números). Períodos sem contrato vinculado não entram: são contados à parte. */
function obterDadosDoDialogoDeFerias() {
  const contratos = {};
  listarContratos().forEach(function (c) { contratos[String(c.ID_CONTRATO)] = c; });
  const todas = listarFerias();
  const vinculadas = todas.filter(function (f) { return !valorVazio(f.ID_CONTRATO) && contratos[String(f.ID_CONTRATO)]; });
  const SF = CONFIG.STATUS_FERIAS;
  const periodosPorContrato = {};
  vinculadas.forEach(function (f) { (periodosPorContrato[String(f.ID_CONTRATO).trim()] = periodosPorContrato[String(f.ID_CONTRATO).trim()] || []).push(f); });
  return {
    status: CONFIG.STATUS_FERIAS,
    semVinculo: todas.length - vinculadas.length,
    contratos: listarContratos().filter(function (c) { return c.STATUS !== CONFIG.STATUS_CONTRATO.ENCERRADO; }).map(function (c) {
      const ps = periodosPorContrato[String(c.ID_CONTRATO).trim()] || [];
      const jaTemFerias = ps.some(function (p) { return p.STATUS === SF.PREVISTA || p.STATUS === SF.TIRADA; });
      const todosSemDireito = ps.length > 0 && ps.every(function (p) { return p.STATUS === SF.SEM_DIREITO; });
      return {
        idContrato: String(c.ID_CONTRATO), nome: String(c.NOME), status: String(c.STATUS),
        inicio: formatarData(c.INICIO), fim: formatarData(c.FIM), meses: mesesDoContrato(c),
        podeMarcarSemDireito: !jaTemFerias && !todosSemDireito,
        temSemDireito: ps.some(function (p) { return p.STATUS === SF.SEM_DIREITO; })
      };
    }),
    periodos: vinculadas.map(function (f) {
      const c = contratos[String(f.ID_CONTRATO)];
      return {
        idContrato: String(f.ID_CONTRATO), periodo: String(f.PERIODO), nome: String(f.NOME), status: String(f.STATUS),
        inicio: formatarData(f.INICIO), fim: formatarData(f.FIM), dias: f.DIAS === '' ? '' : String(f.DIAS),
        deseja15: String(f.DESEJA_15), observacoes: String(f.OBSERVACOES),
        corrigivel: f.STATUS === CONFIG.STATUS_FERIAS.TIRADA && f.FIM !== '' && compararDatas(f.FIM, hojeNormalizado()) >= 0,
        contratoStatus: String(c.STATUS), contratoInicio: formatarData(c.INICIO), contratoFim: formatarData(c.FIM)
      };
    })
  };
}

function processarOperacaoDeFeriasDoDialogo(operacao, payload) {
  const p = payload || {};
  switch (operacao) {
    case 'atualizar': {
      const dados = {};
      Object.keys(p.dados || {}).forEach(function (k) {
        dados[k] = (k === 'INICIO' || k === 'FIM') ? converterDataIsoParaBr(p.dados[k]) : p.dados[k];
      });
      const r = salvarPeriodoDeFerias(p.idContrato, p.periodo, dados);
      return r.alterados.length
        ? 'Período ' + r.PERIODO + ' do contrato ' + r.ID_CONTRATO + ' atualizado: ' +
          r.alterados.map(function (k) { return CONFIG.COLUNAS.FERIAS[k]; }).join(', ') + '.'
        : 'Nada foi alterado.';
    }
    case 'dividir': {
      const r = dividirFerias(p.idContrato);
      return 'Férias divididas: criado o período 2º (' + r.STATUS_SEGUNDO + ', sem datas).' + (r.aviso ? ' ' + r.aviso : '');
    }
    case 'semdireito': {
      const r = marcarSemDireitoAFerias(p.idContrato, p.motivo);
      return 'Contrato ' + r.ID_CONTRATO + ' marcado como sem direito a férias.';
    }
    case 'restaurar': {
      const r = restabelecerDireitoAFerias(p.idContrato);
      return 'Direito a férias restabelecido: ' + r.periodosRestabelecidos + ' período(s) voltaram para Pendente.';
    }
    default:
      throw new Error('Operação desconhecida: ' + operacao);
  }
}

/* ===================== HORÁRIOS E DISTRIBUIÇÃO ===================== */

function abrirHorarios() {
  abrirDialogoModal('UI/DialogHorario', null, 600, 700, 'Horários de trabalho');
}

function abrirDistribuicao() {
  abrirDialogoModal('UI/DialogDistribuicao', null, 560, 640, 'Distribuição do balcão');
}

/** Funcionários com contrato Ativo ou Suspenso, em ordem alfabética. */
function listarFuncionariosEmAberto() {
  return listarFuncionarios().map(function (p) {
    const abertos = p.contratos.filter(function (c) { return c.STATUS !== CONFIG.STATUS_CONTRATO.ENCERRADO; });
    if (!abertos.length) return null;
    const ativo = abertos.some(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.ATIVO; });
    return {
      id: String(p.ID_FUNCIONARIO), nome: String(p.NOME), status: ativo ? CONFIG.STATUS_CONTRATO.ATIVO : CONFIG.STATUS_CONTRATO.SUSPENSO,
      vinculo: vinculoAtualDoFuncionario(p)
    };
  }).filter(Boolean).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function obterDadosDoDialogoDeHorarios() {
  const horarios = {};
  listarHorarios().forEach(function (h) {
    const linha = {};
    CONFIG.DIAS.forEach(function (d) {
      linha[d.SIGLA + '_DE'] = horarioDaLinha(h, d.SIGLA + '_DE');
      linha[d.SIGLA + '_ATE'] = horarioDaLinha(h, d.SIGLA + '_ATE');
    });
    horarios[String(h.ID_FUNCIONARIO)] = linha;
  });
  return { dias: CONFIG.DIAS, pessoas: listarFuncionariosEmAberto(), horarios: horarios };
}

function processarOperacaoDeHorarioDoDialogo(payload) {
  const p = payload || {};
  const outros = (p.aplicarA || []).filter(function (id) { return id !== p.idFuncionario; });
  if (outros.length) {
    const r = aplicarHorarioAVarios([p.idFuncionario].concat(outros), p.horarios);
    return 'Horário aplicado a ' + r.total + ' funcionário(s); ' + r.alterados + ' com alteração.';
  }
  const r = salvarHorarioDoFuncionario(p.idFuncionario, p.horarios);
  if (r.criado) return 'Horário cadastrado.';
  return r.alterados.length ? 'Horário atualizado (' + r.alterados.length + ' campo(s)).' : 'Nada foi alterado.';
}

function obterDadosDoDialogoDeDistribuicao() {
  const distribuicao = {};
  listarDistribuicao().forEach(function (d) {
    const linha = { SETOR: String(d.SETOR), POSICAO: String(d.POSICAO), OBSERVACOES: String(d.OBSERVACOES) };
    CONFIG.DIAS.forEach(function (dia) { linha[dia.DISTRIBUICAO] = String(d[dia.DISTRIBUICAO]); });
    distribuicao[String(d.ID_FUNCIONARIO)] = linha;
  });
  const J = CONFIG.JORNADA;
  return {
    dias: CONFIG.DIAS, turnos: CONFIG.TURNOS, setores: CONFIG.SETORES, pessoas: listarFuncionariosEmAberto(), distribuicao: distribuicao,
    turnosPorVinculo: CONFIG.TIPOS_VINCULO.reduce(function (m, v) {
      m[v] = CONFIG.TURNOS.filter(function (t) { return turnoPermitidoParaVinculo(t, v); });
      return m;
    }, {}),
    dicaPorVinculo: CONFIG.TIPOS_VINCULO.reduce(function (m, v) {
      if (J.VINCULOS_MANHA_TARDE.indexOf(v) >= 0) {
        m[v] = 'Manhã+Tarde: ' + J.HORARIOS_MANHA_TARDE.map(function (h) { return h.DE + '–' + h.ATE; }).join(' ou ') +
          ', com ' + J.ALMOCO_MIN_ESTAGIO_MANHA_TARDE + ' min de almoço.';
      } else if (J.VINCULOS_INTEGRAL.indexOf(v) >= 0) {
        m[v] = 'Integral: ' + J.HORARIO_INTEGRAL.DE + '–' + J.HORARIO_INTEGRAL.ATE + '. ' + v + ' tem ' + (J.ALMOCO_MIN_POR_VINCULO[v] / 60) + 'h de almoço.';
      }
      return m;
    }, {})
  };
}

function processarOperacaoDeDistribuicaoDoDialogo(payload) {
  const p = payload || {};
  const r = salvarDistribuicaoDoFuncionario(p.idFuncionario, p.dados);
  if (r.criado) return 'Incluído(a) na distribuição do balcão.';
  return r.alterados.length ? 'Distribuição atualizada (' + r.alterados.length + ' campo(s)).' : 'Nada foi alterado.';
}

function executarOperacaoDoDialogo(operacao, payload) {
  return comAtualizacaoDaConsulta(function () { return processarOperacaoDoDialogo(operacao, payload); });
}

function executarOperacaoDeFeriasDoDialogo(operacao, payload) {
  return comAtualizacaoDaConsulta(function () { return processarOperacaoDeFeriasDoDialogo(operacao, payload); });
}

function executarOperacaoDeHorarioDoDialogo(payload) {
  return comAtualizacaoDaConsulta(function () { return processarOperacaoDeHorarioDoDialogo(payload); });
}

function executarOperacaoDeDistribuicaoDoDialogo(payload) {
  return comAtualizacaoDaConsulta(function () { return processarOperacaoDeDistribuicaoDoDialogo(payload); });
}

/** Item do menu: redesenha a Consulta e leva você até ela. */
function atualizarConsultaPeloMenu() {
  const r = atualizarConsulta();
  SpreadsheetApp.setActiveSheet(obterPlanilha().getSheetByName(CONFIG.ABAS.CONSULTA));
  SpreadsheetApp.getActive().toast('Consulta atualizada (calendário ' + r.ano + ').', 'Consulta', 5);
}

/** Gatilho simples: ao escolher outro ano na lista suspensa da Consulta, o calendário é refeito na hora. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const aba = e.range.getSheet();
    if (aba.getName() !== CONFIG.ABAS.CONSULTA) return;
    if (e.range.getColumn() !== CONFIG.CONSULTA.COLUNA_ANO || e.range.getRow() !== linhaDoSeletorDeAno(aba)) return;
    atualizarConsulta();
  } catch (erro) {
    SpreadsheetApp.getActive().toast(erro.message, 'Consulta', 8);
  }
}

/* ===================== MANUTENÇÃO ===================== */

function mostrarTextoNaJanela(titulo, texto) {
  try {
    SpreadsheetApp.getUi().alert(titulo, cortarTextoParaJanela(texto), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* sem interface: o texto já está no log */ }
}

function auditarDadosPeloMenu() { mostrarTextoNaJanela('Auditoria dos dados', validarIntegridadeDosDados().texto); }
function aplicarValidacoesPeloMenu() { mostrarTextoNaJanela('Listas suspensas', aplicarValidacoesNasAbas()); }
function configurarAutomacoesPeloMenu() { mostrarTextoNaJanela('Automações', configurarAutomacoes()); }
function medirDesempenhoPeloMenu() { mostrarTextoNaJanela('Desempenho', medirDesempenho()); }

/**
 * Pergunta Sim/Não numa janela da planilha. Sem a planilha aberta no navegador não há janela:
 * nesse caso explica o que fazer, em vez de mostrar o erro técnico do Apps Script.
 */
function pedirConfirmacaoDoUsuario(titulo, mensagem) {
  let ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    throw new Error('Esta ação pede uma confirmação numa janela da planilha. Abra a planilha em outra aba do navegador e rode de novo.');
  }
  return ui.alert(titulo, mensagem, ui.ButtonSet.YES_NO) === ui.Button.YES;
}

/** Executa a operação da tela e, se ela der certo, atualiza a Consulta (se estiver configurado). */
function comAtualizacaoDaConsulta(operacao) {
  const resultado = operacao();
  atualizarConsultaAposOperacao();
  return resultado;
}

/* ===================== LISTA DE PRESENÇA ===================== */

function abrirListaDePresenca() {
  abrirDialogoModal('UI/DialogPresenca', null, 1400, 880, 'Lista de presença');
}

/** Semana que contém a data (formato yyyy-MM-dd; vazio = semana atual), em uma única chamada. */
function obterSemanaDaPresenca(dataIso) {
  const data = valorVazio(dataIso) ? hojeNormalizado() : converterData(converterDataIsoParaBr(dataIso));
  if (!data) throw new Error('Data inválida: "' + dataIso + '".');
  return montarSemanaDePresenca(data);
}

/** payload = { itens: [{ data: 'yyyy-MM-dd', idFuncionario, status, observacao, horaChegada }], confirmouAlteracoes } */
function salvarPresencasDaSemanaDoDialogo(payload) {
  const p = payload || {};
  const itens = (p.itens || []).map(function (i) { return Object.assign({}, i, { data: converterDataIsoParaBr(i.data) }); });
  const r = salvarPresencasEmLote(itens, p.confirmouAlteracoes === true);
  const partes = [];
  if (r.novos) partes.push(r.novos + ' novo(s)');
  if (r.alterados) partes.push(r.alterados + ' alterado(s)');
  if (r.iguais) partes.push(r.iguais + ' sem mudança');
  return { novos: r.novos, alterados: r.alterados, iguais: r.iguais, mensagem: 'Registros salvos: ' + partes.join(', ') + '.' };
}

/** Pessoas que podem ser consultadas no histórico (inclui contratos encerrados). */
function listarPessoasParaHistoricoDePresenca() {
  return listarFuncionarios().map(function (p) { return { id: String(p.ID_FUNCIONARIO), nome: String(p.NOME) }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** payload = { idFuncionario (vazio = todos), inicio: 'yyyy-MM-dd', fim: 'yyyy-MM-dd' }. Somente leitura. */
function consultarHistoricoDePresencaDoDialogo(payload) {
  const p = payload || {};
  return consultarHistoricoDePresenca(p.idFuncionario, converterDataIsoParaBr(p.inicio), converterDataIsoParaBr(p.fim));
}

/** Tudo que a tela precisa para uma data (formato yyyy-MM-dd; vazio = hoje), em uma única chamada. */
function obterDadosDaPresenca(dataIso) {
  const data = valorVazio(dataIso) ? hojeNormalizado() : converterData(converterDataIsoParaBr(dataIso));
  if (!data) throw new Error('Data inválida: "' + dataIso + '".');
  return montarListaDePresenca(data);
}

function salvarPresencasDoDialogo(payload) {
  const p = payload || {};
  const r = salvarPresencas(converterDataIsoParaBr(p.data), p.itens, p.confirmouAlteracoes === true);
  const partes = [];
  if (r.novos) partes.push(r.novos + ' novo(s)');
  if (r.alterados) partes.push(r.alterados + ' alterado(s)');
  if (r.iguais) partes.push(r.iguais + ' sem mudança');
  return { novos: r.novos, alterados: r.alterados, iguais: r.iguais, mensagem: 'Presença salva: ' + partes.join(', ') + '.' };
}