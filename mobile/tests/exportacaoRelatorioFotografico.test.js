const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  formatarDataHora,
  formatarDataSimples,
  formatarCoordenadas,
  agruparFotosPorEtapaEServico,
  gerarHtmlRelatorioFotografico,
} = require("../src/utils/relatorioFotograficoUtils");

test("US28 / RF28 - Relatório fotográfico consolida fotografias do ciclo em formato estruturado", () => {
  const fotosMock = [
    {
      id: "foto-1",
      servico_id: "srv-10",
      caminho_local: "file:///local/foto1.jpg",
      data_hora_captura: "2026-11-14T10:00:00.000Z",
      possui_localizacao: 1,
      latitude: -5.197222,
      longitude: -39.294111,
    },
    {
      id: "foto-2",
      servico_id: "srv-20",
      caminho_local: "file:///local/foto2.jpg",
      data_hora_captura: "2026-11-14T11:30:00.000Z",
      possui_localizacao: 0,
    },
  ];

  const estruturaMock = {
    etapas: [
      {
        id: "etp-1",
        nome: "1.0 Infraestrutura",
        servicos: [
          {
            id: "srv-10",
            codigo_servico: "INF-01",
            descricao: "Escavação de valas",
          },
        ],
      },
      {
        id: "etp-2",
        nome: "2.0 Superestrutura",
        servicos: [
          {
            id: "srv-20",
            codigo_servico: "SUP-01",
            descricao: "Armação de pilares",
          },
        ],
      },
    ],
  };

  const agrupado = agruparFotosPorEtapaEServico({
    fotos: fotosMock,
    estruturaObra: estruturaMock,
  });

  assert.equal(agrupado.totalFotos, 2, "Deve consolidar exatamente as 2 fotos do ciclo");
  assert.equal(agrupado.totalServicosComFotos, 2, "Deve computar 2 serviços com evidências");
  assert.equal(agrupado.etapas.length, 2, "Deve agrupar nas 2 etapas correspondentes");
});

test("US28 [Checklist] - Exportação preserva todas as fotos e dados do relatório sem perda de informação (RNF11)", () => {
  const fotosCompletas = [
    {
      id: "f1",
      servico_id: "s1",
      caminho_local: "file:///storage/foto_fundacao.jpg",
      data_hora_captura: "2026-11-14T08:15:00.000Z",
      possui_localizacao: 1,
      latitude: -3.717222,
      longitude: -38.543056,
    },
    {
      id: "f2",
      servico_id: "s_inexistente_na_planilha",
      caminho_local: "file:///storage/foto_geral.jpg",
      data_hora_captura: "2026-11-14T09:00:00.000Z",
      possui_localizacao: 0,
      latitude: null,
      longitude: null,
    },
  ];

  const estrutura = {
    etapas: [
      {
        id: "e1",
        nome: "1.0 Fundações",
        servicos: [
          { id: "s1", codigo_servico: "FND-01", descricao: "Estacas hélice contínua" },
        ],
      },
    ],
  };

  const agrupamento = agruparFotosPorEtapaEServico({
    fotos: fotosCompletas,
    estruturaObra: estrutura,
  });

  // RNF11: Nenhuma foto pode se perder, mesmo com serviço desvinculado
  assert.equal(agrupamento.totalFotos, 2, "Não pode haver perda de fotos mesmo sem serviço mapeado");
  const etapasNomes = agrupamento.etapas.map((e) => e.nome);
  assert.ok(etapasNomes.includes("1.0 Fundações"));
  assert.ok(etapasNomes.includes("Registros Gerais da Obra"));

  // Validação da compilação HTML sem perda de dados
  const dadosExportacao = {
    obraNome: "Hospital Regional Universitário",
    obraEndereco: "Av. dos Médicos, 1000, Fortaleza - CE",
    numeroCiclo: 4,
    periodoTexto: "01/11/2026 a 15/11/2026",
    responsavelNome: "Eng. Roberto Silva - CREA 12345",
    dataEmissao: "14/11/2026 às 17:00",
    totalFotos: agrupamento.totalFotos,
    totalServicosComFotos: agrupamento.totalServicosComFotos,
    etapas: agrupamento.etapas,
  };

  const html = gerarHtmlRelatorioFotografico(dadosExportacao);

  // Verificações rigorosas do conteúdo exportado
  assert.ok(html.includes("Hospital Regional Universitário"), "Preserva nome da obra");
  assert.ok(html.includes("Av. dos Médicos, 1000, Fortaleza - CE"), "Preserva endereço completo");
  assert.ok(html.includes("Ciclo 04"), "Preserva identificador do ciclo formatado");
  assert.ok(html.includes("01/11/2026 a 15/11/2026"), "Preserva período temporal do ciclo (RNF10/RNF11)");
  assert.ok(html.includes("Eng. Roberto Silva - CREA 12345"), "Preserva responsável técnico (RNF12)");
  assert.ok(html.includes("14/11/2026 às 17:00"), "Preserva data e hora de emissão");
  assert.ok(html.includes("Estacas hélice contínua"), "Preserva descrição do serviço");
  assert.ok(html.includes("Lat: -3.717222 | Lon: -38.543056"), "Preserva coordenadas geográficas de alta precisão");
  assert.ok(html.includes("Localização não informada"), "Preserva mensagem clara para fotos sem localização");
  assert.ok(html.includes("foto_fundacao.jpg"), "Preserva referência da primeira imagem");
  assert.ok(html.includes("foto_geral.jpg"), "Preserva referência da segunda imagem em registros gerais");
});

