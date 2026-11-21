const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("api.js consome diretamente GET, POST, PUT, PATCH e DELETE de obras com fallback Offline-First", () => {
  const apiContent = fs.readFileSync(
    path.join(__dirname, "../src/services/api.js"),
    "utf-8"
  );

  // Verbos HTTP exigidos pela Etapa 2 (GET, POST, PUT, PATCH e DELETE)
  assert.match(apiContent, /method:\s*"GET"/, "Deve expor requisições GET");
  assert.match(apiContent, /method:\s*"POST"/, "Deve expor requisições POST");
  assert.match(apiContent, /method:\s*"PUT"/, "Deve expor requisições PUT");
  assert.match(apiContent, /method:\s*"PATCH"/, "Deve expor requisições PATCH");
  assert.match(apiContent, /method:\s*"DELETE"/, "Deve expor requisições DELETE");

  // Chamadas REST diretas sobre o recurso /obras quando online
  assert.ok(
    apiContent.includes('requisicao("/obras"') &&
      apiContent.includes('method: "POST"'),
    "criarObra deve enviar POST /obras diretamente quando online"
  );
  assert.ok(
    apiContent.includes("requisicao(`/obras/${id}`") &&
      apiContent.includes('method: "PUT"'),
    "atualizarObra deve enviar PUT /obras/:id diretamente quando online"
  );
  assert.ok(
    apiContent.includes("requisicao(`/obras/${id}/arquivar`") &&
      apiContent.includes("requisicao(`/obras/${id}/desarquivar`") &&
      apiContent.includes("requisicao(`/obras/${id}/encerrar`"),
    "mudanças de status devem enviar PATCH /obras/:id/(arquivar|desarquivar|encerrar)"
  );
  assert.ok(
    apiContent.includes('requisicao(`/obras/${id}`, { method: "DELETE" })'),
    "deletarObra deve enviar DELETE /obras/:id diretamente quando online"
  );

  // Preservação do fallback Offline-First para a fila local
  assert.ok(
    apiContent.includes("enfileirarMutacaoObraFallback"),
    "Deve enfileirar mutação localmente caso a chamada REST falhe por falta de rede"
  );
});

test("README.md existe na raiz com a estrutura e ordem exigidas pela disciplina", () => {
  const readmePath = path.join(__dirname, "../../README.md");
  assert.ok(fs.existsSync(readmePath), "README.md em maiúsculo deve existir na raiz");

  const conteudo = fs.readFileSync(readmePath, "utf-8");
  const secoesObrigatorias = [
    "## Identificação da Equipe",
    "### Descrição do projeto",
    "### API REST",
    "### Aplicação mobile",
    "### Organização Git",
  ];

  let ultimaPosicao = -1;
  for (const secao of secoesObrigatorias) {
    const idx = conteudo.indexOf(secao);
    assert.ok(idx !== -1, `Seção obrigatória ausente no README.md: ${secao}`);
    assert.ok(
      idx > ultimaPosicao,
      `Seção fora da ordem exigida pelo modelo: ${secao}`
    );
    ultimaPosicao = idx;
  }
});
