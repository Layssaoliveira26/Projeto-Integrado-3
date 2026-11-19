const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const syncController = require("../controllers/syncController");

const router = express.Router();

// Todas as rotas de sincronização exigem autenticação JWT
router.use(authMiddleware);

router.post("/push", syncController.push);
router.get("/pull", syncController.pull);
router.post("/fotos/:id/arquivo", syncController.uploadArquivoFoto);
router.get("/fotos/:id/arquivo", syncController.baixarArquivoFoto);

module.exports = router;

