// mobile/src/sync/syncManager.js
import NetInfo from "@react-native-community/netinfo";
import { getDbConnection } from "../database/index";
import { obterToken } from "../services/storage";
import {
  listarItensPendentes,
  marcarItemSincronizado,
  registrarFalhaItem,
  obterResumoFila,
} from "../repositories/syncQueueRepository";
import { upsertObraSincronizada } from "../repositories/obraLocalRepository";
import { upsertCicloSincronizado } from "../repositories/cicloLocalRepository";
import { upsertMedicaoSincronizada } from "../repositories/medicaoLocalRepository";
import {
  marcarFotografiaComoSincronizada,
  upsertFotografiaSincronizada,
} from "../repositories/fotografiaRepository";

let isOnline = true;
let isSyncing = false;
let syncState = "idle"; // 'idle' | 'syncing' | 'pending' | 'error' | 'synced'
let pendingCount = 0;
let errorCount = 0;
let lastSyncedAt = null;
let lastErrorMessage = null;
let unsubscribeNetInfo = null;
let requisicaoFn = null;

const listeners = new Set();

const notificarListeners = () => {
  const snapshot = obterEstadoAtualSync();
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error("[SyncManager] Erro ao notificar listener:", err);
    }
  });
};

/**
 * Permite injetar a função de requisição HTTP (evita dependência circular com api.js).
 */
export const configurarClienteHttpSync = (fn) => {
  requisicaoFn = fn;
};

export const obterEstadoAtualSync = () => ({
  isOnline,
  isSyncing,
  syncState,
  pendingCount,
  errorCount,
  totalNaoSincronizados: pendingCount + errorCount,
  lastSyncedAt,
  lastErrorMessage,
});

export const inscreverStatusSync = (callback) => {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  callback(obterEstadoAtualSync());
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Recalcula as contagens da fila local e atualiza o estado observável.
 */
export const atualizarContadoresFila = async () => {
  try {
    const resumo = await obterResumoFila();
    pendingCount = resumo.pendentes;
    errorCount = resumo.erros;

    if (!isSyncing) {
      if (errorCount > 0) {
        syncState = "error";
      } else if (pendingCount > 0) {
        syncState = "pending";
      } else if (lastSyncedAt) {
        syncState = "synced";
      } else {
        syncState = "idle";
      }
    }

    notificarListeners();
    return resumo;
  } catch (err) {
    return { pendentes: 0, erros: 0, totalNaoSincronizados: 0 };
  }
};

/**
 * Hidrata o SQLite local com os dados retornados pelo GET /sync/pull.
 */
export const hidratarBancoLocalComPull = async (dadosPull) => {
  if (!dadosPull) return;
  const db = await getDbConnection();
  const agora = new Date().toISOString();

  for (const obra of dadosPull.obras || []) {
    await upsertObraSincronizada(obra, db);
  }

  for (const etapa of dadosPull.etapas || []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO etapas (id, obra_id, etapa_pai_id, nome, ordem, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        String(etapa.id),
        String(etapa.obra_id),
        etapa.etapa_pai_id || null,
        etapa.nome || "",
        Number(etapa.ordem || 0),
        etapa.created_at || agora,
        etapa.updated_at || agora,
      ]
    );
  }

  for (const servico of dadosPull.servicos || []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO servicos (
        id, obra_id, etapa_id, codigo_servico, descricao, fonte_origem,
        unidade_medida, quantidade_orcada, preco_unitario, preco_total, ordem, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        String(servico.id),
        String(servico.obra_id),
        servico.etapa_id ? String(servico.etapa_id) : null,
        String(servico.codigo_servico || ""),
        servico.descricao || "",
        servico.fonte_origem || null,
        servico.unidade_medida || "UN",
        Number(servico.quantidade_orcada || 0),
        Number(servico.preco_unitario || 0),
        Number(servico.preco_total || 0),
        Number(servico.ordem || 0),
        servico.created_at || agora,
        servico.updated_at || agora,
      ]
    );
  }

  for (const ciclo of dadosPull.ciclos || []) {
    await upsertCicloSincronizado(ciclo, db);
  }

  for (const medicao of dadosPull.medicoes || []) {
    await upsertMedicaoSincronizada(medicao, db);
  }

  for (const foto of dadosPull.fotografias || []) {
    await upsertFotografiaSincronizada(foto, db);
  }
};

/**
 * Executa o ciclo completo de sincronização (Push das pendências locais + Pull das novidades do servidor).
 * Protegido por mutex (isSyncing) para evitar concorrência.
 */
