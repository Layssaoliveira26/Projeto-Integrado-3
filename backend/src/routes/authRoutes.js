// Definição das rotas HTTP para o módulo de autenticação de usuários
const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authController.registrar);
router.post("/login", authController.login);

module.exports = router;
