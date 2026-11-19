// mobile/src/components/SyncStatusBanner.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  CircleAlert,
  CircleCheck,
  CloudUpload,
  RefreshCw,
  WifiOff,
} from "lucide-react-native";
import { useSync } from "../context/SyncContext";
import { cores, fontes, moderateScale, rem } from "../styles/theme";

/**
 * Componente visual desacoplado exibido somente quando há dessincronização real:
 * - Modo offline ativo (!isOnline)
 * - Falha na sincronização com botão de nova tentativa (errorCount > 0)
 * - Pendência/envio persistente ou acionado manualmente
 * - Confirmação discreta única quando o app se recupera de uma dessincronização
 */
export default function SyncStatusBanner({ compact = false }) {
  const {
    isOnline,
    isSyncing,
    isSendingPush,
    isManualSync,
    pendingCount,
    errorCount,
    totalNaoSincronizados,
    mostrarPendenciaVisivel,
    exibirConfirmacaoRecente,
    sincronizarAgora,
  } = useSync();

  const sincronizacaoVisivel =
    Boolean(isManualSync && isSyncing) ||
    Boolean((isSendingPush || isSyncing) && mostrarPendenciaVisivel);
  const pendenciaVisivel = pendingCount > 0 && Boolean(mostrarPendenciaVisivel);

  // Invisível por padrão quando online e sincronizado (inclui Pulls silenciosos e saves rápidos)
  if (
    isOnline &&
    errorCount === 0 &&
    !sincronizacaoVisivel &&
    !pendenciaVisivel &&
    !exibirConfirmacaoRecente
  ) {
    return null;
  }

  let variante = styles.bannerOffline;
  let Icone = WifiOff;
  let corTexto = cores.azulPetroleo;
  let titulo = "Modo offline ativo";
  let subtitulo =
    totalNaoSincronizados > 0
      ? `${totalNaoSincronizados} registro(s) salvo(s) no dispositivo. Serão enviados quando houver conexão.`
      : "Seus registros em campo estão sendo salvos no dispositivo.";
  let mostrarBotaoTentar = false;

  if (sincronizacaoVisivel) {
    variante = styles.bannerSyncing;
    Icone = RefreshCw;
    corTexto = cores.azulPetroleo;
    titulo = "Sincronizando dados...";
    subtitulo = `Enviando ${totalNaoSincronizados || ""} registro(s) para o servidor.`;
  } else if (errorCount > 0 && isOnline) {
    variante = styles.bannerErro;
    Icone = CircleAlert;
    corTexto = "#B91C1C";
    titulo = `Falha ao sincronizar ${errorCount} registro(s)`;
    subtitulo =
      "Os dados estão seguros no aparelho. Toque para tentar novamente.";
    mostrarBotaoTentar = true;
  } else if (pendenciaVisivel && isOnline) {
    variante = styles.bannerPendente;
    Icone = CloudUpload;
    corTexto = "#0D6579";
    titulo = `${pendingCount} registro(s) pendente(s) de sincronização`;
    subtitulo = "Toque para sincronizar agora com o servidor.";
    mostrarBotaoTentar = true;
  } else if (!isOnline) {
    variante = styles.bannerOffline;
    Icone = WifiOff;
    corTexto = cores.azulPetroleo;
    titulo = "Modo offline ativo";
    subtitulo =
      totalNaoSincronizados > 0
        ? `${totalNaoSincronizados} registro(s) salvo(s) no dispositivo. Serão enviados quando houver conexão.`
        : "Seus registros em campo estão sendo salvos no dispositivo.";
  } else if (exibirConfirmacaoRecente) {
    variante = styles.bannerSucesso;
    Icone = CircleCheck;
    corTexto = "#3aa150";
    titulo = "Dados sincronizados com o servidor";
    subtitulo = "Todas as medições e fotos da obra estão atualizadas.";
  }

  return (
    <TouchableOpacity
      style={[styles.container, variante, compact && styles.containerCompacto]}
      onPress={
        mostrarBotaoTentar && !isSyncing
          ? () => sincronizarAgora({ manual: true })
          : undefined
      }
      activeOpacity={mostrarBotaoTentar ? 0.8 : 1}
      disabled={!mostrarBotaoTentar || isSyncing}
      accessibilityRole={mostrarBotaoTentar ? "button" : "summary"}
      accessibilityLabel={titulo}
    >
      <View style={styles.iconeContainer}>
        {sincronizacaoVisivel ? (
          <ActivityIndicator size="small" color={corTexto} />
        ) : (
          <Icone size={moderateScale(20)} color={corTexto} strokeWidth={2.5} />
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
    marginTop: moderateScale(20),
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
    backgroundColor: cores.fundoBanner,
    borderColor: "#BCE3DE",
    borderWidth: 2,
  },
  bannerSyncing: {
    backgroundColor: cores.fundoBanner,
    borderColor: cores.ciano,
    borderWidth: 2,
  },
  bannerPendente: {
    backgroundColor: cores.fundoBanner,
    borderColor: "#09D1C7",
    borderWidth: 2,
  },
  bannerErro: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 2,
  },
  bannerSucesso: {
    backgroundColor: "#d8ffe0",
    borderColor: cores.verdeClaro,
    borderWidth: 2,
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
    fontFamily: fontes.media,
    fontSize: rem(0.72),
    color: cores.textoEscuro,
    marginTop: moderateScale(0.5),
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
