const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const syncController = require("../controllers/syncController");

const router = express.Router();

// Todas as rotas de sincronização exigem autenticação JWT (RNF09)
router.use(authMiddleware);

router.post("/push", syncController.push);
router.get("/pull", syncController.pull);

module.exports = router;
