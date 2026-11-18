import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, SquareCheck, Archive } from "lucide-react-native";

import { fontes, shadows, rem, moderateScale } from "../styles/theme";

const ABAS = [
  { chave: "Obras", label: "Obras", Icone: Home },
  { chave: "Concluidas", label: "Concluídas", Icone: SquareCheck },
  { chave: "Arquivadas", label: "Arquivadas", Icone: Archive },
];

const NAVBAR_CORES = {
  ativa: "#40DEB5",
  inativa: "#0D6579",
  fundo: "#FFFFFF",
};

export default function NavBar({ abaAtiva = "Obras", onChangeAba = () => {} }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[
          styles.barra,
          { paddingBottom: Math.max(insets.bottom, moderateScale(10)) },
        ]}
      >
        <View style={styles.abas}>
          {ABAS.map((aba) => {
            const ativa = aba.chave === abaAtiva;
            const cor = ativa ? NAVBAR_CORES.ativa : NAVBAR_CORES.inativa;
            const Icone = aba.Icone;

            return (
              <TouchableOpacity
                key={aba.chave}
                style={styles.aba}
                onPress={() => onChangeAba(aba.chave)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityLabel={aba.label}
                accessibilityState={{ selected: ativa }}
              >
                <Icone
                  color={cor}
                  size={moderateScale(25)}
                  strokeWidth={ativa ? 2.3 : 2}
                />
                <Text style={[styles.abaTexto, { color: cor }]}>
                  {aba.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  barra: {
    backgroundColor: NAVBAR_CORES.fundo,
    opacity: 0.95,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    paddingTop: moderateScale(14),
    ...shadows.padrao,
  },
  abas: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  aba: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  abaTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.75),
    marginTop: moderateScale(4),
  },
});
