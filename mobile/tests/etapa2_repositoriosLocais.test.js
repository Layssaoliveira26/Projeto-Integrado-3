const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Etapa 2 - calculoMedicaoLocal realiza cálculos exatos de medição sem dependências externas (RNF01 / RNF04)", () => {
  const caminhoCalc = path.join(__dirname, "../src/utils/calculoMedicaoLocal.js");
  const codigo = fs.readFileSync(caminhoCalc, "utf-8");

  // Garante pureza do módulo (sem SQLite, sem API, sem React)
  assert.ok(!codigo.includes("expo-sqlite"), "calculoMedicaoLocal deve ser puro e não importar SQLite");
  assert.ok(!codigo.includes("fetch("), "calculoMedicaoLocal não deve fazer chamadas de rede");

  // Converte ES module simples para avaliação no ambiente de teste Node
  const codigoCommonJS = codigo
    .replace(/export const /g, "const ")
    .replace(/export default /g, "module.exports = ");
  const mod = {};
  const fn = new Function("module", "exports", codigoCommonJS);
  fn(mod, {});
  const { calcularMedicaoLocal, ehUnidadeInteira } = mod.exports;

  assert.equal(ehUnidadeInteira("UN"), true);
  assert.equal(ehUnidadeInteira("m²"), false);

  const res = calcularMedicaoLocal({
    quantidadePeriodo: 5,
    quantidadeAnterior: 3,
    valorAnterior: 750,
    quantidadeOrcada: 10,
    precoUnitario: 250,
    unidadeMedida: "m²",
  });

  assert.equal(res.quantidade_medida_periodo, 5);
  assert.equal(res.quantidade_acumulada_anterior, 3);
  assert.equal(res.quantidade_acumulada_atual, 8);
  assert.equal(res.saldo_quantidade, 2);
  assert.equal(res.valor_medido_periodo, 1250);
  assert.equal(res.valor_acumulado_atual, 2000);
  assert.equal(res.percentual_execucao, 80);
  assert.equal(res.superou_orcamento, false);

  // Rejeita decimais em unidades inteiras
  assert.throws(() => {
    calcularMedicaoLocal({
      quantidadePeriodo: 2.5,
      quantidadeOrcada: 10,
      precoUnitario: 100,
      unidadeMedida: "UN",
    });
  }, /unidade inteira/i);
});

test("Etapa 2 - Repositórios locais possuem responsabilidade única por entidade e enfileiram mutações (RNF02)", () => {
  const arquivos = [
    {
      nome: "obraLocalRepository.js",
      esperados: [
        "criarObraLocal",
        "listarObrasLocais",
        "atualizarObraLocal",
        "arquivarObraLocal",
        "deletarObraLocal",
        "salvarEstruturaPlanilhaLocal",
        "obterEstruturaObraLocal",
        "enfileirarOperacao",
      ],
    },
    {
      nome: "medicaoLocalRepository.js",
      esperados: [
        "obterDadosMedicaoLocal",
        "registrarMedicaoLocal",
        "upsertMedicaoSincronizada",
        "listarMedicoesCicloLocal",
        "calcularMedicaoLocal",
        "enfileirarOperacao",
      ],
    },
    {
      nome: "cicloLocalRepository.js",
      esperados: [
        "upsertCicloSincronizado",
        "listarCiclosObraLocal",
        "obterDetalhesCicloLocal",
        "encerrarCicloLocal",
        "enfileirarOperacao",
      ],
    },
    {
      nome: "fotografiaRepository.js",
      esperados: [
        "salvarFotografia",
        "excluirFotografia",
        "marcarFotografiaComoSincronizada",
        "upsertFotografiaSincronizada",
        "enfileirarOperacao",
      ],
    },
  ];

  for (const item of arquivos) {
    const caminho = path.join(__dirname, "../src/repositories", item.nome);
    const conteudo = fs.readFileSync(caminho, "utf-8");

    // Nenhum repositório local pode importar telas ou fetch HTTP
    assert.ok(!conteudo.includes("../screens/"), `${item.nome} não deve acoplar com telas`);
    assert.ok(!conteudo.includes("fetch("), `${item.nome} não deve chamar rede diretamente`);

    for (const simbolo of item.esperados) {
      assert.ok(
        conteudo.includes(simbolo),
        `${item.nome} deve conter ${simbolo}`
      );
    }
  }
});

