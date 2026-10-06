const test = require("node:test");
const assert = require("node:assert/strict");

const planilhaRepository = require("../src/repositories/planilhaRepository");
const planilhaService = require("../src/services/planilhaService");

// Fixtures para os testes
const mockObraId = "b2c3d4e5-0000-0000-0000-000000000002";
const mockUsuarioId = "a1b2c3d4-0000-0000-0000-000000000001";

const mockObra = {
  id: mockObraId,
  usuario_id: mockUsuarioId,
  nome: "QUADRA DA SEDE",
  status: "ativa",
  orcamento_total: "0.00"
};

// Payload espelhado no modelo de dados da planilha_padrao.xlsx
const mockPayloadValido = {
  obraId: mockObraId,
  usuarioId: mockUsuarioId,
  nomeArquivo: "planilha_padrao.xlsx",
  etapas: [
    {
      ordem: 1,
      item: "1",
      nome: "SERVIÇOS PRELIMINARES",
      servicos: [
        {
          ordem: 1,
          item: "1.1",
          codigo_servico: "00004813",
          descricao: "PLACA DE OBRA EM CHAPA GALVANIZADA",
          fonte_origem: "SINAPI",
          unidade_medida: "M2",
          quantidade_orcada: "12.0000",
          preco_unitario: "250.0000"
        },
        {
          ordem: 2,
          item: "1.2",
          codigo_servico: "C2849",
          descricao: "INSTALAÇÕES PROVISORIAS DE ESGOTO",
          fonte_origem: "SEINFRA",
          unidade_medida: "UN",
          quantidade_orcada: "1.0000",
          preco_unitario: "202.3600"
        }
      ]
    },
    {
      ordem: 2,
      item: "2",
      nome: "MOVIMENTO DE TERRA",
      servicos: [
        {
          ordem: 1,
          item: "2.1",
          codigo_servico: "93358",
          descricao: "ESCAVAÇÃO MANUAL DE VALA",
          fonte_origem: "SINAPI",
          unidade_medida: "M3",
          quantidade_orcada: "15.5000",
          preco_unitario: "80.0000"
        }
      ]
    }
  ]
};

test("Importar planilha-base com sucesso e calcular orçamento total exato", async () => {
  const etapasSalvas = [];
  const servicosSalvos = [];
  let orcamentoAtualizado = null;
  let cicloGarantido = false;
  let planilhaRegistrada = null;
  let estruturaLimpa = false;

  // Mock do repositório
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;
  planilhaRepository.executarEmTransacao = async (cb) => cb({});

  planilhaRepository.salvarPlanilhaBase = async (client, dados) => {
    planilhaRegistrada = dados;
    return { id: "planilha-uuid-1", ...dados };
  };

  planilhaRepository.limparEstruturaObra = async (client, obraId) => {
    estruturaLimpa = true;
  };

  planilhaRepository.salvarEtapa = async (client, dados) => {
    const etapa = { id: `etapa-uuid-${etapasSalvas.length + 1}`, ...dados };
    etapasSalvas.push(etapa);
    return etapa;
  };

  planilhaRepository.salvarServico = async (client, dados) => {
    servicosSalvos.push(dados);
    return { id: `servico-uuid-${servicosSalvos.length}`, ...dados };
  };

  planilhaRepository.atualizarOrcamentoObra = async (client, obraId, total) => {
    orcamentoAtualizado = total;
  };

  planilhaRepository.garantirCicloInicial = async (client, obraId) => {
    cicloGarantido = true;
  };

  const resultado = await planilhaService.importarPlanilhaBase(mockPayloadValido);

  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.resumo.obra_id, mockObraId);
  assert.equal(resultado.resumo.total_etapas, 2);
  assert.equal(resultado.resumo.total_servicos, 3);
  // Cálculo exato: (12 * 250) + (1 * 202.36) + (15.5 * 80) = 3000 + 202.36 + 1240 = 4442.36
  assert.equal(resultado.resumo.orcamento_total, 4442.36);
  assert.equal(orcamentoAtualizado, "4442.36");
  assert.equal(estruturaLimpa, true);
  assert.equal(cicloGarantido, true);
  assert.equal(planilhaRegistrada.nomeArquivo, "planilha_padrao.xlsx");
  assert.equal(servicosSalvos.length, 3);
  assert.equal(servicosSalvos[0].precoTotal, "3000.0000");
  assert.equal(servicosSalvos[1].precoTotal, "202.3600");
  assert.equal(servicosSalvos[2].precoTotal, "1240.0000");
});

test("Rejeitar importação se obra não for encontrada ou usuário não tiver permissão", async () => {
  planilhaRepository.buscarObraComPermissao = async () => null;

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(mockPayloadValido);
    },
    (err) => {
      assert.equal(err.status, 404);
      assert.match(err.message, /Obra não encontrada/);
      return true;
    }
  );
});

test("Rejeitar importação se a obra já possuir medições registradas (409)", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => true;

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(mockPayloadValido);
    },
    (err) => {
      assert.equal(err.status, 409);
      assert.match(err.message, /já possui medições registradas/);
      return true;
    }
  );
});

