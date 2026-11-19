/**
 * Code.gs — ponto de entrada. Nesta etapa: apenas o teste da fundação.
 * O menu (UI/Menu.gs) e as demais funções entram nas próximas etapas.
 */

/**
 * Testa Utils e a camada de leitura/gravação SEM tocar nas abas reais:
 * usa uma aba temporária "_TESTE_FUNDACAO" (com colunas em ordem invertida, para provar
 * que as colunas são localizadas pelo cabeçalho) e a remove no final.
 */
function testarFundacao() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }

  // DataUtils
  afirmar(formatarData('01/02/2027') === '01/02/2027', 'converterData/formatar texto dd/MM/yyyy');
  afirmar(converterData('-') === null, 'converterData("-") retorna null');
  afirmar(converterData('31/02/2027') === null, 'converterData rejeita data inexistente');
  afirmar(diasEntreDatas('01/01/2027', '15/01/2027') === 15, 'diasEntreDatas conta início e fim (15)');
  afirmar(diasEntreDatas('09/08/2026', '15/08/2026') === 7, 'diasEntreDatas (7)');
  afirmar(formatarData(somarMesesData('31/01/2027', 1)) === '28/02/2027', 'somarMesesData ajusta fim de mês');
  afirmar(formatarData(somarDiasData('28/02/2027', 1)) === '01/03/2027', 'somarDiasData');
  afirmar(dataEstaNoIntervalo('10/01/2027', '01/01/2027', '15/01/2027'), 'dataEstaNoIntervalo');

  // ValidacaoUtils
  afirmar(chaveDoNome('  José   Antônio ') === 'jose antonio', 'chaveDoNome ignora acento e espaços');
  afirmar(chaveDoNome('Jose Antonio') === chaveDoNome('José Antônio '), 'Nomes com grafia diferente geram a mesma chave');
  afirmar(valorVazio('-') && valorVazio('') && !valorVazio('x'), 'valorVazio');

  // IdUtils
  const propriedades = PropertiesService.getScriptProperties();
  try {
    const ids = reservarIds('TESTE', 2, ['TESTE-0005']);
    afirmar(ids[0] === 'TESTE-0006' && ids[1] === 'TESTE-0007', 'reservarIds respeita o maior ID existente');
    afirmar(formatarId(CONFIG.IDS.PREFIXO_FUNCIONARIO, 7) === 'FUNC-0007' && idEhValido('CONT-0012', 'CONT'), 'formatarId/ehValido');
  } finally {
    propriedades.deleteProperty('ULTIMO_ID_TESTE');
  }

  // PlanilhaUtils em aba temporária
  const planilha = obterPlanilha();
  const nomeTemp = '_TESTE_FUNDACAO';
  if (planilha.getSheetByName(nomeTemp)) {
    throw new Error('Já existe a aba "' + nomeTemp + '". Remova-a manualmente e rode o teste de novo.');
  }
  const aba = planilha.insertSheet(nomeTemp);
  try {
    const colunas = CONFIG.COLUNAS.HISTORICO;
    const cabecalhos = Object.keys(colunas).map(function (k) { return colunas[k]; }).reverse();
    aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);

    const linhas = executarComTrava(function () {
      return inserirRegistrosNaAba(aba, colunas, [
        { DATA_HORA: new Date(), USUARIO: 'teste', OPERACAO: 'Cadastro', NOVO_VALOR: 'A' },
        { DATA_HORA: new Date(), USUARIO: 'teste', OPERACAO: 'Alteração', CAMPO: 'Status', VALOR_ANTERIOR: 'Ativo', NOVO_VALOR: 'Suspenso' }
      ], CONFIG.COLUNAS_FORMATO.HISTORICO);
    });
    afirmar(linhas.length === 2 && linhas[0] === 2 && linhas[1] === 3, 'inserirNaAba grava em lote nas linhas 2 e 3');

    const lidos = lerRegistrosDaAba(aba, colunas);
    afirmar(lidos.length === 2, 'lerRegistrosDaAba lê 2 registros');
    afirmar(lidos[1].OPERACAO === 'Alteração' && lidos[1].NOVO_VALOR === 'Suspenso', 'Colunas localizadas pelo cabeçalho (ordem invertida)');
    afirmar(lidos[0].DATA_HORA instanceof Date, 'Coluna de data/hora volta como Date');

    const diff = atualizarRegistroNaAba(aba, colunas, lidos[1]._linha, { NOVO_VALOR: 'Ativo', USUARIO: 'teste' });
    afirmar(diff.depois.NOVO_VALOR === 'Ativo' && diff.antes.NOVO_VALOR === 'Suspenso' && !('USUARIO' in diff.depois),
      'atualizarNaAba grava só o que mudou e devolve antes/depois');

    let falhou = false;
    try {
      atualizarRegistroNaAba(aba, colunas, 999, { NOVO_VALOR: 'x' });
    } catch (e) { falhou = true; }
    afirmar(falhou, 'atualizarNaAba rejeita linha inexistente');
  } finally {
    planilha.deleteSheet(aba);
  }

  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Confere se todos os arquivos novos estão no projeto e na versão certa.
 * Rode quando algo parecer faltando. Mostra no log (e em janela) o que falta ou está desatualizado.
 */