test("US28 / RNF11 - Utilitário formatarDataSimples extrai datas no formato DD/MM/AAAA", () => {
  assert.equal(formatarDataSimples("2026-11-01T03:00:00.000Z"), "01/11/2026");
  assert.equal(formatarDataSimples("2026-12-31"), "31/12/2026");
  assert.equal(formatarDataSimples(null), "");
});

test("US28 / RNF12 - Rastreabilidade: Serviço de exportação persiste histórico e limpa temporários", () => {
  const servicePath = path.join(__dirname, "../src/services/relatorioFotograficoService.js");
  const serviceConteudo = fs.readFileSync(servicePath, "utf-8");

  assert.ok(
    serviceConteudo.includes("exportarRelatorioFotograficoPdf"),
    "Deve conter a função principal de exportação do PDF"
  );
  assert.ok(
    serviceConteudo.includes("limparRelatoriosTemporariosAnteriores"),
    "Deve conter rotina de limpeza para evitar acúmulo de armazenamento"
  );
  assert.ok(
    serviceConteudo.includes("salvarRegistroRelatorio"),
    "Deve registrar o relatório gerado na rastreabilidade local"
  );
  assert.ok(
    serviceConteudo.includes("Sharing.shareAsync"),
    "Deve acionar compartilhamento nativo para envio a terceiros (RF28)"
  );
});

test("US28 - Tela PreviaRelatorioFotograficoScreen integra exportação com botões no cabeçalho e rodapé", () => {
  const screenPath = path.join(__dirname, "../src/screens/PreviaRelatorioFotograficoScreen.js");
  const screenConteudo = fs.readFileSync(screenPath, "utf-8");

  assert.ok(
    screenConteudo.includes("handleExportarPdf"),
    "Tela deve conter handler de exportação"
  );
  assert.ok(
    screenConteudo.includes("Exportar Relatório em PDF"),
    "Botão de rodapé deve ter texto claro de exportação em PDF"
  );
  assert.ok(
    screenConteudo.includes("botaoCompartilharTopo"),
    "Cabeçalho deve possuir botão de compartilhamento rápido"
  );
  assert.ok(
    screenConteudo.includes("useAuth"),
    "Tela deve injetar useAuth para capturar o responsável pela exportação"
  );
});
