import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { cores, fontes, moderateScale } from "../styles/theme";

/**
 * Componente padronizado para exibição de campos de leitura de dados da obra.
 */
export default function CampoDadosObra({
  rotulo,
  valor,
  containerStyle,
  caixaStyle,
  numberOfLines = 2,
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      {Boolean(rotulo) && <Text style={styles.rotulo}>{rotulo}</Text>}
      <View style={[styles.caixaCampo, caixaStyle]}>
        <Text style={styles.textoCampo} numberOfLines={numberOfLines}>
          {valor || "Não informado"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  rotulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(14),
    color: cores.titulo,
    marginTop: 14,
    marginBottom: 8,
  },
  caixaCampo: {
    backgroundColor: "#E6E5E0",
    borderRadius: 15,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textoCampo: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    color: cores.rotulo,
  },
});
