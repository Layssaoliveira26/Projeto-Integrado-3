const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("prazoObraUtils - opções padrões e soma de dias corridos no calendário", async (t) => {
  const {
    OPCOES_DIAS_PADRAO,
    somarDiasDataBr,
    calcularDiferencaDiasBr,
    sanitizarEntradaDias,
    validarDataBr,
  } = await import("../src/utils/prazoObraUtils.js");

  await t.test("define exatamente as opções padrões 30, 90, 100 e 180 dias", () => {
    assert.deepEqual(OPCOES_DIAS_PADRAO, [30, 90, 100, 180]);
  });

  await t.test("soma 30, 90, 100 e 180 dias respeitando meses de 30/31 dias e virada de ano", () => {
    assert.equal(somarDiasDataBr("01/09/2026", 30), "01/10/2026");
    assert.equal(somarDiasDataBr("01/09/2026", 90), "30/11/2026");
    assert.equal(somarDiasDataBr("01/09/2026", 100), "10/12/2026");
    assert.equal(somarDiasDataBr("01/09/2026", 180), "28/02/2027");
    assert.equal(calcularDiferencaDiasBr("01/09/2026", "10/12/2026"), 100);
  });

  await t.test("respeita anos bissextos e não bissextos em fevereiro", () => {
    assert.equal(somarDiasDataBr("01/02/2026", 28), "01/03/2026");
    assert.equal(somarDiasDataBr("01/02/2028", 28), "29/02/2028");
    assert.equal(somarDiasDataBr("01/02/2028", 29), "01/03/2028");
    assert.equal(validarDataBr("29/02/2026", true), false);
    assert.equal(validarDataBr("29/02/2028", true), true);
  });

  await t.test("sanitiza entradas de dias removendo caracteres não numéricos e zeros à esquerda", () => {
    assert.equal(sanitizarEntradaDias("0030abc"), "30");
    assert.equal(sanitizarEntradaDias("0"), "");
    assert.equal(sanitizarEntradaDias("180"), "180");
    assert.equal(sanitizarEntradaDias("123456"), "1234");
  });
});

test("prazoObraUtils - sincronização entre campo de dias, presets e edição manual de data", async (t) => {
  const {
    calcularEstadoAoAlterarDias,
    calcularEstadoAoSelecionarPresetDias,
    calcularEstadoAoEditarDataManual,
  } = await import("../src/utils/prazoObraUtils.js");

  await t.test("digitar dígitos sequencialmente recalcula sempre sobre o prazo base sem acumular erro", () => {
    const base = "15/05/2026";

    const passo1 = calcularEstadoAoAlterarDias("3", {
      dataConclusaoBase: base,
      dataConclusaoAtual: base,
    });
    assert.equal(passo1.diasAdicionados, "3");
    assert.equal(passo1.dataConclusao, "18/05/2026");

    const passo2 = calcularEstadoAoAlterarDias("30", {
      dataConclusaoBase: base,
      dataConclusaoAtual: passo1.dataConclusao,
    });
    assert.equal(passo2.diasAdicionados, "30");
    assert.equal(passo2.dataConclusao, "14/06/2026");

    const limpo = calcularEstadoAoAlterarDias("", {
      dataConclusaoBase: base,
      dataConclusaoAtual: passo2.dataConclusao,
    });
    assert.equal(limpo.diasAdicionados, "");
    assert.equal(limpo.dataConclusao, "15/05/2026");
  });

  await t.test("selecionar presets alterna entre quantidades padrões e desmarca ao tocar novamente", () => {
    const base = "01/09/2026";

    const sel30 = calcularEstadoAoSelecionarPresetDias(30, {
      diasAdicionadosAtual: "",
      dataConclusaoBase: base,
      dataConclusaoAtual: base,
    });
    assert.equal(sel30.diasAdicionados, "30");
    assert.equal(sel30.dataConclusao, "01/10/2026");

    const sel100 = calcularEstadoAoSelecionarPresetDias(100, {
      diasAdicionadosAtual: sel30.diasAdicionados,
      dataConclusaoBase: base,
      dataConclusaoAtual: sel30.dataConclusao,
    });
    assert.equal(sel100.diasAdicionados, "100");
    assert.equal(sel100.dataConclusao, "10/12/2026");

    const desmarcado = calcularEstadoAoSelecionarPresetDias(100, {
      diasAdicionadosAtual: sel100.diasAdicionados,
      dataConclusaoBase: base,
      dataConclusaoAtual: sel100.dataConclusao,
    });
    assert.equal(desmarcado.diasAdicionados, "");
    assert.equal(desmarcado.dataConclusao, "01/09/2026");
  });

  await t.test("editar a data final manualmente reflete a diferença positiva em dias ou limpa se anterior/igual", () => {
    const base = "01/09/2026";

    const manual90 = calcularEstadoAoEditarDataManual("30112026", {
      dataConclusaoBase: base,
    });
    assert.equal(manual90.dataConclusao, "30/11/2026");
    assert.equal(manual90.diasAdicionados, "90");

    const manualAnterior = calcularEstadoAoEditarDataManual("20082026", {
      dataConclusaoBase: base,
    });
    assert.equal(manualAnterior.dataConclusao, "20/08/2026");
    assert.equal(manualAnterior.diasAdicionados, "");
  });

  await t.test("usa dataInicio como fallback caso a obra não possua dataConclusaoBase prévia", () => {
    const resultado = calcularEstadoAoSelecionarPresetDias(90, {
      diasAdicionadosAtual: "",
      dataConclusaoBase: "",
      dataConclusaoAtual: "",
      dataInicio: "01/03/2026",
    });
    assert.equal(resultado.diasAdicionados, "90");
    assert.equal(resultado.dataConclusao, "30/05/2026");
  });
});

