import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Layers, Image as ImageIcon } from "lucide-react-native";

import { fontes, shadows, moderateScale, rem } from "../styles/theme";

const NAVBAR_CORES = {
  ativa: "#40DEB5",
  inativa: "#0D6579",
  fundo: "#FFFFFF",
};

const ABAS_ACOMPANHAMENTO = [
  { chave: "Etapas", label: "Etapas", Icone: Home },
  { chave: "Ciclos", label: "Ciclos", Icone: Layers },
  { chave: "Fotos", label: "Fotos", Icone: ImageIcon },
];

export default function NavBarAcompanhamento({
  abaAtiva = "Etapas",
  onChangeAba = () => {},
  aboveBar = null,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {aboveBar && <View style={styles.aboveBar}>{aboveBar}</View>}
      <View
        style={[
          styles.barra,
          { paddingBottom: Math.max(insets.bottom, moderateScale(10)) },
        ]}
      >
        {ABAS_ACOMPANHAMENTO.map((aba) => {
          const ativa = abaAtiva === aba.chave;
          const cor = ativa ? NAVBAR_CORES.ativa : NAVBAR_CORES.inativa;
          const Icone = aba.Icone;

          return (
            <TouchableOpacity
              key={aba.chave}
              style={styles.abaItem}
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
              <Text style={[styles.abaTexto, { color: cor }]}>{aba.label}</Text>
            </TouchableOpacity>
          );
        })}
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
    backgroundColor: "transparent",
    zIndex: 99,
  },
  aboveBar: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(10),
  },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    backgroundColor: NAVBAR_CORES.fundo,
    opacity: 0.95,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    paddingTop: moderateScale(14),
    ...shadows.padrao,
  },
  abaItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  abaTexto: {
    fontSize: rem(0.75),
    fontFamily: fontes.semiNegrito,
    marginTop: moderateScale(4),
  },
});
