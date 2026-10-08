const express = require("express");
const router = express.Router();
const cicloController = require("../controllers/cicloController");

router.get("/obra/:obra_id", cicloController.listarPorObra);
router.get("/:id/detalhes", cicloController.obterDetalhes);
router.post("/:id/encerrar", cicloController.encerrar);

module.exports = router;