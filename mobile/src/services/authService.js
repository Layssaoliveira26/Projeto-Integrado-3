import api from "./api";
import { salvarToken, removerToken } from "./storage";

// Realiza login no backend e armazena o token recebido
export const login = async ({ email, senha }) => {
  const resposta = await api.post("/auth/login", { email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }

  return resposta;
};

// Cadastra um novo usuário no backend e armazena o token
export const registrar = async ({ nome, email, senha }) => {
  const resposta = await api.post("/auth/register", { nome, email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }

  return resposta;
};

// Busca os dados do usuário autenticado a partir do token
export const obterPerfil = async () => {
  return await api.get("/auth/me");
};

// Encerra a sessão removendo o token armazenado
export const logout = async () => {
  await removerToken();
};

export default {
  login,
  registrar,
  obterPerfil,
  logout,
};
