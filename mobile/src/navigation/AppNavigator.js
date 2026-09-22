import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/Login";
import RegisterScreen from "../screens/Register";
import HomeScreen from "../screens/Home";
import { cores } from "../styles/theme";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { autenticado, carregando } = useAuth();

  // Exibe indicador de carregamento enquanto restaura a sessão do SecureStore
  if (carregando) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator size="large" color={cores.azulPetroleo} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {autenticado ? (
          // Rotas privadas (usuário logado)
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "Obras" }}
          />
        ) : (
          // Rotas públicas de autenticação
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  carregando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: cores.fundoCard,
  },
});