function verificarInstalacao() {
  const esperadas = {
    'Auditoria.gs': ['auditarDados', 'validarIntegridadeDosDados', 'montarRegrasDeValidacao', 'aplicarValidacoesNasAbas', 'tipoDoNome', 'funcaoExiste', 'classificarGatilhos', 'configurarAutomacoes', 'medirDesempenho', 'formatarResultadoDaCorrecaoDeNomes', 'simularCorrecaoDeNomes', 'executarCorrecaoDeNomes', 'alternarAbasLegado', 'ocultarAbasLegado', 'reexibirAbasLegado'],
    'Repositories/ContratoRepository.gs': ['listarContratos', 'buscarContratoPorId', 'listarContratosDoFuncionario', 'listarIdsDeContrato', 'gerarProximoIdContrato', 'inserirContratos', 'atualizarContrato'],
    'Repositories/DistribuicaoRepository.gs': ['listarDistribuicao', 'buscarDistribuicaoDoFuncionario', 'inserirDistribuicao', 'atualizarDistribuicao'],
    'Repositories/FeriasRepository.gs': ['listarFerias', 'listarFeriasDoContrato', 'listarFeriasDoFuncionario', 'buscarPeriodoDeFerias', 'inserirFerias', 'atualizarPeriodoDeFerias', 'listarPreferencias', 'buscarPreferenciaDoContrato', 'atualizarPreferencia'],
    'Repositories/FuncionarioRepository.gs': ['listarFuncionarios', 'buscarFuncionarioPorId', 'buscarFuncionariosPorNome', 'listarIdsDeFuncionario', 'gerarProximoIdFuncionario'],
    'Repositories/HistoricoRepository.gs': ['obterUsuarioAtual', 'formatarValorDoHistorico', 'registrarHistorico', 'registrarAlteracaoNoHistorico', 'listarHistorico'],
    'Repositories/HorarioRepository.gs': ['listarHorarios', 'buscarHorarioDoFuncionario', 'inserirHorarios', 'atualizarHorario'],
    'Repositories/PresencaRepository.gs': ['abaDePresencaExiste', 'garantirAbaDePresenca', 'listarPresencas', 'listarPresencasDaData', 'buscarPresenca', 'inserirPresencas', 'atualizarPresenca', 'gerarIdsDePresenca', 'acrescentarColunasNovasDePresenca', 'listarPresencasDoPeriodo'],
    'Services/ContratoService.gs': ['obterSeparadorDeFormulas', 'aplicarFormulaDeDuracao', 'corrigirFormulaDeDuracao', 'obterContratoOuErro', 'normalizarDadosDoContrato', 'validarDadosDoContrato', 'montarRegistroDoContrato', 'acrescentarObservacao', 'campoDoContratoMudou', 'inserirNovoContrato', 'trocarStatusDoContrato', 'alterarDadosDoContrato', 'suspenderContrato', 'reativarContrato', 'encerrarContrato', 'renovarContrato'],
    'Services/DashboardService.gs': ['nomeCurto', 'indiceDoDiaUtil', 'pluralizarTexto', 'listarAnosDoCalendario', 'ultimoDiaDoMes', 'doisDigitos', 'calcularDadosDaConsulta'],
    'Services/DistribuicaoService.gs': ['normalizarTurno', 'salvarDistribuicaoDoFuncionario'],
    'Services/FeriasService.gs': ['normalizarPeriodoDeFerias', 'normalizarStatusDeFerias', 'normalizarDatasDoPeriodo', 'normalizarDesejaQuinzeDias', 'validarTransicaoDeStatusDeFerias', 'validarPeriodoDeFerias', 'montarRegistroDoPeriodo', 'registrarAlteracaoDeFerias', 'criarPeriodoDeFerias', 'salvarPeriodoDeFerias', 'dividirFerias', 'sincronizarFeriasDosContratos', 'limparDatasDosPeriodosEmAberto', 'mesesDoContrato', 'marcarSemDireitoAFerias', 'restabelecerDireitoAFerias'],
    'Services/FuncionarioService.gs': ['normalizarNomeCompleto', 'cadastrarFuncionario', 'adicionarContratoAoFuncionario', 'atualizarNomeNasOutrasAbas', 'alterarNomeDoFuncionario', 'sincronizarNomesComOsContratos', 'vinculoAtualDoFuncionario'],
    'Services/HorarioService.gs': ['normalizarHorario', 'normalizarHorariosDaSemana', 'horarioDaLinha', 'gravarHorarioDoFuncionario', 'salvarHorarioDoFuncionario', 'aplicarHorarioAVarios', 'minutosDoHorario', 'turnoPermitidoParaVinculo', 'minutosDeAlmoco', 'calcularJornadaDoDia'],
    'Services/PresencaService.gs': ['normalizarStatusDePresenca', 'verificarPermissaoDePresenca', 'contratoCobreADataParaPresenca', 'idsDeQuemEstaDeFeriasNaData', 'classificarFuncionariosParaPresenca', 'montarListaDePresenca', 'classificarItensDePresenca', 'validarItensDePresenca', 'salvarPresencas', 'listaDeStatusDePresenca', 'contratoDaPessoaNaData', 'registroDePresencaParaTela', 'segundaDaSemana', 'jornadaDaPessoaNoDia', 'montarSemanaDePresenca', 'calcularAtrasoEmMinutos', 'salvarPresencasEmLote', 'consultarHistoricoDePresenca'],
    'Triggers.gs': ['auditarGatilhos', 'executarRotinaDiariaDeFerias', 'simularRotinaDeFerias', 'formatarResultadoDaRotinaDeFerias', 'instalarGatilhoDiarioDeFerias', 'simularLimpezaDeDatasDeFerias', 'executarLimpezaDeDatasDeFerias'],
    'UI/Consulta.gs': ['colunaDoGrid', 'largurasDaConsulta', 'estilosDaConsulta', 'corDoStatusDeFerias', 'coresDoAviso', 'montarTextoComMarcadores', 'montarLayoutDaConsulta', 'notacaoA1', 'aplicarEstiloNaLista', 'aplicarLayoutNaConsulta', 'linhaDoSeletorDeAno', 'lerAnoDaConsulta', 'atualizarConsulta', 'atualizarConsultaSemErro', 'atualizarConsultaAposOperacao'],
    'UI/Menu.gs': ['onOpen', 'criarMenuDeFuncionarios', 'incluirArquivoHtml', 'abrirDialogoModal', 'abrirCadastrarFuncionario', 'abrirRenovarContrato', 'abrirAlterarContrato', 'abrirAlterarNome', 'abrirSuspenderContrato', 'abrirReativarContrato', 'abrirDesativarContrato', 'converterDataIsoParaBr', 'obterDadosDoDialogo', 'processarOperacaoDoDialogo', 'abrirAtualizarFerias', 'abrirDividirFerias', 'abrirSemDireitoAFerias', 'cortarTextoParaJanela', 'rodarRotinaDeFeriasPeloMenu', 'ativarRotinaDiariaPeloMenu', 'obterDadosDoDialogoDeFerias', 'processarOperacaoDeFeriasDoDialogo', 'abrirHorarios', 'abrirDistribuicao', 'listarFuncionariosEmAberto', 'obterDadosDoDialogoDeHorarios', 'processarOperacaoDeHorarioDoDialogo', 'obterDadosDoDialogoDeDistribuicao', 'processarOperacaoDeDistribuicaoDoDialogo', 'executarOperacaoDoDialogo', 'executarOperacaoDeFeriasDoDialogo', 'executarOperacaoDeHorarioDoDialogo', 'executarOperacaoDeDistribuicaoDoDialogo', 'atualizarConsultaPeloMenu', 'onEdit', 'mostrarTextoNaJanela', 'auditarDadosPeloMenu', 'aplicarValidacoesPeloMenu', 'configurarAutomacoesPeloMenu', 'medirDesempenhoPeloMenu', 'pedirConfirmacaoDoUsuario', 'comAtualizacaoDaConsulta', 'abrirListaDePresenca', 'obterDadosDaPresenca', 'salvarPresencasDoDialogo', 'obterSemanaDaPresenca', 'salvarPresencasDaSemanaDoDialogo', 'listarPessoasParaHistoricoDePresenca', 'consultarHistoricoDePresencaDoDialogo'],
    'Utils/DataUtils.gs': ['partesDaData', 'criarData', 'normalizarData', 'hojeNormalizado', 'converterData', 'formatarData', 'diasEntreDatas', 'somarDiasData', 'somarMesesData', 'compararDatas', 'dataEstaNoIntervalo', 'formatarDataHora'],
    'Utils/IdUtils.gs': ['formatarId', 'extrairNumeroDoId', 'idEhValido', 'reservarIds', 'proximoIdFuncionario', 'proximoIdContrato'],
    'Utils/PlanilhaUtils.gs': ['obterPlanilha', 'obterAbaPorChave', 'obterColunasDaAba', 'mapearColunasDoCabecalho', 'mapearColunasPorCabecalho', 'valoresSaoIguais', 'lerRegistrosDaAba', 'inserirRegistrosNaAba', 'atualizarRegistroNaAba', 'listarRegistros', 'inserirRegistros', 'atualizarRegistro', 'executarComTrava'],
    'Utils/ValidacaoUtils.gs': ['valorVazio', 'normalizarTexto', 'chaveDoNome', 'exigirCampos', 'exigirNaLista', 'validarIntervaloDeDatas']
  };
  const versoesAntigas = ['DataUtils', 'ValidacaoUtils', 'IdUtils', 'PlanilhaUtils', 'ContratoRepository', 'FuncionarioRepository', 'FeriasRepository', 'HorarioRepository', 'DistribuicaoRepository', 'HistoricoRepository', 'ContratoService', 'FuncionarioService', 'FeriasService'];
  const existe = tipoDoNome;
  const problemas = [];

  Object.keys(esperadas).forEach(function (arquivo) {
    const faltando = esperadas[arquivo].filter(function (nome) { return existe(nome) !== 'function'; });
    if (faltando.length) {
      problemas.push('Arquivo "' + arquivo + '": faltam ' + faltando.length + ' de ' + esperadas[arquivo].length +
        ' funções (ex.: ' + faltando.slice(0, 3).join(', ') + '). Crie/substitua este arquivo pelo novo.');
    }
  });
  versoesAntigas.forEach(function (nome) {
    if (existe(nome) === 'object') {
      problemas.push('Ainda existe a versão ANTIGA "' + nome + '" (objeto). Substitua o conteúdo do arquivo que a define pelo arquivo novo.');
    }
  });
  if (existe('CONFIG') !== 'object') problemas.push('Falta a constante CONFIG (arquivo Config.gs).');

  const codigoAntigo = ['linhaTotal_', 'lerFerias_', 'sincronizarFerias_', 'adicionarFuncionario', 'alterarFuncionario', 'desativarFuncionario', 'criarAbaConsulta', 'abrirAdicionar'].filter(function (nome) { return existe(nome) === 'function'; });
  let texto = problemas.length
    ? 'INSTALAÇÃO INCOMPLETA:\n- ' + problemas.join('\n- ')
    : 'INSTALAÇÃO OK: todos os arquivos novos estão presentes.';
  if (codigoAntigo.length) {
    texto += '\nAVISO: ainda há código do sistema antigo no projeto (' + codigoAntigo.join(', ') +
      '). Ele aponta para as abas antigas; remova esses arquivos (Extracao, Tratamento, Formatacao e os diálogos antigos) quando a migração estiver concluída.';
  }
  Logger.log(texto);
  try { SpreadsheetApp.getUi().alert('Verificação da instalação', texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* sem interface */ }
  return texto;
}


/**
 * Teste da Etapa 2 NAS ABAS REAIS (rode só na CÓPIA). Cria a pessoa fictícia "Zz Teste Etapa Dois",
 * executa cadastro, alteração, suspensão, reativação, renovação, desativação e troca de nome, confere
 * os resultados (inclusive se a Duração calcula sem erro) e, no final, REMOVE as linhas que criou em
 * Funcionários e Histórico e restaura os contadores de ID.
 */
function testarEtapa2() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  const props = PropertiesService.getScriptProperties();
  const chaveF = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_FUNCIONARIO;
  const chaveC = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_CONTRATO;
  const salvoF = props.getProperty(chaveF);
  const salvoC = props.getProperty(chaveC);
  const nome = 'Zz Teste Etapa Dois';
  let idFuncionario = null;
  try {
    afirmar(buscarFuncionariosPorNome(nome).length === 0, 'a pessoa de teste ainda não existe');
    const cad = cadastrarFuncionario({ NOME: nome, VINCULO: 'Estágio', INICIO: '01/03/2027', FIM: '28/02/2028' });
    idFuncionario = cad.ID_FUNCIONARIO;
    const aba = obterAbaPorChave('FUNCIONARIOS');
    const colDuracao = mapearColunasPorCabecalho(aba, CONFIG.COLUNAS.FUNCIONARIOS).indices.DURACAO + 1;
    const c1 = buscarContratoPorId(cad.ID_CONTRATO);
    afirmar(c1 && c1.STATUS === 'Ativo', 'cadastro cria contrato Ativo (' + cad.ID_CONTRATO + ')');
    afirmar(aba.getRange(c1._linha, colDuracao).getDisplayValue() === '365', 'Duração calcula 365 (sem #ERROR!)');

    afirmar(alterarDadosDoContrato(cad.ID_CONTRATO, { CARGO: 'Teste' }).alterados.join() === 'CARGO', 'alterar cargo');
    afirmar(suspenderContrato(cad.ID_CONTRATO, 'teste').STATUS === 'Suspenso', 'suspender');
    afirmar(reativarContrato(cad.ID_CONTRATO).STATUS === 'Ativo', 'reativar');

    const ren = renovarContrato(cad.ID_CONTRATO, { INICIO: '01/03/2028', FIM: '28/02/2029' });
    afirmar(buscarContratoPorId(ren.ID_CONTRATO_ANTERIOR).STATUS === 'Encerrado', 'renovar: anterior Encerrado');
    const c2 = buscarContratoPorId(ren.ID_CONTRATO_NOVO);
    afirmar(c2.STATUS === 'Ativo' && c2.CARGO === 'Teste', 'renovar: novo Ativo, herda o cargo');
    afirmar(aba.getRange(c2._linha, colDuracao).getDisplayValue() === '365', 'Duração do contrato novo calcula 365');

    const des = encerrarContrato(ren.ID_CONTRATO_NOVO, '31/05/2028', 'teste');
    afirmar(des.STATUS === 'Encerrado' && des.DESLIGAMENTO === '31/05/2028', 'desativar com data de desligamento');

    const mudou = alterarNomeDoFuncionario(idFuncionario, nome + ' Renomeado');
    afirmar(mudou.alterado === true, 'alterar nome');
    afirmar(buscarFuncionarioPorId(idFuncionario).NOME === nome + ' Renomeado', 'nome novo gravado');

    const hist = listarHistorico({ ID_FUNCIONARIO: idFuncionario });
    afirmar(hist.length >= 10, 'histórico registrou as operações (' + hist.length + ' linhas)');
  } finally {
    // limpeza: só as linhas desta pessoa de teste
    if (idFuncionario) {
      [['FUNCIONARIOS', listarContratosDoFuncionario(idFuncionario)], ['HISTORICO', listarHistorico({ ID_FUNCIONARIO: idFuncionario })]]
        .forEach(function (par) {
          const aba = obterAbaPorChave(par[0]);
          par[1].map(function (r) { return r._linha; }).sort(function (a, b) { return b - a; })
            .forEach(function (linha) { aba.deleteRow(linha); });
        });
    }
    if (salvoF === null) props.deleteProperty(chaveF); else props.setProperty(chaveF, salvoF);
    if (salvoC === null) props.deleteProperty(chaveC); else props.setProperty(chaveC, salvoC);
  }
  resultados.push('Limpeza feita: linhas de teste removidas e contadores de ID restaurados.');
  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Teste da Etapa 3 NAS ABAS REAIS (rode só na CÓPIA). Cria a pessoa fictícia "Zz Teste Etapa Tres",
 * passa por rotina (só em simulação), situações, datas, divisão e Tirada, e no final REMOVE as linhas
 * que criou (Funcionários, Férias e Histórico) e restaura os contadores de ID.
 * A rotina real NÃO é executada aqui, para não criar períodos para os outros funcionários.
 */
function testarEtapa3() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  function deveFalhar(funcao, trecho, descricao) {
    let mensagem = null;
    try { funcao(); } catch (e) { mensagem = String(e.message); }
    afirmar(mensagem !== null && mensagem.indexOf(trecho) >= 0, descricao);
  }
  const props = PropertiesService.getScriptProperties();
  const chaveF = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_FUNCIONARIO;
  const chaveC = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_CONTRATO;
  const salvoF = props.getProperty(chaveF);
  const salvoC = props.getProperty(chaveC);
  const nome = 'Zz Teste Etapa Tres';
  const hoje = hojeNormalizado();
  const dia = function (n) { return formatarData(somarDiasData(hoje, n)); };
  let idFuncionario = null;
  try {
    afirmar(buscarFuncionariosPorNome(nome).length === 0, 'a pessoa de teste ainda não existe');
    const cad = cadastrarFuncionario({ NOME: nome, VINCULO: 'Estágio', INICIO: dia(-200), FIM: dia(165) });
    idFuncionario = cad.ID_FUNCIONARIO;
    const idc = cad.ID_CONTRATO;

    const sim = sincronizarFeriasDosContratos(true);
    afirmar(sim.criados.some(function (x) { return x.indexOf(idc) >= 0; }), 'simulação da rotina lista o contrato novo');
    afirmar(buscarPeriodoDeFerias(idc, '1º') === null, 'simulação não gravou nada');

    criarPeriodoDeFerias(idc, {});
    let p1 = buscarPeriodoDeFerias(idc, '1º');
    afirmar(p1.STATUS === 'Pendente' && p1.INICIO === '' && p1.DIAS === '', 'período 1º nasce Pendente, sem datas e sem dias');

    afirmar(salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Aguardando' }).alterados.join() === 'STATUS', 'Pendente -> Aguardando');
    deveFalhar(function () { salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista' }); }, 'informe início e fim', 'Prevista exige datas');
    deveFalhar(function () { salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista', INICIO: dia(300), FIM: dia(310) }); }, 'dentro do contrato', 'datas fora do contrato são recusadas');
    salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista', INICIO: dia(20), FIM: dia(34) });
    p1 = buscarPeriodoDeFerias(idc, '1º');
    afirmar(p1.STATUS === 'Prevista' && p1.DIAS === 15, 'Prevista com datas: 15 dias calculados');

    const div = dividirFerias(idc);
    const p2 = buscarPeriodoDeFerias(idc, '2º');
    afirmar(p2 && p2.STATUS === 'Pendente' && div.aviso === '', 'dividir cria o 2º Pendente');
    afirmar(buscarPeriodoDeFerias(idc, '1º').DESEJA_15 === 'Sim', 'dividir marca "Deseja 15 dias" no 1º');
    deveFalhar(function () { salvarPeriodoDeFerias(idc, '2º', { STATUS: 'Prevista', INICIO: dia(30), FIM: dia(40) }); }, 'se sobrepõe', '2º não pode sobrepor o 1º');

    salvarPeriodoDeFerias(idc, '1º', { INICIO: dia(-60), FIM: dia(-46) });
    const sim2 = sincronizarFeriasDosContratos(true);
    afirmar(sim2.tiradas.some(function (x) { return x.indexOf(nome) >= 0; }), 'simulação aponta a Prevista vencida');
    afirmar(salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Tirada' }).alterados.join() === 'STATUS', 'marcar Tirada depois do fim');
    deveFalhar(function () { salvarPeriodoDeFerias(idc, '1º', { INICIO: dia(-61), FIM: dia(-46) }); }, 'já tirado', 'Tirada não aceita mudar datas');

    // limpeza de datas de rascunho: só em SIMULAÇÃO aqui (a real mexeria nas linhas dos outros funcionários)
    salvarPeriodoDeFerias(idc, '2º', { INICIO: dia(100), FIM: dia(114) });
    const limpeza = limparDatasDosPeriodosEmAberto(true);
    afirmar(limpeza.periodos.some(function (x) { return x.indexOf(nome) >= 0 && x.indexOf('2º') >= 0 && x.indexOf('[Pendente]') >= 0; }), 'simulação da limpeza lista o período Pendente com datas');
    afirmar(limpeza.periodos.every(function (x) { return x.indexOf('[Prevista]') < 0 && x.indexOf('[Tirada]') < 0; }), 'a limpeza nunca lista Prevista nem Tirada');
    afirmar(buscarPeriodoDeFerias(idc, '2º').INICIO !== '', 'simulação da limpeza não gravou nada');

    const hist = listarHistorico({ ID_FUNCIONARIO: idFuncionario });
    afirmar(hist.some(function (h) { return String(h.CAMPO).indexOf('Férias 1º') === 0; }), 'histórico registrou as alterações de férias (' + hist.length + ' linhas)');
  } finally {
    if (idFuncionario) {
      [['FUNCIONARIOS', listarContratosDoFuncionario(idFuncionario)],
       ['FERIAS', listarFeriasDoFuncionario(idFuncionario)],
       ['HISTORICO', listarHistorico({ ID_FUNCIONARIO: idFuncionario })]].forEach(function (par) {
        const aba = obterAbaPorChave(par[0]);
        par[1].map(function (r) { return r._linha; }).sort(function (a, b) { return b - a; })
          .forEach(function (linha) { aba.deleteRow(linha); });
      });
    }
    if (salvoF === null) props.deleteProperty(chaveF); else props.setProperty(chaveF, salvoF);
    if (salvoC === null) props.deleteProperty(chaveC); else props.setProperty(chaveC, salvoC);
  }
  resultados.push('Limpeza feita: linhas de teste removidas e contadores de ID restaurados.');
  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Teste da Etapa 4 NAS ABAS REAIS (rode só na CÓPIA). Cria duas pessoas fictícias ("Zz Teste Etapa Quatro"
 * e "Zz Teste Etapa Quatro Dois"), grava horários e distribuição, confere que os horários ficam como TEXTO
 * "HH:mm" no Sheets e, no final, REMOVE as linhas criadas e restaura os contadores de ID.
 */
function testarEtapa4() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  function deveFalhar(funcao, trecho, descricao) {
    let mensagem = null;
    try { funcao(); } catch (e) { mensagem = String(e.message); }
    afirmar(mensagem !== null && mensagem.indexOf(trecho) >= 0, descricao);
  }
  const props = PropertiesService.getScriptProperties();
  const chaveF = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_FUNCIONARIO;
  const chaveC = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_CONTRATO;
  const salvoF = props.getProperty(chaveF);
  const salvoC = props.getProperty(chaveC);
  const nomeA = 'Zz Teste Etapa Quatro';
  const nomeB = 'Zz Teste Etapa Quatro Dois';
  const ids = [];
  try {
    afirmar(buscarFuncionariosPorNome(nomeA).length === 0 && buscarFuncionariosPorNome(nomeB).length === 0, 'as pessoas de teste ainda não existem');
    const a = cadastrarFuncionario({ NOME: nomeA, VINCULO: 'Cargo' });
    const b = cadastrarFuncionario({ NOME: nomeB, VINCULO: 'Cargo' });
    ids.push(a.ID_FUNCIONARIO, b.ID_FUNCIONARIO);
    const semana = {};
    CONFIG.DIAS.forEach(function (d) { semana[d.SIGLA + '_DE'] = '08:00'; semana[d.SIGLA + '_ATE'] = '12:00'; });

    deveFalhar(function () { salvarHorarioDoFuncionario(a.ID_FUNCIONARIO, { SEG_DE: '12:00', SEG_ATE: '08:00' }); }, 'depois do inicial', 'fim antes do início é recusado');
    afirmar(salvarHorarioDoFuncionario(a.ID_FUNCIONARIO, semana).criado === true, 'horário cadastrado');
    const h = buscarHorarioDoFuncionario(a.ID_FUNCIONARIO);
    afirmar(typeof h.SEG_DE === 'string' && h.SEG_DE === '08:00', 'horário gravado como TEXTO "08:00" (não virou hora do Sheets)');
    afirmar(salvarHorarioDoFuncionario(a.ID_FUNCIONARIO, semana).alterados.length === 0, 'reenviar igual não altera');
    salvarHorarioDoFuncionario(a.ID_FUNCIONARIO, Object.assign({}, semana, { QUA_DE: '13:00', QUA_ATE: '17:00' }));
    const h2 = buscarHorarioDoFuncionario(a.ID_FUNCIONARIO);
    afirmar(h2.QUA_DE === '13:00' && h2.QUA_ATE === '17:00' && h2.QUI_DE === '08:00', 'alterar a quarta mantém os outros dias');
    const varios = aplicarHorarioAVarios([a.ID_FUNCIONARIO, b.ID_FUNCIONARIO], semana);
    afirmar(varios.total === 2 && buscarHorarioDoFuncionario(b.ID_FUNCIONARIO).SEG_DE === '08:00', 'aplicar o mesmo horário a duas pessoas');

    deveFalhar(function () { salvarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO, { SEGUNDA: 'Noite' }); }, 'Turno inválido', 'turno inválido é recusado');
    deveFalhar(function () { salvarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO, { SEGUNDA: 'Manhã+Tarde' }); }, 'não vale para o vínculo Cargo', 'Manhã+Tarde é recusado para Cargo');
    afirmar(buscarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO) === null, 'a recusa não criou linha na distribuição');
    afirmar(salvarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO, { POSICAO: 'Balcão 1', SEGUNDA: 'Manhã', TERCA: 'Integral' }).criado === true, 'distribuição cadastrada');
    const d = buscarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO);
    afirmar(d.POSICAO === 'Balcão 1' && d.SEGUNDA === 'Manhã' && d.TERCA === 'Integral' && d.QUARTA === '', 'distribuição gravada corretamente');
    afirmar(salvarDistribuicaoDoFuncionario(a.ID_FUNCIONARIO, { TERCA: '' }).alterados.join() === 'TERCA', 'esvaziar um dia altera só esse dia');

    const hist = listarHistorico({ ID_FUNCIONARIO: a.ID_FUNCIONARIO });
    afirmar(hist.some(function (x) { return String(x.CAMPO).indexOf('Horário — Quarta') === 0; }) &&
            hist.some(function (x) { return String(x.CAMPO).indexOf('Distribuição') === 0; }), 'histórico registrou horário e distribuição (' + hist.length + ' linhas)');
  } finally {
    ids.forEach(function (id) {
      const linhas = {
        FUNCIONARIOS: listarContratosDoFuncionario(id).map(function (r) { return r._linha; }),
        HORARIOS: [buscarHorarioDoFuncionario(id)].filter(Boolean).map(function (r) { return r._linha; }),
        DISTRIBUICAO: [buscarDistribuicaoDoFuncionario(id)].filter(Boolean).map(function (r) { return r._linha; }),
        HISTORICO: listarHistorico({ ID_FUNCIONARIO: id }).map(function (r) { return r._linha; })
      };
      Object.keys(linhas).forEach(function (chave) {
        const aba = obterAbaPorChave(chave);
        linhas[chave].sort(function (x, y) { return y - x; }).forEach(function (linha) { aba.deleteRow(linha); });
      });
    });
    if (salvoF === null) props.deleteProperty(chaveF); else props.setProperty(chaveF, salvoF);
    if (salvoC === null) props.deleteProperty(chaveC); else props.setProperty(chaveC, salvoC);
  }
  resultados.push('Limpeza feita: linhas de teste removidas e contadores de ID restaurados.');
  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Teste da Etapa 5 NAS ABAS REAIS: redesenha a Consulta, confere alguns valores gravados e roda de novo
 * (idempotente). ATENÇÃO: substitui o conteúdo da aba Consulta (a do sistema antigo não é mais usada).
 */
function testarEtapa5() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  const r1 = atualizarConsulta();
  const aba = obterPlanilha().getSheetByName(CONFIG.ABAS.CONSULTA);
  afirmar(aba !== null, 'a aba Consulta existe');
  afirmar(aba.getRange(2, colunaDoGrid(CONFIG.CONSULTA.RESERVAR_ESPACO_BRASAO ? 3 : 1)).getValue() === CONFIG.CONSULTA.TITULO, 'título do painel gravado');
  const linhaAno = linhaDoSeletorDeAno(aba);
  afirmar(linhaAno > 0 && Number(aba.getRange(linhaAno, CONFIG.CONSULTA.COLUNA_ANO).getValue()) === r1.ano, 'seletor de ano na seção Férias (linha ' + linhaAno + ') mostra ' + r1.ano);
  const regra = aba.getRange(linhaAno, CONFIG.CONSULTA.COLUNA_ANO).getDataValidation();
  afirmar(regra !== null && regra.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST, 'o ano é uma lista suspensa');
  afirmar(regra.getCriteriaValues()[0].map(Number).indexOf(r1.ano + 1) >= 0, 'a lista oferece o ano seguinte (' + (r1.ano + 1) + ')');
  const dados = calcularDadosDaConsulta(hojeNormalizado(), r1.ano, '');
  afirmar(aba.getRange(7, colunaDoGrid(2)).getValue() === dados.kpis.equipeAtiva, 'Equipe ativa na tela = cálculo (' + dados.kpis.equipeAtiva + ')');
  afirmar(aba.getRange(7, colunaDoGrid(5)).getValue() === dados.kpis.suspensos, 'Suspensos na tela = cálculo (' + dados.kpis.suspensos + ')');
  const texto = aba.getDataRange().getDisplayValues().map(function (l) { return l.join(' '); }).join('\n');
  afirmar(texto.indexOf('#ERROR') < 0 && texto.indexOf('#REF') < 0 && texto.indexOf('#NAME') < 0, 'nenhuma célula com erro de fórmula');
  afirmar(texto.indexOf('Organização do balcão') >= 0 && linhaAno > 0, 'seções Distribuição e Férias desenhadas');
  afirmar(texto.indexOf('Por vínculo') < 0 && texto.indexOf('Por cargo') < 0 && texto.indexOf('Por setor') < 0, 'sem os blocos por vínculo, cargo e setor');
  const r2 = atualizarConsulta();
  afirmar(r2.linhas === r1.linhas, 'rodar de novo gera o mesmo layout (' + r2.linhas + ' linhas)');
  // trocar o ano pela lista: escreve o ano seguinte, redesenha e volta ao ano original
  aba.getRange(linhaAno, CONFIG.CONSULTA.COLUNA_ANO).setValue(r1.ano + 1);
  const r3 = atualizarConsulta();
  afirmar(r3.ano === r1.ano + 1, 'escolher outro ano na lista redesenha o calendário com ' + (r1.ano + 1));
  aba.getRange(linhaDoSeletorDeAno(aba), CONFIG.CONSULTA.COLUNA_ANO).setValue(r1.ano);
  afirmar(atualizarConsulta().ano === r1.ano, 'voltar ao ano original (' + r1.ano + ')');
  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Roda, em sequência, todos os testes que usam as abas reais (rode só na CÓPIA). Cada teste limpa o que cria.
 * Atenção: testarEtapa5 redesenha a aba Consulta. Mostra um resumo com o que passou e o que falhou.
 */
function executarTodosOsTestes() {
  const testes = [
    ['testarFundacao', testarFundacao], ['testarEtapa2', testarEtapa2], ['testarEtapa3', testarEtapa3],
    ['testarEtapa4', testarEtapa4], ['testarEtapa5', testarEtapa5], ['testarRegrasDeJornada', testarRegrasDeJornada],
    ['testarSemDireitoAFerias', testarSemDireitoAFerias], ['testarPresenca', testarPresenca]
  ];
  const linhas = ['RESUMO DOS TESTES'];
  let falhas = 0;
  testes.forEach(function (t) {
    try {
      const saida = t[1]();
      linhas.push('OK     - ' + t[0] + ' (' + (Array.isArray(saida) ? saida.length : '?') + ' itens)');
    } catch (e) {
      falhas++;
      linhas.push('FALHOU - ' + t[0] + ': ' + String(e.message).split('\n')[0]);
    }
  });
  linhas.push(falhas ? falhas + ' teste(s) falharam. Veja o log da execução de cada um.' : 'Todos os testes passaram.');
  const texto = linhas.join('\n');
  Logger.log(texto);
  try { SpreadsheetApp.getUi().alert('Testes', texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* sem interface */ }
  return texto;
}


/**
 * Teste de "Sem direito a férias" NAS ABAS REAIS (rode só na CÓPIA). Cria a pessoa fictícia "Zz Teste Sem Direito"
 * com contrato de 6 meses, marca e desfaz o "sem direito", e no fim REMOVE as linhas que criou (Funcionários,
 * Férias e Histórico) e restaura os contadores de ID.
 */
function testarSemDireitoAFerias() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  function deveFalhar(funcao, trecho, descricao) {
    let mensagem = null;
    try { funcao(); } catch (e) { mensagem = String(e.message); }
    afirmar(mensagem !== null && mensagem.indexOf(trecho) >= 0, descricao);
  }
  const props = PropertiesService.getScriptProperties();
  const chaveF = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_FUNCIONARIO;
  const chaveC = 'ULTIMO_ID_' + CONFIG.IDS.PREFIXO_CONTRATO;
  const salvoF = props.getProperty(chaveF);
  const salvoC = props.getProperty(chaveC);
  const nome = 'Zz Teste Sem Direito';
  const hoje = hojeNormalizado();
  let idFuncionario = null;
  try {
    afirmar(buscarFuncionariosPorNome(nome).length === 0, 'a pessoa de teste ainda não existe');
    const cad = cadastrarFuncionario({
      NOME: nome, VINCULO: 'Estágio',
      INICIO: formatarData(somarDiasData(hoje, -30)), FIM: formatarData(somarDiasData(hoje, 150))
    });
    idFuncionario = cad.ID_FUNCIONARIO;
    const idc = cad.ID_CONTRATO;
    afirmar(mesesDoContrato(buscarContratoPorId(idc)) === 6, 'contrato de teste tem 6 meses');

    const r = marcarSemDireitoAFerias(idc, '');
    const p1 = buscarPeriodoDeFerias(idc, '1º');
    afirmar(r.periodosMarcados === 1 && p1.STATUS === 'Sem direito' && p1.INICIO === '' && p1.DIAS === '', 'sem período: cria o 1º já como "Sem direito", sem datas');
    afirmar(String(p1.OBSERVACOES).indexOf('contrato de 6 meses') >= 0, 'observação registra o contrato de 6 meses');
    deveFalhar(function () { marcarSemDireitoAFerias(idc, ''); }, 'já está marcado', 'marcar duas vezes é recusado');
    deveFalhar(function () { dividirFerias(idc); }, 'sem direito a férias', 'não divide férias de quem não tem direito');

    const sim = sincronizarFeriasDosContratos(true);
    afirmar(!sim.criados.some(function (x) { return x.indexOf(idc) >= 0; }), 'a rotina não cria período Pendente para o contrato sem direito');
    const dados = obterDadosDoDialogoDeFerias();
    const c = dados.contratos.filter(function (x) { return x.idContrato === idc; })[0];
    afirmar(c && c.meses === 6 && c.temSemDireito === true && c.podeMarcarSemDireito === false, 'a tela oferece o contrato só para restabelecer');
    deveFalhar(function () { salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista', INICIO: formatarData(somarDiasData(hoje, 10)), FIM: formatarData(somarDiasData(hoje, 20)) }); }, 'só pode voltar para Pendente', '"Sem direito" só volta para Pendente');

    const rr = restabelecerDireitoAFerias(idc);
    afirmar(rr.periodosRestabelecidos === 1 && buscarPeriodoDeFerias(idc, '1º').STATUS === 'Pendente', 'restabelecer: volta para Pendente');
    deveFalhar(function () { restabelecerDireitoAFerias(idc); }, 'não está marcado', 'restabelecer duas vezes é recusado');

    // com período Pendente e datas de rascunho: marcar limpa datas e dias
    salvarPeriodoDeFerias(idc, '1º', { INICIO: formatarData(somarDiasData(hoje, 20)), FIM: formatarData(somarDiasData(hoje, 34)) });
    afirmar(marcarSemDireitoAFerias(idc, 'teste').periodosMarcados === 1, 'marcar com período existente');
    const p2 = buscarPeriodoDeFerias(idc, '1º');
    afirmar(p2.STATUS === 'Sem direito' && p2.INICIO === '' && p2.FIM === '' && p2.DIAS === '', 'datas e dias foram limpos');
    restabelecerDireitoAFerias(idc);
    // com férias Prevista: recusa
    salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista', INICIO: formatarData(somarDiasData(hoje, 20)), FIM: formatarData(somarDiasData(hoje, 34)) });
    deveFalhar(function () { marcarSemDireitoAFerias(idc, ''); }, 'já tem férias Prevista ou Tirada', 'não marca quem já tem férias Prevista');

    const hist = listarHistorico({ ID_FUNCIONARIO: idFuncionario });
    afirmar(hist.some(function (h) { return String(h.NOVO_VALOR) === 'Sem direito'; }), 'histórico registrou o "Sem direito" (' + hist.length + ' linhas)');
  } finally {
    if (idFuncionario) {
      [['FUNCIONARIOS', listarContratosDoFuncionario(idFuncionario)],
       ['FERIAS', listarFeriasDoFuncionario(idFuncionario)],
       ['HISTORICO', listarHistorico({ ID_FUNCIONARIO: idFuncionario })]].forEach(function (par) {
        const aba = obterAbaPorChave(par[0]);
        par[1].map(function (r) { return r._linha; }).sort(function (a, b) { return b - a; })
          .forEach(function (linha) { aba.deleteRow(linha); });
      });
    }
    if (salvoF === null) props.deleteProperty(chaveF); else props.setProperty(chaveF, salvoF);
    if (salvoC === null) props.deleteProperty(chaveC); else props.setProperty(chaveC, salvoC);
  }
  resultados.push('Limpeza feita: linhas de teste removidas e contadores de ID restaurados.');
  Logger.log(resultados.join('\n'));
  return resultados;
}


/**
 * Teste da lista de presença NAS ABAS REAIS (rode só na CÓPIA). Cria a pessoa fictícia "Zz Teste Presenca",
 * lança, repete, altera (com confirmação) e confere duplicidade, data futura e a saída da lista por férias, suspensão e encerramento.
 * No fim REMOVE o que criou (inclusive a aba Presença, se foi o teste que a criou) e restaura os contadores de ID.
 */
function testarPresenca() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  function deveFalhar(funcao, trecho, descricao) {
    let mensagem = null;
    try { funcao(); } catch (e) { mensagem = String(e.message); }
    afirmar(mensagem !== null && mensagem.indexOf(trecho) >= 0, descricao);
  }
  const props = PropertiesService.getScriptProperties();
  const chaves = ['FUNC', 'CONT', 'PRES'].map(function (p) { return 'ULTIMO_ID_' + p; });
  const salvos = chaves.map(function (k) { return props.getProperty(k); });
  const existiaAba = abaDePresencaExiste();
  const nome = 'Zz Teste Presenca';
  const hoje = hojeNormalizado();
  const hojeTexto = formatarData(hoje);
  let idFuncionario = null;
  try {
    afirmar(buscarFuncionariosPorNome(nome).length === 0, 'a pessoa de teste ainda não existe');
    const cad = cadastrarFuncionario({ NOME: nome, VINCULO: 'Estágio', INICIO: formatarData(somarDiasData(hoje, -10)), FIM: formatarData(somarDiasData(hoje, 100)) });
    idFuncionario = cad.ID_FUNCIONARIO;
    const idc = cad.ID_CONTRATO;

    let lista = montarListaDePresenca(hoje);
    let linha = lista.linhas.filter(function (l) { return l.idFuncionario === idFuncionario; })[0];
    afirmar(linha && linha.status === '' && !linha.idRegistro, 'aparece na lista de hoje SEM marcação (nada é lançado automaticamente)');
    afirmar(lista.podeEditar === true, 'o usuário pode lançar (' + lista.usuario + ')');
    deveFalhar(function () { salvarPresencas(formatarData(somarDiasData(hoje, 1)), [{ idFuncionario: idFuncionario, status: 'Presente', observacao: '' }], false); }, 'data futura', 'data futura é recusada');
    deveFalhar(function () { salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'Viajando', observacao: '' }], false); }, 'Situação inválida', 'situação inválida é recusada');

    const r1 = salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'presente', observacao: 'teste' }], false);
    afirmar(r1.novos === 1 && abaDePresencaExiste(), 'novo registro gravado (aba Presença criada se não existia)');
    const reg = buscarPresenca(idFuncionario, hoje);
    afirmar(reg && reg.STATUS === 'Presente' && reg.DATA instanceof Date && /^PRES-/.test(reg.ID_REGISTRO) && String(reg.USUARIO) !== '' && reg.LANCADO_EM instanceof Date,
      'registro com ID, data, situação normalizada, usuário e data/hora do lançamento');

    const r2 = salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'Presente', observacao: 'teste' }], false);
    afirmar(r2.novos === 0 && r2.iguais === 1 && listarPresencasDaData(hoje).filter(function (x) { return x.ID_FUNCIONARIO === idFuncionario; }).length === 1, 'repetir não duplica o registro do dia');
    deveFalhar(function () { salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'Ausente', observacao: 'teste' }], false); }, 'Confirme as alterações', 'alterar um registro já lançado exige confirmação');
    afirmar(buscarPresenca(idFuncionario, hoje).STATUS === 'Presente', 'sem confirmação nada foi sobrescrito');
    const r3 = salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'Ausente', observacao: 'teste' }], true);
    const reg2 = buscarPresenca(idFuncionario, hoje);
    afirmar(r3.alterados === 1 && reg2.STATUS === 'Ausente' && String(reg2.ATUALIZADO_POR) !== '' && reg2.ATUALIZADO_EM instanceof Date, 'alteração confirmada grava quem alterou e quando');
    afirmar(listarHistorico({ ID_FUNCIONARIO: idFuncionario }).some(function (h) {
      return h.OPERACAO === 'Presença' && h.VALOR_ANTERIOR === 'Presente' && h.NOVO_VALOR === 'Ausente';
    }), 'valor anterior preservado no Histórico');

    // férias, suspensão e encerramento tiram a pessoa da lista (e impedem o lançamento)
    criarPeriodoDeFerias(idc, {});
    salvarPeriodoDeFerias(idc, '1º', { STATUS: 'Prevista', INICIO: hojeTexto, FIM: formatarData(somarDiasData(hoje, 2)) });
    lista = montarListaDePresenca(hoje);
    afirmar(!lista.linhas.some(function (l) { return l.idFuncionario === idFuncionario; }) && lista.foraDaLista.ferias >= 1, 'quem está de férias na data NÃO aparece na lista');
    deveFalhar(function () { salvarPresencas(hojeTexto, [{ idFuncionario: idFuncionario, status: 'Presente', observacao: '' }], true); }, 'não está na lista', 'e não recebe lançamento');
    salvarPeriodoDeFerias(idc, '1º', { INICIO: formatarData(somarDiasData(hoje, 10)), FIM: formatarData(somarDiasData(hoje, 12)) });
    afirmar(montarListaDePresenca(hoje).linhas.some(function (l) { return l.idFuncionario === idFuncionario; }), 'férias em outra data: volta a aparecer');
    suspenderContrato(idc);
    lista = montarListaDePresenca(hoje);
    afirmar(!lista.linhas.some(function (l) { return l.idFuncionario === idFuncionario; }) && lista.foraDaLista.suspensos >= 1, 'contrato Suspenso NÃO aparece');
    reativarContrato(idc);
    encerrarContrato(idc, hojeTexto);
    lista = montarListaDePresenca(hoje);
    afirmar(!lista.linhas.some(function (l) { return l.idFuncionario === idFuncionario; }) && lista.foraDaLista.encerrados >= 1, 'contrato Encerrado NÃO aparece (o registro antigo continua guardado na aba)');
    afirmar(buscarPresenca(idFuncionario, hoje) !== null, 'registro já lançado continua na aba Presença');
  } finally {
    if (idFuncionario) {
      [['FUNCIONARIOS', listarContratosDoFuncionario(idFuncionario)],
       ['FERIAS', listarFeriasDoFuncionario(idFuncionario)],
       ['HISTORICO', listarHistorico({ ID_FUNCIONARIO: idFuncionario })]].forEach(function (par) {
        const aba = obterAbaPorChave(par[0]);
        par[1].map(function (r) { return r._linha; }).sort(function (a, b) { return b - a; })
          .forEach(function (linhaDaAba) { aba.deleteRow(linhaDaAba); });
      });
      if (abaDePresencaExiste()) {
        const abaP = obterAbaPorChave('PRESENCA');
        listarPresencas().filter(function (r) { return String(r.ID_FUNCIONARIO).trim() === idFuncionario; })
          .map(function (r) { return r._linha; }).sort(function (a, b) { return b - a; })
          .forEach(function (linhaDaAba) { abaP.deleteRow(linhaDaAba); });
      }
    }
    if (!existiaAba && abaDePresencaExiste()) obterPlanilha().deleteSheet(obterAbaPorChave('PRESENCA'));
    chaves.forEach(function (k, i) { if (salvos[i] === null) props.deleteProperty(k); else props.setProperty(k, salvos[i]); });
  }
  resultados.push('Limpeza feita: linhas de teste removidas' + (existiaAba ? '' : ', aba Presença criada pelo teste removida') + ' e contadores de ID restaurados.');
  Logger.log(resultados.join('\n'));
  return resultados;
}

