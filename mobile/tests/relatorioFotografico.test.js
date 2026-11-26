const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatarDataHora,
  formatarCoordenadas,
  agruparFotosPorEtapaEServico,
  gerarHtmlRelatorioFotografico,
} = require("../src/utils/relatorioFotograficoUtils");

test("US27 [Critério de Aceite] - formatarDataHora formata timestamp ISO corretamente para padrão pt-BR", () => {
  const dataIso = "2026-11-06T14:35:00.000Z";
  const formatada = formatarDataHora(dataIso);
  assert.ok(formatada.includes("2026"));
  assert.ok(formatada.includes("às"));
  assert.equal(formatarDataHora(null), "--/--/----");
});

test("US27 [Critério de Aceite] - formatarCoordenadas exibe latitude e longitude com 6 casas decimais quando houver", () => {
  const fotoComGps = {
    possui_localizacao: 1,
    latitude: -5.197222,
    longitude: -39.294111,
  };
  const resultado = formatarCoordenadas(fotoComGps);
  assert.equal(resultado, "Lat: -5.197222 | Lon: -39.294111");

  const fotoComGpsBool = {
    possui_localizacao: true,
    latitude: -3.71722,
    longitude: -38.54306,
  };
  assert.equal(
    formatarCoordenadas(fotoComGpsBool),
    "Lat: -3.717220 | Lon: -38.543060"
  );
});

test("US27 [Critério de Aceite] - formatarCoordenadas sinaliza ausência de coordenadas quando não houver localização", () => {
  const fotoSemGps = {
    possui_localizacao: 0,
    latitude: null,
    longitude: null,
  };
  assert.equal(formatarCoordenadas(fotoSemGps), "Localização não informada");
  assert.equal(formatarCoordenadas(null), "Localização não informada");
});

test("US27 [RN12 / RN13] - agrupa fotos por etapa e serviço e omite serviços vazios", () => {
  const estruturaObra = {
    etapas: [
      {
        id: "e1",
        nome: "1.0 FUNDAÇÕES",
        servicos: [
          {
            id: "s1",
            codigo_servico: "001",
            descricao: "Escavação manual de valas",
          },
          {
            id: "s2",
            codigo_servico: "002",
            descricao: "Armadura CA-50 para estacas",
          },
        ],
      },
      {
        id: "e2",
        nome: "2.0 ESTRUTURA",
        servicos: [
          {
            id: "s3",
            codigo_servico: "003",
            descricao: "Concretagem de pilares e vigas",
          },
        ],
      },
    ],
  };

  const fotos = [
    {
      id: "f1",
      servico_id: "s1",
      caminho_local: "file:///photos/foto1.jpg",
      possui_localizacao: 1,
      latitude: -5.197,
      longitude: -39.294,
      data_hora_captura: "2026-11-06T10:00:00Z",
    },
    {
      id: "f2",
      servico_id: "s1",
      caminho_local: "file:///photos/foto2.jpg",
      possui_localizacao: 0,
      latitude: null,
      longitude: null,
      data_hora_captura: "2026-11-06T10:15:00Z",
    },
    {
      id: "f3",
      servico_id: "s3",
      caminho_local: "file:///photos/foto3.jpg",
      possui_localizacao: 1,
      latitude: -5.198,
      longitude: -39.295,
      data_hora_captura: "2026-11-06T11:00:00Z",
    },
  ];

  const agrupado = agruparFotosPorEtapaEServico({ fotos, estruturaObra });

  assert.equal(agrupado.totalFotos, 3);
  assert.equal(agrupado.totalServicosComFotos, 2);
  assert.equal(agrupado.etapas.length, 2);

  // Etapa 1
  assert.equal(agrupado.etapas[0].nome, "1.0 FUNDAÇÕES");
  assert.equal(agrupado.etapas[0].servicos.length, 1); // s2 foi filtrado pois não tem fotos
  assert.equal(agrupado.etapas[0].servicos[0].id, "s1");
  assert.equal(agrupado.etapas[0].servicos[0].fotos.length, 2);

  // Etapa 2
  assert.equal(agrupado.etapas[1].nome, "2.0 ESTRUTURA");
  assert.equal(agrupado.etapas[1].servicos.length, 1);
  assert.equal(agrupado.etapas[1].servicos[0].id, "s3");
  assert.equal(agrupado.etapas[1].servicos[0].fotos.length, 1);
});

