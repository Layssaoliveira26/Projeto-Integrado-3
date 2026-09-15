const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10; // é o número que será elevado para o embaraçamento que adicionará a criptografia


async function gerarHash(senha) {
  return await bcrypt.hash(senha, SALT_ROUNDS);
}


async function compararSenha(senha, hash) {
  return await bcrypt.compare(senha, hash);
}

module.exports = {
  gerarHash,
  compararSenha,
};