export const sincronizarTudo = async ({ incluirPull = true } = {}) => {
  if (isSyncing) {
    return obterEstadoAtualSync();
  }

  await atualizarContadoresFila();

  // Verifica conectividade atual
  try {
    const netState = await NetInfo.fetch();
    isOnline = Boolean(
      netState.isConnected && netState.isInternetReachable !== false
    );
  } catch {
    // Mantém último valor conhecido de isOnline
  }

  if (!isOnline || !requisicaoFn) {
    await atualizarContadoresFila();
    return obterEstadoAtualSync();
  }

  const token = await obterToken();
  if (!token) {
    return obterEstadoAtualSync();
  }

  isSyncing = true;
  syncState = "syncing";
  lastErrorMessage = null;
  notificarListeners();

  try {
    const db = await getDbConnection();
    const pendentes = await listarItensPendentes(db);

    if (pendentes.length > 0) {
      let respostaPush;
      try {
        respostaPush = await requisicaoFn("/sync/push", {
          method: "POST",
          body: JSON.stringify({ itens: pendentes }),
        });
      } catch (errPush) {
        // Caso o Wi-Fi/4G tenha acabado de reconectar e o socket tenha falhado no primeiro instante,
        // aguarda 1.5s e realiza uma segunda tentativa automática antes de desistir
        if (errPush.status === 0 || !errPush.status) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          respostaPush = await requisicaoFn("/sync/push", {
            method: "POST",
            body: JSON.stringify({ itens: pendentes }),
          });
        } else {
          throw errPush;
        }
      }

      const sincronizados = Array.isArray(respostaPush?.sincronizados)
        ? respostaPush.sincronizados
        : [];
      const falhas = Array.isArray(respostaPush?.falhas)
        ? respostaPush.falhas
        : [];

      for (const itemOk of sincronizados) {
        await marcarItemSincronizado(itemOk.fila_id, db);

        if (itemOk.tabela_referencia === "obras") {
          await db.runAsync(
            `UPDATE obras SET sync_status = 'synced' WHERE id = ?;`,
            [String(itemOk.registro_id)]
          );
        } else if (itemOk.tabela_referencia === "medicoes") {
          await db.runAsync(
            `UPDATE medicoes SET sync_status = 'synced' WHERE id = ?;`,
            [String(itemOk.registro_id)]
          );
        } else if (itemOk.tabela_referencia === "fotografias") {
          await marcarFotografiaComoSincronizada(
            itemOk.registro_id,
            itemOk.resultado?.url_nuvem || null,
            db
          );
        }
      }

      for (const itemFalha of falhas) {
        await registrarFalhaItem(
          itemFalha.fila_id,
          itemFalha.erro || "Falha ao sincronizar registro no servidor",
          db
        );
        lastErrorMessage = itemFalha.erro;
      }
    }

    if (incluirPull) {
      try {
        const dadosPull = await requisicaoFn("/sync/pull", { method: "GET" });
        await hidratarBancoLocalComPull(dadosPull);
      } catch (pullErr) {
        // Se o pull falhar mas o push funcionou, não invalida os itens enviados
        console.warn("[SyncManager] Aviso no pull:", pullErr.message);
      }
    }

    lastSyncedAt = new Date().toISOString();
  } catch (error) {
    lastErrorMessage =
      error.message || "Não foi possível sincronizar com o servidor.";
    if (error.status === 0) {
      isOnline = false;
    }
  } finally {
    isSyncing = false;
    await atualizarContadoresFila();
  }

  return obterEstadoAtualSync();
};

/**
 * Agenda uma tentativa assíncrona de sincronização sem bloquear a operação atual do usuário.
 */
export const agendarSincronizacao = () => {
  atualizarContadoresFila().then((resumo) => {
    if (isOnline && resumo.totalNaoSincronizados > 0 && !isSyncing) {
      setTimeout(() => {
        sincronizarTudo({ incluirPull: false }).catch(() => {});
      }, 150);
    }
  });
};

/**
 * Inicia o monitoramento contínuo de conectividade via NetInfo.
 */
export const iniciarMonitoramentoRede = () => {
  if (unsubscribeNetInfo) return unsubscribeNetInfo;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const conectouAgora = Boolean(
      state.isConnected && state.isInternetReachable !== false
    );
    const estavaOffline = !isOnline;
    isOnline = conectouAgora;

    notificarListeners();

    if (conectouAgora && estavaOffline) {
      // Pequeno delay de estabilização da rota de rede local/Wi-Fi ao reconectar
      setTimeout(() => {
        sincronizarTudo({ incluirPull: true }).catch(() => {});
      }, 600);
    }
  });

  // Dispara verificação inicial ao abrir o app
  atualizarContadoresFila().then(() => {
    sincronizarTudo({ incluirPull: true }).catch(() => {});
  });

  return unsubscribeNetInfo;
};

export const pararMonitoramentoRede = () => {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
};

export default {
  configurarClienteHttpSync,
  obterEstadoAtualSync,
  inscreverStatusSync,
  atualizarContadoresFila,
  hidratarBancoLocalComPull,
  sincronizarTudo,
  agendarSincronizacao,
  iniciarMonitoramentoRede,
  pararMonitoramentoRede,
};

