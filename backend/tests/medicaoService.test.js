const test = require("node:test");
const assert = require("node:assert/strict");

const medicaoRepository = require("../src/repositories/medicaoRepository");
const medicaoService = require("../src/services/medicaoService");

// Fixtures para os testes
const mockObraId = "b2c3d4e5-0000-0000-0000-000000000002";
const mockUsuarioId = "a1b2c3d4-0000-0000-0000-000000000001";
const mockCicloAberto = {
  id: "c3d4e5f6-0000-0000-0000-000000000003",
  obra_id: mockObraId,
  numero_ciclo: 1,
  status: "aberto",
};
const mockCiclo2Aberto = {
  id: "c3d4e5f6-0000-0000-0000-000000000004",
  obra_id: mockObraId,
  numero_ciclo: 2,
  status: "aberto",
};
const mockCicloEncerrado = {
  id: "c3d4e5f6-0000-0000-0000-000000000005",
  obra_id: mockObraId,
  numero_ciclo: 1,
  status: "encerrado",
};

const mockServico = {
  id: "e5f6a7b8-0000-0000-0000-000000000005",
  obra_id: mockObraId,
  codigo_servico: "00004813",
  descricao: "PLACA DE OBRA EM CHAPA GALVANIZADA",
  unidade_medida: "M2",
  quantidade_orcada: "12.0000",
  preco_unitario: "250.0000",
  preco_total: "3000.0000",
};

test("Registrar primeira medição de um serviço com sucesso e cálculos exatos", async () => {
  // Configura mocks
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => mockServico;
  medicaoRepository.buscarUltimaMedicao = async () => null; // Sem medições anteriores
  medicaoRepository.salvarMedicao = async (dados) => ({ id: "med-1", ...dados });

  const resultado = await medicaoService.registrarOuAtualizarMedicao({
    ciclo_id: mockCicloAberto.id,
    servico_id: mockServico.id,
    usuario_id: mockUsuarioId,
    quantidade_medida_periodo: "5.0000",
  });

  assert.equal(resultado.quantidade_medida_periodo, "5.0000");
  assert.equal(resultado.quantidade_acumulada_anterior, "0.0000");
  assert.equal(resultado.quantidade_acumulada_atual, "5.0000");
  assert.equal(resultado.saldo_quantidade, "7.0000"); // 12 - 5 = 7
  assert.equal(resultado.valor_medido_periodo, "1250.0000"); // 5 * 250 = 1250
  assert.equal(resultado.valor_acumulado_anterior, "0.0000");
  assert.equal(resultado.valor_acumulado_atual, "1250.0000");
  // 5 / 12 * 100 = 41.666666... -> 41.6667
  assert.equal(resultado.percentual_execucao, "41.6667");
  assert.equal(resultado.superou_orcamento, false);
  assert.equal(resultado.alerta, null);
  assert.equal(resultado.servico.codigo_servico, "00004813");
});

test("Registrar medição subsequente acumulando corretamente dados do ciclo anterior", async () => {
  const medicaoAnterior = {
    quantidade_acumulada_atual: "5.0000",
    valor_acumulado_atual: "1250.0000",
  };

  medicaoRepository.buscarCicloPorId = async () => mockCiclo2Aberto;
  medicaoRepository.buscarServicoPorId = async () => mockServico;
  medicaoRepository.buscarUltimaMedicao = async (servicoId, numCiclo) => {
    assert.equal(numCiclo, 2); // Garante que buscou estritamente ciclos anteriores
    return medicaoAnterior;
  };
  medicaoRepository.salvarMedicao = async (dados) => ({ id: "med-2", ...dados });

  const resultado = await medicaoService.registrarOuAtualizarMedicao({
    ciclo_id: mockCiclo2Aberto.id,
    servico_id: mockServico.id,
    usuario_id: mockUsuarioId,
    quantidade_medida_periodo: "7.0000",
  });

  assert.equal(resultado.quantidade_medida_periodo, "7.0000");
  assert.equal(resultado.quantidade_acumulada_anterior, "5.0000");
  assert.equal(resultado.quantidade_acumulada_atual, "12.0000");
  assert.equal(resultado.saldo_quantidade, "0.0000"); // 12 - 12 = 0
  assert.equal(resultado.valor_medido_periodo, "1750.0000"); // 7 * 250 = 1750
  assert.equal(resultado.valor_acumulado_anterior, "1250.0000");
  assert.equal(resultado.valor_acumulado_atual, "3000.0000");
  assert.equal(resultado.percentual_execucao, "100.0000");
  assert.equal(resultado.superou_orcamento, false);
});

test("Alerta e saldo negativo quando a medição supera a quantidade orçada", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => mockServico;
  medicaoRepository.buscarUltimaMedicao = async () => null;
  medicaoRepository.salvarMedicao = async (dados) => ({ id: "med-superada", ...dados });

  const resultado = await medicaoService.registrarOuAtualizarMedicao({
    ciclo_id: mockCicloAberto.id,
    servico_id: mockServico.id,
    usuario_id: mockUsuarioId,
    quantidade_medida_periodo: "15.0000", // Orçado é 12.0000
  });

  assert.equal(resultado.quantidade_acumulada_atual, "15.0000");
  assert.equal(resultado.saldo_quantidade, "-3.0000");
  assert.equal(resultado.percentual_execucao, "125.0000");
  assert.equal(resultado.superou_orcamento, true);
  assert.match(resultado.alerta, /supera a quantidade prevista/i);
});

