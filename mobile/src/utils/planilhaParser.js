import * as xlsx from "xlsx";

// Importações seguras para compatibilidade Expo SDK 57 e ambiente Node
let ExpoFS = null;
let LegacyFS = null;
try {
  ExpoFS = require("expo-file-system");
} catch {}
try {
  LegacyFS = require("expo-file-system/legacy");
} catch {}

/**
 * Normaliza textos removendo acentos, quebras de linha (CRLF, LF, CR) e espaços extras.
 */
export function normalizarTexto(txt) {
  if (txt === null || txt === undefined) return "";
  return String(txt)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[\r\n\t\u00A0]+/g, " ") // substitui qualquer quebra de linha (\r, \n, \r\n, tabs) por espaço
    .replace(/\s+/g, " ") // colapsa múltiplos espaços em um único
    .trim()
    .toUpperCase();
}

/**
 * Formata o tamanho do arquivo em bytes para formato legível (KB ou MB).
 */
export function formatarTamanho(bytes) {
  if (!bytes || isNaN(bytes)) return "0 KB";
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".0", "")} MB`;
  }
  const kb = Math.round(bytes / 1024);
  return `${kb} KB`;
}

/**
 * Classifica se uma linha da planilha representa uma Etapa, um Serviço ou rodapé/ignorar.
 */
export function classificarLinha({
  item = "",
  codigo = "",
  descricao = "",
  fonte = "",
  und = "",
  quantidade = "",
  precoUnitario = "",
  precoTotal = "",
  rawRow = [],
}) {
  const rowStr = normalizarTexto(Array.isArray(rawRow) ? rawRow.join(" ") : "");
  if (!rowStr) return null;

  // 1. Identifica e ignora linhas de resumo, BDI, totais finais ou assinaturas
  if (
    rowStr.includes("VALOR BDI") ||
    rowStr.includes("VALOR ORCAMENTO") ||
    rowStr.includes("VALOR TOTAL") ||
    rowStr.includes("TOTAL GERAL") ||
    rowStr.includes("ASSINATURA") ||
    rowStr.includes("BDI TOTAL")
  ) {
    return null;
  }

  const temCamposExclusivosServico = Boolean(fonte || und || quantidade || precoUnitario);
  const temSubitem = String(item).includes(".") && !String(item).endsWith(".0");
  const temCodigoEDescricao = Boolean(codigo && descricao);

  if (temCamposExclusivosServico || temSubitem || temCodigoEDescricao) {
    return "SERVICO";
  }

  if (item || descricao || codigo || precoTotal) {
    return "ETAPA";
  }

  return null;
}

/**
 * Extrai a estrutura de etapas e serviços validando a planilha padrão.
 */
export function extrairDadosPlanilha(workbook, nomeArquivo) {
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    const err = new Error("Planilha vazia ou sem abas.");
    err.code = "INCOMPATIVEL";
    throw err;
  }

  const sheetName =
    workbook.SheetNames.find((s) => normalizarTexto(s).includes("ORCAMENTO")) ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"]) {
    const err = new Error("Aba principal da planilha sem dados.");
    err.code = "INCOMPATIVEL";
    throw err;
  }

  const range = xlsx.utils.decode_range(sheet["!ref"]);
  const rawRows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (!rawRows || rawRows.length === 0) {
    const err = new Error("Nenhum dado encontrado na planilha.");
    err.code = "INCOMPATIVEL";
    throw err;
  }

  // 1. Localiza a linha do cabeçalho
  let headerIndex = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row) || row.length < 8) continue;

    const col0 = normalizarTexto(row[0]);
    const col1 = normalizarTexto(row[1]);
    const col2 = normalizarTexto(row[2]);
    const col3 = normalizarTexto(row[3]);
    const col4 = normalizarTexto(row[4]);
    const col5 = normalizarTexto(row[5]);
    const col6 = normalizarTexto(row[6]);
    const col7 = normalizarTexto(row[7]);

    if (
      col0 === "ITEM" &&
      (col1 === "CODIGO" || col1 === "COD") &&
      col2 === "DESCRICAO" &&
      col3 === "FONTE" &&
      (col4 === "UND" || col4 === "UN" || col4 === "UNID") &&
      (col5 === "QUANTIDADE" || col5.startsWith("QUANTIDAD")) &&
      col6.includes("PRECO UNITARIO") &&
      col7.includes("PRECO TOTAL")
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    const err = new Error(
      "Cabeçalho da planilha padrão não encontrado. O modelo padrão deve conter as colunas: ITEM, CÓDIGO, DESCRIÇÃO, FONTE, UND, QUANTIDADE, PREÇO UNITÁRIO e PREÇO TOTAL."
    );
    err.code = "INCOMPATIVEL";
    throw err;
  }

  // 2. Os dados iniciam na linha seguinte ao cabeçalho
  const dataStartIndex = headerIndex + 1;

  // 3. Itera sobre as linhas de dados montando a árvore de etapas e serviços
  const etapas = [];
  let etapaAtual = null;
  let ultimaLinhaComDados = headerIndex + 1;

  for (let r = dataStartIndex; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row) || row.every((c) => !String(c).trim())) {
      continue;
    }

    ultimaLinhaComDados = r + 1;

    const colItem = String(row[0] || "").trim();
    const colCodigo = String(row[1] || "").trim();
    const colDescricao = String(row[2] || "").trim();
    const colFonte = String(row[3] || "").trim();
    const colUnd = String(row[4] || "").trim();
    const colQtd = String(row[5] || "").trim();
    const colPrecoUnitario = String(row[6] || "").trim();
    const colPrecoTotal = String(row[7] || "").trim();

    const tipo = classificarLinha({
      item: colItem,
      codigo: colCodigo,
      descricao: colDescricao,
      fonte: colFonte,
      und: colUnd,
      quantidade: colQtd,
      precoUnitario: colPrecoUnitario,
      precoTotal: colPrecoTotal,
      rawRow: row,
    });

    if (tipo === "ETAPA") {
      // Nome da etapa pode vir na coluna de descrição ou mesclada na coluna de código
      const nomeEtapa = colDescricao || colCodigo || `Etapa ${etapas.length + 1}`;

      etapaAtual = {
        ordem: etapas.length + 1,
        item: colItem || String(etapas.length + 1),
        nome: nomeEtapa,
        preco_total: colPrecoTotal || "0",
        servicos: [],
      };
      etapas.push(etapaAtual);
    } else if (tipo === "SERVICO") {
      if (!etapaAtual) {
        etapaAtual = {
          ordem: 1,
          item: "1",
          nome: "Serviços Gerais",
          preco_total: "0",
          servicos: [],
        };
        etapas.push(etapaAtual);
      }

      const ordemServico = etapaAtual.servicos.length + 1;
      const itemServico =
        colItem || `${etapaAtual.item || etapaAtual.ordem}.${ordemServico}`;
      const codigoServico =
        colCodigo || itemServico || `SERV-${etapaAtual.ordem}.${ordemServico}`;
      const descricaoServico =
        colDescricao || colCodigo || `Serviço ${ordemServico}`;

      etapaAtual.servicos.push({
        ordem: ordemServico,
        item: itemServico,
        codigo_servico: codigoServico,
        codigo: codigoServico,
        descricao: descricaoServico,
        fonte_origem: colFonte || null,
        fonte: colFonte || null,
        unidade_medida: colUnd || "UN",
        unidade: colUnd || "UN",
        quantidade_orcada: colQtd || "1",
        quantidade: colQtd || "1",
        preco_unitario: colPrecoUnitario || "0",
        preco_total: colPrecoTotal || "0",
      });
    }
  }

  // Filtra etapas vazias que não possuem serviços cadastrados
  const etapasValidas = etapas.filter(
    (et) => Array.isArray(et.servicos) && et.servicos.length > 0
  );

  const totalServicos = etapasValidas.reduce(
    (acc, et) => acc + (et.servicos ? et.servicos.length : 0),
    0
  );

  if (etapasValidas.length === 0 || totalServicos === 0) {
    const err = new Error(
      "Nenhuma etapa ou serviço válido foi identificado no modelo padrão."
    );
    err.code = "INCOMPATIVEL";
    throw err;
  }

  const totalLinhas = ultimaLinhaComDados;
  const totalColunas = Math.max(range.e.c + 1, 8);

  return {
    valido: true,
    totalLinhas,
    totalColunas,
    totalServicos,
    payload: {
      nome_arquivo: nomeArquivo || "planilha_padrao.xlsx",
      etapas: etapasValidas,
    },
  };
}

/**
 * Lê o arquivo em Base64 de forma multiplataforma (Android, iOS, Web).
 * Utiliza estratégias em cascata para superar restrições de sandbox e schemes do Expo Go.
 */
async function lerBase64Arquivo(uri, asset = null) {
  // 1. Web / Navegador: quando temos o objeto File nativo do HTML5
  if (asset && asset.file && typeof FileReader !== "undefined") {
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res === "string") {
            const parts = res.split(",");
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else {
            resolve(null);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(asset.file);
      });
      if (b64) return b64;
    } catch (e) {
      console.warn("Leitura via asset.file falhou:", e?.message);
    }
  }

  // 2. Expo SDK 57 File API (Modern API - acessa content:// e file:// via ContentResolver nativo)
  if (ExpoFS && ExpoFS.File) {
    try {
      const file = new ExpoFS.File(uri);
      if (typeof file.base64 === "function") {
        const b64 = await file.base64();
        if (b64) return b64;
      }
    } catch (e) {
      console.warn("Expo File.base64() falhou, tentando próxima estratégia:", e?.message);
    }
  }

  // 3. Estratégia de Cópia Segura para documentDirectory (contorna 'Location isn't readable' no Expo Go)
  const fs = LegacyFS || ExpoFS;
  if (
    fs &&
    fs.documentDirectory &&
    typeof fs.copyAsync === "function" &&
    typeof fs.readAsStringAsync === "function"
  ) {
    const tempTarget = `${fs.documentDirectory}temp_planilha_${Date.now()}.xlsx`;
    try {
      await fs.copyAsync({ from: uri, to: tempTarget });
      const encoding = fs.EncodingType?.Base64 || "base64";
      const b64 = await fs.readAsStringAsync(tempTarget, { encoding });
      if (b64) return b64;
    } catch (e) {
      console.warn("Cópia para documentDirectory falhou:", e?.message);
    } finally {
      try {
        if (typeof fs.deleteAsync === "function") {
          await fs.deleteAsync(tempTarget, { idempotent: true });
        }
      } catch {}
    }
  }

  // 4. Leitura direta legada (para iOS ou paths internos comuns)
  if (fs && typeof fs.readAsStringAsync === "function") {
    try {
      const encoding = fs.EncodingType?.Base64 || "base64";
      const b64 = await fs.readAsStringAsync(uri, { encoding });
      if (b64) return b64;
    } catch (e) {
      console.warn("readAsStringAsync direto falhou:", e?.message);
    }
  }

  // 5. Fallback via fetch + FileReader (funciona em Web para blob: e http:)
  if (typeof fetch === "function" && typeof FileReader !== "undefined") {
    try {
      const resposta = await fetch(uri);
      const blob = await resposta.blob();
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl === "string") {
            const parts = dataUrl.split(",");
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else {
            resolve(null);
          }
        };
        reader.readAsDataURL(blob);
      });
      if (b64) return b64;
    } catch (e) {
      console.warn("fetch/blob fallback falhou:", e?.message);
    }
  }

  throw new Error("Não foi possível acessar o arquivo selecionado no dispositivo.");
}

/**
 * Analisa e extrai dados e estatísticas do arquivo Excel (.xlsx / .xls).
 * Lança erro com código 'INCOMPATIVEL' caso a planilha não siga o padrão.
 */
export async function analisarPlanilha(uri, nomeArquivo, asset = null) {
  let b64;
  try {
    b64 = await lerBase64Arquivo(uri, asset);
  } catch (readError) {
    console.error("Erro na leitura do arquivo:", readError);
    const err = new Error(
      readError?.message?.includes("readable") || readError?.message?.includes("permissão")
        ? "Permissão negada ao acessar o arquivo no dispositivo. Tente copiar o arquivo para a pasta Downloads ou Documentos."
        : "Não foi possível acessar o arquivo selecionado."
    );
    err.code = "LEITURA";
    throw err;
  }

  let workbook;
  try {
    workbook = xlsx.read(b64, { type: "base64" });
  } catch (xlsxError) {
    console.error("Erro ao decodificar planilha:", xlsxError);
    const err = new Error("O arquivo selecionado não é uma planilha Excel válida.");
    err.code = "INCOMPATIVEL";
    throw err;
  }

  return extrairDadosPlanilha(workbook, nomeArquivo);
}