test("Rejeitar importação com códigos de serviço duplicados na mesma planilha", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;

  const payloadDuplicado = {
    ...mockPayloadValido,
    etapas: [
      {
        nome: "ETAPA 1",
        servicos: [
          {
            codigo_servico: "C2849",
            descricao: "SERVIÇO A",
            unidade_medida: "UN",
            quantidade_orcada: 1,
            preco_unitario: 100
          },
          {
            codigo_servico: "C2849", // Duplicado!
            descricao: "SERVIÇO B",
            unidade_medida: "UN",
            quantidade_orcada: 2,
            preco_unitario: 50
          }
        ]
      }
    ]
  };

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(payloadDuplicado);
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /Código de serviço duplicado/);
      assert.match(err.message, /C2849/);
      return true;
    }
  );
});

test("Rejeitar serviço com quantidade orçada menor ou igual a zero", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;

  const payloadQtdZero = {
    ...mockPayloadValido,
    etapas: [
      {
        nome: "ETAPA 1",
        servicos: [
          {
            codigo_servico: "SERV-01",
            descricao: "SERVIÇO",
            unidade_medida: "M2",
            quantidade_orcada: 0,
            preco_unitario: 100
          }
        ]
      }
    ]
  };

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(payloadQtdZero);
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /deve ser maior que zero/);
      return true;
    }
  );
});

test("Rejeitar serviço com preço unitário negativo", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;

  const payloadPrecoNegativo = {
    ...mockPayloadValido,
    etapas: [
      {
        nome: "ETAPA 1",
        servicos: [
          {
            codigo_servico: "SERV-01",
            descricao: "SERVIÇO",
            unidade_medida: "M2",
            quantidade_orcada: 10,
            preco_unitario: -50
          }
        ]
      }
    ]
  };

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(payloadPrecoNegativo);
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /não pode ser negativo/);
      return true;
    }
  );
});

test("US16: Rejeitar quantidade fracionária para unidade de medida inteira (UN)", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;

  const payloadUnidadeFracionada = {
    ...mockPayloadValido,
    etapas: [
      {
        nome: "ETAPA 1",
        servicos: [
          {
            codigo_servico: "SERV-UN",
            descricao: "PORTA DE MADEIRA",
            unidade_medida: "UN",
            quantidade_orcada: 2.5, // Fracionado para unidade inteira!
            preco_unitario: 350
          }
        ]
      }
    ]
  };

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase(payloadUnidadeFracionada);
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /unidade inteira/);
      assert.match(err.message, /não pode conter casas decimais fracionárias/);
      return true;
    }
  );
});

test("Aceitar e sanitizar valores numéricos em formato pt-BR e moeda", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;
  planilhaRepository.executarEmTransacao = async (cb) => cb({});
  planilhaRepository.salvarPlanilhaBase = async () => ({ id: "1" });
  planilhaRepository.limparEstruturaObra = async () => {};
  planilhaRepository.salvarEtapa = async () => ({ id: "etapa-1" });
  planilhaRepository.salvarServico = async () => ({ id: "servico-1" });
  let orcamentoTotalSalvo = null;
  planilhaRepository.atualizarOrcamentoObra = async (client, id, total) => {
    orcamentoTotalSalvo = total;
  };
  planilhaRepository.garantirCicloInicial = async () => ({ id: "ciclo-1" });

  const payloadFormatado = {
    obraId: mockObraId,
    usuarioId: mockUsuarioId,
    nomeArquivo: "orcamento.xlsx",
    etapas: [
      {
        nome: "FACHADA",
        servicos: [
          {
            codigo_servico: "FAC-01",
            descricao: "PINTURA ACRÍLICA",
            unidade_medida: "m²",
            quantidade_orcada: "1.250,50",
            preco_unitario: "R$ 45,80"
          }
        ]
      }
    ]
  };

  const resultado = await planilhaService.importarPlanilhaBase(payloadFormatado);
  assert.equal(resultado.sucesso, true);
  // 1250.50 * 45.80 = 57272.90
  assert.equal(resultado.resumo.orcamento_total, 57272.9);
  assert.equal(orcamentoTotalSalvo, "57272.90");
});

test("Rejeitar planilha sem etapas ou com etapas vazias", async () => {
  planilhaRepository.buscarObraComPermissao = async () => mockObra;
  planilhaRepository.verificarMedicoesExistentes = async () => false;

  await assert.rejects(
    async () => {
      await planilhaService.importarPlanilhaBase({
        obraId: mockObraId,
        usuarioId: mockUsuarioId,
        etapas: []
      });
    },
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /pelo menos uma etapa/);
      return true;
    }
  );
});

test("obterPlanilhaBase retorna metadados da planilha e orçamento da obra", async () => {
  planilhaRepository.buscarObraComPermissao = async () => ({
    ...mockObra,
    orcamento_total: "4442.36"
  });
  planilhaRepository.buscarPlanilhaPorObraId = async () => ({
    id: "planilha-uuid-1",
    nome_arquivo: "planilha_padrao.xlsx",
    status_validacao: "valida",
    data_importacao: "2026-10-05T10:00:00Z"
  });

  const dados = await planilhaService.obterPlanilhaBase(mockObraId, mockUsuarioId);
  assert.equal(dados.obra_id, mockObraId);
  assert.equal(dados.orcamento_total, 4442.36);
  assert.equal(dados.planilha.nome_arquivo, "planilha_padrao.xlsx");
});
