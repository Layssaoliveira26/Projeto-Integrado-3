const estruturaService = require("../services/estruturaService");

async function obterEstruturaObra(req, res) {
  try {
    const { obra_id } = req.params;
    const { ciclo_id } = req.query;

    const estrutura = await estruturaService.obterEstruturaAcompanhamento(obra_id, ciclo_id);

    if (!estrutura) {
      return res.status(404).json({ mensagem: "Obra não encontrada ou sem serviços cadastrados." });
    }

    return res.status(200).json(estrutura);
  } catch (error) {
    console.error("Erro ao buscar estrutura de acompanhamento:", error);
    return res.status(500).json({ mensagem: "Erro interno do servidor." });
  }
}

module.exports = { obterEstruturaObra };