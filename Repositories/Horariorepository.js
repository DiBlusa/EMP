/**
 * HorarioRepository.gs — horários semanais (aba Horários), uma linha por funcionário.
 * Vinculados ao ID_FUNCIONARIO, independentemente de renovações de contrato.
 */
function listarHorarios() {
  return listarRegistros('HORARIOS');
}

function buscarHorarioDoFuncionario(idFuncionario) {
  const alvo = String(idFuncionario).trim();
  return listarHorarios().find(function (r) { return String(r.ID_FUNCIONARIO).trim() === alvo; }) || null;
}

function inserirHorarios(registros) {
  return inserirRegistros('HORARIOS', registros);
}

function atualizarHorario(numeroLinha, campos) {
  return atualizarRegistro('HORARIOS', numeroLinha, campos);
}