/**
 * FeriasService.gs — regras de negócio das FÉRIAS (um período = uma linha, ligado a um contrato).
 *
 * Situações (controladas por você, não por contagem de meses):
 *   Pendente   = ainda não conversei com a pessoa
 *   Aguardando = já conversei e aguardo a resposta para negociar
 *   Prevista   = combinado e programado (exige datas)
 *   Tirada     = já realizado (exige datas; só depois do fim das férias; não muda mais)
 * Nenhuma data ou quantidade de dias é calculada sozinha enquanto CONFIG.FERIAS.REGRA_VALIDADA for false.
 */

/* ===================== NORMALIZAÇÃO E VALIDAÇÃO ===================== */

function normalizarPeriodoDeFerias(periodo) {
  const t = String(periodo === null || periodo === undefined ? '' : periodo).trim().replace(/[ºo°]$/i, '');
  const canonico = CONFIG.PERIODOS_FERIAS.filter(function (p) { return p.replace('º', '') === t; })[0];
  if (!canonico) throw new Error('[Férias] Período inválido: "' + periodo + '". Use ' + CONFIG.PERIODOS_FERIAS.join(' ou ') + '.');
  return canonico;
}

function normalizarStatusDeFerias(status) {
  const lista = Object.keys(CONFIG.STATUS_FERIAS).map(function (k) { return CONFIG.STATUS_FERIAS[k]; });
  const canonico = lista.filter(function (s) { return chaveDoNome(s) === chaveDoNome(status); })[0];
  if (!canonico) throw new Error('[Férias] Status inválido: "' + status + '". Valores aceitos: ' + lista.join(', '));
  return canonico;
}

function normalizarDatasDoPeriodo(inicio, fim) {
  const data = function (v, rotulo) {
    if (valorVazio(v)) return '';
    const d = converterData(v);
    if (!d) throw new Error('[Férias] ' + rotulo + ' inválido: "' + v + '". Use dd/MM/aaaa.');
    return d;
  };
  const datas = { INICIO: data(inicio, 'Início das férias'), FIM: data(fim, 'Fim das férias') };
  if ((datas.INICIO === '') !== (datas.FIM === '')) {
    throw new Error('[Férias] Informe início e fim das férias, ou deixe os dois em branco.');
  }
  return datas;
}

function normalizarDesejaQuinzeDias(valor) {
  if (valor === true) return 'Sim';
  return ['sim', 'true', 's', 'x', '1'].indexOf(chaveDoNome(valor)) >= 0 ? 'Sim' : '';
}

function validarTransicaoDeStatusDeFerias(de, para, datas) {
  const ST = CONFIG.STATUS_FERIAS;
  if (de === para) return;
  if (de === ST.SEM_DIREITO) {
    if (para === ST.PENDENTE) return;
    throw new Error('[Férias] Período sem direito a férias: só pode voltar para Pendente (restabelecer o direito).');
  }
  if (para === ST.SEM_DIREITO) {
    if (de === ST.PENDENTE || de === ST.AGUARDANDO) return;
    throw new Error('[Férias] Só é possível marcar como sem direito um período Pendente ou Aguardando.');
  }
  if (de === ST.TIRADA) {
    // correção de engano: uma "Tirada" cujo fim ainda não chegou pode voltar para Prevista
    if (para === ST.PREVISTA && datas.FIM !== '' && compararDatas(datas.FIM, hojeNormalizado()) >= 0) return;
    throw new Error('[Férias] Período já tirado: o status só pode voltar para Prevista se as férias ainda não terminaram.');
  }
  if (para === ST.TIRADA) {
    if (de !== ST.PREVISTA) throw new Error('[Férias] Só é possível marcar como Tirada um período Prevista.');
    if (compararDatas(datas.FIM, hojeNormalizado()) >= 0) {
      throw new Error('[Férias] As férias ainda não terminaram (fim em ' + formatarData(datas.FIM) + ').');
    }
  }
}

