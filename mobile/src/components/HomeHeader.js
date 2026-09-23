import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import {
  cores,
  bordas,
  fontes,
  shadows,
  gradienteCores,
  gardianteDistribuicaoHeader,
  gradienteDistribuicaoCompleta,
} from "../styles/theme";

export default function HomeHeader({ onLogout }) {
  return (
    <LinearGradient
      colors={[cores.azulPetroleo, cores.azulEsverdeado]}
      locations={gardianteDistribuicaoHeader}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.marca}>
        <LinearGradient
          colors={gradienteCores}
          locations={gradienteDistribuicaoCompleta}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.logoBolinha}
        />
        <Text style={styles.logo}>Metria</Text>
      </View>

      <View style={styles.areaAcoes}>
        {onLogout ? (
          <TouchableOpacity
            style={styles.botaoLogout}
            onPress={onLogout}
            activeOpacity={0.8}
            accessibilityLabel="Sair da conta"
          >
            <Ionicons
              name="log-out-outline"
              size={32}
              color="#FFFFFF"
              style={{ fontWeight: "850" }}
            />
          </TouchableOpacity>
        ) : null}

        <Image
          source={require("../utils/img/avatar.png")}
          style={styles.avatar}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: bordas.header,
    borderBottomRightRadius: bordas.header,
    ...shadows.padrao,
  },
  marca: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBolinha: {
    width: 30,
    height: 30,
    borderRadius: 30,
    marginRight: 10,
  },
  logo: {
    fontFamily: fontes.semiNegrito,
    fontSize: 20,
    color: "#FFFFFF",
    paddingTop: 5,
  },
  areaAcoes: {
    flexDirection: "row",
    alignItems: "center",
  },
  botaoLogout: {
    width: 32,
    height: 32,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
