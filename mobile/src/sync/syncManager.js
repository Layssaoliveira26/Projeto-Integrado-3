// mobile/src/sync/syncManager.js
import NetInfo from "@react-native-community/netinfo";
import { getDbConnection } from "../database/index";
import { padronizarUnidadeMedida } from "../utils/unidadesMedida";
import { obterToken, obterUsuarioLocal } from "../services/storage";
import {
  listarItensPendentes,
  marcarItemSincronizado,
  registrarFalhaItem,
  obterResumoFila,
  recuperarItensEmVooInterrompidos,
  marcarItensEnviando,
  reverterItensParaPendente,
  possuiOutraPendenciaAtiva,
  possuiPendenciaOuErroMetadado,
  limparSincronizados,
  obterMetaSync,
  salvarMetaSync,
} from "../repositories/syncQueueRepository";
import {
  upsertObraSincronizada,
  contarObrasLocaisPorUsuario,
  removerObraPorTombstoneLocal,
  expurgarObrasArquivadasAntigasLocal,
  upsertHistoricoDataObraLocal,
} from "../repositories/obraLocalRepository";
import { upsertCicloSincronizado } from "../repositories/cicloLocalRepository";
import { upsertMedicaoSincronizada } from "../repositories/medicaoLocalRepository";
import {
  marcarFotografiaComoSincronizada,
  marcarErroUploadFotografia,
  upsertFotografiaSincronizada,
  listarFotografiasPendentesUploadBinario,
  listarFotografiasComUrlNuvem,
  atualizarCaminhoLocalFotografia,
} from "../repositories/fotografiaRepository";

const obterFsLocal = () => {
  try {
    return require("expo-file-system/legacy");
  } catch {
    try {
      return require("expo-file-system");
    } catch {
      return null;
    }
  }
};

const ehPlataformaWeb = () => {
  try {
    const rn = require("react-native");
    return rn?.Platform?.OS === "web";
  } catch {
    return false;
  }
};

const LIMITE_LOTE_PUSH = 40;

let isOnline = true;
let isSyncing = false;
let mutexSyncAtivo = false;
let isSendingPush = false;
let isManualSync = false;
let syncState = "idle"; // 'idle' | 'syncing' | 'pending' | 'error' | 'synced'
let filaTransacaoPromise = Promise.resolve();
let pendingCount = 0;
let errorCount = 0;
let permanentErrorCount = 0;
let lastSyncedAt = null;
let lastPullAt = null;
let lastErrorMessage = null;
let unsubscribeNetInfo = null;
let requisicaoFn = null;
let perfilSyncFn = null;

let syncPendenteNovamente = false;
let pullPendenteNovamente = false;
let timerAgendamento = null;
let timerRetryRede = null;
let recuperacaoInFlightFeita = false;

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

/**
 * Permite registrar callback opcional de sincronização de perfil (AuthContext)
 * para execução unificada no ciclo do syncManager.
 */
export const configurarSincronizacaoPerfil = (fn) => {
  perfilSyncFn = typeof fn === "function" ? fn : null;
};

