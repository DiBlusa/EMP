/**
 * PresencaService.gs — regras da LISTA DE PRESENÇA (visão semanal e diária).
 *  - O usuário sempre marca; nada é lançado automaticamente. "Pendente" não é gravado: é o dia de trabalho que já chegou sem registro.
 *  - Um registro por funcionário por dia. Alterar um registro já lançado exige confirmação e guarda o valor antigo no Histórico.
 *  - NÃO recebem lançamento: quem está de férias na data, contratos Suspensos e Encerrados.
 *    Na semana, quem está de férias em todos os dias em que trabalharia fica oculto; férias em parte da semana bloqueiam só esses dias.
 *    Renovação não conta como encerramento: quem tem um contrato Ativo continua aparecendo nas datas do contrato anterior.
 *  - Atrasado exige a hora de chegada; o atraso é contado a partir da entrada prevista no dia (a saída continua a combinada).
 *  - Os registros de quem saiu da lista continuam guardados na aba Presença; só não são exibidos.
 */

function listaDeStatusDePresenca() {
  return Object.keys(CONFIG.STATUS_PRESENCA).map(function (k) { return CONFIG.STATUS_PRESENCA[k]; });
}

function normalizarStatusDePresenca(status) {
  const lista = listaDeStatusDePresenca();
  const canonico = lista.filter(function (s) { return chaveDoNome(s) === chaveDoNome(status); })[0];
  if (!canonico) throw new Error('[Presença] Situação inválida: "' + status + '". Valores aceitos: ' + lista.join(', '));
  return canonico;
}

/** Quem pode lançar/alterar. Sem lista em CONFIG.PRESENCA.EMAILS_AUTORIZADOS, qualquer pessoa com acesso à planilha. */
function verificarPermissaoDePresenca() {
  const usuario = obterUsuarioAtual();
  const lista = CONFIG.PRESENCA.EMAILS_AUTORIZADOS;
  if (!lista.length) return { pode: true, motivo: '', usuario: usuario };
  const autorizado = lista.some(function (e) { return chaveDoNome(e) === chaveDoNome(usuario); });
  return { pode: autorizado, motivo: autorizado ? '' : 'Você não está na lista de pessoas autorizadas a lançar presença.', usuario: usuario };
}

/**
 * O contrato vale para a presença naquela data? Ativo desde o início. Encerrado só conta em renovação:
 * quando a pessoa tem outro contrato Ativo, o anterior vale dentro do seu período. Suspenso nunca.
 */
function contratoCobreADataParaPresenca(contrato, data, pessoaTemContratoAtivo) {
  const ST = CONFIG.STATUS_CONTRATO;
  const comecou = contrato.INICIO === '' || compararDatas(data, contrato.INICIO) >= 0;
  if (contrato.STATUS === ST.ATIVO) return comecou;
  if (contrato.STATUS === ST.ENCERRADO && pessoaTemContratoAtivo) {
    const fim = contrato.DESLIGAMENTO !== '' ? contrato.DESLIGAMENTO : contrato.FIM;
    return contrato.INICIO !== '' && comecou && fim !== '' && compararDatas(data, fim) <= 0;
  }
  return false;
}

/** Mapa idFuncionario -> true para quem tem férias Prevista ou Tirada cobrindo a data. ferias: lista já lida (opcional). */
function idsDeQuemEstaDeFeriasNaData(data, ferias) {
  const SF = CONFIG.STATUS_FERIAS;
  const mapa = {};
  (ferias || listarFerias()).forEach(function (f) {
    if ((f.STATUS === SF.PREVISTA || f.STATUS === SF.TIRADA) && f.INICIO !== '' && f.FIM !== '' && dataEstaNoIntervalo(data, f.INICIO, f.FIM)) {
      mapa[String(f.ID_FUNCIONARIO).trim()] = true;
    }
  });
  return mapa;
}

/** Contrato que vale para a pessoa na data (o Ativo tem preferência), ou null. */
function contratoDaPessoaNaData(pessoa, data) {
  const temAtivo = pessoa.contratos.some(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.ATIVO; });
  const cobrindo = pessoa.contratos.filter(function (c) { return contratoCobreADataParaPresenca(c, data, temAtivo); });
  if (!cobrindo.length) return null;
  return cobrindo.filter(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.ATIVO; })[0] || cobrindo[0];
}

/**
 * Quem entra na lista da data e quantos ficaram de fora (de férias, suspensos, encerrados).
 * pre (opcional) = { pessoas, ferias } já lidos, para não reler as abas a cada data.
 */
