const express = require("express");
const medicaoController = require("../controllers/medicaoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, medicaoController.registrar);

module.exports = router;