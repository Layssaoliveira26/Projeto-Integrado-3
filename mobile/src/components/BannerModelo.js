import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  cores,
  bordas,
  shadows,
  fontes,
  gradianteDistribuicaoDownload,
  rem,
  moderateScale,
} from "../styles/theme";
import ModalAviso from "./ModalAviso";
import ModalFeedback from "./ModalFeedback";
import useFeedbackAcao from "../hooks/useFeedbackAcao";
import { baixarModeloPlanilha } from "../services/api";

export default function BannerModelo() {
  const { feedback, executar } = useFeedbackAcao();
  const [avisoErro, setAvisoErro] = useState(false);

  const handlePress = async () => {
    if (feedback.visible) return;
    await executar(
      "downloadModeloPlanilha",
      () => baixarModeloPlanilha({ mostrarAlertas: false }),
      {
        aoFalhar: (erro) => {
          if (erro?.code === "DOWNLOAD_CANCELADO") return;
          setAvisoErro(true);
        },
      },
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, Platform.OS === "web" && { cursor: "pointer" }]}
        onPress={handlePress}
        disabled={feedback.visible}
        accessibilityRole="button"
        accessibilityLabel="Baixar modelo padrão de planilha"
        activeOpacity={0.85}
      >
        <View style={styles.textoContainer} pointerEvents="none">
          <Text style={styles.titulo}>Baixe nosso modelo</Text>
          <Text style={styles.subtitulo}>
            Para realizar o mapeamento automático, use nosso modelo padrão de
            planilha.
          </Text>
        </View>

        <View style={styles.botaoDownload} pointerEvents="none">
          <LinearGradient
            colors={[cores.azulEsverdeado, cores.ciano, cores.verdeAgua]}
            locations={gradianteDistribuicaoDownload}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradiente}
          >
            {feedback.visible && feedback.estado === "loading" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather
                name="download"
                size={moderateScale(38)}
                color="#FFFFFF"
                strokeWidth={5}
              />
            )}
          </LinearGradient>
        </View>
      </TouchableOpacity>
      <ModalFeedback {...feedback} />
      <ModalAviso
        visible={avisoErro}
        titulo="Erro no download"
        mensagem="Não foi possível concluir o download do modelo no momento. Tente novamente."
        onFechar={() => setAvisoErro(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(15),
    overflow: "hidden",
    ...shadows.padrao,
  },
  textoContainer: {
    flex: 1,
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(18),
    justifyContent: "center",
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.05),
    color: cores.rotulo,
    marginBottom: moderateScale(1),
  },
  subtitulo: {
    fontFamily: fontes.media,
    fontSize: rem(0.8),
    color: cores.erro,
  },
  botaoDownload: {
    width: moderateScale(100),
    minWidth: 60,
  },
  gradiente: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
