const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const obraController = require("../controllers/obraController");

// Todas as rotas de Obras precisam que o usuário esteja autenticado
router.use(authMiddleware);

// Rotas CRUD
router.post("/", obraController.criar);
router.get("/", obraController.listar);
router.put("/:id", obraController.atualizar);
router.delete("/:id", obraController.deletar);

// Rota específica para arquivar
router.patch("/:id/arquivar", obraController.arquivar);

module.exports = router;
