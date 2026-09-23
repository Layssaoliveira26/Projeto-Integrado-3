import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { cores, fontes } from "../styles/theme";

export default function RodapeAutenticacao({
  texto,
  textoLink,
  onPress,
  accessibilityHint,
  style,
}) {
  return (
    <View style={[styles.rodape, style]}>
      <Text style={styles.texto}>{texto} </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="link"
        accessibilityLabel={textoLink}
        accessibilityHint={accessibilityHint}
      >
        <Text style={styles.link}>{textoLink}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rodape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  texto: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.textoEscuro,
  },
  link: {
    fontFamily: fontes.negrito,
    fontSize: 13,
    color: cores.textoEscuro,
  },
});
