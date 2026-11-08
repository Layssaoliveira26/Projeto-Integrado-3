// mobile/src/context/SyncContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AppState } from "react-native";
import {
  obterEstadoAtualSync,
  inscreverStatusSync,
  iniciarMonitoramentoRede,
  pararMonitoramentoRede,
  sincronizarTudo,
} from "../sync/syncManager";

const SyncContext = createContext({
  isOnline: true,
  isSyncing: false,
  syncState: "idle",
  pendingCount: 0,
  errorCount: 0,
  totalNaoSincronizados: 0,
  lastSyncedAt: null,
  lastErrorMessage: null,
  sincronizarAgora: async () => {},
});

export function SyncProvider({ children }) {
  const [estadoSync, setEstadoSync] = useState(obterEstadoAtualSync());

  useEffect(() => {
    const cancelarInscricao = inscreverStatusSync((novoEstado) => {
      setEstadoSync(novoEstado);
    });

    iniciarMonitoramentoRede();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        sincronizarTudo({ incluirPull: true }).catch(() => {});
      }
    });

    return () => {
      cancelarInscricao();
      pararMonitoramentoRede();
      if (appStateSub && typeof appStateSub.remove === "function") {
        appStateSub.remove();
      }
    };
  }, []);

  const sincronizarAgora = useCallback(async () => {
    return await sincronizarTudo({ incluirPull: true });
  }, []);

  return (
    <SyncContext.Provider
      value={{
        ...estadoSync,
        sincronizarAgora,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync deve ser utilizado dentro de um SyncProvider");
  }
  return context;
}

export default SyncContext;

