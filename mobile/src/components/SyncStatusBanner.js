// mobile/src/components/SyncStatusBanner.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSync } from "../context/SyncContext";
import { cores, fontes, moderateScale, rem } from "../styles/theme";

/**
 * Componente visual desacoplado para indicar ao usuário a situação da sincronização (RF31):
 * - Dados pendentes em modo offline
 * - Sincronização em andamento
 * - Falha na sincronização com botão de nova tentativa
 * - Confirmação discreta quando sincronizado
 */
export default function SyncStatusBanner({ compact = false }) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    errorCount,
    totalNaoSincronizados,
    lastSyncedAt,
    sincronizarAgora,
  } = useSync();

  const [exibirConfirmacaoRecente, setExibirConfirmacaoRecente] = useState(false);

  useEffect(() => {
    if (lastSyncedAt && totalNaoSincronizados === 0 && !isSyncing) {
      setExibirConfirmacaoRecente(true);
      const timer = setTimeout(() => {
        setExibirConfirmacaoRecente(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lastSyncedAt, totalNaoSincronizados, isSyncing]);

  // Se está online, sem pendências, sem erros e já passou a confirmação recente, não polui a tela
  if (
    isOnline &&
    !isSyncing &&
    totalNaoSincronizados === 0 &&
    !exibirConfirmacaoRecente
  ) {
    return null;
  }

  let variante = styles.bannerOffline;
  let icone = "wifi-off";
  let corTexto = "#0D6579";
  let titulo = "Modo offline ativo";
  let subtitulo =
    totalNaoSincronizados > 0
      ? `${totalNaoSincronizados} registro(s) salvo(s) no dispositivo. Serão enviados quando houver conexão.`
      : "Seus registros em campo estão sendo salvos no dispositivo.";
  let mostrarBotaoTentar = false;

  if (isSyncing) {
    variante = styles.bannerSyncing;
    icone = "refresh-cw";
    corTexto = "#0D6579";
    titulo = "Sincronizando dados...";
    subtitulo = `Enviando ${totalNaoSincronizados || ""} registro(s) para o servidor.`;
  } else if (errorCount > 0 && isOnline) {
    variante = styles.bannerErro;
    icone = "alert-circle";
    corTexto = "#B91C1C";
    titulo = `Falha ao sincronizar ${errorCount} registro(s)`;
    subtitulo = "Os dados estão seguros no aparelho. Toque para tentar novamente.";
    mostrarBotaoTentar = true;
  } else if (pendingCount > 0 && isOnline) {
    variante = styles.bannerPendente;
    icone = "upload-cloud";
    corTexto = "#0D6579";
    titulo = `${pendingCount} registro(s) pendente(s) de sincronização`;
    subtitulo = "Toque para sincronizar agora com o servidor.";
    mostrarBotaoTentar = true;
  } else if (exibirConfirmacaoRecente) {
    variante = styles.bannerSucesso;
    icone = "check-circle";
    corTexto = "#15803D";
    titulo = "Dados sincronizados com o servidor";
    subtitulo = "Todas as medições e fotos da obra estão atualizadas.";
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        variante,
        compact && styles.containerCompacto,
      ]}
      onPress={
        mostrarBotaoTentar && !isSyncing ? () => sincronizarAgora() : undefined
      }
      activeOpacity={mostrarBotaoTentar ? 0.8 : 1}
      disabled={!mostrarBotaoTentar || isSyncing}
      accessibilityRole={mostrarBotaoTentar ? "button" : "summary"}
      accessibilityLabel={titulo}
    >
      <View style={styles.iconeContainer}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={corTexto} />
        ) : (
          <Feather name={icone} size={moderateScale(18)} color={corTexto} />
        )}
      </View>

      <View style={styles.textosContainer}>
        <Text style={[styles.titulo, { color: corTexto }]}>{titulo}</Text>
        {!compact && <Text style={styles.subtitulo}>{subtitulo}</Text>}
      </View>

      {mostrarBotaoTentar && !isSyncing && (
        <View style={styles.botaoSincronizar}>
          <Text style={styles.textoBotaoSincronizar}>Sincronizar</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(10),
    marginBottom: moderateScale(4),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(14),
    borderRadius: moderateScale(14),
    borderWidth: 1,
  },
  containerCompacto: {
    marginHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
  },
  bannerOffline: {
    backgroundColor: "#E0EAE7",
    borderColor: "#BCE3DE",
  },
  bannerSyncing: {
    backgroundColor: "#E0F7F3",
    borderColor: "#46DFB3",
  },
  bannerPendente: {
    backgroundColor: "#EBFBF8",
    borderColor: "#09D1C7",
  },
  bannerErro: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  bannerSucesso: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  iconeContainer: {
    width: moderateScale(26),
    alignItems: "center",
    justifyContent: "center",
    marginRight: moderateScale(10),
  },
  textosContainer: {
    flex: 1,
  },
  titulo: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.8),
  },
  subtitulo: {
    fontFamily: fontes.regular,
    fontSize: rem(0.72),
    color: cores.textoEscuro,
    marginTop: moderateScale(2),
    lineHeight: moderateScale(15),
  },
  botaoSincronizar: {
    backgroundColor: cores.azulPetroleo,
    paddingVertical: moderateScale(6),
    paddingHorizontal: moderateScale(10),
    borderRadius: moderateScale(10),
    marginLeft: moderateScale(8),
  },
  textoBotaoSincronizar: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.72),
    color: "#FFFFFF",
  },
});
