require("dotenv").config();
const express = require("express");
const cors = require("cors");

// const authRoutes = require("./routes/authRoutes");
// const syncRoutes = require("./routes/syncRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});