import api from "./api";
import {
  salvarToken,
  removerToken,
  salvarUsuarioLocal,
  removerUsuarioLocal,
} from "./storage";

export const login = async ({ email, senha }) => {
  const resposta = await api.post("/auth/login", { email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }
  if (resposta.usuario) {
    await salvarUsuarioLocal(resposta.usuario);
  }

  return resposta;
};

export const registrar = async ({ nome, email, senha }) => {
  const resposta = await api.post("/auth/register", { nome, email, senha }, { pularToken: true });

  if (resposta.token) {
    await salvarToken(resposta.token);
  }
  if (resposta.usuario) {
    await salvarUsuarioLocal(resposta.usuario);
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
  await removerUsuarioLocal();
};

export default {
  login,
  registrar,
  obterPerfil,
  atualizarPerfilRemoto,
  logout,
};