test("US27 [Critérios de Aceite] - Documento HTML gerado inclui foto, descrição do serviço, data/hora e coordenadas", () => {
  const dadosRelatorio = {
    obraId: "obra-123",
    obraNome: "Residencial Parque das Acácias",
    obraEndereco: "Av. Perimetral, 500, Quixadá - CE",
    cicloId: "ciclo-1",
    numeroCiclo: 3,
    dataEmissao: "06/11/2026 às 15:00",
    totalFotos: 1,
    totalServicosComFotos: 1,
    etapas: [
      {
        id: "e1",
        nome: "1.0 ESTRUTURA",
        servicos: [
          {
            id: "s1",
            codigo: "C0843",
            descricao: "Concretagem fck 25MPa",
            fotos: [
              {
                id: "f1",
                uri: "file:///data/user/0/host.exp.exponent/cache/foto_teste.jpg",
                dataHoraFormatada: "06/11/2026 às 14:30",
                coordenadasTexto: "Lat: -5.197200 | Lon: -39.294100",
                possuiCoordenadas: true,
                servicoDescricao: "Concretagem fck 25MPa",
              },
            ],
          },
        ],
      },
    ],
  };

  const html = gerarHtmlRelatorioFotografico(dadosRelatorio);

  assert.ok(html.includes("Relatório Fotográfico de Medição"));
  assert.ok(html.includes("Residencial Parque das Acácias"));
  assert.ok(html.includes("Ciclo 03"));
  assert.ok(html.includes("Concretagem fck 25MPa"));
  assert.ok(html.includes("06/11/2026 às 14:30"));
  assert.ok(html.includes("Lat: -5.197200 | Lon: -39.294100"));
  assert.ok(html.includes("foto_teste.jpg"));
});

test("Aba Fotos exibe o rótulo padronizado 'Relatório Fotográfico'", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const acompConteudo = fs.readFileSync(
    path.join(__dirname, "../src/screens/AcompanhamentoObraScreen.js"),
    "utf-8"
  );
  assert.ok(
    acompConteudo.includes("Relatório Fotográfico"),
    "Deve conter o rótulo unificado 'Relatório Fotográfico'"
  );
  assert.ok(
    !acompConteudo.includes("Baixar imagens"),
    "Não deve conter o texto ambíguo 'Baixar imagens'"
  );
});

test("DetalhesCicloScreen garante o repasse explícito de obraId na navegação para a prévia do relatório", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const detalhesConteudo = fs.readFileSync(
    path.join(__dirname, "../src/screens/DetalhesCicloScreen.js"),
    "utf-8"
  );
  assert.ok(
    detalhesConteudo.includes("idObraEfetivo"),
    "Deve calcular idObraEfetivo para garantir obraId na rota"
  );
  assert.ok(
    detalhesConteudo.includes("obraId: idObraEfetivo"),
    "Deve repassar explicitamente obraId na assinatura do navigate"
  );
});

test("CapturaFotoScreen aplica timeout explícito e fallback na obtenção de coordenadas GPS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const capturaConteudo = fs.readFileSync(
    path.join(__dirname, "../src/screens/CapturaFotoScreen.js"),
    "utf-8"
  );
  assert.ok(
    capturaConteudo.includes("4000"),
    "Deve conter timeout explícito de 4 segundos para evitar travamento do GPS"
  );
  assert.ok(
    capturaConteudo.includes("getLastKnownPositionAsync"),
    "Deve conter fallback para a última localização conhecida"
  );
  assert.ok(
    capturaConteudo.includes("Localização não informada"),
    "Deve aplicar continuidade suave com fallback de localização não informada (RN13)"
  );
});

test("relatorioFotograficoService gerencia e limpa arquivos PDF temporários anteriores", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const serviceConteudo = fs.readFileSync(
    path.join(__dirname, "../src/services/relatorioFotograficoService.js"),
    "utf-8"
  );
  assert.ok(
    serviceConteudo.includes("limparRelatoriosTemporariosAnteriores"),
    "Deve conter a função limparRelatoriosTemporariosAnteriores"
  );
  assert.ok(
    serviceConteudo.includes("readDirectoryAsync"),
    "Deve ler o diretório de destino para localizar relatórios anteriores"
  );
  assert.ok(
    serviceConteudo.includes("deleteAsync"),
    "Deve remover relatórios anteriores para liberar espaço de armazenamento"
  );
});

test("Remoção de Emojis do Relatório Fotográfico - HTML limpo e profissional", () => {
  const dados = {
    obraNome: "Edifício Horizonte",
    obraEndereco: "Rua das Flores, 123",
    numeroCiclo: 1,
    periodoTexto: "01/11/2026 a 15/11/2026",
    responsavelNome: "Engenheiro Responsável",
    dataEmissao: "18/11/2026",
    totalFotos: 0,
    totalServicosComFotos: 0,
    etapas: [],
  };
  const html = gerarHtmlRelatorioFotografico(dados);
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  assert.ok(!emojiRegex.test(html), "O HTML do relatório não deve conter emojis para manter aspecto formal e profissional");
  assert.ok(html.includes("Rua das Flores, 123"));
  assert.ok(html.includes("Período: 01/11/2026 a 15/11/2026"));
  assert.ok(html.includes("Responsável: Engenheiro Responsável"));
});

