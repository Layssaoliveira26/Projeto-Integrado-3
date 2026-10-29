import React from "react";
import { View, StyleSheet } from "react-native";
import { cores, bordas, shadows, useResponsiveLayout } from "../styles/theme";

export default function CardAutenticacao({ children, style }) {
  const { isTablet, isSmallDevice } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.card,
        isTablet && styles.cardTablet,
        isSmallDevice && styles.cardSmall,
        style,
      ]}
    >
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
    paddingTop: 40,
    paddingBottom: 36,
    alignItems: "center",
    ...shadows.padrao,
  },
  cardTablet: {
    maxWidth: 480,
    paddingHorizontal: 44,
    paddingTop: 48,
    paddingBottom: 44,
    borderRadius: 44,
  },
  cardSmall: {
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 28,
    borderRadius: 30,
  },
});