function validarPeriodoDeFerias(contrato, periodo, datas, status, outrosPeriodos) {
  const ST = CONFIG.STATUS_FERIAS;
  const temDatas = datas.INICIO !== '';
  if (status === ST.SEM_DIREITO && temDatas) throw new Error('[Férias] Período "Sem direito" não tem datas.');
  if ((status === ST.PREVISTA || status === ST.TIRADA) && !temDatas) {
    throw new Error('[Férias] Para "' + status + '" informe início e fim das férias.');
  }
  if (!temDatas) return;
  validarIntervaloDeDatas(datas.INICIO, datas.FIM, 'Férias');
  const dias = diasEntreDatas(datas.INICIO, datas.FIM);
  if (dias > CONFIG.FERIAS.DIAS_POR_ANO) {
    throw new Error('[Férias] O período tem ' + dias + ' dias; o máximo é ' + CONFIG.FERIAS.DIAS_POR_ANO + '.');
  }
  if (contrato.INICIO !== '' && contrato.FIM !== '' &&
      (compararDatas(datas.INICIO, contrato.INICIO) < 0 || compararDatas(datas.FIM, contrato.FIM) > 0)) {
    throw new Error('[Férias] As férias devem ficar dentro do contrato (' + formatarData(contrato.INICIO) + ' a ' + formatarData(contrato.FIM) + ').');
  }
  outrosPeriodos.forEach(function (o) {
    if (o.PERIODO === periodo || o.INICIO === '' || o.FIM === '') return;
    if (compararDatas(datas.INICIO, o.FIM) <= 0 && compararDatas(datas.FIM, o.INICIO) >= 0) {
      throw new Error('[Férias] O período ' + periodo + ' se sobrepõe ao ' + o.PERIODO + ' (' + formatarData(o.INICIO) + ' a ' + formatarData(o.FIM) + ').');
    }
  });
}

function montarRegistroDoPeriodo(contrato, periodo, datas, status, deseja15, observacoes) {
  return {
    ID_CONTRATO: contrato.ID_CONTRATO, ID_FUNCIONARIO: contrato.ID_FUNCIONARIO, NOME: contrato.NOME,
    PERIODO: periodo, INICIO: datas.INICIO, FIM: datas.FIM,
    DIAS: datas.INICIO === '' ? '' : diasEntreDatas(datas.INICIO, datas.FIM),
    DESEJA_15: deseja15, STATUS: status, OBSERVACOES: observacoes
  };
}

function registrarAlteracaoDeFerias(operacao, periodo, diff) {
  const campos = Object.keys(diff.depois || {});
  if (!campos.length) return;
  registrarHistorico(campos.map(function (k) {
    return {
      ID_FUNCIONARIO: periodo.ID_FUNCIONARIO, ID_CONTRATO: periodo.ID_CONTRATO, OPERACAO: operacao,
      CAMPO: 'Férias ' + periodo.PERIODO + ' — ' + CONFIG.COLUNAS.FERIAS[k],
      VALOR_ANTERIOR: diff.antes[k], NOVO_VALOR: diff.depois[k]
    };
  }));
}

/* ===================== OPERAÇÕES ===================== */

/** Cria um período para o contrato. Dados opcionais: PERIODO ('1º'), STATUS (Pendente), INICIO, FIM, DESEJA_15, OBSERVACOES. */
function criarPeriodoDeFerias(idContrato, dados) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    const d = dados || {};
    const periodo = normalizarPeriodoDeFerias(valorVazio(d.PERIODO) ? CONFIG.PERIODOS_FERIAS[0] : d.PERIODO);
    const status = normalizarStatusDeFerias(valorVazio(d.STATUS) ? CONFIG.STATUS_FERIAS.PENDENTE : d.STATUS);
    if (contrato.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO && status !== CONFIG.STATUS_FERIAS.TIRADA) {
      throw new Error('[Férias] Contrato Encerrado: só é possível registrar férias já Tiradas.');
    }
    const existentes = listarFeriasDoContrato(idContrato);
    if (existentes.some(function (f) { return f.PERIODO === periodo; })) {
      throw new Error('[Férias] O contrato ' + idContrato + ' já tem o período ' + periodo + '.');
    }
    if (periodo === CONFIG.PERIODOS_FERIAS[1] && !existentes.some(function (f) { return f.PERIODO === CONFIG.PERIODOS_FERIAS[0]; })) {
      throw new Error('[Férias] Crie o período 1º antes do 2º.');
    }
    const datas = normalizarDatasDoPeriodo(d.INICIO, d.FIM);
    validarPeriodoDeFerias(contrato, periodo, datas, status, existentes);
    if (status === CONFIG.STATUS_FERIAS.TIRADA && compararDatas(datas.FIM, hojeNormalizado()) >= 0) {
      throw new Error('[Férias] As férias ainda não terminaram (fim em ' + formatarData(datas.FIM) + ').');
    }
    const registro = montarRegistroDoPeriodo(contrato, periodo, datas, status,
      normalizarDesejaQuinzeDias(d.DESEJA_15), valorVazio(d.OBSERVACOES) ? '' : String(d.OBSERVACOES).trim());
    inserirFerias([registro]);
    registrarHistorico({
      ID_FUNCIONARIO: contrato.ID_FUNCIONARIO, ID_CONTRATO: contrato.ID_CONTRATO, OPERACAO: CONFIG.OPERACOES.CADASTRO,
      CAMPO: 'Férias ' + periodo, NOVO_VALOR: status
    });
    return { ID_CONTRATO: contrato.ID_CONTRATO, PERIODO: periodo, STATUS: status };
  });
}

