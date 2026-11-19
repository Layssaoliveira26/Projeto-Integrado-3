const db = require("../config/db");
const estruturaService = require("../services/estruturaService");

async function obterEstruturaObra(req, res) {
  try {
    const { obra_id } = req.params;
    const { ciclo_id } = req.query;

    if (req.user) {
      const obraRes = await db.query("SELECT id, usuario_id FROM obras WHERE id = $1", [obra_id]);
      if (obraRes.rows.length === 0) {
        return res.status(404).json({ mensagem: "Obra não encontrada." });
      }
      if (obraRes.rows[0].usuario_id !== req.user.id) {
        return res.status(403).json({ mensagem: "Você não tem permissão para visualizar a estrutura desta obra." });
      }
    }

    const estrutura = await estruturaService.obterEstruturaAcompanhamento(obra_id, ciclo_id);

    if (!estrutura) {
      return res.status(404).json({ mensagem: "Obra não encontrada ou sem serviços cadastrados." });
    }

    return res.status(200).json(estrutura);
  } catch (error) {
    console.error("Erro ao buscar estrutura de acompanhamento:", error);
    if (error?.code === "22P02") {
      return res.status(400).json({ mensagem: "Identificador em formato inválido." });
    }
    return res.status(error?.statusCode || 500).json({
      mensagem: error?.statusCode ? error.message : "Erro interno do servidor.",
    });
  }
}

module.exports = { obterEstruturaObra };