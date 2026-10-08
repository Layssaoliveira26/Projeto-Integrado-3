const medicaoService = require("../services/medicaoService");
const { tratarErro } = require("../utils/errorUtils");
const crypto = require("crypto");

/**
 * Registra ou atualiza a quantidade medida de um serviço no ciclo.
 * POST /medicoes
 */
const registrar = async (req, res) => {
  try {
    const usuario_id = req.user?.id || null;
    const body = req.body || {};

    let id = body.id || body.id_medicao;
    if (!id || id === "null" || id === "") {
      id = crypto.randomUUID();
    }

    const ciclo_id = body.ciclo_id || body.cicloId;
    const servico_id = body.servico_id || body.servicoId;
    const quantidade_medida_periodo = body.quantidade_medida_periodo !== undefined 
      ? body.quantidade_medida_periodo 
      : body.quantidadeMedidaPeriodo;

    const resultado = await medicaoService.registrarOuAtualizarMedicao({
      id,
      ciclo_id,
      servico_id,
      usuario_id,
      quantidade_medida_periodo,
    });

    return res.status(201).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

/**
 * Obtém dados orçamentários, acumulado anterior e status atual do serviço para medição.
 * GET /medicoes/servico/:servico_id/ciclo/:ciclo_id
 */
const obterDadosParaMedicao = async (req, res) => {
  try {
    const { servico_id, ciclo_id } = req.params;
    const resultado = await medicaoService.obterDadosParaMedicao(servico_id, ciclo_id);
    return res.status(200).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

/**
 * Lista todas as medições de um ciclo específico.
 * GET /medicoes/ciclo/:ciclo_id
 */
const listarPorCiclo = async (req, res) => {
  try {
    const { ciclo_id } = req.params;
    const resultado = await medicaoService.listarMedicoesCiclo(ciclo_id);
    return res.status(200).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

module.exports = {
  registrar,
  obterDadosParaMedicao,
  listarPorCiclo,
};