/** Altera status, datas, "deseja 15 dias" e observações. Só grava o que mudou; Dias é recalculado. */
function salvarPeriodoDeFerias(idContrato, periodo, dados) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    const p = normalizarPeriodoDeFerias(periodo);
    const atual = buscarPeriodoDeFerias(idContrato, p);
    if (!atual) throw new Error('[Férias] O contrato ' + idContrato + ' não tem o período ' + p + '.');
    const campos = dados || {};
    Object.keys(campos).forEach(function (k) {
      if (['INICIO', 'FIM', 'STATUS', 'DESEJA_15', 'OBSERVACOES'].indexOf(k) < 0) throw new Error('[Férias] Campo não editável: ' + k + '.');
    });
    const tem = function (k) { return Object.prototype.hasOwnProperty.call(campos, k); };
    const datas = normalizarDatasDoPeriodo(tem('INICIO') ? campos.INICIO : atual.INICIO, tem('FIM') ? campos.FIM : atual.FIM);
    const status = tem('STATUS') && !valorVazio(campos.STATUS) ? normalizarStatusDeFerias(campos.STATUS) : atual.STATUS;
    if (status === CONFIG.STATUS_FERIAS.SEM_DIREITO) { datas.INICIO = ''; datas.FIM = ''; } // sem direito não tem datas

    const novos = {};
    if (campoDoContratoMudou(atual.INICIO, datas.INICIO)) novos.INICIO = datas.INICIO;
    if (campoDoContratoMudou(atual.FIM, datas.FIM)) novos.FIM = datas.FIM;
    if (novos.INICIO !== undefined || novos.FIM !== undefined) {
      novos.DIAS = datas.INICIO === '' ? '' : diasEntreDatas(datas.INICIO, datas.FIM);
    }
    if (status !== atual.STATUS) novos.STATUS = status;
    if (tem('DESEJA_15') && normalizarDesejaQuinzeDias(campos.DESEJA_15) !== String(atual.DESEJA_15)) {
      novos.DESEJA_15 = normalizarDesejaQuinzeDias(campos.DESEJA_15);
    }
    if (tem('OBSERVACOES') && String(campos.OBSERVACOES === null ? '' : campos.OBSERVACOES).trim() !== String(atual.OBSERVACOES).trim()) {
      novos.OBSERVACOES = String(campos.OBSERVACOES === null ? '' : campos.OBSERVACOES).trim();
    }
    const chavesNovas = Object.keys(novos);
    if (!chavesNovas.length) return { ID_CONTRATO: idContrato, PERIODO: p, alterados: [] };

    const ST = CONFIG.STATUS_FERIAS;
    const correcaoDeTirada = atual.STATUS === ST.TIRADA && novos.STATUS === ST.PREVISTA && atual.FIM !== '' &&
      compararDatas(atual.FIM, hojeNormalizado()) >= 0 &&
      chavesNovas.every(function (k) { return k === 'STATUS' || k === 'OBSERVACOES'; });
    if (atual.STATUS === ST.TIRADA && !correcaoDeTirada && chavesNovas.some(function (k) { return k !== 'OBSERVACOES'; })) {
      throw new Error('[Férias] Período já tirado: só as Observações podem ser alteradas (o status só volta para Prevista se as férias ainda não terminaram).');
    }
    if (correcaoDeTirada) {
      novos.OBSERVACOES = acrescentarObservacao(novos.OBSERVACOES !== undefined ? novos.OBSERVACOES : atual.OBSERVACOES,
        'Corrigido de Tirada para Prevista (as férias ainda não terminaram).');
    }
    if (novos.STATUS !== undefined) validarTransicaoDeStatusDeFerias(atual.STATUS, status, datas);
    if (novos.INICIO !== undefined || novos.FIM !== undefined || novos.STATUS !== undefined) {
      const outros = listarFeriasDoContrato(idContrato).filter(function (o) { return o.PERIODO !== p; });
      validarPeriodoDeFerias(contrato, p, datas, status, outros);
    }
    const diff = atualizarPeriodoDeFerias(atual._linha, novos);
    registrarAlteracaoDeFerias(CONFIG.OPERACOES.ALTERACAO, atual, diff);
    return { ID_CONTRATO: idContrato, PERIODO: p, alterados: Object.keys(diff.depois) };
  });
}

