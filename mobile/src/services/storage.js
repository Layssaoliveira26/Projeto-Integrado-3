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

// Recupera o token JWT para restaurar a sessão do usuário
export const obterToken = async () => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(CHAVE_TOKEN);
      }
      return null;
    }
    return await SecureStore.getItemAsync(CHAVE_TOKEN);
  } catch (error) {
    console.error("Erro ao obter token do armazenamento:", error);
    return null;
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
