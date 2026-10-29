const planilhaFinalService = require("../services/planilhaFinalService");
const { tratarErro } = require("../utils/errorUtils");

/**
 * Retorna os dados consolidados da planilha final de medição em JSON.
 * GET /obras/:id/planilha-final
 */
async function obterPlanilhaFinal(req, res) {
  try {
    const { id } = req.params;
    const ciclo_id = req.query.ciclo_id || req.query.cicloId;
    const usuarioId = req.user?.id;

    const dados = await planilhaFinalService.obterDadosPlanilhaFinal(id, ciclo_id, usuarioId);
    return res.status(200).json(dados);
  } catch (error) {
    return tratarErro(res, error);
  }
}

/**
 * Gera e realiza o download do arquivo .xlsx da planilha final de medição.
 * GET /obras/:id/planilha-final/download
 */
async function baixarPlanilhaFinal(req, res) {
  try {
    const { id } = req.params;
    const ciclo_id = req.query.ciclo_id || req.query.cicloId;
    const usuarioId = req.user?.id;

    const dados = await planilhaFinalService.obterDadosPlanilhaFinal(id, ciclo_id, usuarioId);
    const buffer = planilhaFinalService.gerarExcelPlanilhaFinal(dados);

    const nomeArquivo = `planilha_final_medicao_${dados.obra.nome.toLowerCase().replace(/[^a-z0-9]/g, "_")}_ciclo_${dados.ciclo.numero_ciclo}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    return res.status(200).send(buffer);
  } catch (error) {
    return tratarErro(res, error);
  }
}

module.exports = {
  obterPlanilhaFinal,
  baixarPlanilhaFinal,
};
