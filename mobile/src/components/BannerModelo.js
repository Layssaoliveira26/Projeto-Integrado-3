import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  cores,
  bordas,
  shadows,
  fontes,
  gradianteDistribuicaoDownload,
} from "../styles/theme";

export default function BannerModelo({ onPress }) {
  return (
    <View style={styles.container}>
      <View style={styles.textoContainer}>
        <Text style={styles.titulo}>Baixe nosso modelo</Text>
        <Text style={styles.subtitulo}>
          Para realizar o mapeamento automático, use nosso modelo padrão de
          planilha.
        </Text>
      </View>

      <TouchableOpacity style={styles.botaoDownload} onPress={onPress}>
        <LinearGradient
          colors={[cores.azulEsverdeado, cores.ciano, cores.verdeAgua]}
          locations={gradianteDistribuicaoDownload}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradiente}
        >
          <Feather name="download" size={50} color="#FFFFFF" strokeWidth={5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: "hidden",
    ...shadows.padrao,
  },
  textoContainer: {
    flex: 1,
    padding: 25,
    paddingBottom: 30,
    justifyContent: "center",
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: 18,
    color: cores.rotulo,
    marginBottom: 0,
  },
  subtitulo: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.erro,
    lineHeight: 18,
  },
  botaoDownload: {
    width: 95,
  },
  gradiente: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
