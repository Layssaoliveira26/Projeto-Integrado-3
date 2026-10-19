const express = require("express");
const estruturaController = require("../controllers/estruturaController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/:obra_id", estruturaController.obterEstruturaObra);

module.exports = router;