/**
 * Divisão em dois períodos (15 + 15): cria o 2º período (sem datas) e marca "Deseja 15 dias" no 1º.
 * As datas de cada um você define depois, na negociação com a pessoa.
 */
function dividirFerias(idContrato) {
  return executarComTrava(function () {
    const contrato = obterContratoOuErro(idContrato);
    const ST = CONFIG.STATUS_FERIAS;
    if (contrato.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO) throw new Error('[Férias] Contrato Encerrado.');
    const periodos = listarFeriasDoContrato(idContrato);
    const primeiro = periodos.filter(function (f) { return f.PERIODO === CONFIG.PERIODOS_FERIAS[0]; })[0];
    if (!primeiro) throw new Error('[Férias] O contrato ' + idContrato + ' ainda não tem o período 1º.');
    if (periodos.some(function (f) { return f.PERIODO === CONFIG.PERIODOS_FERIAS[1]; })) {
      throw new Error('[Férias] O contrato ' + idContrato + ' já tem o período 2º.');
    }
    if (primeiro.STATUS === ST.TIRADA) throw new Error('[Férias] O período 1º já foi tirado.');
    if (primeiro.STATUS === ST.SEM_DIREITO) throw new Error('[Férias] O contrato está marcado como sem direito a férias.');
    const statusSegundo = primeiro.STATUS === ST.AGUARDANDO ? ST.AGUARDANDO : ST.PENDENTE;
    inserirFerias([montarRegistroDoPeriodo(contrato, CONFIG.PERIODOS_FERIAS[1], { INICIO: '', FIM: '' }, statusSegundo, 'Sim', '')]);
    registrarHistorico({
      ID_FUNCIONARIO: contrato.ID_FUNCIONARIO, ID_CONTRATO: idContrato, OPERACAO: CONFIG.OPERACOES.CADASTRO,
      CAMPO: 'Férias ' + CONFIG.PERIODOS_FERIAS[1], NOVO_VALOR: statusSegundo
    });
    if (normalizarDesejaQuinzeDias(primeiro.DESEJA_15) !== 'Sim') {
      registrarAlteracaoDeFerias(CONFIG.OPERACOES.ALTERACAO, primeiro, atualizarPeriodoDeFerias(primeiro._linha, { DESEJA_15: 'Sim' }));
    }
    const preferencia = buscarPreferenciaDoContrato(idContrato);
    if (preferencia && String(preferencia.DESEJA_DIVIDIR).trim() !== 'Sim') {
      atualizarPreferencia(preferencia._linha, { DESEJA_DIVIDIR: 'Sim' });
    }
    const aviso = (primeiro.INICIO !== '' && diasEntreDatas(primeiro.INICIO, primeiro.FIM) > 15)
      ? 'O 1º período tem ' + diasEntreDatas(primeiro.INICIO, primeiro.FIM) + ' dias: ajuste as datas dele.' : '';
    return { ID_CONTRATO: idContrato, STATUS_SEGUNDO: statusSegundo, aviso: aviso };
  });
}

/* ===================== ROTINA (manual ou diária) ===================== */

/**
 * 1) Contrato Ativo sem nenhum período de férias ganha o 1º, Pendente e sem datas.
 * 2) Período Prevista cujo fim já passou vira Tirada.
 * Com simular = true só calcula e devolve o que faria, sem gravar nada.
 * Quem tem férias sem contrato vinculado é ignorado (evita duplicar) e listado em semVinculo.
 */
