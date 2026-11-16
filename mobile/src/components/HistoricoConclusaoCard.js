import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { cores, fontes, moderateScale, shadows } from "../styles/theme";

/**
 * Card individual para exibição de uma prorrogação no histórico da obra.
 */
export default function HistoricoConclusaoCard({
  dataAnterior,
  dataConclusao,
  tempoAdicionado,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.faixaLateral} />
      <View style={styles.conteudo}>
        <View style={styles.linha}>
          <Text style={styles.rotulo}>Data anterior: </Text>
          <View style={styles.badgeAnterior}>
            <Text style={styles.textoBadgeAnterior}>{dataAnterior}</Text>
          </View>
        </View>

        <View style={[styles.linha, styles.margemLinha]}>
          <Text style={styles.rotulo}>Data de conclusão: </Text>
          <View style={styles.badgeConclusao}>
            <Text style={styles.textoBadgeConclusao}>{dataConclusao}</Text>
          </View>
        </View>

        <View style={[styles.linha, styles.margemLinha]}>
          <Text style={styles.rotulo}>Tempo adicionado: </Text>
          <Text style={styles.valorTempo}>{tempoAdicionado}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FBFAF8",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAE7E2",
    ...shadows.padrao,
  },
  faixaLateral: {
    width: 7,
    backgroundColor: cores.ciano,
  },
  conteudo: {
    flex: 1,
    padding: 14,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
  },
  margemLinha: {
    marginTop: 8,
  },
  rotulo: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13.5),
    color: cores.titulo,
  },
  badgeAnterior: {
    backgroundColor: "#D6F5EE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  textoBadgeAnterior: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13),
    color: cores.azulPetroleo,
  },
  badgeConclusao: {
    backgroundColor: "#9CF1DA",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  textoBadgeConclusao: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13),
    color: cores.azulPetroleo,
  },
  valorTempo: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13.5),
    color: cores.azulPetroleo,
  },
});