test("Relatório Fotográfico - Inclui endereço e coordenadas geográficas (Lat/Lon) conjuntamente", () => {
  const dados = {
    obraNome: "Centro de Pesquisas Tecnológicas",
    obraEndereco: "Campus UFC, Bloco A",
    numeroCiclo: 2,
    dataEmissao: "19/11/2026",
    totalFotos: 1,
    totalServicosComFotos: 1,
    etapas: [
      {
        id: "e1",
        nome: "1.0 Fundações",
        servicos: [
          {
            id: "s1",
            codigo: "FND-01",
            descricao: "Perfuração de solo",
            fotos: [
              {
                id: "f1",
                uri: "file:///photo.jpg",
                dataHoraFormatada: "19/11/2026 às 10:00",
                coordenadasTexto: "Rua Universitária, 100, Bairro Benfica, Fortaleza - CE",
                coordenadasGps: "Lat: -3.743120 | Lon: -38.536140",
                possuiCoordenadas: true,
                servicoDescricao: "Perfuração de solo",
              },
            ],
          },
        ],
      },
    ],
  };
  const html = gerarHtmlRelatorioFotografico(dados);
  assert.ok(html.includes("Rua Universitária, 100, Bairro Benfica, Fortaleza - CE"), "Deve incluir o endereço por extenso");
  assert.ok(html.includes("Lat: -3.743120 | Lon: -38.536140"), "Deve incluir as coordenadas GPS com precisão decimal");
  assert.ok(html.includes("Coordenadas:"), "Deve conter o rótulo explícito de coordenadas");
});

test("Acúmulo de fotos de ciclos anteriores e ciclo atual no relatório fotográfico", () => {
  const estruturaObra = {
    ciclos: [
      { id: "c1", numero_ciclo: 1 },
      { id: "c2", numero_ciclo: 2 },
      { id: "c3", numero_ciclo: 3 },
    ],
    etapas: [
      {
        id: "e1",
        nome: "1.0 ESTRUTURA",
        servicos: [
          {
            id: "s1",
            codigo_servico: "001",
            descricao: "Armação de pilares",
          },
        ],
      },
    ],
  };

  const fotos = [
    {
      id: "f1",
      ciclo_id: "c1",
      servico_id: "s1",
      caminho_local: "file:///foto-ciclo1.jpg",
      possui_localizacao: 1,
      latitude: -5.197,
      longitude: -39.294,
      data_hora_captura: "2026-10-01T10:00:00Z",
    },
    {
      id: "f2",
      ciclo_id: "c2",
      servico_id: "s1",
      caminho_local: "file:///foto-ciclo2.jpg",
      possui_localizacao: 1,
      latitude: -5.198,
      longitude: -39.295,
      data_hora_captura: "2026-10-15T10:00:00Z",
    },
    {
      id: "f3",
      ciclo_id: "c3",
      servico_id: "s1",
      caminho_local: "file:///foto-ciclo3.jpg",
      possui_localizacao: 1,
      latitude: -5.199,
      longitude: -39.296,
      data_hora_captura: "2026-11-01T10:00:00Z",
    },
  ];

  const agrupado = agruparFotosPorEtapaEServico({ fotos, estruturaObra });

  assert.equal(agrupado.totalFotos, 3, "Deve incluir todas as 3 fotos acumuladas");
  assert.equal(agrupado.etapas[0].servicos[0].fotos.length, 3);
  assert.equal(agrupado.etapas[0].servicos[0].fotos[0].numeroCiclo, 1);
  assert.equal(agrupado.etapas[0].servicos[0].fotos[1].numeroCiclo, 2);
  assert.equal(agrupado.etapas[0].servicos[0].fotos[2].numeroCiclo, 3);

  // Gera HTML para ciclo 3 e garante que badges individuais dos ciclos anteriores sejam exibidos
  const dadosRelatorio = {
    obraNome: "Obra Teste Acúmulo",
    numeroCiclo: 3,
    dataEmissao: "25/11/2026",
    totalFotos: agrupado.totalFotos,
    totalServicosComFotos: agrupado.totalServicosComFotos,
    etapas: agrupado.etapas,
  };

  const html = gerarHtmlRelatorioFotografico(dadosRelatorio);
  assert.ok(html.includes("Ciclo 01"), "Deve exibir badge do Ciclo 01 para foto registrada no primeiro ciclo");
  assert.ok(html.includes("Ciclo 02"), "Deve exibir badge do Ciclo 02 para foto registrada no segundo ciclo");
  assert.ok(html.includes("Ciclo 03"), "Deve exibir badge do Ciclo 03 para foto registrada no ciclo atual");
});

test("fotografiaRepository exporta listarFotografiasAteCiclo com suporte a ciclos anteriores", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const caminhoRepo = path.join(__dirname, "../src/repositories/fotografiaRepository.js");
  const conteudo = fs.readFileSync(caminhoRepo, "utf-8");

  assert.ok(
    conteudo.includes("export const listarFotografiasAteCiclo"),
    "Deve exportar a função listarFotografiasAteCiclo"
  );
  assert.ok(
    conteudo.includes("LEFT JOIN ciclos_medicao c ON f.ciclo_id = c.id"),
    "Deve fazer join com ciclos_medicao para identificar número do ciclo de cada foto"
  );
  assert.ok(
    conteudo.includes("c.numero_ciclo <= ?"),
    "Deve filtrar fotos com ciclo menor ou igual ao ciclo máximo solicitado"
  );
});


