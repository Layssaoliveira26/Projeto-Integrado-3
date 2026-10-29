const test = require("node:test");
const assert = require("node:assert/strict");

const {
  construirUrlDownloadPlanilhaFinal,
  COLUNAS_PLANILHA_FINAL,
} = require("../src/utils/planilhaFinalUtils");

test("construirUrlDownloadPlanilhaFinal monta a URL com token e cicloId corretamente", () => {
  const urlComTokenECiclo = construirUrlDownloadPlanilhaFinal(
    "http://localhost:3000",
    "123",
    "45",
    "meu-jwt-token"
  );
  assert.ok(urlComTokenECiclo.includes("/obras/123/planilha-final/download"));
  assert.ok(urlComTokenECiclo.includes("token=meu-jwt-token"));
  assert.ok(urlComTokenECiclo.includes("cicloId=45"));

  const urlSemCiclo = construirUrlDownloadPlanilhaFinal(
    "http://localhost:3000",
    "99",
    null,
    "token-abc"
  );
  assert.ok(urlSemCiclo.includes("/obras/99/planilha-final/download"));
  assert.ok(urlSemCiclo.includes("token=token-abc"));
  assert.ok(!urlSemCiclo.includes("cicloId"));

  const urlSemParametros = construirUrlDownloadPlanilhaFinal(
    "http://localhost:3000",
    "77"
  );
  assert.equal(
    urlSemParametros,
    "http://localhost:3000/obras/77/planilha-final/download"
  );
});

test("Validação do contrato das 17 colunas da planilha final de medição (US22)", () => {
  assert.equal(COLUNAS_PLANILHA_FINAL.length, 17);
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("ITEM"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("CÓDIGO"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("DESCRIÇÃO"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("FONTE"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("UND"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("QTD ORÇADA"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("UNITÁRIO (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("TOTAL ORÇADO (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("QTD ANTERIOR"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("VALOR ANTERIOR (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("QTD PERÍODO"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("VALOR PERÍODO (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("QTD ACUMULADA"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("VALOR ACUMULADO (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("SALDO QTD"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("SALDO VALOR (R$)"));
  assert.ok(COLUNAS_PLANILHA_FINAL.includes("% EXECUÇÃO"));
});