function classificarFuncionariosParaPresenca(data, pre) {
  const p0 = pre || {};
  const emFerias = idsDeQuemEstaDeFeriasNaData(data, p0.ferias);
  const elegiveis = [];
  const fora = { ferias: 0, suspensos: 0, encerrados: 0 };
  (p0.pessoas || listarFuncionarios()).forEach(function (p) {
    const id = String(p.ID_FUNCIONARIO).trim();
    const contrato = contratoDaPessoaNaData(p, data);
    if (contrato) {
      if (emFerias[id]) { fora.ferias++; return; }
      elegiveis.push({ id: id, nome: String(p.NOME), contrato: contrato });
      return;
    }
    if (p.contratos.some(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.SUSPENSO; })) fora.suspensos++;
    else if (p.contratos.some(function (c) { return c.STATUS === CONFIG.STATUS_CONTRATO.ENCERRADO; })) fora.encerrados++;
  });
  return { elegiveis: elegiveis, fora: fora };
}

function dataIso(data) {
  return formatarData(data).split('/').reverse().join('-');
}

/** Registro da aba -> objeto simples para a tela (Date não atravessa o google.script.run). */
function registroDePresencaParaTela(r) {
  if (!r) return null;
  return {
    idRegistro: String(r.ID_REGISTRO), status: String(r.STATUS), observacao: String(r.OBSERVACAO),
    horaChegada: horarioDaLinha(r, 'HORA_CHEGADA'), atrasoMin: (r.ATRASO_MIN === '' || r.ATRASO_MIN === undefined) ? '' : Number(r.ATRASO_MIN),
    lancadoPor: String(r.USUARIO), lancadoEm: formatarDataHora(r.LANCADO_EM),
    atualizadoPor: String(r.ATUALIZADO_POR), atualizadoEm: formatarDataHora(r.ATUALIZADO_EM)
  };
}

