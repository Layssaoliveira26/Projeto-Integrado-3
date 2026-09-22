import React from "react";
import { View, StyleSheet } from "react-native";
import { cores, bordas, shadows } from "../styles/theme";

export default function CardAutenticacao({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardAutenticacao,
    paddingHorizontal: 32,
    paddingTop: 44,
    paddingBottom: 40,
    alignItems: "center",
    ...shadows.padrao,
  },
});
