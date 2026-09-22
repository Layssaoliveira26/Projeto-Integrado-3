import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { cores, bordas, dimensoes, fontes } from "../styles/theme";

export default function Botao({
  titulo,
  onPress,
  carregando = false,
  desabilitado = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.botao,
        (desabilitado || carregando) && styles.desabilitado,
        style,
      ]}
      onPress={onPress}
      disabled={desabilitado || carregando}
      activeOpacity={0.85}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || titulo}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: desabilitado || carregando,
        busy: carregando,
      }}
    >
      {carregando ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.texto}>{titulo}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.principal,
    borderRadius: bordas.input,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  desabilitado: {
    opacity: 0.6,
  },
  texto: {
    fontFamily: fontes.semiNegrito,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