test("Rejeita medição com quantidade negativa", async () => {
  await assert.rejects(
    async () => {
      await medicaoService.registrarOuAtualizarMedicao({
        ciclo_id: mockCicloAberto.id,
        servico_id: mockServico.id,
        usuario_id: mockUsuarioId,
        quantidade_medida_periodo: "-2.5",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /não pode ser negativa/i);
      return true;
    }
  );
});

test("Rejeita medição com valor não numérico", async () => {
  await assert.rejects(
    async () => {
      await medicaoService.registrarOuAtualizarMedicao({
        ciclo_id: mockCicloAberto.id,
        servico_id: mockServico.id,
        usuario_id: mockUsuarioId,
        quantidade_medida_periodo: "cinco",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /valor numérico válido/i);
      return true;
    }
  );
});

test("Rejeita medição se o ciclo estiver encerrado", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloEncerrado;

  await assert.rejects(
    async () => {
      await medicaoService.registrarOuAtualizarMedicao({
        ciclo_id: mockCicloEncerrado.id,
        servico_id: mockServico.id,
        usuario_id: mockUsuarioId,
        quantidade_medida_periodo: "2.0000",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /ciclo encerrado/i);
      return true;
    }
  );
});

test("Rejeita medição se o serviço não for encontrado", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => null;

  await assert.rejects(
    async () => {
      await medicaoService.registrarOuAtualizarMedicao({
        ciclo_id: mockCicloAberto.id,
        servico_id: "servico-inexistente",
        usuario_id: mockUsuarioId,
        quantidade_medida_periodo: "2.0000",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.match(err.message, /Serviço não encontrado/i);
      return true;
    }
  );
});

test("Rejeita medição se o serviço pertencer a outra obra diferente do ciclo", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => ({
    ...mockServico,
    obra_id: "outra-obra-id-9999",
  });

  await assert.rejects(
    async () => {
      await medicaoService.registrarOuAtualizarMedicao({
        ciclo_id: mockCicloAberto.id,
        servico_id: mockServico.id,
        usuario_id: mockUsuarioId,
        quantidade_medida_periodo: "2.0000",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /não pertence à obra/i);
      return true;
    }
  );
});

test("obterDadosParaMedicao retorna dados orçamentários e histórico acumulado", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => mockServico;
  medicaoRepository.buscarUltimaMedicao = async () => ({
    quantidade_acumulada_atual: "4.0000",
    valor_acumulado_atual: "1000.0000",
  });
  medicaoRepository.buscarMedicaoAtual = async () => null;

  const dados = await medicaoService.obterDadosParaMedicao(mockServico.id, mockCicloAberto.id);

  assert.equal(dados.ciclo.id, mockCicloAberto.id);
  assert.equal(dados.servico.codigo_servico, "00004813");
  assert.equal(dados.acumulado_anterior.quantidade_acumulada_anterior, "4.0000");
  assert.equal(dados.acumulado_anterior.valor_acumulado_anterior, "1000.0000");
  assert.equal(dados.medicao_atual, null);
});

test("Atualiza automaticamente os indicadores de progresso do serviço, da etapa e da obra", async () => {
  medicaoRepository.buscarCicloPorId = async () => mockCicloAberto;
  medicaoRepository.buscarServicoPorId = async () => ({
    ...mockServico,
    etapa_id: "etapa-preliminares-1",
  });
  medicaoRepository.buscarUltimaMedicao = async () => null;
  medicaoRepository.salvarMedicao = async (dados) => ({ id: "med-us19", ...dados });
  medicaoRepository.calcularProgressoObraEEtapa = async () => ({
    obra_id: mockObraId,
    obra_nome: "REFORMA DO GINASIO",
    etapa_id: "etapa-preliminares-1",
    etapa_nome: "SERVICOS PRELIMINARES",
    valor_orcado_obra: "10000.0000",
    valor_executado_obra: "2500.0000",
    valor_orcado_etapa: "5000.0000",
    valor_executado_etapa: "2500.0000",
  });

  const resultado = await medicaoService.registrarOuAtualizarMedicao({
    ciclo_id: mockCicloAberto.id,
    servico_id: mockServico.id,
    usuario_id: mockUsuarioId,
    quantidade_medida_periodo: "5.0000",
  });

  // 1. Progresso do serviço
  assert.ok(resultado.progresso);
  assert.equal(resultado.progresso.servico.id, mockServico.id);
  assert.equal(resultado.progresso.servico.percentual_execucao, 41.6667);
  assert.equal(resultado.progresso.servico.quantidade_acumulada_atual, "5.0000");
  assert.equal(resultado.progresso.servico.valor_acumulado_atual, "1250.0000");

  // 2. Progresso da etapa
  assert.ok(resultado.progresso.etapa);
  assert.equal(resultado.progresso.etapa.nome, "SERVICOS PRELIMINARES");
  assert.equal(resultado.progresso.etapa.percentual_execucao, 50.0); // 2500 / 5000 * 100
  assert.equal(resultado.progresso.etapa.valor_executado, 2500.0);
  assert.equal(resultado.progresso.etapa.valor_orcado, 5000.0);

  // 3. Progresso da obra
  assert.ok(resultado.progresso.obra);
  assert.equal(resultado.progresso.obra.nome, "REFORMA DO GINASIO");
  assert.equal(resultado.progresso.obra.percentual_execucao, 25.0); // 2500 / 10000 * 100
  assert.equal(resultado.progresso.obra.valor_executado_total, 2500.0);
  assert.equal(resultado.progresso.obra.valor_orcado_total, 10000.0);
});