function sincronizarFeriasDosContratos(simular) {
  return executarComTrava(function () {
    const ST = CONFIG.STATUS_FERIAS;
    const hoje = hojeNormalizado();
    const resultado = { simulado: !!simular, criados: [], tiradas: [], semVinculo: [] };
    const ferias = listarFerias();
    const contratosComPeriodo = {};
    const pessoasSemVinculo = {};
    ferias.forEach(function (f) {
      if (valorVazio(f.ID_CONTRATO)) pessoasSemVinculo[String(f.ID_FUNCIONARIO).trim()] = true;
      else contratosComPeriodo[String(f.ID_CONTRATO).trim()] = true;
    });

    const novos = [];
    listarContratos().forEach(function (c) {
      if (c.STATUS !== CONFIG.STATUS_CONTRATO.ATIVO) return;
      if (contratosComPeriodo[String(c.ID_CONTRATO).trim()]) return;
      if (CONFIG.FERIAS.VINCULOS_COM_CADASTRO_AUTOMATICO.indexOf(c.VINCULO) < 0) return;
      if (CONFIG.FERIAS.MESES_PARA_FERIAS > 0 && c.INICIO !== '' &&
          compararDatas(somarMesesData(c.INICIO, CONFIG.FERIAS.MESES_PARA_FERIAS), hoje) > 0) return;
      if (pessoasSemVinculo[String(c.ID_FUNCIONARIO).trim()]) {
        resultado.semVinculo.push(c.NOME + ' (' + c.ID_CONTRATO + ')');
        return;
      }
      novos.push(montarRegistroDoPeriodo(c, CONFIG.PERIODOS_FERIAS[0], { INICIO: '', FIM: '' }, ST.PENDENTE, '', ''));
      resultado.criados.push(c.NOME + ' (' + c.ID_CONTRATO + ')');
    });

    const vencidas = CONFIG.FERIAS.MARCAR_TIRADA_AUTOMATICAMENTE ? ferias.filter(function (f) {
      return f.STATUS === ST.PREVISTA && f.FIM !== '' && compararDatas(f.FIM, hoje) < 0;
    }) : [];
    vencidas.forEach(function (f) { resultado.tiradas.push(f.NOME + ' ' + f.PERIODO + ' (fim em ' + formatarData(f.FIM) + ')'); });

    if (!simular) {
      if (novos.length) {
        inserirFerias(novos);
        registrarHistorico(novos.map(function (r) {
          return { ID_FUNCIONARIO: r.ID_FUNCIONARIO, ID_CONTRATO: r.ID_CONTRATO, OPERACAO: CONFIG.OPERACOES.ROTINA,
            CAMPO: 'Férias ' + r.PERIODO, NOVO_VALOR: r.STATUS };
        }));
      }
      vencidas.forEach(function (f) {
        registrarAlteracaoDeFerias(CONFIG.OPERACOES.ROTINA, f, atualizarPeriodoDeFerias(f._linha, { STATUS: ST.TIRADA }));
      });
    }
    return resultado;
  });
}

/**
 * Limpeza pontual: remove início, fim e dias dos períodos Pendente ou Aguardando (datas de rascunho do
 * sistema antigo, que ninguém negociou). NUNCA toca em Prevista nem Tirada. O status não muda.
 * Com simular = true só lista o que seria limpo, sem gravar nada.
 */
function limparDatasDosPeriodosEmAberto(simular) {
  return executarComTrava(function () {
    const ST = CONFIG.STATUS_FERIAS;
    const alvos = listarFerias().filter(function (f) {
      return (f.STATUS === ST.PENDENTE || f.STATUS === ST.AGUARDANDO) &&
        (f.INICIO !== '' || f.FIM !== '' || String(f.DIAS) !== '');
    });
    const resultado = { simulado: !!simular, total: alvos.length, periodos: [] };
    alvos.forEach(function (f) {
      resultado.periodos.push(f.NOME + ' ' + f.PERIODO + ' [' + f.STATUS + '] ' +
        (f.INICIO !== '' ? formatarData(f.INICIO) + ' a ' + formatarData(f.FIM) : 'sem datas') +
        (String(f.DIAS) !== '' ? ' (' + f.DIAS + ' dias)' : ''));
      if (!simular) {
        registrarAlteracaoDeFerias(CONFIG.OPERACOES.ALTERACAO, f,
          atualizarPeriodoDeFerias(f._linha, { INICIO: '', FIM: '', DIAS: '' }));
      }
    });
    return resultado;
  });
}

