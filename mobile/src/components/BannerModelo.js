import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
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
import { API_URL, baixarModeloPlanilha } from "../services/api";

export default function BannerModelo({ onPress = baixarModeloPlanilha }) {
  const downloadUrl = `${API_URL}/obras/modelo-planilha/planilha_padrao.xlsx`;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        Platform.OS === "web" && { cursor: "pointer" },
      ]}
      onPress={onPress}
      onClick={onPress}
      href={Platform.OS === "web" ? downloadUrl : undefined}
      download="planilha_padrao.xlsx"
      accessibilityRole="link"
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

      <View
        style={styles.botaoDownload}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[cores.azulEsverdeado, cores.ciano, cores.verdeAgua]}
          locations={gradianteDistribuicaoDownload}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradiente}
        >
          <Feather
            name="download"
            size={moderateScale(32)}
            color="#FFFFFF"
            strokeWidth={2.5}
          />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(16),
    overflow: "hidden",
    ...shadows.padrao,
  },
  textoContainer: {
    flex: 1,
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    justifyContent: "center",
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.05),
    color: cores.rotulo,
    marginBottom: moderateScale(4),
  },
  subtitulo: {
    fontFamily: fontes.media,
    fontSize: rem(0.8),
    color: cores.erro,
    lineHeight: rem(1.15),
  },
  botaoDownload: {
    width: moderateScale(72),
    minWidth: 64,
  },
  gradiente: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

