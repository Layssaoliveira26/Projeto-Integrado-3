const obraService = require("../services/obraService");
const syncRepository = require("../repositories/syncRepository");

const CODIGOS_VALIDACAO_ENTRADA_PG = new Set(["22P02", "22007", "22008"]);

const ehErroInternoInfraestrutura = (error) => {
  if (!error) return false;
  const status = error.statusCode || error.status;
  if (status && status >= 500) return true;
  if (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError
  ) {
    return true;
  }
  if (error.code && !CODIGOS_VALIDACAO_ENTRADA_PG.has(String(error.code))) {
    return true;
  }
  return false;
};

const responderErroObra = (res, error, mensagemPadrao500 = null) => {
  if (error?.code === "22P02") {
    const msg = "Identificador da obra em formato inválido.";
    return res.status(400).json({ erro: msg, mensagem: msg });
  }
  if (error?.code === "22007" || error?.code === "22008") {
    const msg = "Data informada em formato inválido.";
    return res.status(400).json({ erro: msg, mensagem: msg });
  }
  if (error?.statusCode && error.statusCode < 500) {
    return res
      .status(error.statusCode)
      .json({ erro: error.message, mensagem: error.message });
  }
  if (error?.message?.includes("não encontrada")) {
    return res
      .status(404)
      .json({ erro: error.message, mensagem: error.message });
  }
  if (ehErroInternoInfraestrutura(error) || mensagemPadrao500) {
    const msg500 = mensagemPadrao500 || "Erro interno no servidor.";
    return res.status(500).json({ erro: msg500, mensagem: msg500 });
  }
  const msg = error?.message || "Dados inválidos na requisição.";
  return res.status(400).json({ erro: msg, mensagem: msg });
};

const criar = async (req, res) => {
  try {
    const {
      id,
      nome,
      endereco,
      data_inicio,
      data_conclusao,
      descricao,
      imagem_capa,
    } = req.body || {};
    const usuarioId = req.user.id;

    let novaObra = await obraService.criarObra({
      id,
      nome,
      endereco,
      data_inicio,
      data_conclusao,
      descricao,
      usuarioId,
    });

    if (
      imagem_capa !== undefined &&
      novaObra?.id &&
      typeof syncRepository.atualizarImagemCapaObra === "function"
    ) {
      const capaSalva = await syncRepository.atualizarImagemCapaObra(
        novaObra.id,
        usuarioId,
        imagem_capa
      );
      if (capaSalva?.imagem_capa !== undefined) {
        novaObra = { ...novaObra, imagem_capa: capaSalva.imagem_capa };
      }
    }

    return res.status(201).json(novaObra);
  } catch (error) {
    console.error("Erro ao criar obra:", error);
    return responderErroObra(res, error);
  }
};

const listar = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const incluirArquivadas = req.query.incluirArquivadas === "true";
    const incluirEncerradas = req.query.incluirEncerradas === "true";

    const obras = await obraService.listarObras(
      usuarioId,
      incluirArquivadas,
      incluirEncerradas
    );
    return res.status(200).json(obras);
  } catch (error) {
    console.error("Erro ao listar obras:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
};

const obterPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obra = await obraService.obterObraPorId(id, usuarioId);
    return res.status(200).json(obra);
  } catch (error) {
    console.error("Erro ao obter obra por ID:", error);
    return responderErroObra(res, error, "Erro ao buscar obra.");
  }
};

const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      endereco,
      data_inicio,
      data_conclusao,
      descricao,
      imagem_capa,
    } = req.body || {};
    const usuarioId = req.user.id;

    let obraAtualizada = await obraService.atualizarObra(id, usuarioId, {
      nome,
      endereco,
      data_inicio,
      data_conclusao,
      descricao,
    });

    if (
      imagem_capa !== undefined &&
      obraAtualizada?.id &&
      typeof syncRepository.atualizarImagemCapaObra === "function"
    ) {
      const capaSalva = await syncRepository.atualizarImagemCapaObra(
        obraAtualizada.id,
        usuarioId,
        imagem_capa
      );
      if (capaSalva?.imagem_capa !== undefined) {
        obraAtualizada = {
          ...obraAtualizada,
          imagem_capa: capaSalva.imagem_capa,
        };
      }
    }

    return res.status(200).json(obraAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar obra:", error);
    return responderErroObra(res, error);
  }
};

const deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraDeletada = await obraService.deletarObra(id, usuarioId);
    return res.status(200).json({
      mensagem: "Obra deletada com sucesso.",
      obra: obraDeletada,
    });
  } catch (error) {
    console.error("Erro ao deletar obra:", error);
    return responderErroObra(res, error);
  }
};

const arquivar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraArquivada = await obraService.arquivarObra(id, usuarioId);
    return res.status(200).json({
      mensagem: "Obra arquivada com sucesso.",
      obra: obraArquivada,
    });
  } catch (error) {
    console.error("Erro ao arquivar obra:", error);
    return responderErroObra(res, error);
  }
};

const desarquivar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraDesarquivada = await obraService.desarquivarObra(id, usuarioId);
    return res.status(200).json({
      mensagem: "Obra desarquivada com sucesso.",
      obra: obraDesarquivada,
    });
  } catch (error) {
    console.error("Erro ao desarquivar obra:", error);
    return responderErroObra(res, error);
  }
};

const encerrar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const obraEncerrada = await obraService.encerrarObra(id, usuarioId);
    return res.status(200).json({
      mensagem: "Obra encerrada com sucesso.",
      obra: obraEncerrada,
    });
  } catch (error) {
    console.error("Erro ao encerrar obra:", error);
    return responderErroObra(res, error);
  }
};

const obterHistoricoConclusao = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const resultado = await obraService.obterHistoricoConclusao(id, usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error("Erro ao obter histórico de conclusão da obra:", error);
    return responderErroObra(res, error);
  }
};

const adicionarHistoricoConclusao = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const { data_anterior, data_conclusao, motivo } = req.body || {};

    const registro = await obraService.registrarAlteracaoConclusao(id, usuarioId, {
      data_anterior,
      data_conclusao,
      motivo,
    });
    return res.status(201).json(registro);
  } catch (error) {
    console.error("Erro ao registrar alteração de data de conclusão:", error);
    return responderErroObra(res, error);
  }
};

module.exports = {
  criar,
  listar,
  obterPorId,
  atualizar,
  deletar,
  arquivar,
  desarquivar,
  encerrar,
  obterHistoricoConclusao,
  adicionarHistoricoConclusao,
};