test("EditarObra - integra campo de adicionar dias e atalhos padrões na tela", () => {
  const caminhoEditar = path.join(__dirname, "../src/screens/EditarObra.js");
  const conteudo = fs.readFileSync(caminhoEditar, "utf-8");

  assert.ok(
    conteudo.includes("OPCOES_DIAS_PADRAO"),
    "EditarObra deve renderizar as opções padrões de dias",
  );
  assert.ok(
    conteudo.includes("Adicionar dias ao prazo final:"),
    "EditarObra deve exibir o rótulo da seção de adição de dias",
  );
  assert.ok(
    conteudo.includes("handleAlterarDias"),
    "EditarObra deve tratar a digitação de dias personalizados",
  );
  assert.ok(
    conteudo.includes("handleSelecionarPresetDias"),
    "EditarObra deve tratar a seleção de presets de dias",
  );
  assert.ok(
    conteudo.includes('placeholder="Ex: 41 dias"'),
    "EditarObra deve usar o placeholder definido no Figma",
  );
  assert.ok(
    conteudo.includes("Prazo anterior:"),
    "EditarObra deve exibir o card de resumo de prazo anterior e novo",
  );
  assert.ok(
    !conteudo.match(/\balert\s*\(/),
    "EditarObra não deve utilizar alert() global",
  );
});

test("Histórico de prazo - formatadores de delta, resumo acumulado e componentes no padrão Figma", async (t) => {
  const {
    obterDeltaDiasHistorico,
    formatarDeltaPrazo,
    resumirHistoricoConclusao,
    formatarTempoAdicionado,
  } = await import("../src/utils/formatadores.js");

  await t.test("formata prorrogações positivas, reduções negativas e singular", () => {
    assert.equal(formatarDeltaPrazo(90), "+90 dias");
    assert.equal(formatarDeltaPrazo(1), "+1 dia");
    assert.equal(formatarDeltaPrazo(-15), "-15 dias");
    assert.equal(formatarDeltaPrazo(-1), "-1 dia");
    assert.equal(formatarDeltaPrazo(0), "0 dias");
    assert.equal(formatarTempoAdicionado({ dias_adicionados: -10 }), "-10 dias");
    assert.equal(obterDeltaDiasHistorico({ tempo_adicionado: "-20 dias" }), -20);
  });

  await t.test("consolida contagem total e saldo líquido de dias no histórico", () => {
    const resumo = resumirHistoricoConclusao([
      { dias_adicionados: 90 },
      { dias_adicionados: 30 },
      { dias_adicionados: -15 },
    ]);
    assert.deepEqual(resumo, { totalAlteracoes: 3, saldoDias: 105 });
    assert.deepEqual(resumirHistoricoConclusao([]), {
      totalAlteracoes: 0,
      saldoDias: 0,
    });
  });

  await t.test("SecaoHistoricoConclusao e HistoricoConclusaoCard seguem o novo componente do Figma", () => {
    const secao = fs.readFileSync(
      path.join(__dirname, "../src/components/SecaoHistoricoConclusao.js"),
      "utf-8",
    );
    const card = fs.readFileSync(
      path.join(__dirname, "../src/components/HistoricoConclusaoCard.js"),
      "utf-8",
    );

    assert.ok(secao.includes("resumirHistoricoConclusao"));
    assert.ok(secao.includes("dataRegistro={formatarDataHora(item.created_at)}"));
    assert.ok(secao.includes("Ver histórico completo"));
    assert.ok(card.includes("formatarDeltaPrazo"));
    assert.ok(card.includes('name="clock"'));
    assert.ok(card.includes("→"));
  });
});