/** Tudo que a tela DIÁRIA precisa para uma data, em uma única leitura (mantida para compatibilidade). */
function montarListaDePresenca(data) {
  const hoje = hojeNormalizado();
  const permissao = verificarPermissaoDePresenca();
  const futura = compararDatas(data, hoje) > 0;
  let podeEditar = permissao.pode;
  let motivo = permissao.motivo;
  if (podeEditar && futura && !CONFIG.PRESENCA.PERMITIR_DATA_FUTURA) {
    podeEditar = false;
    motivo = 'Não é possível lançar presença em data futura.';
  }
  const registroPorPessoa = {};
  listarPresencasDaData(data).forEach(function (r) { registroPorPessoa[String(r.ID_FUNCIONARIO).trim()] = r; });
  const distribuicao = {};
  listarDistribuicao().forEach(function (d) { distribuicao[String(d.ID_FUNCIONARIO).trim()] = d; });
  const classificacao = classificarFuncionariosParaPresenca(data);

  const linhas = classificacao.elegiveis.map(function (p) {
    const registro = registroPorPessoa[p.id] || null;
    const dist = distribuicao[p.id];
    return {
      idFuncionario: p.id, nome: p.nome, vinculo: String(p.contrato.VINCULO),
      setor: String(p.contrato.SETOR || (dist ? dist.SETOR : '') || ''),
      status: registro ? String(registro.STATUS) : '', observacao: registro ? String(registro.OBSERVACAO) : '',
      idRegistro: registro ? String(registro.ID_REGISTRO) : '',
      lancadoPor: registro ? String(registro.USUARIO) : '', lancadoEm: registro ? formatarDataHora(registro.LANCADO_EM) : '',
      atualizadoPor: registro ? String(registro.ATUALIZADO_POR) : '', atualizadoEm: registro ? formatarDataHora(registro.ATUALIZADO_EM) : ''
    };
  });
  linhas.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

  const unicos = function (campo) {
    const m = {};
    linhas.forEach(function (l) { if (l[campo]) m[l[campo]] = true; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  };
  return {
    data: formatarData(data), dataIso: dataIso(data), hojeIso: dataIso(hoje),
    status: listaDeStatusDePresenca(),
    linhas: linhas, vinculos: unicos('vinculo'), setores: unicos('setor'), foraDaLista: classificacao.fora,
    podeEditar: podeEditar, motivoSemEdicao: motivo, usuario: permissao.usuario, maxObservacao: CONFIG.PRESENCA.MAX_OBSERVACAO
  };
}

/** Segunda-feira da semana da data. */
function segundaDaSemana(data) {
  const p = partesDaData(data);
  const w = new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay(); // 0 = domingo
  return somarDiasData(data, w === 0 ? -6 : 1 - w);
}

/** Jornada da pessoa no dia: vínculo do contrato da data, turno da Distribuição e horário de Horários. Null se não der para saber. */
function jornadaDaPessoaNoDia(contrato, dia, horario, distribuicao) {
  const turno = distribuicao ? String(distribuicao[dia.DISTRIBUICAO] || '').trim() : '';
  const de = horario ? horarioDaLinha(horario, dia.SIGLA + '_DE') : '';
  const ate = horario ? horarioDaLinha(horario, dia.SIGLA + '_ATE') : '';
  try {
    const j = calcularJornadaDoDia(String(contrato.VINCULO).trim(), turno, de, ate);
    if (j) j.turno = turno;
    return j;
  } catch (e) {
    return null; // horário inválido na aba: a Auditoria aponta
  }
}

/**
 * Tudo que a tela SEMANAL precisa, numa única leitura de cada aba.
 * Dias: segunda a sexta (Horários e Distribuição só têm dias úteis).
 */
function montarSemanaDePresenca(dataQualquer) {
  const hoje = hojeNormalizado();
  const segunda = segundaDaSemana(dataQualquer);
  const sexta = somarDiasData(segunda, CONFIG.DIAS.length - 1);
  const permissao = verificarPermissaoDePresenca();
  const pre = { pessoas: listarFuncionarios(), ferias: listarFerias() };
  const horarios = {};
  listarHorarios().forEach(function (h) { horarios[String(h.ID_FUNCIONARIO).trim()] = h; });
  const distribuicao = {};
  listarDistribuicao().forEach(function (d) { distribuicao[String(d.ID_FUNCIONARIO).trim()] = d; });
  const registros = {};
  listarPresencasDoPeriodo(segunda, sexta).forEach(function (r) { registros[String(r.ID_FUNCIONARIO).trim() + '|' + formatarData(r.DATA)] = r; });

  const dias = CONFIG.DIAS.map(function (dia, i) {
    const data = somarDiasData(segunda, i);
    return {
      dia: dia, data: data, emFerias: idsDeQuemEstaDeFeriasNaData(data, pre.ferias),
      tela: { iso: dataIso(data), br: formatarData(data), sigla: dia.SIGLA, nome: dia.NOME,
        hoje: compararDatas(data, hoje) === 0, futuro: compararDatas(data, hoje) > 0 }
    };
  });

  const ocultos = { ferias: 0 };
  const linhas = [];
  pre.pessoas.forEach(function (p) {
    const id = String(p.ID_FUNCIONARIO).trim();
    let ultimoContrato = null;
    let trabalhaAlgumDia = false;
    let algumDiaDeFerias = false;
    const celulas = dias.map(function (d) {
      const contrato = contratoDaPessoaNaData(p, d.data);
      const registro = registros[id + '|' + d.tela.br] || null;
      const ferias = !!(contrato && d.emFerias[id]);
      if (contrato) ultimoContrato = contrato;
      if (contrato && !ferias) trabalhaAlgumDia = true;
      if (ferias) algumDiaDeFerias = true;
      return {
        ativo: !!contrato, ferias: ferias, registro: registroDePresencaParaTela(registro),
        jornada: contrato ? jornadaDaPessoaNoDia(contrato, d.dia, horarios[id], distribuicao[id]) : null
      };
    });
    const temRegistro = celulas.some(function (c) { return c.registro; });
    if (!trabalhaAlgumDia && !temRegistro) {
      if (algumDiaDeFerias) ocultos.ferias++;
      return;
    }
    const contrato = ultimoContrato || p.contratos[p.contratos.length - 1];
    const dist = distribuicao[id];
    linhas.push({
      idFuncionario: id, nome: String(p.NOME), vinculo: String(contrato.VINCULO),
      setor: String(contrato.SETOR || (dist ? dist.SETOR : '') || ''),
      temHorario: !!horarios[id], dias: celulas
    });
  });
  linhas.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

  const unicos = function (campo) {
    const m = {};
    linhas.forEach(function (l) { if (l[campo]) m[l[campo]] = true; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  };
  const agora = new Date();
  const hm = Utilities.formatDate(agora, CONFIG.FUSO, 'HH:mm').split(':');
  const K = CONFIG.CONSULTA;
  return {
    instituicao: { titulo: K.TITULO, orgao: K.ORGAO, setor: K.SETOR },
    atualizadoEm: Utilities.formatDate(agora, CONFIG.FUSO, 'dd/MM/yyyy HH:mm:ss'),
    agoraMinutos: Number(hm[0]) * 60 + Number(hm[1]),
    hojeIso: dataIso(hoje), segundaIso: dataIso(segunda), sextaIso: dataIso(sexta),
    dias: dias.map(function (d) { return d.tela; }),
    status: listaDeStatusDePresenca(), statusAtrasado: CONFIG.STATUS_PRESENCA.ATRASADO, pendente: CONFIG.PRESENCA.PENDENTE,
    linhas: linhas, vinculos: unicos('vinculo'), setores: unicos('setor'), ocultos: ocultos,
    podeEditar: permissao.pode, motivoSemEdicao: permissao.motivo, permitirDataFutura: CONFIG.PRESENCA.PERMITIR_DATA_FUTURA,
    usuario: permissao.usuario, maxObservacao: CONFIG.PRESENCA.MAX_OBSERVACAO,
    atualizacaoAutomaticaMin: CONFIG.PRESENCA.ATUALIZACAO_AUTOMATICA_MIN
  };
}

/**
 * Separa o que o usuário enviou em novos, alterações e iguais (sem gravar nada).
 * itens: [{ idFuncionario, status, observacao, horaChegada }]; existentes: registros da data.
 */
function classificarItensDePresenca(itens, existentes) {
  const porPessoa = {};
  existentes.forEach(function (r) { porPessoa[String(r.ID_FUNCIONARIO).trim()] = r; });
  const resultado = { novos: [], alteracoes: [], iguais: [] };
  itens.forEach(function (item) {
    const atual = porPessoa[item.idFuncionario];
    if (!atual) { resultado.novos.push(item); return; }
    const chegadaAtual = atual.HORA_CHEGADA === undefined ? '' : horarioDaLinha(atual, 'HORA_CHEGADA');
    if (String(atual.STATUS) === item.status && String(atual.OBSERVACAO).trim() === item.observacao && chegadaAtual === (item.horaChegada || '')) {
      resultado.iguais.push(item);
    } else resultado.alteracoes.push({ item: item, atual: atual });
  });
  return resultado;
}

function validarItensDePresenca(itens, funcionariosConhecidos) {
  if (!Array.isArray(itens) || !itens.length) throw new Error('[Presença] Nenhum registro para salvar.');
  const vistos = {};
  return itens.map(function (item) {
    const id = String(item.idFuncionario === null || item.idFuncionario === undefined ? '' : item.idFuncionario).trim();
    if (!id) throw new Error('[Presença] Registro sem funcionário.');
    if (!funcionariosConhecidos[id]) throw new Error('[Presença] ' + id + ' não está na lista de presença desta data (inexistente, de férias, suspenso ou encerrado).');
    if (vistos[id]) throw new Error('[Presença] Funcionário repetido na lista: ' + funcionariosConhecidos[id] + '.');
    vistos[id] = true;
    const observacao = valorVazio(item.observacao) ? '' : String(item.observacao).trim();
    if (observacao.length > CONFIG.PRESENCA.MAX_OBSERVACAO) {
      throw new Error('[Presença] Observação muito longa em ' + funcionariosConhecidos[id] + ' (máximo ' + CONFIG.PRESENCA.MAX_OBSERVACAO + ' caracteres).');
    }
    const status = normalizarStatusDePresenca(item.status);
    let horaChegada = '';
    if (status === CONFIG.STATUS_PRESENCA.ATRASADO) {
      if (valorVazio(item.horaChegada)) throw new Error('[Presença] Informe a hora de chegada de ' + funcionariosConhecidos[id] + ' (Atrasado).');
      try { horaChegada = normalizarHorario(item.horaChegada); } catch (e) { throw new Error('[Presença] ' + funcionariosConhecidos[id] + ': ' + e.message.replace('[Horário] ', '')); }
    }
    return { idFuncionario: id, status: status, observacao: observacao, horaChegada: horaChegada };
  });
}

/** Minutos de atraso a partir da entrada prevista; '' quando não há horário previsto. Chegada no horário ou antes é recusada. */
function calcularAtrasoEmMinutos(horaChegada, jornada, nome) {
  if (!horaChegada || !jornada) return '';
  const atraso = minutosDoHorario(horaChegada) - minutosDoHorario(jornada.de);
  if (atraso <= 0) {
    throw new Error('[Presença] ' + nome + ' chegou às ' + horaChegada + ', no horário ou antes da entrada prevista (' + jornada.de + '). Use "Presente".');
  }
  return atraso;
}

/**
 * Grava registros de UMA OU VÁRIAS datas numa única trava e leitura.
 * itens: [{ data: 'dd/MM/aaaa', idFuncionario, status, observacao, horaChegada }].
 * Alterar um registro que já existe exige confirmouAlteracoes = true (nunca sobrescreve em silêncio)
 * e guarda o valor anterior no Histórico.
 */
function salvarPresencasEmLote(itens, confirmouAlteracoes) {
  return executarComTrava(function () {
    const permissao = verificarPermissaoDePresenca();
    if (!permissao.pode) throw new Error('[Presença] ' + permissao.motivo);
    if (!Array.isArray(itens) || !itens.length) throw new Error('[Presença] Nenhum registro para salvar.');
    const hoje = hojeNormalizado();
    const porData = {};
    const ordem = [];
    itens.forEach(function (item) {
      const data = converterData(String(item && item.data !== undefined ? item.data : ''));
      if (!data) throw new Error('[Presença] Data inválida: "' + (item && item.data) + '". Use dd/MM/aaaa.');
      if (compararDatas(data, hoje) > 0 && !CONFIG.PRESENCA.PERMITIR_DATA_FUTURA) {
        throw new Error('[Presença] Não é possível lançar presença em data futura (' + formatarData(data) + ').');
      }
      const chave = formatarData(data);
      if (!porData[chave]) { porData[chave] = { data: data, itens: [] }; ordem.push(chave); }
      porData[chave].itens.push(item);
    });

    const pre = { pessoas: listarFuncionarios(), ferias: listarFerias() };
    const pessoaPorId = {};
    pre.pessoas.forEach(function (p) { pessoaPorId[String(p.ID_FUNCIONARIO).trim()] = p; });
    const horarios = {};
    listarHorarios().forEach(function (h) { horarios[String(h.ID_FUNCIONARIO).trim()] = h; });
    const distribuicao = {};
    listarDistribuicao().forEach(function (d) { distribuicao[String(d.ID_FUNCIONARIO).trim()] = d; });
    const todas = listarPresencas();

    const novos = [];
    const alteracoes = [];
    let iguais = 0;
    ordem.forEach(function (chave) {
      const grupo = porData[chave];
      const nomes = {};
      const contratos = {};
      classificarFuncionariosParaPresenca(grupo.data, pre).elegiveis.forEach(function (p) { nomes[p.id] = p.nome; contratos[p.id] = p.contrato; });
      const validos = validarItensDePresenca(grupo.itens, nomes);
      const indice = indiceDoDiaUtil(grupo.data);
      validos.forEach(function (item) {
        const jornada = indice >= 0 ? jornadaDaPessoaNoDia(contratos[item.idFuncionario], CONFIG.DIAS[indice], horarios[item.idFuncionario], distribuicao[item.idFuncionario]) : null;
        item.atrasoMin = calcularAtrasoEmMinutos(item.horaChegada, jornada, nomes[item.idFuncionario]);
        item.nome = nomes[item.idFuncionario];
        item.data = grupo.data;
      });
      const c = classificarItensDePresenca(validos, todas.filter(function (r) { return formatarData(r.DATA) === chave; }));
      Array.prototype.push.apply(novos, c.novos);
      Array.prototype.push.apply(alteracoes, c.alteracoes);
      iguais += c.iguais.length;
    });
    if (alteracoes.length && confirmouAlteracoes !== true) {
      throw new Error('[Presença] ' + alteracoes.length + ' registro(s) já lançado(s) seriam alterados. Confirme as alterações para continuar.');
    }

    const agora = new Date();
    if (novos.length) {
      const ids = gerarIdsDePresenca(novos.length, todas.map(function (r) { return r.ID_REGISTRO; }));
      inserirPresencas(novos.map(function (item, i) {
        return {
          ID_REGISTRO: ids[i], ID_FUNCIONARIO: item.idFuncionario, NOME: item.nome || (pessoaPorId[item.idFuncionario] || {}).NOME, DATA: item.data,
          STATUS: item.status, OBSERVACAO: item.observacao, USUARIO: permissao.usuario, LANCADO_EM: agora, ATUALIZADO_EM: '', ATUALIZADO_POR: '',
          HORA_CHEGADA: item.horaChegada, ATRASO_MIN: item.atrasoMin
        };
      }));
    }
    const historico = [];
    alteracoes.forEach(function (a) {
      const diff = atualizarPresenca(a.atual._linha, {
        STATUS: a.item.status, OBSERVACAO: a.item.observacao, HORA_CHEGADA: a.item.horaChegada, ATRASO_MIN: a.item.atrasoMin,
        ATUALIZADO_EM: agora, ATUALIZADO_POR: permissao.usuario
      });
      const rotulo = 'Presença ' + formatarData(a.item.data);
      [['STATUS', 'Situação'], ['OBSERVACAO', 'Observação'], ['HORA_CHEGADA', 'Hora de chegada']].forEach(function (par) {
        if (!(par[0] in diff.depois)) return;
        historico.push({ ID_FUNCIONARIO: a.item.idFuncionario, OPERACAO: CONFIG.OPERACOES.PRESENCA, CAMPO: rotulo + ' — ' + par[1],
          VALOR_ANTERIOR: String(diff.antes[par[0]] === undefined ? '' : diff.antes[par[0]]), NOVO_VALOR: String(diff.depois[par[0]]) });
      });
    });
    if (historico.length) registrarHistorico(historico);
    return { novos: novos.length, alterados: alteracoes.length, iguais: iguais };
  });
}

/** Grava os registros de uma data (forma antiga, mantida). Mesmas regras de salvarPresencasEmLote. */
function salvarPresencas(dataTexto, itens, confirmouAlteracoes) {
  const data = converterData(dataTexto);
  if (!data) throw new Error('[Presença] Data inválida: "' + dataTexto + '". Use dd/MM/aaaa.');
  if (!Array.isArray(itens) || !itens.length) throw new Error('[Presença] Nenhum registro para salvar.');
  return salvarPresencasEmLote(itens.map(function (i) { return Object.assign({}, i, { data: formatarData(data) }); }), confirmouAlteracoes);
}

/**
 * Consulta SOMENTE LEITURA: registros de presença entre duas datas (de uma pessoa ou de todas)
 * e as alterações guardadas no Histórico para esses registros.
 */
function consultarHistoricoDePresenca(idFuncionario, inicio, fim) {
  const de = converterData(inicio);
  const ate = converterData(fim);
  if (!de || !ate) throw new Error('[Presença] Período inválido.');
  if (compararDatas(de, ate) > 0) throw new Error('[Presença] A data final é anterior à inicial.');
  if (diasEntreDatas(de, ate) > CONFIG.PRESENCA.MAX_DIAS_HISTORICO) {
    throw new Error('[Presença] Período muito longo: o máximo é ' + CONFIG.PRESENCA.MAX_DIAS_HISTORICO + ' dias.');
  }
  const id = valorVazio(idFuncionario) ? '' : String(idFuncionario).trim();
  const registros = listarPresencasDoPeriodo(de, ate).filter(function (r) { return !id || String(r.ID_FUNCIONARIO).trim() === id; });
  registros.sort(function (a, b) { return compararDatas(b.DATA, a.DATA) || String(a.NOME).localeCompare(String(b.NOME), 'pt-BR'); });
  const alteracoesPorChave = {};
  if (registros.length) {
    const prefixo = 'Presença ';
    const filtro = { OPERACAO: CONFIG.OPERACOES.PRESENCA };
    if (id) filtro.ID_FUNCIONARIO = id;
    listarHistorico(filtro).forEach(function (h) {
      const campo = String(h.CAMPO);
      if (campo.indexOf(prefixo) !== 0) return;
      const dataTexto = campo.substring(prefixo.length, prefixo.length + 10);
      const chave = String(h.ID_FUNCIONARIO).trim() + '|' + dataTexto;
      (alteracoesPorChave[chave] = alteracoesPorChave[chave] || []).push({
        quando: formatarDataHora(h.DATA_HORA), usuario: String(h.USUARIO), campo: campo.substring(prefixo.length + 13),
        anterior: String(h.VALOR_ANTERIOR), novo: String(h.NOVO_VALOR)
      });
    });
  }
  return registros.map(function (r) {
    const base = registroDePresencaParaTela(r);
    base.idFuncionario = String(r.ID_FUNCIONARIO).trim();
    base.nome = String(r.NOME);
    base.data = formatarData(r.DATA);
    base.alteracoes = alteracoesPorChave[base.idFuncionario + '|' + base.data] || [];
    return base;
  });
}
