const express = require("express");
const medicaoController = require("../controllers/medicaoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas as rotas de medição exigem autenticação do usuário
router.use(authMiddleware);

// Registra ou atualiza medição do período
router.post("/", medicaoController.registrar);

// Lista todas as medições de um ciclo
router.get("/ciclo/:ciclo_id", medicaoController.listarPorCiclo);

// Obtém dados do serviço e acumulados anteriores para medição no ciclo
router.get("/servico/:servico_id/ciclo/:ciclo_id", medicaoController.obterDadosParaMedicao);

module.exports = router;