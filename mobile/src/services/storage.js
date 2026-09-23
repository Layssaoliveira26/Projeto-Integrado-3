import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHAVE_TOKEN = "metria_auth_token";

// Salva o token JWT de forma segura (SecureStore no celular, localStorage na web)
export const salvarToken = async (token) => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CHAVE_TOKEN, token);
      }
    } else {
      await SecureStore.setItemAsync(CHAVE_TOKEN, token);
    }
  } catch (error) {
    console.error("Erro ao salvar token no armazenamento:", error);
  }
};

export const obterToken = async () => {
  try {
    let token = null;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        token = window.localStorage.getItem(CHAVE_TOKEN);
      }
    } else {
      token = await SecureStore.getItemAsync(CHAVE_TOKEN);
    }
    if (token) return token.trim();
    const devToken = process.env.EXPO_PUBLIC_DEV_TOKEN;
    return devToken && typeof devToken === "string" ? devToken.trim() : null;
  } catch (error) {
    console.error("Erro ao obter token do armazenamento:", error);
    const devToken = process.env.EXPO_PUBLIC_DEV_TOKEN;
    return devToken && typeof devToken === "string" ? devToken.trim() : null;
  }
};

// Remove o token JWT ao deslogar
export const removerToken = async () => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(CHAVE_TOKEN);
      }
    } else {
      await SecureStore.deleteItemAsync(CHAVE_TOKEN);
    }
  } catch (error) {
    console.error("Erro ao remover token do armazenamento:", error);
  }
};

export default {
  salvarToken,
  obterToken,
  removerToken,
};
