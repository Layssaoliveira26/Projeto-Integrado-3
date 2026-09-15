// Definição das rotas HTTP para o módulo de autenticação de usuários
const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", authController.registrar);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.perfil);

module.exports = router;
