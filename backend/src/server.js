require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const obraRoutes = require("./routes/obraRoutes");
const syncRoutes = require("./routes/syncRoutes");
const estruturaRoutes = require("./routes/estruturaRoutes");
const medicaoRoutes = require("./routes/medicaoRoutes");
const cicloRoutes = require("./routes/cicloRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const path = require("path");
const fs = require("fs");

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rota pública para download do modelo padrão de planilha orçamentária
app.get(
  ["/obras/modelo-planilha", "/obras/modelo-planilha/planilha_metria.xlsx", "/obras/modelo-planilha/planilha_padrao.xlsx", "/planilha-padrao", "/planilha_metria.xlsx", "/planilha_padrao.xlsx"],
  (req, res) => {
    let caminhoArquivo = path.resolve(__dirname, "../assets/planilha_metria.xlsx");
    if (!fs.existsSync(caminhoArquivo)) {
      caminhoArquivo = path.resolve(__dirname, "../../mobile/assets/planilha_metria.xlsx");
    }
    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).json({ mensagem: "Modelo de planilha não encontrado." });
    }
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.download(caminhoArquivo, "planilha_metria.xlsx");
  }
);

app.use("/auth", authRoutes);
app.use("/sync", syncRoutes);
app.use("/obras/estrutura", estruturaRoutes);
app.use("/medicoes", medicaoRoutes);
app.use("/obras", obraRoutes);
app.use("/ciclos", cicloRoutes);

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ erro: "JSON malformado.", mensagem: "JSON malformado." });
  }
  return next(err);
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;