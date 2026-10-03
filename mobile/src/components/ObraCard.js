import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  cores,
  bordas,
  shadows,
  fontes,
  gradienteDistribuicaoCompleta,
  gradienteCores,
  gradienteCoresInvertido,
} from "../styles/theme";

export default function ObraCard({ obra, onPress }) {
  const imagemSource =
    typeof obra.imagem === "string" ? { uri: obra.imagem } : obra.imagem;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Image source={imagemSource} style={styles.imagem} />

      <View style={styles.conteudo}>
        <View style={styles.linhaTitulo}>
          <Text style={styles.titulo} numberOfLines={1}>
            {obra.nome}
          </Text>

          <View style={styles.badge}>
            <Text style={styles.badgeTexto}>Ciclo {obra.ciclo}</Text>
          </View>
        </View>

        <Text style={styles.info}>
          {obra.servicos} serviços - R$ {obra.valor}
        </Text>

        <View style={styles.linhaProgresso}>
          <View style={styles.barraFundo}>
            <LinearGradient
              colors={gradienteCoresInvertido}
              locations={gradienteDistribuicaoCompleta}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.barraPreenchida, { width: `${obra.progresso}%` }]}
            />
          </View>
          <Text style={styles.progressoTexto}>{obra.progresso}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: "hidden",
    ...shadows.padrao,
  },
  imagem: {
    width: "100%",
    height: 120,
    borderTopLeftRadius: bordas.cardObras,
    borderTopRightRadius: bordas.cardObras,
  },
  conteudo: {
    padding: 25,
  },
  linhaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  titulo: {
    flex: 1,
    fontFamily: fontes.negrito,
    fontSize: 18,
    color: cores.titulo,
    marginRight: 8,
  },
  badge: {
    backgroundColor: cores.azulPetroleo,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingVertical: 2,
    marginLeft: 15,
  },
  badgeTexto: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: "#FFFFFF",
  },
  info: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.rotulo,
    marginBottom: 12,
  },
  linhaProgresso: {
    flexDirection: "row",
    alignItems: "center",
  },
  barraFundo: {
    flex: 1,
    height: 8,
    backgroundColor: cores.fundoInput,
    borderRadius: 4,
    overflow: "hidden",
    marginRight: 10,
  },
  barraPreenchida: {
    height: "100%",
    borderRadius: 4,
  },
  progressoTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: 13,
    color: cores.titulo,
  },
});
