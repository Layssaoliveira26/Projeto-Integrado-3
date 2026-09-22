import React from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradienteCores } from "../styles/theme";

export default function Logo({
  tamanho = 105,
  raio = 18,
  style,
  accessibilityLabel = "Logo da aplicação",
}) {
  return (
    <LinearGradient
      colors={gradienteCores}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.quadrado,
        { width: tamanho, height: tamanho, borderRadius: raio },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  quadrado: {
    marginBottom: 24,
  },
});
