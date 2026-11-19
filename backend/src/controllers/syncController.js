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
    const since = req.query?.since || null;
    const resultado = await syncService.obterPullEstado(usuarioId, { since });
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[Sync] Erro no pull:", error);
    return res.status(500).json({
      mensagem: error.message || "Não foi possível obter os dados de sincronização.",
    });
  }
};

const uploadArquivoFoto = async (req, res) => {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;
    const base64 = req.body?.base64 || req.body?.arquivo_base64 || null;

    const resultado = await syncService.salvarArquivoFoto(id, usuarioId, base64);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[Sync] Erro ao enviar arquivo de fotografia:", error);
    return res.status(error.statusCode || error.status || 400).json({
      mensagem:
        error.message || "Não foi possível salvar o arquivo da fotografia.",
    });
  }
};

const baixarArquivoFoto = async (req, res) => {
  try {
    const usuarioId = req.user?.id;
    const { id } = req.params;

    const resultado = await syncService.obterArquivoFoto(id, usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("[Sync] Erro ao baixar arquivo de fotografia:", error);
    return res.status(error.statusCode || error.status || 400).json({
      mensagem:
        error.message || "Não foi possível obter o arquivo da fotografia.",
    });
  }
};

module.exports = {
  push,
  pull,
  uploadArquivoFoto,
  baixarArquivoFoto,
};

