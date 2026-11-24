import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes, moderateScale, shadows } from "../styles/theme";
import { formatarDeltaPrazo } from "../utils/formatadores";

/**
 * Card individual para exibição de uma alteração de prazo no histórico da obra,
 * fiel ao componente `componente_dados_obra.svg` do Figma.
 */
export default function HistoricoConclusaoCard({
  dataAnterior,
  dataConclusao,
  diasAdicionados = 0,
  tempoAdicionado,
  dataRegistro,
  isMaisRecente = false,
}) {
  const diasNum = Number.isFinite(Number(diasAdicionados))
    ? Math.trunc(Number(diasAdicionados))
    : 0;
  const textoDias =
    diasNum !== 0
      ? formatarDeltaPrazo(diasNum)
      : tempoAdicionado || "0 dias";

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.faixaLateral,
          isMaisRecente && styles.faixaLateralRecente,
        ]}
      />
      <View style={styles.conteudo}>
        {/* Linha superior: pill de dias adicionados + relógio e data/hora */}
        <View style={styles.linhaTopo}>
          <View style={styles.pillDias}>
            <Text style={styles.textoPillDias}>{textoDias}</Text>
          </View>

          {Boolean(dataRegistro) && (
            <View style={styles.containerHorario}>
              <Feather
                name="clock"
                size={moderateScale(13.5)}
                color="#A8B4B1"
              />
              <Text style={styles.textoHorario}>{dataRegistro}</Text>
            </View>
          )}
        </View>

        {/* Linha inferior: dataAnterior → dataConclusao */}
        <View style={styles.linhaDatas}>
          <View
            style={[
              styles.badgeDataAnterior,
              isMaisRecente && styles.badgeDataAnteriorRecente,
            ]}
          >
            <Text style={styles.textoBadgeData}>{dataAnterior}</Text>
          </View>

          <Text style={styles.setaTransicao}>→</Text>

          <View
            style={[
              styles.badgeDataConclusao,
              isMaisRecente && styles.badgeDataConclusaoRecente,
            ]}
          >
            <Text style={styles.textoBadgeData}>{dataConclusao}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: cores.fundoCard,
    borderRadius: 15,
    minHeight: 96,
    overflow: "hidden",
    marginBottom: 14,
    ...shadows.padrao,
  },
  faixaLateral: {
    width: 12,
    backgroundColor: cores.ciano,
  },
  faixaLateralRecente: {
    backgroundColor: cores.verdeAgua,
  },
  conteudo: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  linhaTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pillDias: {
    backgroundColor: "#E0EAE7",
    borderRadius: 10,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  textoPillDias: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(13),
    color: cores.azulPetroleo,
    fontVariant: ["tabular-nums"],
  },
  containerHorario: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  textoHorario: {
    fontFamily: fontes.regular,
    fontSize: moderateScale(11.5),
    color: "#A8B4B1",
    fontVariant: ["tabular-nums"],
  },
  linhaDatas: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 10,
  },
  badgeDataAnterior: {
    backgroundColor: "#D2EFEA",
    borderRadius: 10,
    minHeight: 26,
    paddingHorizontal: 11,
    paddingVertical: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDataAnteriorRecente: {
    backgroundColor: "rgba(70, 223, 179, 0.2)",
  },
  setaTransicao: {
    fontFamily: fontes.media,
    fontSize: moderateScale(14),
    color: cores.azulPetroleo,
  },
  badgeDataConclusao: {
    backgroundColor: "#7FE2DB",
    borderRadius: 10,
    minHeight: 26,
    paddingHorizontal: 11,
    paddingVertical: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDataConclusaoRecente: {
    backgroundColor: "rgba(70, 223, 179, 0.5)",
  },
  textoBadgeData: {
    fontFamily: fontes.media,
    fontSize: moderateScale(12.5),
    color: cores.azulPetroleo,
    fontVariant: ["tabular-nums"],
  },
});
