const test = require("node:test");
const assert = require("node:assert/strict");

test("filtrarObras aplica filtros por data, progresso e ciclos", async (t) => {
  const { filtrarObras } = await import("../src/utils/filtrarObras.js");
  const {
    CHAVES_FILTRO_OBRA: CHAVES,
    FILTROS_OBRA_INICIAIS,
    VALORES_FILTRO_OBRA: VALORES,
  } = await import("../src/utils/filtroObraConstantes.js");
  const agora = new Date("2026-11-18T12:00:00.000Z");
  const criarObra = (id, alteracoes = {}) => ({
    id,
    _raw: { obra: { created_at: "2026-11-17T12:00:00.000Z" } },
    data_ultima_medicao: "2026-11-16T12:00:00.000Z",
    progresso: 0,
    quantidade_ciclos: 1,
    ...alteracoes,
  });

  await t.test("ignora filtros nulos e combina os filtros com AND", () => {
    const obras = [
      criarObra("combina", { progresso: 50 }),
      criarObra("progresso-diferente", { progresso: 49 }),
      criarObra("sem-medicao", { data_ultima_medicao: null, progresso: 50 }),
    ];
    const filtros = {
      ...FILTROS_OBRA_INICIAIS,
      [CHAVES.REGISTRO_MEDICAO]: VALORES.SEMANA,
      [CHAVES.PROGRESSO]: VALORES.ACIMA_50,
    };

    assert.deepEqual(filtrarObras(obras, FILTROS_OBRA_INICIAIS, agora), obras);
    assert.deepEqual(
      filtrarObras(obras, filtros, agora).map((obra) => obra.id),
      ["combina"],
    );
  });

  await t.test("inclui a borda de 7 dias e seleciona datas com mais de um ano", () => {
    const obras = [
      criarObra("sete-dias", {
        _raw: { obra: { created_at: "2026-11-11T12:00:00.000Z" } },
      }),
      criarObra("mais-de-ano", {
        _raw: { obra: { created_at: "2025-11-17T12:00:00.000Z" } },
      }),
    ];

    assert.deepEqual(
      filtrarObras(
        obras,
        { ...FILTROS_OBRA_INICIAIS, [CHAVES.DATA_CRIACAO]: VALORES.SEMANA },
        agora,
      ).map((obra) => obra.id),
      ["sete-dias"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        {
          ...FILTROS_OBRA_INICIAIS,
          [CHAVES.DATA_CRIACAO]: VALORES.ANO_MAIS,
        },
        agora,
      ).map((obra) => obra.id),
      ["mais-de-ano"],
    );
  });

  await t.test("classifica corretamente 0%, abaixo/igual a 50% e quantidade de ciclos", () => {
    const obras = [
      criarObra("zero", { progresso: 0, quantidade_ciclos: 1 }),
      criarObra("abaixo", { progresso: 49, quantidade_ciclos: 9 }),
      criarObra("cinquenta", { progresso: 50, quantidade_ciclos: 10 }),
    ];

    assert.deepEqual(
      filtrarObras(
        obras,
        { ...FILTROS_OBRA_INICIAIS, [CHAVES.PROGRESSO]: VALORES.NENHUM },
        agora,
      ).map((obra) => obra.id),
      ["zero"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        {
          ...FILTROS_OBRA_INICIAIS,
          [CHAVES.PROGRESSO]: VALORES.ABAIXO_50,
        },
        agora,
      ).map((obra) => obra.id),
      ["abaixo"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        {
          ...FILTROS_OBRA_INICIAIS,
          [CHAVES.PROGRESSO]: VALORES.ACIMA_50,
        },
        agora,
      ).map((obra) => obra.id),
      ["cinquenta"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        { ...FILTROS_OBRA_INICIAIS, [CHAVES.CICLOS]: VALORES.PRIMEIRO },
        agora,
      ).map((obra) => obra.id),
      ["zero"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        { ...FILTROS_OBRA_INICIAIS, [CHAVES.CICLOS]: VALORES.MENOS_10 },
        agora,
      ).map((obra) => obra.id),
      ["zero", "abaixo"],
    );
    assert.deepEqual(
      filtrarObras(
        obras,
        { ...FILTROS_OBRA_INICIAIS, [CHAVES.CICLOS]: VALORES.MAIS_10 },
        agora,
      ).map((obra) => obra.id),
      ["cinquenta"],
    );
  });
});
