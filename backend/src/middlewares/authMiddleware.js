// Middleware responsável por interceptar requisições, validar o token JWT e injetar o usuário autenticado em req.user
const { verificarToken } = require("../utils/jwtUtils");
const { criarErro, tratarErro } = require("../utils/errorUtils");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw criarErro("Token de autenticação não fornecido", 401);
    }

    const [tipo, token] = authHeader.split(" ");
    if (tipo !== "Bearer" || !token) {
      throw criarErro("Formato de token inválido. Utilize o formato: Bearer <token>", 401);
    }

    const payload = verificarToken(token);
    req.user = {
      id: payload.id,
      email: payload.email,
    };

    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      error.statusCode = 401;
      error.message = "Token inválido ou expirado";
    }
    return tratarErro(res, error);
  }
};

module.exports = authMiddleware;
