/**
 * Utilitários puros para formatação, agrupamento e geração de HTML do Relatório Fotográfico (US27)
 * Compatível com ESM (React Native) e CJS (Node.js test runner).
 */

export function formatarDataHora(dataString) {
  if (!dataString) return "--/--/----";
  try {
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return String(dataString);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return String(dataString);
  }
}

export function formatarCoordenadas(foto) {
  if (
    foto &&
    (foto.possui_localizacao === 1 || foto.possui_localizacao === true) &&
    foto.latitude !== null &&
    foto.latitude !== undefined &&
    foto.longitude !== null &&
    foto.longitude !== undefined
  ) {
    const lat = Number(foto.latitude).toFixed(6);
    const lon = Number(foto.longitude).toFixed(6);
    return `Lat: ${lat} | Lon: ${lon}`;
  }
  return "Localização não informada";
}

export function agruparFotosPorEtapaEServico({ fotos, estruturaObra }) {
  const mapaServicos = {};
  const etapasOrdenadas = [];

  if (estruturaObra?.etapas && Array.isArray(estruturaObra.etapas)) {
    estruturaObra.etapas.forEach((etapa, idxEtapa) => {
      const etapaId = String(etapa.id || `etapa_${idxEtapa}`);
      const etapaObj = {
        id: etapaId,
        nome: etapa.nome || `Etapa ${idxEtapa + 1}`,
        ordem: etapa.ordem || idxEtapa + 1,
        servicos: [],
      };
      etapasOrdenadas.push(etapaObj);

      if (Array.isArray(etapa.servicos)) {
        etapa.servicos.forEach((srv, idxSrv) => {
          const srvId = String(srv.id || `srv_${idxSrv}`);
          const srvObj = {
            id: srvId,
            codigo: srv.codigo_servico || srv.codigo || "",
            descricao: srv.descricao || srv.nome || "Serviço sem descrição",
            etapaId: etapaId,
            etapaNome: etapaObj.nome,
            ordem: srv.ordem || idxSrv + 1,
            fotos: [],
          };
          mapaServicos[srvId] = srvObj;
          etapaObj.servicos.push(srvObj);
        });
      }
    });
  }

  const fotosNaoMapeadas = [];
  (fotos || []).forEach((f) => {
    const srvId = f.servico_id ? String(f.servico_id) : null;
    const itemFoto = {
      id: f.id,
      uri: f.caminho_local || f.caminho_comprimido || f.url_nuvem,
      dataHoraFormatada: formatarDataHora(
        f.data_hora_captura || f.created_at
      ),
      coordenadasTexto: formatarCoordenadas(f),
      possuiCoordenadas: Boolean(
        (f.possui_localizacao === 1 || f.possui_localizacao === true) &&
          f.latitude !== null &&
          f.longitude !== null
      ),
      latitude: f.latitude,
      longitude: f.longitude,
      servicoId: srvId,
      servicoDescricao:
        mapaServicos[srvId]?.descricao || "Registro fotográfico da obra",
    };

    if (srvId && mapaServicos[srvId]) {
      mapaServicos[srvId].fotos.push(itemFoto);
    } else {
      fotosNaoMapeadas.push(itemFoto);
    }
  });

  const etapasComFotos = etapasOrdenadas
    .map((et) => ({
      ...et,
      servicos: et.servicos.filter((s) => s.fotos.length > 0),
    }))
    .filter((et) => et.servicos.length > 0);

  if (fotosNaoMapeadas.length > 0) {
    etapasComFotos.push({
      id: "outros",
      nome: "Registros Gerais da Obra",
      ordem: 9999,
      servicos: [
        {
          id: "outros_servicos",
          codigo: "",
          descricao: "Registros fotográficos gerais do ciclo",
          fotos: fotosNaoMapeadas,
        },
      ],
    });
  }

  let totalFotos = 0;
  let totalServicosComFotos = 0;
  etapasComFotos.forEach((et) => {
    et.servicos.forEach((s) => {
      totalServicosComFotos += 1;
      totalFotos += s.fotos.length;
    });
  });

  return {
    etapas: etapasComFotos,
    totalFotos,
    totalServicosComFotos,
  };
}