/** Regras de turno e jornada por vínculo (CONFIG.JORNADA). Função pura: não lê nem grava nenhuma aba. */
function testarRegrasDeJornada() {
  const resultados = [];
  function afirmar(condicao, descricao) {
    resultados.push((condicao ? 'OK    ' : 'FALHOU') + ' - ' + descricao);
    if (!condicao) throw new Error('Teste falhou: ' + descricao + '\n' + resultados.join('\n'));
  }
  afirmar(turnoPermitidoParaVinculo('Manhã+Tarde', 'Estágio') && !turnoPermitidoParaVinculo('Manhã+Tarde', 'PSS') && !turnoPermitidoParaVinculo('Manhã+Tarde', 'Cargo'),
    'Manhã+Tarde só para Estágio');
  afirmar(turnoPermitidoParaVinculo('Integral', 'PSS') && turnoPermitidoParaVinculo('Integral', 'Cargo') && !turnoPermitidoParaVinculo('Integral', 'Estágio'),
    'Integral só para PSS e Cargo');
  afirmar(['Estágio', 'PSS', 'Cargo'].every(function (v) { return turnoPermitidoParaVinculo('Manhã', v) && turnoPermitidoParaVinculo('Tarde', v); }),
    'Manhã e Tarde valem para todos');

  const e1 = calcularJornadaDoDia('Estágio', 'Manhã+Tarde', '08:00', '16:00');
  afirmar(e1.almocoMin === 30 && e1.jornadaMin === 450, 'Estágio Manhã+Tarde 08–16: 30 min de almoço, 7h30 de jornada');
  const e2 = calcularJornadaDoDia('Estágio', 'Manhã+Tarde', '09:00', '17:00');
  afirmar(e2.almocoMin === 30 && e2.jornadaMin === 450, 'Estágio Manhã+Tarde 09–17: 30 min de almoço');
  const e3 = calcularJornadaDoDia('Estágio', 'Manhã', '08:00', '12:00');
  afirmar(e3.almocoMin === 0 && e3.jornadaMin === 240, 'Estágio só de manhã: sem almoço');
  afirmar(calcularJornadaDoDia('Estágio', '', '13:00', '17:00').almocoMin === 0, 'Estágio sem turno na distribuição: sem almoço');

  const p1 = calcularJornadaDoDia('PSS', 'Integral', '', '');
  afirmar(p1.de === '08:00' && p1.ate === '17:00' && p1.almocoMin === 60 && p1.jornadaMin === 480 && p1.origem === 'Padrão do turno Integral',
    'PSS Integral sem horário cadastrado: 08–17 com 1h de almoço (8h)');
  const c1 = calcularJornadaDoDia('Cargo', 'Integral', '07:00', '16:00');
  afirmar(c1.de === '07:00' && c1.almocoMin === 60 && c1.origem === 'Horários', 'Cargo: o horário cadastrado prevalece sobre o padrão');
  afirmar(calcularJornadaDoDia('Cargo', '', '08:00', '17:00').almocoMin === 60, 'Cargo tem 1h de almoço mesmo sem turno na distribuição');
  afirmar(calcularJornadaDoDia('Estágio', 'Manhã+Tarde', '', '') === null, 'Estágio sem horário cadastrado: sem jornada (não inventa horário)');
  afirmar(calcularJornadaDoDia('PSS', '', '', '') === null, 'PSS sem horário e sem Integral: sem jornada');

  Logger.log(resultados.join('\n'));
  return resultados;
}
