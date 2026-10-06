const planilhaService = require("../services/planilhaService");
const { tratarErro } = require("../utils/errorUtils");

/**
 * Importa a planilha-base com etapas e serviços orçados para uma obra.
 * POST /obras/:id/planilha-base
 */
const importar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.id;
    const { nome_arquivo, nomeArquivo, etapas } = req.body || {};

    const resultado = await planilhaService.importarPlanilhaBase({
      obraId: id,
      usuarioId,
      nomeArquivo: nome_arquivo || nomeArquivo,
      etapas
    });

    return res.status(201).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

/**
 * Consulta informações da planilha-base importada para a obra.
 * GET /obras/:id/planilha-base
 */
const obter = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.id;

    const resultado = await planilhaService.obterPlanilhaBase(id, usuarioId);
    return res.status(200).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

module.exports = {
  importar,
  obter
};
