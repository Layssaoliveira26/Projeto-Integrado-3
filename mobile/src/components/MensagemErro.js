import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { cores, fontes } from "../styles/theme";

export default function MensagemErro({ mensagem, style }) {
  return (
    <View style={[styles.container, style]} accessibilityLiveRegion="polite">
      {!!mensagem && (
        <Text
          style={styles.texto}
          accessibilityRole="alert"
          selectable={false}
        >
          {mensagem}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minHeight: 22,
    marginTop: 10,
    marginBottom: 28,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  texto: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.erro,
    textAlign: "right",
    userSelect: "none",
  },
});
