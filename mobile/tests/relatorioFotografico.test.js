// mobile/tests/relatorioFotografico.test.js
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
