// Camada de serviço responsável pela autenticação de credenciais e emissão de tokens de acesso
const userRepository = require("../repositories/userRepository");
const userService = require("./userService");
const { compararSenha } = require("../utils/passwordUtils");
const { gerarToken } = require("../utils/jwtUtils");
const { criarErro } = require("../utils/errorUtils");

const registrar = async ({ nome, email, senha }) => {
  const usuario = await userService.criarUsuario({ nome, email, senha });

  const token = gerarToken({
    id: usuario.id,
    email: usuario.email,
  });

  return {
    token,
    usuario,
  };
};

const login = async ({ email, senha }) => {
  if (!email || !senha) {
    throw criarErro("E-mail e senha são obrigatórios", 400);
  }

  const emailPadronizado = userService.padronizarEmail(email);
  const usuario = await userRepository.buscarPorEmail(emailPadronizado);
  if (!usuario) {
    throw criarErro("Credenciais inválidas", 401);
  }

  const senhaValida = await compararSenha(senha, usuario.senha_hash);
  if (!senhaValida) {
    throw criarErro("Credenciais inválidas", 401);
  }

  const token = gerarToken({
    id: usuario.id,
    email: usuario.email,
  });

  const { senha_hash, ...usuarioPublico } = usuario;

  return {
    token,
    usuario: { ...usuarioPublico },
  };
};

module.exports = {
  registrar,
  login,
};
