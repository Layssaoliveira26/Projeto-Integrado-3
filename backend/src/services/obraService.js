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
    const [dia, mes, ano] = limpa.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(limpa)) {
    return limpa.split('T')[0];
  }
  return limpa;
};

const criarObra = async ({ nome, endereco, data_inicio, data_conclusao, descricao, usuarioId }) => {
  validarDadosObra({ nome, endereco });

  const novaObra = await obraRepository.criar({
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

  const obraAtualizada = await obraRepository.atualizar(id, usuarioId, {
    nome: nome.trim(),
    endereco: endereco.trim(),
    data_inicio: normalizarData(data_inicio),
    data_conclusao: normalizarData(data_conclusao),
    descricao: descricao ? descricao.trim() : null,
  });
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

module.exports = {
  criarObra,
  listarObras,
  obterObraPorId,
  atualizarObra,
  deletarObra,
  arquivarObra
};
