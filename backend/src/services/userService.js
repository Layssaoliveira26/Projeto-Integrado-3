// Camada de serviço responsável pelas operações e regras de negócio da entidade de usuários
const userRepository = require("../repositories/userRepository");
const { gerarHash } = require("../utils/passwordUtils");
const { criarErro } = require("../utils/errorUtils");

const padronizarEmail = (email) => (typeof email === "string" ? email.toLowerCase().trim() : "");
const padronizarNome = (nome) => (typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "");

const criarUsuario = async ({ nome, email, senha }) => {
  if (!nome || !email || !senha) {
    throw criarErro("Todos os campos (nome, email, senha) são obrigatórios", 400);
  }

  const nomePadronizado = padronizarNome(nome);
  if (nomePadronizado.length === 0) {
    throw criarErro("Nome inválido", 400);
  }

  const emailPadronizado = padronizarEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailPadronizado)) {
    throw criarErro("Formato de e-mail inválido", 400);
  }

  if (senha.length < 8) {
    throw criarErro("A senha deve conter no mínimo 8 caracteres", 400);
  }

  const usuarioExistente = await userRepository.buscarPorEmail(emailPadronizado);
  if (usuarioExistente) {
    throw criarErro("E-mail já cadastrado", 409);
  }

  const senhaHash = await gerarHash(senha);
  const novoUsuario = await userRepository.criar({
    nome: nomePadronizado,
    email: emailPadronizado,
    senhaHash,
  });

  const { senha_hash, ...usuarioPublico } = novoUsuario;

  return { ...usuarioPublico };
};

const obterPerfil = async (id) => {
  if (!id) {
    throw criarErro("ID do usuário é obrigatório", 400);
  }

  const usuario = await userRepository.buscarPorId(id);
  if (!usuario) {
    throw criarErro("Usuário não encontrado", 404);
  }

  const { senha_hash, ...usuarioPublico } = usuario;

  return { ...usuarioPublico };
};

module.exports = {
  criarUsuario,
  obterPerfil,
  padronizarEmail,
  padronizarNome,
};
