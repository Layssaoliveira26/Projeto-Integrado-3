const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", authController.registrar);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.perfil);
router.put("/perfil", authMiddleware, authController.atualizarPerfil);

module.exports = router;