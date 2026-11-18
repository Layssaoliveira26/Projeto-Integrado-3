/**
 * Utilitários para resolução e formatação de endereço a partir de geolocalização
 * (contendo Rua, Bairro, Cidade, Estado e País).
 */

const REGEX_COORDENADA_BRUTA = /^-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?)?$/;
const REGEX_PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i;
const REGEX_APENAS_NUMERO = /^(\d+[A-Za-z]?|s\/n|sn|sem\s+n[uú]mero)$/i;

export function limparComponenteEndereco(valor) {
  if (!valor || typeof valor !== "string") return "";
  let limpo = valor.trim();
  if (!limpo) return "";

  if (
    REGEX_COORDENADA_BRUTA.test(limpo) ||
    REGEX_PLUS_CODE.test(limpo) ||
    REGEX_APENAS_NUMERO.test(limpo)
  ) {
    return "";
  }

  limpo = limpo
    .replace(/,\s*(n[º°.]?\s*)?\d+[A-Za-z-]*(?=\s*,|$)/gi, "")
    .replace(/\s+(n[º°.]\s*)\d+[A-Za-z-]*(?=\s*,|$)/gi, "")
    .trim();

  if (REGEX_APENAS_NUMERO.test(limpo)) {
    return "";
  }

  return limpo;
}

/**
 * Formata o endereço contendo Rua, Bairro, Cidade, Estado e País,
 * mesclando dados do geocoder nativo e/ou OpenStreetMap Nominatim.
 */
export function formatarEnderecoGeolocalizacao(
  itemNativo = {},
  addressNominatim = {}
) {
  const nativo = itemNativo || {};
  const osm = addressNominatim || {};

  const cidade =
    limparComponenteEndereco(nativo.city) ||
    limparComponenteEndereco(nativo.locality) ||
    limparComponenteEndereco(osm.city) ||
    limparComponenteEndereco(osm.town) ||
    limparComponenteEndereco(osm.municipality) ||
    limparComponenteEndereco(osm.village) ||
    limparComponenteEndereco(nativo.subregion) ||
    limparComponenteEndereco(osm.county) ||
    "";

  const bairroCandidatoNativo =
    limparComponenteEndereco(nativo.district) ||
    limparComponenteEndereco(nativo.subLocality) ||
    (nativo.subregion &&
    limparComponenteEndereco(nativo.subregion).toLowerCase() !==
      cidade.toLowerCase()
      ? limparComponenteEndereco(nativo.subregion)
      : "");

  const bairro =
    bairroCandidatoNativo ||
    limparComponenteEndereco(osm.suburb) ||
    limparComponenteEndereco(osm.neighbourhood) ||
    limparComponenteEndereco(osm.quarter) ||
    limparComponenteEndereco(osm.city_district) ||
    limparComponenteEndereco(osm.district) ||
    limparComponenteEndereco(osm.borough) ||
    "";

  const ruaCandidataNome =
    nativo.name &&
    limparComponenteEndereco(nativo.name).toLowerCase() !==
      cidade.toLowerCase() &&
    limparComponenteEndereco(nativo.name).toLowerCase() !== bairro.toLowerCase()
      ? limparComponenteEndereco(nativo.name)
      : "";

  const rua =
    limparComponenteEndereco(nativo.street) ||
    limparComponenteEndereco(nativo.thoroughfare) ||
    limparComponenteEndereco(osm.road) ||
    limparComponenteEndereco(osm.pedestrian) ||
    limparComponenteEndereco(osm.street) ||
    limparComponenteEndereco(osm.footway) ||
    limparComponenteEndereco(osm.residential) ||
    limparComponenteEndereco(osm.highway) ||
    ruaCandidataNome ||
    "";

  const estado =
    limparComponenteEndereco(nativo.region) ||
    limparComponenteEndereco(nativo.administrativeArea) ||
    limparComponenteEndereco(osm.state) ||
    limparComponenteEndereco(osm.region) ||
    "";

  const pais =
    limparComponenteEndereco(nativo.country) ||
    limparComponenteEndereco(osm.country) ||
    "";

  const partesOrdenadas = [rua, bairro, cidade, estado, pais];
  const partesUnicas = [];
  const vistos = new Set();

  for (const parte of partesOrdenadas) {
    if (!parte) continue;
    const chave = parte.toLowerCase();
    if (!vistos.has(chave)) {
      vistos.add(chave);
      partesUnicas.push(parte);
    }
  }

  return partesUnicas.join(", ");
}

/**
 * Resolve as coordenadas (latitude, longitude) em um nome de endereço legível
 * (Rua, Bairro, Cidade, Estado, País) utilizando o geocoder nativo e fallback Nominatim,
 * garantindo que coordenadas brutas nunca sejam exibidas.
 */
export async function obterEnderecoPorCoordenadas({
  latitude,
  longitude,
  reverseGeocodeFn,
  fetchFn = typeof fetch === "function" ? fetch : null,
  enderecoFallback = "",
}) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    Number.isNaN(Number(latitude)) ||
    Number.isNaN(Number(longitude))
  ) {
    return enderecoFallback || "Localização não informada";
  }

  let itemNativo = {};
  let addressNominatim = {};

  // 1. Tenta o geocoder nativo do dispositivo (expo-location)
  if (typeof reverseGeocodeFn === "function") {
    try {
      const geocodePromise = reverseGeocodeFn({
        latitude: Number(latitude),
        longitude: Number(longitude),
      });
      const geocodeTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout Geocode")), 4000)
      );
      const resultado = await Promise.race([geocodePromise, geocodeTimeout]);
      if (Array.isArray(resultado) && resultado.length > 0 && resultado[0]) {
        itemNativo = resultado[0];
      }
    } catch {
      itemNativo = {};
    }
  }

  // Verifica se já possui todas as 5 informações essenciais (rua, bairro, cidade, estado, país)
  const temRua = Boolean(
    limparComponenteEndereco(itemNativo.street || itemNativo.thoroughfare)
  );
  const temBairro = Boolean(
    limparComponenteEndereco(itemNativo.district || itemNativo.subLocality)
  );
  const temCidade = Boolean(
    limparComponenteEndereco(
      itemNativo.city || itemNativo.locality || itemNativo.subregion
    )
  );
  const temEstado = Boolean(
    limparComponenteEndereco(itemNativo.region || itemNativo.administrativeArea)
  );
  const temPais = Boolean(limparComponenteEndereco(itemNativo.country));

  const enderecoCompletoNativo =
    temRua && temBairro && temCidade && temEstado && temPais;

  // 2. Se o geocoder nativo falhou ou retornou endereço incompleto, complementa via Nominatim (OSM)
  if (!enderecoCompletoNativo && typeof fetchFn === "function") {
    try {
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => {
        if (controller) controller.abort();
      }, 4000);

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          latitude
        )}&lon=${encodeURIComponent(
          longitude
        )}&accept-language=pt-BR&addressdetails=1`;

        const resp = await fetchFn(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "MetriaApp/1.0",
          },
          ...(controller ? { signal: controller.signal } : {}),
        });

        if (resp && resp.ok) {
          const dadosOsm = await resp.json();
          if (dadosOsm && dadosOsm.address) {
            addressNominatim = dadosOsm.address;
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Sem internet ou timeout no Nominatim: prossegue com o que já foi obtido
    }
  }

  const enderecoFormatado = formatarEnderecoGeolocalizacao(
    itemNativo,
    addressNominatim
  );

  if (enderecoFormatado) {
    return enderecoFormatado;
  }

  const fallbackLimpo = limparComponenteEndereco(enderecoFallback);
  return fallbackLimpo || "Endereço não disponível offline";
}

