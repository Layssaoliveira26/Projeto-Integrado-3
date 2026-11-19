// mobile/src/context/SyncContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import {
  obterEstadoAtualSync,
  inscreverStatusSync,
  iniciarMonitoramentoRede,
  pararMonitoramentoRede,
  sincronizarTudo,
} from "../sync/syncManager";

const TOLERANCIA_PENDENCIA_ONLINE_MS = 1000;
const DURACAO_CONFIRMACAO_SYNC_MS = 3500;

const SyncContext = createContext({
  isOnline: true,
  isSyncing: false,
  isSendingPush: false,
  isManualSync: false,
  syncState: "idle",
  pendingCount: 0,
  errorCount: 0,
  permanentErrorCount: 0,
  totalNaoSincronizados: 0,
  lastSyncedAt: null,
  lastPullAt: null,
  lastErrorMessage: null,
  mostrarPendenciaVisivel: false,
  exibirConfirmacaoRecente: false,
  sincronizarAgora: async () => {},
});

export function SyncProvider({ children }) {
  const [estadoSync, setEstadoSync] = useState(obterEstadoAtualSync());
  const [mostrarPendenciaVisivel, setMostrarPendenciaVisivel] = useState(false);
  const [exibirConfirmacaoRecente, setExibirConfirmacaoRecente] =
    useState(false);

  const estavaDessincronizadoRef = useRef(false);
  const mostrarPendenciaRef = useRef(false);
  const timerPendenciaRef = useRef(null);
  const timerConfirmacaoRef = useRef(null);

  useEffect(() => {
    const limparTimerPendencia = () => {
      if (timerPendenciaRef.current) {
        clearTimeout(timerPendenciaRef.current);
        timerPendenciaRef.current = null;
      }
    };

    const limparTimerConfirmacao = () => {
      if (timerConfirmacaoRef.current) {
        clearTimeout(timerConfirmacaoRef.current);
        timerConfirmacaoRef.current = null;
      }
    };

    const atualizarPendenciaVisivel = (valor) => {
      mostrarPendenciaRef.current = valor;
      setMostrarPendenciaVisivel(valor);
    };

    const cancelarInscricao = inscreverStatusSync((novoEstado) => {
      setEstadoSync(novoEstado);

      const offlineOuErro = !novoEstado.isOnline || novoEstado.errorCount > 0;
      const syncManualAtivo =
        novoEstado.isManualSync &&
        (novoEstado.isSyncing || novoEstado.totalNaoSincronizados > 0);
      const temPendenciaOuPush =
        novoEstado.isSendingPush || novoEstado.pendingCount > 0;

      if (offlineOuErro) {
        limparTimerPendencia();
        limparTimerConfirmacao();
        estavaDessincronizadoRef.current = true;
        setExibirConfirmacaoRecente(false);
        atualizarPendenciaVisivel(
          novoEstado.totalNaoSincronizados > 0 || novoEstado.isSendingPush
        );
        return;
      }

      if (syncManualAtivo) {
        limparTimerPendencia();
        limparTimerConfirmacao();
        estavaDessincronizadoRef.current = true;
        setExibirConfirmacaoRecente(false);
        atualizarPendenciaVisivel(true);
        return;
      }

      if (temPendenciaOuPush) {
        limparTimerConfirmacao();
        setExibirConfirmacaoRecente(false);

        if (!mostrarPendenciaRef.current && !timerPendenciaRef.current) {
          timerPendenciaRef.current = setTimeout(() => {
            timerPendenciaRef.current = null;
            estavaDessincronizadoRef.current = true;
            atualizarPendenciaVisivel(true);
          }, TOLERANCIA_PENDENCIA_ONLINE_MS);
        }
        return;
      }

      limparTimerPendencia();
      atualizarPendenciaVisivel(false);

      if (
        !novoEstado.isSyncing &&
        novoEstado.lastSyncedAt &&
        estavaDessincronizadoRef.current
      ) {
        estavaDessincronizadoRef.current = false;
        setExibirConfirmacaoRecente(true);
        limparTimerConfirmacao();
        timerConfirmacaoRef.current = setTimeout(() => {
          timerConfirmacaoRef.current = null;
          setExibirConfirmacaoRecente(false);
        }, DURACAO_CONFIRMACAO_SYNC_MS);
      }
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
      limparTimerPendencia();
      limparTimerConfirmacao();
      if (appStateSub && typeof appStateSub.remove === "function") {
        appStateSub.remove();
      }
    };
  }, []);

  const sincronizarAgora = useCallback(async (opcoes = {}) => {
    return await sincronizarTudo({
      incluirPull: true,
      manual: true,
      ...(opcoes || {}),
    });
  }, []);

  return (
    <SyncContext.Provider
      value={{
        ...estadoSync,
        mostrarPendenciaVisivel,
        exibirConfirmacaoRecente,
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
