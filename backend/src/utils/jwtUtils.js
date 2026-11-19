const jwt = require("jsonwebtoken");

function obterSegredoJwt() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("Configuração JWT_SECRET ausente no servidor.");
    err.statusCode = 500;
    throw err;
  }
  return secret;
}

function gerarToken(payload) {
  return jwt.sign(payload, obterSegredoJwt(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function verificarToken(token) {
  return jwt.verify(token, obterSegredoJwt());
}

module.exports = {
  gerarToken,
  verificarToken,
};