/* ===================== SEM DIREITO A FÉRIAS ===================== */

/** Duração do contrato em meses (arredondada); null se o contrato não tem as duas datas. */
function mesesDoContrato(contrato) {
  if (contrato.INICIO === '' || contrato.FIM === '') return null;
  return Math.round(diasEntreDatas(contrato.INICIO, contrato.FIM) / 30.4375);
}

/**
 * Marca o contrato como "Sem direito a férias" (ex.: contrato de 6 meses). Os períodos Pendente ou Aguardando
 * passam para "Sem direito" (datas e dias são limpos); se não houver período, cria o 1º já nessa situação.
 * Recusa se o contrato já tem férias Prevista ou Tirada. Nada é apagado.
 */
function marcarSemDireitoAFerias(idContrato, motivo) {
  return executarComTrava(function () {
    const SF = CONFIG.STATUS_FERIAS;
    const contrato = obterContratoOuErro(idContrato);
    if (contrato.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO) throw new Error('[Férias] Contrato Encerrado.');
    const periodos = listarFeriasDoContrato(idContrato);
    if (periodos.some(function (p) { return p.STATUS === SF.PREVISTA || p.STATUS === SF.TIRADA; })) {
      throw new Error('[Férias] O contrato ' + idContrato + ' já tem férias Prevista ou Tirada; não dá para marcar como sem direito.');
    }
    const meses = mesesDoContrato(contrato);
    const nota = 'Sem direito a férias' + (valorVazio(motivo) ? (meses ? ' (contrato de ' + meses + ' meses)' : '') : ': ' + String(motivo).trim());
    let marcados = 0;
    if (!periodos.length) {
      inserirFerias([montarRegistroDoPeriodo(contrato, CONFIG.PERIODOS_FERIAS[0], { INICIO: '', FIM: '' }, SF.SEM_DIREITO, '', acrescentarObservacao('', nota))]);
      registrarHistorico({
        ID_FUNCIONARIO: contrato.ID_FUNCIONARIO, ID_CONTRATO: idContrato, OPERACAO: CONFIG.OPERACOES.CADASTRO,
        CAMPO: 'Férias ' + CONFIG.PERIODOS_FERIAS[0], NOVO_VALOR: SF.SEM_DIREITO
      });
      marcados = 1;
    } else {
      periodos.forEach(function (p) {
        if (p.STATUS === SF.SEM_DIREITO) return;
        registrarAlteracaoDeFerias(CONFIG.OPERACOES.ALTERACAO, p, atualizarPeriodoDeFerias(p._linha, {
          STATUS: SF.SEM_DIREITO, INICIO: '', FIM: '', DIAS: '', DESEJA_15: '', OBSERVACOES: acrescentarObservacao(p.OBSERVACOES, nota)
        }));
        marcados++;
      });
    }
    if (!marcados) throw new Error('[Férias] O contrato ' + idContrato + ' já está marcado como sem direito a férias.');
    return { ID_CONTRATO: idContrato, periodosMarcados: marcados };
  });
}

/** Desfaz o "sem direito": os períodos voltam para Pendente (ex.: marcado por engano ou contrato renovado). */
function restabelecerDireitoAFerias(idContrato) {
  return executarComTrava(function () {
    const SF = CONFIG.STATUS_FERIAS;
    const contrato = obterContratoOuErro(idContrato);
    if (contrato.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO) throw new Error('[Férias] Contrato Encerrado.');
    const alvos = listarFeriasDoContrato(idContrato).filter(function (p) { return p.STATUS === SF.SEM_DIREITO; });
    if (!alvos.length) throw new Error('[Férias] O contrato ' + idContrato + ' não está marcado como sem direito a férias.');
    alvos.forEach(function (p) {
      registrarAlteracaoDeFerias(CONFIG.OPERACOES.ALTERACAO, p, atualizarPeriodoDeFerias(p._linha, {
        STATUS: SF.PENDENTE, OBSERVACOES: acrescentarObservacao(p.OBSERVACOES, 'Direito a férias restabelecido')
      }));
    });
    return { ID_CONTRATO: idContrato, periodosRestabelecidos: alvos.length };
  });
}