export function gerarHtmlRelatorioFotografico(dadosRelatorio) {
  const {
    obraNome = "Obra",
    obraEndereco = "",
    numeroCiclo = 1,
    dataEmissao = "",
    totalFotos = 0,
    totalServicosComFotos = 0,
    etapas = [],
  } = dadosRelatorio || {};

  const etapasHtml = (etapas || [])
    .map((etapa) => {
      const servicosHtml = (etapa.servicos || [])
        .map((servico) => {
          const fotosHtml = (servico.fotos || [])
            .map((foto) => {
              const gpsClass = foto.possuiCoordenadas
                ? "gps-valido"
                : "gps-ausente";
              return `
              <div class="foto-card">
                <div class="foto-container">
                  <img src="${foto.uri}" alt="${servico.descricao}" class="foto-img" onerror="this.src='https://placehold.co/600x450/0f2a38/00e5bc?text=Imagem+N%C3%A3o+Dispon%C3%ADvel';" />
                  <span class="badge-ciclo">Ciclo ${String(numeroCiclo).padStart(2, "0")}</span>
                </div>
                <div class="foto-meta">
                  <div class="meta-row">
                    <span class="meta-label">📅 Data/Hora:</span>
                    <span class="meta-val">${foto.dataHoraFormatada}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-label">📍 Coordenadas:</span>
                    <span class="meta-val ${gpsClass}">${foto.coordenadasTexto}</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join("");

          return `
          <div class="servico-bloco">
            <div class="servico-header">
              <span class="servico-codigo">${servico.codigo ? servico.codigo + " - " : ""}</span>
              <span class="servico-nome">${servico.descricao}</span>
              <span class="servico-qtd-fotos">(${servico.fotos?.length || 0} ${servico.fotos?.length === 1 ? "foto" : "fotos"})</span>
            </div>
            <div class="fotos-grid">
              ${fotosHtml}
            </div>
          </div>
        `;
        })
        .join("");

      return `
      <section class="etapa-secao">
        <div class="etapa-titulo">
          <div class="etapa-icone"></div>
          <h2>${etapa.nome}</h2>
        </div>
        ${servicosHtml}
      </section>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Fotográfico - ${obraNome} - Ciclo ${numeroCiclo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 18mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #FFFFFF;
      color: #0F2A38;
      font-size: 11pt;
      line-height: 1.4;
      padding: 10px;
    }
    header.relatorio-header {
      border-bottom: 2px solid #0D6579;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-info h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0F2A38;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    .header-info .subtitulo {
      font-size: 12pt;
      font-weight: 600;
      color: #0D6579;
    }
    .header-info .endereco {
      font-size: 9.5pt;
      color: #64748B;
      margin-top: 3px;
    }
    .header-badge-box {
      text-align: right;
    }
    .ciclo-destaque {
      display: inline-block;
      background: linear-gradient(135deg, #0D6579, #09D1C7);
      color: #FFFFFF;
      font-size: 13pt;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .data-emissao {
      font-size: 8.5pt;
      color: #64748B;
      margin-top: 6px;
    }
    .resumo-cards {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .resumo-card {
      flex: 1;
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid #09D1C7;
      padding: 10px 14px;
      border-radius: 6px;
    }
    .resumo-card .valor {
      font-size: 16pt;
      font-weight: 800;
      color: #0D6579;
    }
    .resumo-card .rotulo {
      font-size: 8.5pt;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 600;
    }
    .etapa-secao {
      margin-bottom: 26px;
      page-break-inside: auto;
    }
    .etapa-titulo {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #0D6579;
      color: #FFFFFF;
      padding: 7px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    .etapa-titulo h2 {
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .servico-bloco {
      margin-bottom: 18px;
      page-break-inside: avoid;
      background-color: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px;
    }
    .servico-header {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0F2A38;
      border-bottom: 1px dashed #CBD5E1;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .servico-codigo {
      color: #0D6579;
    }
    .servico-qtd-fotos {
      font-size: 9pt;
      color: #64748B;
      font-weight: 400;
      margin-left: 6px;
    }
    .fotos-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: flex-start;
    }
    .foto-card {
      width: calc(50% - 6px);
      background-color: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .foto-container {
      position: relative;
      width: 100%;
      height: 200px;
      background-color: #0F172A;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .foto-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badge-ciclo {
      position: absolute;
      top: 8px;
      left: 8px;
      background-color: rgba(13, 101, 121, 0.90);
      color: #00E5BC;
      font-size: 8pt;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 229, 188, 0.3);
    }
    .foto-meta {
      padding: 8px 10px;
      font-size: 8.5pt;
      background-color: #FFFFFF;
      border-top: 1px solid #E2E8F0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .meta-label {
      color: #64748B;
      font-weight: 600;
    }
    .meta-val {
      color: #0F2A38;
      font-weight: 500;
      text-align: right;
    }
    .gps-valido {
      color: #0D9488;
      font-weight: 700;
    }
    .gps-ausente {
      color: #94A3B8;
      font-style: italic;
    }
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      background-color: #F8FAFC;
      border: 1px dashed #CBD5E1;
      border-radius: 8px;
      color: #64748B;
    }
    footer.relatorio-rodape {
      margin-top: 30px;
      border-top: 1px solid #CBD5E1;
      padding-top: 8px;
      font-size: 8pt;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <header class="relatorio-header">
    <div class="header-info">
      <h1>Relatório Fotográfico de Medição</h1>
      <div class="subtitulo">${obraNome}</div>
      ${obraEndereco ? `<div class="endereco">📍 ${obraEndereco}</div>` : ""}
    </div>
    <div class="header-badge-box">
      <span class="ciclo-destaque">Ciclo ${String(numeroCiclo).padStart(2, "0")}</span>
      <div class="data-emissao">Emitido em: ${dataEmissao}</div>
    </div>
  </header>

  <div class="resumo-cards">
    <div class="resumo-card">
      <div class="valor">${totalFotos}</div>
      <div class="rotulo">Total de Fotografias</div>
    </div>
    <div class="resumo-card">
      <div class="valor">${totalServicosComFotos}</div>
      <div class="rotulo">Serviços com Evidência</div>
    </div>
    <div class="resumo-card">
      <div class="valor">${etapas.length}</div>
      <div class="rotulo">Etapas Registradas</div>
    </div>
  </div>

  <main>
    ${
      etapas.length > 0
        ? etapasHtml
        : `
      <div class="empty-state">
        <h3>Nenhuma fotografia registrada neste ciclo</h3>
        <p>Não há fotos vinculadas aos serviços medidos durante o Ciclo ${String(numeroCiclo).padStart(2, "0")}.</p>
      </div>
    `
    }
  </main>

  <footer class="relatorio-rodape">
    <span>Sistema de Registro e Acompanhamento de Medições em Construções Civis</span>
    <span>Documentação Visual de Medição</span>
  </footer>
</body>
</html>
  `.trim();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatarDataHora,
    formatarCoordenadas,
    agruparFotosPorEtapaEServico,
    gerarHtmlRelatorioFotografico,
  };
}
