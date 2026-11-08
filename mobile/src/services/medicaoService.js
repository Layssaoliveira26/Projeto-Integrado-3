import api from "./api";
import { obterUsuarioLocal } from "./storage";
import {
  obterDadosMedicaoLocal,
  registrarMedicaoLocal,
  listarMedicoesCicloLocal,
  upsertMedicaoSincronizada,
} from "../repositories/medicaoLocalRepository";
import { agendarSincronizacao } from "../sync/syncManager";

/**
 * Obtém os dados orçamentários do serviço e o acumulado de ciclos anteriores.
 * Opera de forma Offline-First (RNF01 / RNF04): lê prioritariamente do SQLite local
 * para evitar atrasos em campo e faz fallback para a API caso o serviço ainda não esteja cacheado.
 *
 * @param {string} servicoId
 * @param {string} cicloId
 */
export const obterDadosMedicao = async (servicoId, cicloId) => {
  if (!servicoId || !cicloId) {
    throw new Error("IDs de serviço e ciclo são obrigatórios para carregar a medição.");
  }

  try {
    const dadosLocais = await obterDadosMedicaoLocal(servicoId, cicloId);
    if (dadosLocais && dadosLocais.servico) {
      return dadosLocais;
    }
  } catch (errLocal) {
    console.warn("[MedicaoService] Aviso ao ler SQLite local:", errLocal.message);
  }

  const dadosRemotos = await api.get(`/medicoes/servico/${servicoId}/ciclo/${cicloId}`);
  if (dadosRemotos?.medicao_atual) {
    await upsertMedicaoSincronizada(dadosRemotos.medicao_atual).catch(() => {});
  }
  return dadosRemotos;
};

/**
 * Registra ou atualiza a quantidade executada no período no ciclo de medição.
 * Grava imediatamente no SQLite local e enfileira na fila_sincronizacao (RF31 / RNF01 / RNF04).
 *
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

  const usuarioLocal = await obterUsuarioLocal();

  try {
    const medicaoLocal = await registrarMedicaoLocal({
      id,
      cicloId,
      servicoId,
      usuarioId: usuarioLocal?.id || "local_user",
      quantidadeMedidaPeriodo: String(quantidadeMedidaPeriodo),
    });

    // Dispara tentativa de envio em segundo plano sem travar a tela (RNF04)
    agendarSincronizacao();

    return medicaoLocal;
  } catch (erroLocal) {
    // Se falhou por regra de negócio (ex: unidade inteira ou ciclo encerrado), repassa o erro
    if (
      erroLocal.message?.includes("unidade inteira") ||
      erroLocal.message?.includes("ciclo encerrado") ||
      erroLocal.message?.includes("negativa")
    ) {
      throw erroLocal;
    }

    // Caso o serviço ainda não estivesse no SQLite local, tenta via API direta
    const respostaRemota = await api.post("/medicoes", {
      id,
      ciclo_id: cicloId,
      servico_id: servicoId,
      quantidade_medida_periodo: String(quantidadeMedidaPeriodo),
    });

    if (respostaRemota?.id) {
      await upsertMedicaoSincronizada(respostaRemota).catch(() => {});
    }
    return respostaRemota;
  }
};

/**
 * Lista todas as medições registradas em um ciclo (Offline-First).
 * @param {string} cicloId
 */
export const listarMedicoesCiclo = async (cicloId) => {
  if (!cicloId) {
    throw new Error("ID do ciclo é obrigatório para listar as medições.");
  }

  try {
    const local = await listarMedicoesCicloLocal(cicloId);
    if (local && local.total_itens > 0) {
      return local;
    }
  } catch {
    // Continua para tentativa remota
  }

  try {
    return await api.get(`/medicoes/ciclo/${cicloId}`);
  } catch {
    return await listarMedicoesCicloLocal(cicloId);
  }
};

export default {
  obterDadosMedicao,
  registrarMedicao,
  listarMedicoesCiclo,
};
