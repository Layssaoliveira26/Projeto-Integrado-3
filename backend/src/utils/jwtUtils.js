const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;


function gerarToken(payload) {
  return jwt.sign(payload, JWT_SECRET);
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  gerarToken,
  verificarToken,
};
