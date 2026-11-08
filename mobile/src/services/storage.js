import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHAVE_TOKEN = "metria_auth_token";
const CHAVE_USUARIO = "metria_auth_usuario";

const salvarItemSeguro = async (chave, valor) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(chave, valor);
    }
  } else {
    await SecureStore.setItemAsync(chave, valor);
  }
};

const obterItemSeguro = async (chave) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(chave);
    }
    return null;
  }
  return await SecureStore.getItemAsync(chave);
};

const removerItemSeguro = async (chave) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(chave);
    }
  } else {
    await SecureStore.deleteItemAsync(chave);
  }
};

// Salva o token JWT de forma segura (SecureStore no celular, localStorage na web)
export const salvarToken = async (token) => {
  try {
    await salvarItemSeguro(CHAVE_TOKEN, token);
  } catch (error) {
    console.error("Erro ao salvar token no armazenamento:", error);
  }
};

export const obterToken = async () => {
  try {
    const token = await obterItemSeguro(CHAVE_TOKEN);
    return token ? token.trim() : null;
  } catch (error) {
    console.error("Erro ao obter token do armazenamento:", error);
    return null;
  }
};

// Remove o token JWT ao deslogar
export const removerToken = async () => {
  try {
    await removerItemSeguro(CHAVE_TOKEN);
  } catch (error) {
    console.error("Erro ao remover token do armazenamento:", error);
  }
};

// Salva os dados básicos do usuário autenticado para permitir abertura do app offline
export const salvarUsuarioLocal = async (usuario) => {
  try {
    if (!usuario || !usuario.id) return;
    const dadosMinimos = {
      id: usuario.id,
      nome: usuario.nome || "",
      email: usuario.email || "",
    };
    await salvarItemSeguro(CHAVE_USUARIO, JSON.stringify(dadosMinimos));
  } catch (error) {
    console.error("Erro ao salvar usuário no armazenamento local:", error);
  }
};

export const obterUsuarioLocal = async () => {
  try {
    const raw = await obterItemSeguro(CHAVE_USUARIO);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.id ? parsed : null;
  } catch (error) {
    console.error("Erro ao obter usuário do armazenamento local:", error);
    return null;
  }
};

export const removerUsuarioLocal = async () => {
  try {
    await removerItemSeguro(CHAVE_USUARIO);
  } catch (error) {
    console.error("Erro ao remover usuário do armazenamento local:", error);
  }
};

export default {
  salvarToken,
  obterToken,
  removerToken,
  salvarUsuarioLocal,
  obterUsuarioLocal,
  removerUsuarioLocal,
};
