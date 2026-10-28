import React, { useId } from "react";
import { Defs, LinearGradient, Stop } from "react-native-svg";
import { AlertTriangle } from "lucide-react-native";
import {
  gradienteCores,
  gradienteDistribuicaoCompleta,
} from "../styles/theme";

export default function AlertTriangleGradient() {
  const gradientId = `alertTriangle${useId().replace(/:/g, "")}`;

  return (
    <AlertTriangle
      color={`url(#${gradientId})`}
      size={46}
      strokeWidth={2.2}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          {gradienteCores.map((color, index) => (
            <Stop
              key={`${color}-${index}`}
              offset={`${gradienteDistribuicaoCompleta[index] * 100}%`}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
    </AlertTriangle>
  );
}
