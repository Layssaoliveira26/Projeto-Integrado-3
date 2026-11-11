import { requisicao } from "./api";
import {
  listarCiclosObraLocal,
  obterDetalhesCicloLocal,
  encerrarCicloLocal,
  upsertCicloSincronizado,
} from "../repositories/cicloLocalRepository";
import { agendarSincronizacao } from "../sync/syncManager";

export const listarCiclosObra = async (obraId) => {
  try {
    const locais = await listarCiclosObraLocal(obraId);
    if (Array.isArray(locais) && locais.length > 0) {
      // Atualiza em background se online
      requisicao(`/ciclos/obra/${obraId}`)
        .then(async (remotos) => {
          if (Array.isArray(remotos)) {
            for (const c of remotos) {
              await upsertCicloSincronizado({ ...c, obra_id: obraId });
            }
          }
        })
        .catch(() => {});
      return locais;
    }
  } catch {
    // Continua para tentativa remota
  }

  const remotos = await requisicao(`/ciclos/obra/${obraId}`);
  if (Array.isArray(remotos)) {
    for (const c of remotos) {
      await upsertCicloSincronizado({ ...c, obra_id: obraId }).catch(() => {});
    }
  }
  return remotos;
};

export const obterDetalhesCiclo = async (cicloId) => {
  try {
    const detalhesLocais = await obterDetalhesCicloLocal(cicloId);
    if (detalhesLocais) {
      return detalhesLocais;
    }
  } catch {
    // Continua para tentativa remota
  }

  return await requisicao(`/ciclos/${cicloId}/detalhes`);
};

export const encerrarCiclo = async (cicloId) => {
  try {
    const resultadoLocal = await encerrarCicloLocal(cicloId);
    agendarSincronizacao();
    return resultadoLocal;
  } catch (errLocal) {
    if (errLocal.message?.includes("já está encerrado")) {
      throw errLocal;
    }
    return await requisicao(`/ciclos/${cicloId}/encerrar`, {
      method: "POST",
    });
  }
};

export default {
  listarCiclosObra,
  obterDetalhesCiclo,
  encerrarCiclo,
};
