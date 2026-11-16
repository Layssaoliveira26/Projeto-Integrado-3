import api from "./api";
import { salvarToken, removerToken } from "./storage";

export const login = async ({ email, senha }) => {
  const resposta = await api.post("/auth/login", { email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }

  return resposta;
};

export const registrar = async ({ nome, email, senha }) => {
  const resposta = await api.post("/auth/register", { nome, email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }

  return resposta;
};

export const obterPerfil = async () => {
  return await api.get("/auth/me");
};

export const atualizarPerfilRemoto = async (dados) => {
  const resposta = await api.put("/auth/perfil", dados);

  if (resposta.token) {
    await salvarToken(resposta.token);
  }

  return resposta;
};

export const logout = async () => {
  await removerToken();
};

export default {
  login,
  registrar,
  obterPerfil,
  atualizarPerfilRemoto,
  logout,
};