export const obterEstadoAtualSync = () => ({
  isOnline,
  isSyncing,
  isSendingPush,
  isManualSync,
  syncState,
  pendingCount,
  errorCount,
  permanentErrorCount,
  totalNaoSincronizados: pendingCount + errorCount,
  lastSyncedAt,
  lastPullAt,
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
 * Recalcula as contagens da fila local (isoladas pelo usuário logado) e atualiza o estado observável.
 */
export const atualizarContadoresFila = async (usuarioIdOverride = null) => {
  try {
    let usuarioId = usuarioIdOverride;
    if (!usuarioId) {
      const usuario = await obterUsuarioLocal().catch(() => null);
      usuarioId = usuario?.id || null;
    }

    const resumo = await obterResumoFila(null, usuarioId);
    pendingCount = resumo.pendentes;
    errorCount = resumo.erros;
    permanentErrorCount = resumo.errosPermanentes || 0;

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
  } catch {
    return {
      pendentes: 0,
      erros: 0,
      errosPermanentes: 0,
      totalNaoSincronizados: 0,
    };
  }
};

const executarEmTransacaoLocal = (db, fn) => {
  const executar = () =>
    typeof db.withTransactionAsync === "function"
      ? db.withTransactionAsync(fn)
      : fn();
  const proxima = filaTransacaoPromise.then(executar, executar);
  filaTransacaoPromise = proxima.catch(() => {});
  return proxima;
};

/**
 * Hidrata o SQLite local com os dados retornados pelo GET /sync/pull (Full ou Delta)
 * dentro de uma transação atômica, aplicando tombstones e salvando o cursor `since`.
 */
export const hidratarBancoLocalComPull = async (
  dadosPull,
  usuarioIdOverride = null,
  dbOverride = null
) => {
  if (!dadosPull) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  let usuarioId = usuarioIdOverride;
  if (!usuarioId) {
    const usuario = await obterUsuarioLocal().catch(() => null);
    usuarioId = usuario?.id || null;
  }

  await executarEmTransacaoLocal(db, async () => {
    for (const exc of dadosPull.excluidos || []) {
      const tab = exc?.tabela_referencia;
      const regId = exc?.registro_id;
      if (!tab || !regId) continue;

      const temPendencia = await possuiOutraPendenciaAtiva(tab, regId, db);
      if (temPendencia) continue;

      if (tab === "obras") {
        await removerObraPorTombstoneLocal(regId, db);
      } else if (tab === "fotografias") {
        await db.runAsync(`DELETE FROM fotografias WHERE id = ?;`, [
          String(regId),
        ]);
      }
    }

    for (const obra of dadosPull.obras || []) {
      await upsertObraSincronizada(obra, db);
    }

    for (const etapa of dadosPull.etapas || []) {
      await db.runAsync(
        `INSERT INTO etapas (id, obra_id, etapa_pai_id, nome, ordem, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           obra_id = excluded.obra_id,
           etapa_pai_id = excluded.etapa_pai_id,
           nome = excluded.nome,
           ordem = excluded.ordem,
           updated_at = excluded.updated_at;`,
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
      const srvId = String(servico.id);
      const obraId = String(servico.obra_id);
      const codigo = String(servico.codigo_servico || "");

      // Evita violação de UNIQUE(obra_id, codigo_servico) caso uma planilha tenha sido reimportada
      await db.runAsync(
        `DELETE FROM servicos WHERE obra_id = ? AND codigo_servico = ? AND id != ?;`,
        [obraId, codigo, srvId]
      );

      await db.runAsync(
        `INSERT INTO servicos (
          id, obra_id, etapa_id, codigo_servico, descricao, fonte_origem,
          unidade_medida, quantidade_orcada, preco_unitario, preco_total, ordem, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          obra_id = excluded.obra_id,
          etapa_id = excluded.etapa_id,
          codigo_servico = excluded.codigo_servico,
          descricao = excluded.descricao,
          fonte_origem = excluded.fonte_origem,
          unidade_medida = excluded.unidade_medida,
          quantidade_orcada = excluded.quantidade_orcada,
          preco_unitario = excluded.preco_unitario,
          preco_total = excluded.preco_total,
          ordem = excluded.ordem,
          updated_at = excluded.updated_at;`,
        [
          srvId,
          obraId,
          servico.etapa_id ? String(servico.etapa_id) : null,
          codigo,
          servico.descricao || "",
          servico.fonte_origem || null,
          padronizarUnidadeMedida(servico.unidade_medida || "un"),
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
      const { arquivo_base64, ...fotoMetadados } = foto || {};
      await upsertFotografiaSincronizada(fotoMetadados, db);
    }

    for (const hist of dadosPull.historico_datas_obra || []) {
      await upsertHistoricoDataObraLocal(hist, db).catch(() => {});
    }

    if (dadosPull.timestamp && usuarioId) {
      await salvarMetaSync(`ultimo_pull_${usuarioId}`, dadosPull.timestamp, db);
    }
  });

  const houveMudancas =
    (dadosPull.obras?.length || 0) > 0 ||
    (dadosPull.etapas?.length || 0) > 0 ||
    (dadosPull.servicos?.length || 0) > 0 ||
    (dadosPull.ciclos?.length || 0) > 0 ||
    (dadosPull.medicoes?.length || 0) > 0 ||
    (dadosPull.fotografias?.length || 0) > 0 ||
    (dadosPull.historico_datas_obra?.length || 0) > 0 ||
    (dadosPull.excluidos?.length || 0) > 0;

  if (houveMudancas || !lastPullAt) {
    lastPullAt = new Date().toISOString();
  }
};

const lerFotoComoBase64 = async (uri) => {
  if (!uri || typeof uri !== "string") return null;
  if (uri.startsWith("data:image/")) return uri;
  if (ehPlataformaWeb()) return null;

  const fs = obterFsLocal();
  if (!fs?.getInfoAsync || !fs?.readAsStringAsync) return null;

  try {
    const info = await fs.getInfoAsync(uri);
    if (!info?.exists) return null;
    const b64 = await fs.readAsStringAsync(uri, {
      encoding: fs.EncodingType?.Base64 || "base64",
    });
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } catch {
    return null;
  }
};

const arquivoFotoUtilizavelLocalmente = async (uri) => {
  if (!uri || typeof uri !== "string") return false;
  if (
    uri.startsWith("data:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("blob:")
  ) {
    return true;
  }
  if (ehPlataformaWeb()) return false;

  const fs = obterFsLocal();
  if (!fs?.getInfoAsync) return true;
  try {
    const info = await fs.getInfoAsync(uri);
    return Boolean(info?.exists);
  } catch {
    return false;
  }
};

/**
 * Pipeline separado de mídia (Onda 3):
 * 1) Envia individualmente arquivos de fotografias cujo metadado já subiu mas ainda não possuem url_nuvem.
 * 2) Baixa sob demanda arquivos vindos da nuvem cujo binário ainda não existe localmente neste dispositivo.
 */
export const sincronizarMidiasPendentes = async (
  dbOverride = null,
  usuarioId = null,
  { baixarFaltantes = true } = {}
) => {
  if (!requisicaoFn || !isOnline) return { enviados: 0, baixados: 0 };

  const db = dbOverride || (await getDbConnection());
  let enviados = 0;
  let baixados = 0;

  const pendentesUpload = await listarFotografiasPendentesUploadBinario(
    usuarioId,
    db
  ).catch(() => []);

  for (const foto of pendentesUpload) {
    try {
      const estadoMeta = await possuiPendenciaOuErroMetadado(
        "fotografias",
        foto.id,
        db
      );
      if (estadoMeta) {
        if (Number(estadoMeta.erro_permanente || 0) === 1) {
          await marcarErroUploadFotografia(foto.id, db).catch(() => {});
        }
        continue;
      }

      const metadadoPendente = await possuiOutraPendenciaAtiva(
        "fotografias",
        foto.id,
        db
      );
      if (metadadoPendente) continue;

      const uri = foto.caminho_comprimido || foto.caminho_local;
      const base64 = await lerFotoComoBase64(uri);
      if (!base64) continue;

      const resp = await requisicaoFn(
        `/sync/fotos/${encodeURIComponent(String(foto.id))}/arquivo`,
        {
          method: "POST",
          body: JSON.stringify({ base64 }),
          timeoutMs: 30000,
        }
      );

      await marcarFotografiaComoSincronizada(
        foto.id,
        resp?.url_nuvem ||
          `/sync/fotos/${encodeURIComponent(String(foto.id))}/arquivo`,
        db
      );
      enviados += 1;
    } catch (errFoto) {
      if ([400, 403, 404].includes(Number(errFoto?.status))) {
        await marcarErroUploadFotografia(foto.id, db).catch(() => {});
      }
      console.warn(
        `[SyncManager] Aviso upload mídia foto=${foto.id}:`,
        errFoto?.message || errFoto
      );
    }
  }

  if (baixarFaltantes) {
    const fotosNuvem = await listarFotografiasComUrlNuvem(
      usuarioId,
      db
    ).catch(() => []);
    const fs = obterFsLocal();

    for (const foto of fotosNuvem) {
      try {
        const uriAtual = foto.caminho_comprimido || foto.caminho_local;
        const okLocal = await arquivoFotoUtilizavelLocalmente(uriAtual);
        if (okLocal) continue;

        const resp = await requisicaoFn(
          `/sync/fotos/${encodeURIComponent(String(foto.id))}/arquivo`,
          { method: "GET", timeoutMs: 30000 }
        );
        if (!resp?.base64) continue;

        let caminhoPersistido = resp.base64;
        if (!ehPlataformaWeb() && fs?.documentDirectory && fs?.writeAsStringAsync) {
          const base64Limpo = String(resp.base64).replace(
            /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
            ""
          );
          const destino = `${fs.documentDirectory}foto_sync_${foto.id}.jpg`;
          await fs.writeAsStringAsync(destino, base64Limpo, {
            encoding: fs.EncodingType?.Base64 || "base64",
          });
          caminhoPersistido = destino;
        }

        await atualizarCaminhoLocalFotografia(foto.id, caminhoPersistido, db);
        baixados += 1;
      } catch (errDownload) {
        console.warn(
          `[SyncManager] Aviso download mídia foto=${foto.id}:`,
          errDownload?.message || errDownload
        );
      }
    }

    if (baixados > 0) {
      lastPullAt = new Date().toISOString();
    }
  }

  return { enviados, baixados };
};

const atualizarEstadoConectividadeViaNetInfo = async () => {
  try {
    const netState = await NetInfo.fetch();
    isOnline = Boolean(
      netState.isConnected && netState.isInternetReachable !== false
    );
  } catch {
    // Mantém último valor conhecido de isOnline
  }
  return isOnline;
};

/**
 * Executa o ciclo completo de sincronização (Push em lotes paginados + Pull do servidor).
 * Protegido por mutex (isSyncing) com fila de re-disparo (syncPendenteNovamente).
 */
export const sincronizarTudo = async ({
  incluirPull = true,
  manual = false,
} = {}) => {
  if (isSyncing || mutexSyncAtivo) {
    syncPendenteNovamente = true;
    if (incluirPull) {
      pullPendenteNovamente = true;
    }
    return obterEstadoAtualSync();
  }

  mutexSyncAtivo = true;
  let usuarioId = null;
  let dispararReexecucao = false;
  let reexecucaoComPull = false;
  let execucaoIniciada = false;

  try {
    const usuario = await obterUsuarioLocal().catch(() => null);
    usuarioId = usuario?.id || null;

    await atualizarContadoresFila(usuarioId);
    await atualizarEstadoConectividadeViaNetInfo();

    if (!isOnline || !requisicaoFn) {
      await atualizarContadoresFila(usuarioId);
      return obterEstadoAtualSync();
    }

    const token = await obterToken();
    if (!token || !usuarioId || usuarioId === "local_user") {
      return obterEstadoAtualSync();
    }

    if (timerRetryRede) {
      clearTimeout(timerRetryRede);
      timerRetryRede = null;
    }

    execucaoIniciada = true;
    isSyncing = true;
    isSendingPush = false;
    isManualSync = Boolean(manual);
    syncState = "syncing";
    lastErrorMessage = null;
    notificarListeners();

    const db = await getDbConnection();

    if (!recuperacaoInFlightFeita) {
      await recuperarItensEmVooInterrompidos(db);
      recuperacaoInFlightFeita = true;
    }

    if (typeof perfilSyncFn === "function") {
      await perfilSyncFn(usuarioId).catch(() => {});
    }

    const falhadosNesteCiclo = new Set();
    let loteIndex = 0;

    while (true) {
      const loteBruto = await listarItensPendentes(db, {
        usuarioId,
        limite: LIMITE_LOTE_PUSH,
        ignorarBackoff: manual && loteIndex === 0,
      });

      const pendentes = (loteBruto || []).filter(
        (item) => !falhadosNesteCiclo.has(item.id)
      );

      if (pendentes.length === 0) {
        break;
      }

      if (!isSendingPush) {
        isSendingPush = true;
        notificarListeners();
      }

      loteIndex += 1;
      const idsLote = pendentes.map((item) => item.id);
      await marcarItensEnviando(idsLote, db);

      // Remove payloadObj duplicado para reduzir o tamanho do payload JSON trafegado
      const itensEnvio = pendentes.map(({ payloadObj, ...resto }) => resto);

      let respostaPush;
      try {
        respostaPush = await requisicaoFn("/sync/push", {
          method: "POST",
          body: JSON.stringify({ itens: itensEnvio }),
        });
      } catch (errPush) {
        await reverterItensParaPendente(idsLote, db);
        throw errPush;
      }

      const sincronizados = Array.isArray(respostaPush?.sincronizados)
        ? respostaPush.sincronizados
        : [];
      const falhas = Array.isArray(respostaPush?.falhas)
        ? respostaPush.falhas
        : [];

      for (const itemOk of sincronizados) {
        await marcarItemSincronizado(itemOk.fila_id, db);

        const temOutraPendencia = await possuiOutraPendenciaAtiva(
          itemOk.tabela_referencia,
          itemOk.registro_id,
          db
        );

        if (!temOutraPendencia) {
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
      }

      for (const itemFalha of falhas) {
        falhadosNesteCiclo.add(itemFalha.fila_id);
        await registrarFalhaItem(
          itemFalha.fila_id,
          itemFalha.erro || "Falha ao sincronizar registro no servidor",
          db,
          { permanente: Boolean(itemFalha.permanente) }
        );
        if (
          itemFalha.permanente &&
          itemFalha.tabela_referencia === "fotografias" &&
          itemFalha.registro_id
        ) {
          await marcarErroUploadFotografia(itemFalha.registro_id, db).catch(
            () => {}
          );
        }
        lastErrorMessage = itemFalha.erro;
      }

      if (loteBruto.length < LIMITE_LOTE_PUSH || sincronizados.length === 0) {
        break;
      }
    }

    await limparSincronizados(db).catch(() => {});

    if (incluirPull) {
      try {
        let querySince = "";
        if (usuarioId) {
          const qtdObrasLocais = await contarObrasLocaisPorUsuario(
            usuarioId,
            db
          ).catch(() => 0);
          if (qtdObrasLocais > 0) {
            const cursor = await obterMetaSync(
              `ultimo_pull_${usuarioId}`,
              db
            ).catch(() => null);
            if (cursor) {
              querySince = `?since=${encodeURIComponent(cursor)}`;
            }
          }
        }
        const dadosPull = await requisicaoFn(`/sync/pull${querySince}`, {
          method: "GET",
        });
        await hidratarBancoLocalComPull(dadosPull, usuarioId, db);
        await expurgarObrasArquivadasAntigasLocal(db).catch(() => {});
      } catch (pullErr) {
        console.warn("[SyncManager] Aviso no pull:", pullErr.message);
      }
    }

    await sincronizarMidiasPendentes(db, usuarioId, {
      baixarFaltantes: incluirPull,
    }).catch((errMidia) => {
      console.warn("[SyncManager] Aviso mídia:", errMidia?.message || errMidia);
    });

    lastSyncedAt = new Date().toISOString();
  } catch (error) {
    lastErrorMessage =
      error.message || "Não foi possível sincronizar com o servidor.";

    if (error.status === 0 || !error.status) {
      const conectadoReal = await atualizarEstadoConectividadeViaNetInfo();
      if (conectadoReal && !timerRetryRede) {
        timerRetryRede = setTimeout(() => {
          timerRetryRede = null;
          sincronizarTudo({ incluirPull }).catch(() => {});
        }, 10000);
      }
    }
  } finally {
    mutexSyncAtivo = false;
    isSyncing = false;
    isSendingPush = false;
    isManualSync = false;
    await atualizarContadoresFila(usuarioId);

    if (syncPendenteNovamente) {
      dispararReexecucao = execucaoIniciada && isOnline && Boolean(requisicaoFn);
      reexecucaoComPull = pullPendenteNovamente;
      syncPendenteNovamente = false;
      pullPendenteNovamente = false;
    }
  }

  if (dispararReexecucao) {
    setTimeout(() => {
      sincronizarTudo({ incluirPull: reexecucaoComPull }).catch(() => {});
    }, 50);
  }

  return obterEstadoAtualSync();
};

/**
 * Agenda uma tentativa assíncrona de sincronização sem bloquear a operação atual do usuário.
 * Se uma sincronização já estiver em andamento, garante re-execução imediata ao término.
 */
export const agendarSincronizacao = ({ incluirPull = false } = {}) => {
  if (timerAgendamento) {
    clearTimeout(timerAgendamento);
  }

  atualizarContadoresFila().then((resumo) => {
    if (isSyncing || mutexSyncAtivo) {
      syncPendenteNovamente = true;
      if (incluirPull) pullPendenteNovamente = true;
      return;
    }

    if (isOnline && resumo.totalNaoSincronizados > 0) {
      timerAgendamento = setTimeout(() => {
        timerAgendamento = null;
        if (isSyncing || mutexSyncAtivo) {
          syncPendenteNovamente = true;
          if (incluirPull) pullPendenteNovamente = true;
          return;
        }
        sincronizarTudo({ incluirPull }).catch(() => {});
      }, 150);
    }
  });
};

/**
 * Dispara sincronização completa imediatamente após login ou cadastro.
 */
export const notificarAutenticacaoSync = () => {
  recuperacaoInFlightFeita = false;
  atualizarContadoresFila().then(() => {
    sincronizarTudo({ incluirPull: true }).catch(() => {});
  });
};

/**
 * Limpa estado em memória e timers pendentes ao encerrar sessão (logout).
 */
export const resetarEstadoSyncSessao = () => {
  if (timerAgendamento) {
    clearTimeout(timerAgendamento);
    timerAgendamento = null;
  }
  if (timerRetryRede) {
    clearTimeout(timerRetryRede);
    timerRetryRede = null;
  }
  syncPendenteNovamente = false;
  pullPendenteNovamente = false;
  recuperacaoInFlightFeita = false;
  pendingCount = 0;
  errorCount = 0;
  permanentErrorCount = 0;
  lastSyncedAt = null;
  lastPullAt = null;
  lastErrorMessage = null;
  if (!isSyncing && !mutexSyncAtivo) {
    syncState = "idle";
  }
  notificarListeners();
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
      setTimeout(() => {
        sincronizarTudo({ incluirPull: true }).catch(() => {});
      }, 600);
    }
  });

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
  configurarSincronizacaoPerfil,
  obterEstadoAtualSync,
  inscreverStatusSync,
  atualizarContadoresFila,
  hidratarBancoLocalComPull,
  sincronizarMidiasPendentes,
  sincronizarTudo,
  agendarSincronizacao,
  notificarAutenticacaoSync,
  resetarEstadoSyncSessao,
  iniciarMonitoramentoRede,
  pararMonitoramentoRede,
};
