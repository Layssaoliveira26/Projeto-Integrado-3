import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Home, Layers, Image as ImageIcon, Plus } from "lucide-react-native";

import {
  cores,
  fontes,
  shadows,
  gradianteDistribuicaoDownload,
  rem,
  moderateScale,
} from "../styles/theme";

// Abas da barra. "rota" é o nome da tela registrada no AppNavigator.
const ABAS = [
  { chave: "Obras", rota: "Home", Icone: Home },
  { chave: "Ciclos", rota: "Ciclos", Icone: Layers },
  { chave: "Fotos", rota: "Fotos", Icone: ImageIcon },
];

export default function NavBar({ abaAtiva = "Obras" }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handlePressAba = (aba) => {
    if (aba.chave === abaAtiva) return;

    // Ciclos e Fotos ainda não têm tela registrada. Só navega se a rota
    // existir, evitando erro de "rota não encontrada" até serem criadas.
    const rotasRegistradas = navigation.getState()?.routeNames || [];
    if (rotasRegistradas.includes(aba.rota)) {
      navigation.navigate(aba.rota);
    }
  };

  const handlePressNovaObra = () => {
    navigation.navigate("NovaObra");
  };

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
            const cor = ativa ? cores.verdeAgua : cores.azulPetroleo;
            const Icone = aba.Icone;

            return (
              <TouchableOpacity
                key={aba.chave}
                style={styles.aba}
                onPress={() => handlePressAba(aba)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={aba.chave}
                accessibilityState={{ selected: ativa }}
              >
                <Icone
                  color={cor}
                  size={moderateScale(24)}
                  strokeWidth={2.2}
                />
                <Text style={[styles.abaTexto, { color: cor }]}>
                  {aba.chave}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Botão flutuante "+" sobreposto à barra */}
      <TouchableOpacity
        style={styles.fabWrapper}
        onPress={handlePressNovaObra}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar nova obra"
      >
        <LinearGradient
          colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
          locations={gradianteDistribuicaoDownload}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fab}
        >
          <Plus
            color="rgba(255, 255, 255, 0.95)"
            size={moderateScale(34)}
            strokeWidth={3}
          />
        </LinearGradient>
      </TouchableOpacity>
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
    backgroundColor: cores.fundoCard,
    borderTopLeftRadius: moderateScale(32),
    borderTopRightRadius: moderateScale(32),
    paddingTop: moderateScale(14),
    paddingLeft: moderateScale(16),
    paddingRight: moderateScale(96),
    ...shadows.padrao,
    shadowOffset: { width: 0, height: -2 },
  },
  abas: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  aba: {
    alignItems: "center",
    minWidth: moderateScale(54),
  },
  abaTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.75),
    marginTop: moderateScale(4),
  },
  fabWrapper: {
    position: "absolute",
    right: moderateScale(20),
    top: -moderateScale(22),
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(34),
    ...shadows.padrao,
  },
  fab: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(34),
    justifyContent: "center",
    alignItems: "center",
  },
});

