const obraRepository = require("../repositories/obraRepository");

const validarDadosObra = ({ nome, endereco }) => {
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new Error("O nome da obra é obrigatório.");
  }
  if (!endereco || typeof endereco !== 'string' || endereco.trim() === '') {
    throw new Error("O endereço da obra é obrigatório.");
  }
};

const normalizarData = (dataStr) => {
  if (!dataStr || typeof dataStr !== 'string' || dataStr.trim() === '') return null;
  const limpa = dataStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpa)) {
    const [diaStr, mesStr, anoStr] = limpa.split('/');
    const dia = parseInt(diaStr, 10);
    const mes = parseInt(mesStr, 10);
    const ano = parseInt(anoStr, 10);

    if (mes < 1 || mes > 12) {
      throw new Error(`Data inválida (${limpa}): o mês deve estar entre 01 e 12.`);
    }
    const diasNoMes = new Date(ano, mes, 0).getDate();
    if (dia < 1 || dia > diasNoMes) {
      throw new Error(`Data inválida (${limpa}): o dia ${diaStr} não é válido para o mês ${mesStr}.`);
    }
    return `${anoStr}-${mesStr.padStart(2, '0')}-${diaStr.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(limpa)) {
    return limpa.split('T')[0];
  }
  return limpa;
};

const extrairDataIso = (val) => {
  if (!val) return null;
  if (typeof val === "string") {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val.trim())) {
      return normalizarData(val);
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const ano = val.getUTCFullYear();
    const mes = String(val.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(val.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  return null;
};

const calcularDiferencaDias = (dataInicioStr, dataFimStr) => {
  if (!dataInicioStr || !dataFimStr) return 0;
  const [ano1, mes1, dia1] = dataInicioStr.split("-").map(Number);
  const [ano2, mes2, dia2] = dataFimStr.split("-").map(Number);
  const utc1 = Date.UTC(ano1, mes1 - 1, dia1);
  const utc2 = Date.UTC(ano2, mes2 - 1, dia2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

const criarObra = async ({ id, nome, endereco, data_inicio, data_conclusao, descricao, usuarioId }) => {
  validarDadosObra({ nome, endereco });

  const novaObra = await obraRepository.criar({
    id,
    nome: nome.trim(),
    endereco: endereco.trim(),
    data_inicio: normalizarData(data_inicio),
    data_conclusao: normalizarData(data_conclusao),
    descricao: descricao ? descricao.trim() : null,
    usuarioId,
  });

  return novaObra;
};

const listarObras = async (usuarioId, incluirArquivadas = false) => {
  const obras = await obraRepository.listarPorUsuario(usuarioId, incluirArquivadas);
  return obras;
};

const atualizarObra = async (id, usuarioId, { nome, endereco, data_inicio, data_conclusao, descricao }) => {
  validarDadosObra({ nome, endereco });

  const obraExistente = await obraRepository.buscarPorId(id, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para editá-la.");
  }

  const novaDataConclusao = normalizarData(data_conclusao);
  const dataConclusaoAnterior = extrairDataIso(obraExistente.data_conclusao);

  const obraAtualizada = await obraRepository.atualizar(id, usuarioId, {
    nome: nome.trim(),
    endereco: endereco.trim(),
    data_inicio: normalizarData(data_inicio),
    data_conclusao: novaDataConclusao,
    descricao: descricao ? descricao.trim() : null,
  });

  if (
    dataConclusaoAnterior &&
    novaDataConclusao &&
    dataConclusaoAnterior !== novaDataConclusao
  ) {
    const diasAdicionados = calcularDiferencaDias(dataConclusaoAnterior, novaDataConclusao);

    try {
      await obraRepository.registrarHistoricoConclusao({
        obraId: id,
        usuarioId,
        dataAnterior: dataConclusaoAnterior,
        dataConclusao: novaDataConclusao,
        diasAdicionados,
      });
      console.log(`[ObraService] Histórico registrado para obra ${id}: de ${dataConclusaoAnterior} para ${novaDataConclusao} (${diasAdicionados} dias)`);
    } catch (err) {
      console.error("Erro ao registrar histórico de data de conclusão:", err);
    }
  }

  return obraAtualizada;
};

const deletarObra = async (id, usuarioId) => {
  const obraExistente = await obraRepository.buscarPorId(id, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para excluí-la.");
  }

  // TODO: Quando tabelas de ciclos e medições existirem, deletá-las antes ou usar CASCADE.
  const obraDeletada = await obraRepository.deletar(id, usuarioId);
  return obraDeletada;
};

const arquivarObra = async (id, usuarioId) => {
  const obraExistente = await obraRepository.buscarPorId(id, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para arquivá-la.");
  }

  if (obraExistente.status === 'arquivada') {
    throw new Error("Esta obra já está arquivada.");
  }

  const obraArquivada = await obraRepository.mudarStatus(id, usuarioId, 'arquivada');
  return obraArquivada;
};

const obterObraPorId = async (id, usuarioId) => {
  const obra = await obraRepository.buscarPorId(id, usuarioId);
  if (!obra) {
    throw new Error("Obra não encontrada ou você não tem permissão para acessá-la.");
  }
  return obra;
};

const obterHistoricoConclusao = async (obraId, usuarioId) => {
  const obraExistente = await obraRepository.buscarPorId(obraId, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para acessá-la.");
  }
  const historico = await obraRepository.listarHistoricoConclusao(obraId);

  let ultimaAtualizacao = null;
  if (historico.length > 0 && historico[0].created_at) {
    const d = new Date(historico[0].created_at);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, "0");
      const minutos = String(d.getMinutes()).padStart(2, "0");
      ultimaAtualizacao = `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
    }
  }

  return {
    ultima_atualizacao: ultimaAtualizacao,
    historico,
  };
};

const registrarAlteracaoConclusao = async (obraId, usuarioId, { data_anterior, data_conclusao, motivo }) => {
  const obraExistente = await obraRepository.buscarPorId(obraId, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para editá-la.");
  }

  const dataAntNormalizada =
    normalizarData(data_anterior) || extrairDataIso(obraExistente.data_conclusao);
  const dataConclusaoNormalizada = normalizarData(data_conclusao);

  if (!dataAntNormalizada || !dataConclusaoNormalizada) {
    throw new Error("Data anterior e nova data de conclusão são obrigatórias.");
  }

  const diasAdicionados = calcularDiferencaDias(
    dataAntNormalizada,
    dataConclusaoNormalizada
  );

  const registro = await obraRepository.registrarHistoricoConclusao({
    obraId,
    usuarioId,
    dataAnterior: dataAntNormalizada,
    dataConclusao: dataConclusaoNormalizada,
    diasAdicionados,
    motivo,
  });

  await obraRepository.atualizar(obraId, usuarioId, {
    nome: obraExistente.nome,
    endereco: obraExistente.endereco,
    data_inicio: obraExistente.data_inicio,
    data_conclusao: dataConclusaoNormalizada,
    descricao: obraExistente.descricao,
  });

  return registro;
};

module.exports = {
  criarObra,
  listarObras,
  obterObraPorId,
  atualizarObra,
  deletarObra,
  arquivarObra,
  obterHistoricoConclusao,
  registrarAlteracaoConclusao,
};
