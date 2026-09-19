const obraService = require("../services/obraService");

const criar = async (req, res) => {
  try {
    const { nome } = req.body;
    const usuarioId = req.user.id; // Assumindo que o middleware de auth adiciona req.user

    const novaObra = await obraService.criarObra({ nome, usuarioId });
    return res.status(201).json(novaObra);
  } catch (error) {
    console.error("Erro ao criar obra:", error);
    return res.status(400).json({ erro: error.message });
  }
};

const listar = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const incluirArquivadas = req.query.incluirArquivadas === 'true';

    const obras = await obraService.listarObras(usuarioId, incluirArquivadas);
    return res.status(200).json(obras);
  } catch (error) {
    console.error("Erro ao listar obras:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
};

const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome } = req.body;
    const usuarioId = req.user.id;

    const obraAtualizada = await obraService.atualizarObra(id, usuarioId, { nome });
    return res.status(200).json(obraAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar obra:", error);
    // Erros como "Obra não encontrada..." retornam 404. 
    // Pode-se refinar o tratamento de erro se necessário.
    if (error.message.includes("não encontrada")) {
      return res.status(404).json({ erro: error.message });
    }
    return res.status(400).json({ erro: error.message });
  }
};

const deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraDeletada = await obraService.deletarObra(id, usuarioId);
    return res.status(200).json({ 
      mensagem: "Obra deletada com sucesso.", 
      obra: obraDeletada 
    });
  } catch (error) {
    console.error("Erro ao deletar obra:", error);
    if (error.message.includes("não encontrada")) {
      return res.status(404).json({ erro: error.message });
    }
    return res.status(400).json({ erro: error.message });
  }
};

const arquivar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraArquivada = await obraService.arquivarObra(id, usuarioId);
    return res.status(200).json({ 
      mensagem: "Obra arquivada com sucesso.", 
      obra: obraArquivada 
    });
  } catch (error) {
    console.error("Erro ao arquivar obra:", error);
    if (error.message.includes("não encontrada")) {
      return res.status(404).json({ erro: error.message });
    }
    return res.status(400).json({ erro: error.message });
  }
};

module.exports = {
  criar,
  listar,
  atualizar,
  deletar,
  arquivar
};
