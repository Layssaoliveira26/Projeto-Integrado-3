const express = require("express");
const estruturaController = require("../controllers/estruturaController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/:obra_id", authMiddleware, estruturaController.obterEstruturaObra);

module.exports = router;