// backend/src/utils/unidadesMedida.js
// Padronização de unidades de medida segundo SI / ABNT NBR / SINAPI

const MAPA_UNIDADES_CANONICAS = {
  // Unidades discretas / inteiras
  un: "un",
  und: "un",
  unid: "un",
  unidade: "un",
  unidades: "un",
  cj: "cj",
  conj: "cj",
  conjunto: "cj",
  conjuntos: "cj",
  vb: "vb",
  verba: "vb",
  verbas: "vb",
  pt: "pt",
  pto: "pt",
  ponto: "pt",
  pontos: "pt",
  pc: "pç",
  "pç": "pç",
  peca: "pç",
  "peça": "pç",
  pecas: "pç",
  "peças": "pç",
  par: "par",
  pares: "par",

  // Global
  gl: "gl",
  global: "gl",

  // Comprimento (SI)
  m: "m",
  ml: "m",
  metro: "m",
  metros: "m",
  "metro linear": "m",
  "metros lineares": "m",
  cm: "cm",
  centimetro: "cm",
  "centímetro": "cm",
  centimetros: "cm",
  "centímetros": "cm",
  mm: "mm",
  milimetro: "mm",
  "milímetro": "mm",
  milimetros: "mm",
  "milímetros": "mm",
  km: "km",
  quilometro: "km",
  "quilômetro": "km",
  quilometros: "km",
  "quilômetros": "km",

  // Área (SI: m², cm², mm², km², ha)
  m2: "m²",
  "m²": "m²",
  "m^2": "m²",
  "metro quadrado": "m²",
  "metros quadrados": "m²",
  cm2: "cm²",
  "cm²": "cm²",
  "cm^2": "cm²",
  mm2: "mm²",
  "mm²": "mm²",
  "mm^2": "mm²",
  km2: "km²",
  "km²": "km²",
  "km^2": "km²",
  ha: "ha",
  hectare: "ha",
  hectares: "ha",

  // Volume (SI: m³, cm³, dm³, L)
  m3: "m³",
  "m³": "m³",
  "m^3": "m³",
  "metro cubico": "m³",
  "metro cúbico": "m³",
  "metros cubicos": "m³",
  "metros cúbicos": "m³",
  cm3: "cm³",
  "cm³": "cm³",
  "cm^3": "cm³",
  dm3: "dm³",
  "dm³": "dm³",
  "dm^3": "dm³",
  l: "L",
  lt: "L",
  litro: "L",
  litros: "L",

  // Massa (SI: kg, g, t)
  kg: "kg",
  kilo: "kg",
  quilo: "kg",
  quilograma: "kg",
  quilogramas: "kg",
  g: "g",
  gr: "g",
  grama: "g",
  gramas: "g",
  t: "t",
  ton: "t",
  tonelada: "t",
  toneladas: "t",

  // Tempo
  h: "h",
  hr: "h",
  hrs: "h",
  hora: "h",
  horas: "h",
  d: "dia",
  dia: "dia",
  dias: "dia",
  mes: "mês",
  "mês": "mês",
  meses: "mês",

  // Unidades compostas e horárias SINAPI / engenharia civil
  m2xmes: "m²×mês",
  "m2 x mes": "m²×mês",
  "m²xmes": "m²×mês",
  "m²xmês": "m²×mês",
  "m² x mês": "m²×mês",
  "m2*mes": "m²×mês",
  "m2.mes": "m²×mês",
  "m²·mês": "m²×mês",
  "m²×mês": "m²×mês",
  mxmes: "m×mês",
  "m x mes": "m×mês",
  "m x mês": "m×mês",
  "m*mes": "m×mês",
  "m×mês": "m×mês",
  m3xkm: "m³×km",
  "m3 x km": "m³×km",
  "m³xkm": "m³×km",
  "m³ x km": "m³×km",
  "m³×km": "m³×km",
  txkm: "t×km",
  "t x km": "t×km",
  "t×km": "t×km",
  chp: "CHP",
  chi: "CHI",
};

const UNIDADES_INTEIRAS_SET = new Set([
  "un",
  "und",
  "unid",
  "unidade",
  "unidades",
  "cj",
  "conj",
  "conjunto",
  "conjuntos",
  "pt",
  "pto",
  "ponto",
  "pontos",
  "vb",
  "verba",
  "verbas",
  "pc",
  "pç",
  "peca",
  "peça",
  "pecas",
  "peças",
  "par",
  "pares",
]);

function padronizarUnidadeMedida(valor, fallback = "un") {
  if (valor === null || valor === undefined) return fallback;
  const textoBruto = String(valor)
    .replace(/[\r\n\t\u00A0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!textoBruto) return fallback;

  const semPontoFinal = textoBruto.replace(/\.+$/, "").trim();
  const chave = semPontoFinal.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(MAPA_UNIDADES_CANONICAS, chave)) {
    return MAPA_UNIDADES_CANONICAS[chave];
  }

  return semPontoFinal
    .toLowerCase()
    .replace(/\b([ckmd]?m)\s*\^?\s*2\b/gi, (_, prefixo) => `${prefixo.toLowerCase()}²`)
    .replace(/\b([ckmd]?m)\s*\^?\s*3\b/gi, (_, prefixo) => `${prefixo.toLowerCase()}³`)
    .replace(/m\^2|m2(?![a-z0-9])/gi, "m²")
    .replace(/m\^3|m3(?![a-z0-9])/gi, "m³")
    .replace(/m²\s*x\s*m[eê]s/gi, "m²×mês")
    .replace(/m³\s*x\s*km/gi, "m³×km")
    .replace(/\bund?\b/gi, "un")
    .replace(/\bmes\b/gi, "mês");
}

function ehUnidadeInteira(unidade) {
  if (!unidade) return false;
  const limpa = String(unidade)
    .trim()
    .replace(/\.+$/, "")
    .toLowerCase();
  const canonica = padronizarUnidadeMedida(limpa, "");
  return UNIDADES_INTEIRAS_SET.has(limpa) || UNIDADES_INTEIRAS_SET.has(canonica);
}

module.exports = {
  padronizarUnidadeMedida,
  ehUnidadeInteira,
};
