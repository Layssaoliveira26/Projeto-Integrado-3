const obraRepository = require("../repositories/obraRepository");

const criarObra = async ({ nome, usuarioId }) => {
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new Error("O nome da obra é obrigatório.");
  }

  const novaObra = await obraRepository.criar({ nome: nome.trim(), usuarioId });
  return novaObra;
};

const listarObras = async (usuarioId, incluirArquivadas = false) => {
  const obras = await obraRepository.listarPorUsuario(usuarioId, incluirArquivadas);
  return obras;
};

const atualizarObra = async (id, usuarioId, { nome }) => {
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new Error("O nome da obra é obrigatório.");
  }

  const obraExistente = await obraRepository.buscarPorId(id, usuarioId);
  if (!obraExistente) {
    throw new Error("Obra não encontrada ou você não tem permissão para editá-la.");
  }

  const obraAtualizada = await obraRepository.atualizar(id, usuarioId, { nome: nome.trim() });
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

module.exports = {
  criarObra,
  listarObras,
  atualizarObra,
  deletarObra,
  arquivarObra
};
