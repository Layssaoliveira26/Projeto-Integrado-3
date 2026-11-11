const syncService = require("../services/syncService");

const push = async (req, res) => {
  try {
    const usuarioId = req.user?.id;
    const itens = Array.isArray(req.body?.itens)
      ? req.body.itens
      : Array.isArray(req.body?.operacoes)
      ? req.body.operacoes
      : [];

    const resultado = await syncService.processarPushLote(itens, usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[Sync] Erro no push:", error);
    return res.status(400).json({
      mensagem: error.message || "Não foi possível processar o lote de sincronização.",
    });
  }
};

const pull = async (req, res) => {
  try {
    const usuarioId = req.user?.id;
    const resultado = await syncService.obterPullEstado(usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[Sync] Erro no pull:", error);
    return res.status(500).json({
      mensagem: error.message || "Não foi possível obter os dados de sincronização.",
    });
  }
};

module.exports = {
  push,
  pull,
};

