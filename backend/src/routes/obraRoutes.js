const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const obraController = require("../controllers/obraController");
const planilhaController = require("../controllers/planilhaController");

router.use(authMiddleware);

router.post("/", obraController.criar);
router.get("/", obraController.listar);
router.get("/:id", obraController.obterPorId);
router.put("/:id", obraController.atualizar);
router.delete("/:id", obraController.deletar);

// Rota específica para arquivar
router.patch("/:id/arquivar", obraController.arquivar);

// Rotas da planilha-base orçamentária da obra (US08)
router.post("/:id/planilha-base", planilhaController.importar);
router.get("/:id/planilha-base", planilhaController.obter);

module.exports = router;
