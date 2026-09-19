import React from "react";
import { Text, StyleSheet } from "react-native";
import { cores, fontes } from "../styles/theme";

export default function Titulo({ children, style }) {
  return (
    <Text style={[styles.titulo, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: 28,
    color: cores.titulo,
    marginBottom: 32,
  },
});
