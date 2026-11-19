/**
 * Config.gs — configurações centrais do sistema.
 * Sem dependências de outros arquivos: deve ser o PRIMEIRO arquivo do projeto.
 * Valores editáveis pelo usuário (listas) ficarão na aba "Configurações" (Etapa 2 em diante).
 */
const CONFIG = {
  FUSO: 'America/Sao_Paulo',
  FORMATO_DATA: 'dd/MM/yyyy',
  LINHA_CABECALHO: 1,
  SUFIXO_LEGADO: '_Legado',
  ABAS_LEGADO: ['Contratos', 'Férias', 'Preferência de Férias', 'Distribuição do Balcão', 'Distribuição de Férias'], // nomes originais; hoje com o sufixo acima
  TRAVA_ESPERA_MS: 30000,
  VALOR_VAZIO_LEGADO: '-', // a planilha antiga usa "-" para "sem data"

  // Nomes das abas novas (sem sufixo). As antigas serão renomeadas com SUFIXO_LEGADO.
  ABAS: {
    FUNCIONARIOS: 'Funcionários',
    FERIAS: 'Férias',
    HORARIOS: 'Horários',
    PREFERENCIAS: 'Preferências',
    DISTRIBUICAO: 'Distribuição',
    CONSULTA: 'Consulta',
    HISTORICO: 'Histórico',
    CONFIGURACOES: 'Configurações',
    PRESENCA: 'Presença'
  },

  // chave interna -> texto do cabeçalho. A ordem define a ordem das colunas ao criar a aba.
  // As colunas são localizadas pelo TEXTO do cabeçalho, nunca pela posição.
  // Consulta e Configurações têm layout próprio (definido nas etapas 5 e 2/6) e não entram aqui.
  COLUNAS: {
    FUNCIONARIOS: {
      ID_CONTRATO: 'ID do contrato',
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome completo',
      CARGO: 'Cargo',
      SETOR: 'Setor',
      VINCULO: 'Tipo de vínculo',
      INICIO: 'Início do contrato',
      FIM: 'Fim do contrato',
      DURACAO: 'Duração',
      STATUS: 'Status',
      DESLIGAMENTO: 'Data de desligamento',
      OBSERVACOES: 'Observações'
    },
    FERIAS: {
      ID_CONTRATO: 'ID do contrato',
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome',
      PERIODO: 'Período (1º / 2º)',
      INICIO: 'Início das férias',
      FIM: 'Fim das férias',
      DIAS: 'Dias',
      DESEJA_15: 'Deseja 15 dias',
      STATUS: 'Status',
      OBSERVACOES: 'Observações'
    },
    HORARIOS: {
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome',
      SEG_DE: 'Segunda — De', SEG_ATE: 'Segunda — Até',
      TER_DE: 'Terça — De', TER_ATE: 'Terça — Até',
      QUA_DE: 'Quarta — De', QUA_ATE: 'Quarta — Até',
      QUI_DE: 'Quinta — De', QUI_ATE: 'Quinta — Até',
      SEX_DE: 'Sexta — De', SEX_ATE: 'Sexta — Até'
    },
    PREFERENCIAS: {
      ID_CONTRATO: 'ID do contrato',
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome',
      DESEJA_DIVIDIR: 'Deseja dividir férias?',
      PREF_PRIMEIRO: 'Preferência do primeiro período',
      PREF_SEGUNDO: 'Preferência do segundo período',
      OBSERVACOES: 'Observações'
    },
    DISTRIBUICAO: {
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome',
      SETOR: 'Setor',
      POSICAO: 'Posição',
      SEGUNDA: 'Segunda',
      TERCA: 'Terça',
      QUARTA: 'Quarta',
      QUINTA: 'Quinta',
      SEXTA: 'Sexta',
      OBSERVACOES: 'Observações'
    },
    HISTORICO: {
      DATA_HORA: 'Data e hora',
      USUARIO: 'Usuário',
      ID_FUNCIONARIO: 'ID do funcionário',
      ID_CONTRATO: 'ID do contrato',
      OPERACAO: 'Operação',
      CAMPO: 'Campo alterado',
      VALOR_ANTERIOR: 'Valor anterior',
      NOVO_VALOR: 'Novo valor'
    },
    PRESENCA: {
      ID_REGISTRO: 'ID do registro',
      ID_FUNCIONARIO: 'ID do funcionário',
      NOME: 'Nome do funcionário',
      DATA: 'Data',
      STATUS: 'Status da presença',
      OBSERVACAO: 'Observação',
      USUARIO: 'Usuário responsável',
      LANCADO_EM: 'Data e hora do lançamento',
      ATUALIZADO_EM: 'Última atualização',
      ATUALIZADO_POR: 'Atualizado por',
      HORA_CHEGADA: 'Hora de chegada',     // só para Atrasado (texto HH:mm)
      ATRASO_MIN: 'Atraso (min)'           // minutos após o horário de entrada previsto no dia
    }
  },

  // Formato de número aplicado às colunas de data ao gravar.
  COLUNAS_FORMATO: {
    FUNCIONARIOS: { INICIO: 'dd/MM/yyyy', FIM: 'dd/MM/yyyy', DESLIGAMENTO: 'dd/MM/yyyy' },
    FERIAS: { INICIO: 'dd/MM/yyyy', FIM: 'dd/MM/yyyy' },
    HISTORICO: { DATA_HORA: 'dd/MM/yyyy HH:mm:ss' },
    PRESENCA: { DATA: 'dd/MM/yyyy', LANCADO_EM: 'dd/MM/yyyy HH:mm:ss', ATUALIZADO_EM: 'dd/MM/yyyy HH:mm:ss', HORA_CHEGADA: '@', ATRASO_MIN: '0' },
    // horários ficam como TEXTO "HH:mm" (evita conversão de fuso/1899 do Sheets)
    HORARIOS: { SEG_DE: '@', SEG_ATE: '@', TER_DE: '@', TER_ATE: '@', QUA_DE: '@', QUA_ATE: '@', QUI_DE: '@', QUI_ATE: '@', SEX_DE: '@', SEX_ATE: '@' }
  },

  // Textos gravados na coluna "Operação" do Histórico
  OPERACOES: {
    CADASTRO: 'Cadastro', ALTERACAO: 'Alteração', SUSPENSAO: 'Suspensão',
    REATIVACAO: 'Reativação', DESATIVACAO: 'Desativação', RENOVACAO: 'Renovação', PRESENCA: 'Presença',
    ROTINA: 'Rotina automática'
  },

  // Campos do contrato que o usuário pode alterar (Status muda só pelas operações próprias)
  CAMPOS_EDITAVEIS_CONTRATO: ['CARGO', 'SETOR', 'VINCULO', 'INICIO', 'FIM', 'OBSERVACOES'],

  // Dias úteis: sigla (colunas de Horários), chave (colunas de Distribuição) e nome de exibição
  DIAS: [
    { SIGLA: 'SEG', DISTRIBUICAO: 'SEGUNDA', NOME: 'Segunda' },
    { SIGLA: 'TER', DISTRIBUICAO: 'TERCA', NOME: 'Terça' },
    { SIGLA: 'QUA', DISTRIBUICAO: 'QUARTA', NOME: 'Quarta' },
    { SIGLA: 'QUI', DISTRIBUICAO: 'QUINTA', NOME: 'Quinta' },
    { SIGLA: 'SEX', DISTRIBUICAO: 'SEXTA', NOME: 'Sexta' }
  ],
  TURNOS: ['Manhã', 'Tarde', 'Manhã+Tarde', 'Integral'],

  // Regras de jornada por vínculo (usadas na Distribuição e no tempo restante da Lista de presença).
  // Manhã+Tarde é exclusivo de Estágio (08:00–16:00 ou 09:00–17:00, com 30 min de almoço).
  // Integral é exclusivo de PSS e Cargo (08:00–17:00, com 1h de almoço). PSS e Cargo sempre têm 1h de almoço.
  JORNADA: {
    TURNO_MANHA_TARDE: 'Manhã+Tarde',
    TURNO_INTEGRAL: 'Integral',
    VINCULOS_MANHA_TARDE: ['Estágio'],
    VINCULOS_INTEGRAL: ['PSS', 'Cargo'],
    HORARIO_INTEGRAL: { DE: '08:00', ATE: '17:00' },      // usado quando a pessoa não tem horário cadastrado no dia
    HORARIOS_MANHA_TARDE: [{ DE: '08:00', ATE: '16:00' }, { DE: '09:00', ATE: '17:00' }],
    ALMOCO_MIN_POR_VINCULO: { 'PSS': 60, 'Cargo': 60 },   // sempre
    ALMOCO_MIN_ESTAGIO_MANHA_TARDE: 30                    // Estágio: só no dia em que o turno é Manhã+Tarde
  },

  // Aba Consulta (dashboard institucional). Grade: 18 colunas de conteúdo + 5 de respiro entre os cartões.
  CONSULTA: {
    COLUNAS: 25,
    COLUNA_ANO: 24,                           // seletor de ano (lista suspensa) na seção do calendário
    TITULO_FERIAS: 'Calendário de férias',
    DIAS_AVISO_VENCIMENTO: 60,               // janela de "contratos a vencer": indicador, aviso e resumo de pendências
    ATUALIZAR_APOS_OPERACAO: true,            // false = só atualiza pela rotina diária, pelo menu e ao trocar o ano
    TITULO: 'Gestão de Estagiários e Funcionários',
    ORGAO: 'Nome do Órgão',
    SETOR: 'Nome do Setor',
    RESERVAR_ESPACO_BRASAO: true,             // deixa um espaço à esquerda do título para o brasão
    BRASAO_URL: '',                           // link público da imagem do brasão (opcional; veja o manual)
    CORES: {
      AZUL_ESCURO: '#17365D', AZUL_MEDIO: '#285A91', AZUL_CLARO: '#DCE8F5',
      CINZA_ESCURO: '#343A40', CINZA_MEDIO: '#A7ADB4', CINZA_CLARO: '#F1F3F5', BRANCO: '#FFFFFF',
      VERMELHO: '#C0392B', VERMELHO_FUNDO: '#FBE9E7', AMARELO: '#D99A00', AMARELO_FUNDO: '#FFF4D6',
      VERDE: '#2E7D32', VERDE_FUNDO: '#E6F4EA'
    }
  },

  // Gatilhos que o sistema espera encontrar (um de cada, nunca duplicados)
  AUTOMACAO: {
    GATILHOS_ESPERADOS: ['executarRotinaDiariaDeFerias']
  },

  IDS: {
    PREFIXO_FUNCIONARIO: 'FUNC',
    PREFIXO_CONTRATO: 'CONT',
    PREFIXO_PRESENCA: 'PRES',
    DIGITOS: 4
  },

  STATUS_CONTRATO: { ATIVO: 'Ativo', SUSPENSO: 'Suspenso', ENCERRADO: 'Encerrado' },

  // Pendente: ainda não conversei com a pessoa sobre as férias
  // Aguardando: já conversei e aguardo a resposta dela para negociar (datas, escala, equipe)
  // Prevista: combinado e programado | Tirada: férias já realizadas
  // Sem direito: contrato sem direito a férias (ex.: contrato de 6 meses); sem datas, sai das pendências
  STATUS_FERIAS: { PENDENTE: 'Pendente', AGUARDANDO: 'Aguardando', PREVISTA: 'Prevista', TIRADA: 'Tirada', SEM_DIREITO: 'Sem direito' },

  // Situações da lista de presença (o usuário sempre marca; nada é lançado automaticamente)
  STATUS_PRESENCA: { PRESENTE: 'Presente', AUSENTE: 'Ausente', ATRASADO: 'Atrasado', JUSTIFICADO: 'Justificado', FERIAS: 'Férias', FOLGA: 'Folga' },

  PRESENCA: {
    PERMITIR_DATA_FUTURA: false,              // true = deixa lançar presença de dias que ainda não chegaram
    EMAILS_AUTORIZADOS: [],                   // vazio = qualquer pessoa com acesso à planilha; com e-mails = só eles lançam/alteram
    MAX_OBSERVACAO: 300,
    // Colunas acrescentadas depois da criação da aba: entram no fim do cabeçalho sozinhas, sem mexer nos registros.
    COLUNAS_ACRESCENTADAS: ['HORA_CHEGADA', 'ATRASO_MIN'],
    ATUALIZACAO_AUTOMATICA_MIN: 5,            // a tela recarrega os dados sozinha (só quando não há alteração por salvar)
    MAX_DIAS_HISTORICO: 366,                  // maior intervalo aceito na consulta de histórico
    // "Pendente" não é gravado: é o dia de trabalho que já chegou e ainda não tem registro
    PENDENTE: 'Pendente'
  },

  TIPOS_VINCULO: ['Estágio', 'PSS', 'Cargo'],
  PERIODOS_FERIAS: ['1º', '2º'],

  // Listas preenchidas pelo usuário (não inventar valores).
  CARGOS: [],
  SETORES: [],

  // Regra inicial; REGRA_VALIDADA permanece false até confirmar a regra de cada tipo de contrato.
  FERIAS: {
    DIAS_POR_ANO: 30,
    DIAS_CONTRATO_SEMESTRAL: 15,
    REGRA_VALIDADA: false,            // enquanto false, nenhum dia/data de férias é calculado sozinho
    MESES_PARA_FERIAS: 0,             // 0 = cria o período 1º logo; use 6 para só criar após 6 meses de contrato
    VINCULOS_COM_CADASTRO_AUTOMATICO: ['Estágio', 'PSS', 'Cargo'],
    MARCAR_TIRADA_AUTOMATICAMENTE: true,
    HORA_ROTINA_DIARIA: 6
  }
};