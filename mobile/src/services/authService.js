import api from "./api";
import {
  salvarToken,
  removerToken,
  salvarUsuarioLocal,
  removerUsuarioLocal,
} from "./storage";

// Realiza login no backend e armazena o token e perfil localmente
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

// Cadastra um novo usuário no backend e armazena o token e perfil localmente
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

// Busca os dados do usuário autenticado a partir do token
export const obterPerfil = async () => {
  return await api.get("/auth/me");
};

// Encerra a sessão removendo o token e perfil armazenados
export const logout = async () => {
  await removerToken();
  await removerUsuarioLocal();
};

export default {
  login,
  registrar,
  obterPerfil,
  logout,
};
