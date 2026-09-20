const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const obraController = require("../controllers/obraController");

router.use(authMiddleware);

router.post("/", obraController.criar);
router.get("/", obraController.listar);
router.put("/:id", obraController.atualizar);
router.delete("/:id", obraController.deletar);

// Rota específica para arquivar
router.patch("/:id/arquivar", obraController.arquivar);

module.exports = router;
