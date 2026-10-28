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
  rem,
  moderateScale,
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

      <View style={styles.badge}>
        <Text style={styles.badgeTexto}>Ciclo {obra.ciclo}</Text>
      </View>

      <View style={styles.conteudo}>
        <View style={styles.linhaTitulo}>
          <Text style={styles.titulo}>{obra.nome}</Text>
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
    position: "relative",
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(16),
    overflow: "hidden",
    ...shadows.padrao,
  },
  imagem: {
    width: "100%",
    height: moderateScale(135),
    borderTopLeftRadius: bordas.cardObras,
    borderTopRightRadius: bordas.cardObras,
  },
  conteudo: {
    padding: moderateScale(16),
    paddingTop: moderateScale(14),
  },
  linhaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: moderateScale(2),
  },
  titulo: {
    flex: 1,
    fontFamily: fontes.negrito,
    fontSize: rem(1.05),
    color: cores.titulo,
  },
  badge: {
    position: "absolute",
    top: moderateScale(14),
    right: moderateScale(14),
    zIndex: 1,
    backgroundColor: cores.azulPetroleo,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(3),
  },
  badgeTexto: {
    fontFamily: fontes.media,
    fontSize: rem(0.8),
    color: "#FFFFFF",
  },
  info: {
    fontFamily: fontes.regular,
    fontSize: rem(0.8),
    color: cores.rotulo,
    marginBottom: moderateScale(10),
  },
  linhaProgresso: {
    flexDirection: "row",
    alignItems: "center",
  },
  barraFundo: {
    flex: 1,
    height: moderateScale(8),
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(4),
    overflow: "hidden",
    marginRight: moderateScale(10),
  },
  barraPreenchida: {
    height: "100%",
    borderRadius: moderateScale(4),
  },
  progressoTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.8),
    color: cores.titulo,
  },
});

