const { test } = require("node:test");
const assert = require("node:assert/strict");

/**
 * Funções puras de formatação e análise de inconsistências utilizadas na Prévia da Planilha (US23)
 */
function identificarInconsistencias(dados) {
  if (!dados || !Array.isArray(dados.etapas)) return [];
  const inconsistencias = [];
  dados.etapas.forEach((etapa) => {
    (etapa.servicos || []).forEach((servico) => {
      const saldoQtd = Number(servico.saldo_quantidade);
      const saldoVal = Number(servico.saldo_valor);
      if (saldoQtd < 0 || saldoVal < 0) {
        inconsistencias.push({
          servicoId: servico.id,
          codigo: servico.codigo_servico,
          descricao: servico.descricao,
          saldoQtd,
          saldoVal,
        });
      }
    });
  });
  return inconsistencias;
}

function formatarMoedaPtBr(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "R$ 0,00";
  const num = Number(valor);
  return (
    "R$ " +
    num
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

function formatarPercentualPtBr(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "0,00%";
  return `${Number(valor).toFixed(2).replace(".", ",")}%`;
}

test("US23 [Checklist 2] - Identifica corretamente serviços com inconsistência (saldo negativo)", () => {
  const dadosComInconsistencia = {
    etapas: [
      {
        id: "e1",
        nome: "SERVIÇOS PRELIMINARES",
        servicos: [
          {
            id: "s1",
            codigo_servico: "00004813",
            descricao: "PLACA DE OBRA",
            saldo_quantidade: -2.5,
            saldo_valor: -805.12,
          },
          {
            id: "s2",
            codigo_servico: "97627",
            descricao: "DEMOLIÇÃO",
            saldo_quantidade: 10.0,
            saldo_valor: 3200.0,
          },
        ],
      },
    ],
  };

  const lista = identificarInconsistencias(dadosComInconsistencia);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].servicoId, "s1");
  assert.equal(lista[0].saldoQtd, -2.5);
  assert.equal(lista[0].saldoVal, -805.12);
});

test("US23 [Checklist 2] - Retorna lista vazia quando todas as medições estão dentro do orçamento", () => {
  const dadosRegulares = {
    etapas: [
      {
        id: "e1",
        nome: "ESTRUTURAS",
        servicos: [
          {
            id: "s1",
            codigo_servico: "C0216",
            descricao: "ARMADURA CA-50A",
            saldo_quantidade: 50.0,
            saldo_valor: 770.5,
          },
          {
            id: "s2",
            codigo_servico: "C0843",
            descricao: "CONCRETO FCK 25",
            saldo_quantidade: 0,
            saldo_valor: 0,
          },
        ],
      },
    ],
  };

  const lista = identificarInconsistencias(dadosRegulares);
  assert.equal(lista.length, 0);
});

test("US23 [Checklist 1] - Formata valores monetários com precisão no padrão brasileiro", () => {
  assert.equal(formatarMoedaPtBr(125231.04), "R$ 125.231,04");
  assert.equal(formatarMoedaPtBr(611.9), "R$ 611,90");
  assert.equal(formatarMoedaPtBr(0), "R$ 0,00");
  assert.equal(formatarMoedaPtBr(null), "R$ 0,00");
});

test("US23 [Checklist 1] - Formata percentuais com vírgula e duas casas decimais", () => {
  assert.equal(formatarPercentualPtBr(15.8333), "15,83%");
  assert.equal(formatarPercentualPtBr(71.43), "71,43%");
  assert.equal(formatarPercentualPtBr(0), "0,00%");
});
