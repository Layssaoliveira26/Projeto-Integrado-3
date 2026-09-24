import api from "./api";

/**
 * Obtém os dados orçamentários do serviço e o acumulado de ciclos anteriores.
 * @param {string} servicoId
 * @param {string} cicloId
 */
export const obterDadosMedicao = async (servicoId, cicloId) => {
  if (!servicoId || !cicloId) {
    throw new Error("IDs de serviço e ciclo são obrigatórios para carregar a medição.");
  }
  return await api.get(`/medicoes/servico/${servicoId}/ciclo/${cicloId}`);
};

/**
 * Registra ou atualiza a quantidade executada no período no ciclo de medição.
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} params.cicloId
 * @param {string} params.servicoId
 * @param {number|string} params.quantidadeMedidaPeriodo
 */
export const registrarMedicao = async ({
  id,
  cicloId,
  servicoId,
  quantidadeMedidaPeriodo,
}) => {
  if (!cicloId || !servicoId) {
    throw new Error("IDs de ciclo e serviço são obrigatórios para registrar a medição.");
  }
  if (
    quantidadeMedidaPeriodo === undefined ||
    quantidadeMedidaPeriodo === null ||
    quantidadeMedidaPeriodo === ""
  ) {
    throw new Error("A quantidade medida no período é obrigatória.");
  }

  return await api.post("/medicoes", {
    id,
    ciclo_id: cicloId,
    servico_id: servicoId,
    quantidade_medida_periodo: String(quantidadeMedidaPeriodo),
  });
};

/**
 * Lista todas as medições registradas em um ciclo.
 * @param {string} cicloId
 */
export const listarMedicoesCiclo = async (cicloId) => {
  if (!cicloId) {
    throw new Error("ID do ciclo é obrigatório para listar as medições.");
  }
  return await api.get(`/medicoes/ciclo/${cicloId}`);
};

export default {
  obterDadosMedicao,
  registrarMedicao,
  listarMedicoesCiclo,
};
