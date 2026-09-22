import { Platform } from "react-native";
import Constants from "expo-constants";
import { obterToken } from "./storage";

// Define a URL base da API de acordo com o ambiente de execução
export const obterUrlBase = () => {
  // Variável de ambiente explícita
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // No celular físico via Expo Go, usa o IP da máquina na rede local
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:3000`;
    }
  }

  // Emulador Android nativo usa 10.0.2.2 para acessar o localhost do computador
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
};

export const API_URL = obterUrlBase();

// Envia requisições HTTP e anexa o token JWT automaticamente nas rotas protegidas
export const requisicao = async (endpoint, opcoes = {}) => {
  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(opcoes.headers || {}),
  };

  // Anexa o token JWT a menos que pularToken seja verdadeiro
  if (!opcoes.pularToken) {
    const token = await obterToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      headers,
    });

    const dados = await resposta.json().catch(() => ({}));

    // Trata erros retornados pela API (status diferente de 2xx)
    if (!resposta.ok) {
      const mensagemErro = dados.mensagem || dados.erro || dados.message || "Erro de comunicação com o servidor.";
      const erro = new Error(mensagemErro);
      erro.status = resposta.status;
      erro.dados = dados;
      throw erro;
    }

    return dados;
  } catch (error) {
    // Trata falha de rede ou servidor backend desligado
    if (!error.status) {
      const erroRede = new Error("Não foi possível conectar ao servidor. Verifique se a API está em execução.");
      erroRede.status = 0;
      throw erroRede;
    }
    throw error;
  }
};

export default {
  get: (endpoint, opcoes) => requisicao(endpoint, { ...opcoes, method: "GET" }),
  post: (endpoint, corpo, opcoes) =>
    requisicao(endpoint, {
      ...opcoes,
      method: "POST",
      body: JSON.stringify(corpo),
    }),
  put: (endpoint, corpo, opcoes) =>
    requisicao(endpoint, {
      ...opcoes,
      method: "PUT",
      body: JSON.stringify(corpo),
    }),
  delete: (endpoint, opcoes) => requisicao(endpoint, { ...opcoes, method: "DELETE" }),
};
