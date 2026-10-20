import React, { useId } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import theme from "../styles/theme";

export default function CircleGradientProgress({
  percentage = 0,
  size = 46,
  strokeWidth = 4,
}) {
  const gradientId = useId().replace(/:/g, "");
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Number.isFinite(percentage)
    ? Math.min(Math.max(percentage, 0), 100)
    : 0;
  const strokeDashoffset =
    circumference - (circumference * safePercentage) / 100;

  const numDigits = String(Math.round(safePercentage)).length;
  const fontSize =
    numDigits >= 3
      ? Math.round(size * 0.23)
      : Math.round(size * 0.265);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {theme.gradienteCores.map((cor, index) => (
              <Stop
                key={`${cor}-${index}`}
                offset={`${theme.gradienteDistribuicaoCompleta[index] * 100}%`}
                stopColor={cor}
              />
            ))}
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#EDEAE5"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Text style={[styles.percentage, { fontSize }]} numberOfLines={1}>
        {Math.round(safePercentage)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
    transform: [{ rotate: "-90deg" }],
  },
  percentage: {
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulEscuro,
    textAlign: "center",
    includeFontPadding: false,
  },
});
