import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  cores,
  fontes,
  gradienteCores,
  gradianteDistribuicaoDownload,
  gradienteCoresInvertido,
  gradienteDistribuicaoCompleta,
} from "../styles/theme";
import FeedbackModal from "../components/FeedbackModal";
import { obterDadosMedicao, registrarMedicao } from "../services/medicaoService";

/* ------------------------------------------------------------------ */
/*  MOCK DATA (Fallback caso a tela seja aberta sem parâmetros de rota) */
/* ------------------------------------------------------------------ */

const MOCK_SERVICO = {
  id: "srv-01",
  codigo: "—",
  descricao:
    "PLACA DE OBRA (PARA CONSTRUCAO CIVIL) EM CHAPA GALVANIZADA *N. 22*, ADESIVADA, DE *2,4 X 1,2* M (SEM POSTES PARA FIXACAO)",
  origem: "SEINFRA",
  unidadeMedida: "m³",
  valorUnidade: 234.32,
  valorTotalContratado: 23242.23,
  quantidadePrevista: 183,
  quantidadeAcumuladaAnterior: 23,
};

/* ------------------------------------------------------------------ */
/*  CONFIGURAÇÃO E VALIDAÇÃO DE UNIDADES DE MEDIDA (US16 / RF16)      */
/* ------------------------------------------------------------------ */

const normalizarUnidade = (unidade) => {
  if (!unidade || typeof unidade !== "string") return "default";
  const limpa = unidade.trim().toLowerCase();
  if (
    [
      "un",
      "und",
      "unid",
      "unidade",
      "unidades",
      "cj",
      "conjunto",
      "pt",
      "ponto",
      "vb",
      "verba",
      "pc",
      "pç",
      "peca",
      "peça",
    ].includes(limpa)
  ) {
    return "un";
  }
  if (["m", "metro", "metros"].includes(limpa)) {
    return "m";
  }
  if (
    ["m²", "m2", "m^2"].includes(limpa)
  ) {
    return "m²";
  }
  if (
    ["m³", "m3", "m^3"].includes(limpa)
  ) {
    return "m³";
  }
  if (
    ["kg", "kilo", "quilo", "quilograma", "quilogramas"].includes(limpa)
  ) {
    return "kg";
  }
  if (["t", "ton", "tonelada", "toneladas"].includes(limpa)) {
    return "t";
  }
  return "default";
};

const UNIT_CONFIG = {
  un: { step: 1, decimals: 0, isInteger: true },
  m: { step: 0.1, decimals: 1, isInteger: false },
  "m²": { step: 0.1, decimals: 1, isInteger: false },
  "m³": { step: 0.1, decimals: 1, isInteger: false },
  kg: { step: 0.01, decimals: 2, isInteger: false },
  t: { step: 0.001, decimals: 3, isInteger: false },
  default: { step: 0.1, decimals: 1, isInteger: false },
};

const getUnitConfig = (unidade) => {
  const chave = normalizarUnidade(unidade);
  return UNIT_CONFIG[chave] ?? UNIT_CONFIG.default;
};

/**
 * Máscara e validação em tempo de digitação:
 * - Adapta conforme unidade inteira (un, vb, cj) vs decimal (m, m², m³, kg, t).
 * - Impede inserção de múltiplos pontos ou vírgulas.
 * - Limita rigorosamente as casas decimais ao valor suportado pela unidade.
 * - Não permite números negativos ou letras.
 */
const aplicarMascaraQuantidade = (texto, config) => {
  if (!texto) return "";

  // Substitui vírgula por ponto para padronização interna
  let valor = texto.replace(",", ".");

  if (config.isInteger) {
    // Unidade inteira: apenas dígitos numéricos, sem ponto nem vírgula
    return valor.replace(/\D/g, "");
  }

  // Unidade decimal: permite apenas dígitos numéricos e um único ponto
  valor = valor.replace(/[^0-9.]/g, "");
  const partes = valor.split(".");
  if (partes.length > 2) {
    valor = `${partes[0]}.${partes.slice(1).join("")}`;
  }

  // Limita as casas decimais conforme a unidade
  if (valor.includes(".")) {
    const [inteiro, decimal] = valor.split(".");
    const decimalLimitado = decimal.slice(0, config.decimals);
    return `${inteiro}.${decimalLimitado}`;
  }

  return valor;
};

const formatBRL = (value) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatQty = (value, decimals) => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return decimals === 0 ? "0" : Number(0).toFixed(decimals);
  }
  return Number(value).toFixed(decimals);
};

/* ------------------------------------------------------------------ */
/*  Cartão de métrica (grelha 2x2)                                      */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Ecrã principal                                                       */
/* ------------------------------------------------------------------ */

export default function MedicaoScreen({ navigation, route }) {
  const servicoId = route?.params?.servicoId;
  const cicloId = route?.params?.cicloId;

  const [servico, setServico] = useState(MOCK_SERVICO);
  const [medicaoId, setMedicaoId] = useState(null);

  const unitConfig = useMemo(
    () => getUnitConfig(servico.unidadeMedida),
    [servico.unidadeMedida]
  );
  const { step, decimals, isInteger } = unitConfig;

  const [quantidade, setQuantidade] = useState(12.3);
  const [textoQuantidade, setTextoQuantidade] = useState(
    formatQty(12.3, unitConfig.decimals)
  );
  const [acumuladoAnterior, setAcumuladoAnterior] = useState(
    MOCK_SERVICO.quantidadeAcumuladaAnterior,
  );
  const [feedback, setFeedback] = useState(null); // null | "loading" | "success"

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      if (!servicoId || !cicloId) return;

      try {
        const dados = await obterDadosMedicao(servicoId, cicloId);
        if (!ativo || !dados) return;

        let unidadeAtual = "m³";
        if (dados.servico) {
          unidadeAtual = dados.servico.unidade_medida || "un";
          setServico({
            id: dados.servico.id,
            codigo: dados.servico.codigo_servico || "—",
            descricao: dados.servico.descricao,
            origem: dados.servico.origem || "SEINFRA",
            unidadeMedida: unidadeAtual,
            valorUnidade: parseFloat(dados.servico.preco_unitario || 0),
            valorTotalContratado: parseFloat(dados.servico.preco_total || 0),
            quantidadePrevista: parseFloat(dados.servico.quantidade_orcada || 0),
            quantidadeAcumuladaAnterior: parseFloat(
              dados.acumulado_anterior?.quantidade_acumulada_anterior || 0,
            ),
          });
        }

        const cfg = getUnitConfig(unidadeAtual);
        const qtdAnterior = parseFloat(
          dados.acumulado_anterior?.quantidade_acumulada_anterior || 0,
        );
        setAcumuladoAnterior(qtdAnterior);

        if (dados.medicao_atual) {
          setMedicaoId(dados.medicao_atual.id);
          const qtdAtual = parseFloat(
            dados.medicao_atual.quantidade_medida_periodo || 0,
          );
          setQuantidade(qtdAtual);
          setTextoQuantidade(formatQty(qtdAtual, cfg.decimals));
        } else {
          setQuantidade(0);
          setTextoQuantidade(formatQty(0, cfg.decimals));
        }
      } catch (error) {
        console.error("Erro ao carregar dados da medição:", error);
      }
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, [servicoId, cicloId]);

  /* RF17 — acumulado e saldo recalculados a cada alteração da quantidade */
  const acumuladoAtual = useMemo(
    () => acumuladoAnterior + quantidade,
    [acumuladoAnterior, quantidade],
  );
  const saldo = useMemo(
    () => Math.max(servico.quantidadePrevista - acumuladoAtual, 0),
    [servico.quantidadePrevista, acumuladoAtual],
  );
  const valorExecutadoPeriodo = useMemo(
    () => quantidade * servico.valorUnidade,
    [quantidade, servico.valorUnidade],
  );

  const handleChangeTexto = useCallback(
    (novoTexto) => {
      const textoFormatado = aplicarMascaraQuantidade(novoTexto, unitConfig);
      setTextoQuantidade(textoFormatado);

      const valorNumerico = parseFloat(textoFormatado);
      setQuantidade(isNaN(valorNumerico) ? 0 : valorNumerico);
    },
    [unitConfig]
  );

  const handleBlur = useCallback(() => {
    setTextoQuantidade(formatQty(quantidade, decimals));
  }, [quantidade, decimals]);

  const handleDecrement = useCallback(() => {
    setQuantidade((current) => {
      const next = Math.max(0, Number((current - step).toFixed(decimals)));
      setTextoQuantidade(formatQty(next, decimals));
      return next;
    });
  }, [step, decimals]);

  const handleIncrement = useCallback(() => {
    setQuantidade((current) => {
      const next = Number((current + step).toFixed(decimals));
      setTextoQuantidade(formatQty(next, decimals));
      return next;
    });
  }, [step, decimals]);

  const handleRegistrar = useCallback(async () => {
    setFeedback("loading");

    try {
      if (servicoId && cicloId) {
        const resposta = await registrarMedicao({
          id: medicaoId,
          cicloId,
          servicoId,
          quantidadeMedidaPeriodo: quantidade,
        });

        if (resposta?.id) {
          setMedicaoId(resposta.id);
        }

        if (resposta?.quantidade_acumulada_anterior !== undefined) {
          setAcumuladoAnterior(
            parseFloat(resposta.quantidade_acumulada_anterior),
          );
        }

        setFeedback("success");

        setTimeout(() => {
          setFeedback(null);
          navigation?.goBack?.();
        }, 1200);
      } else {
        // Simula a persistência local quando sem parâmetros
        setTimeout(() => {
          setAcumuladoAnterior((prev) => prev + quantidade);
          setFeedback("success");

          setTimeout(() => {
            setFeedback(null);
            setQuantidade(0);
            navigation?.goBack?.();
          }, 1200);
        }, 1000);
      }
    } catch (error) {
      console.error("Erro ao registrar medição:", error);
      setFeedback(null);
      Alert.alert(
        "Erro na Medição",
        error.message || "Não foi possível registrar a medição. Tente novamente."
      );
    }
  }, [servicoId, cicloId, medicaoId, quantidade, navigation]);

  const handleFoto = useCallback(() => {
    // TODO: acionar captura de fotografia vinculada ao serviço (RF24)
    // navigation.navigate('CapturaFoto', { servicoId: servico.id });
    console.log("Abrir câmera para foto do serviço", servico.id);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Cabeçalho ---------------- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={8}>
            <Ionicons name="chevron-back" size={28} color={cores.textoEscuro} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Medição</Text>
        </View>

        {/* ---------------- Banner informativo ---------------- */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Registre a medida executado do serviço no ciclo atual.
          </Text>
        </View>

        {/* ---------------- Cartão de detalhes do serviço ---------------- */}
        <View style={styles.servicoCard}>
          <Text style={styles.servicoCodLabel}>Cód.</Text>
          <Text style={styles.servicoDescricao}>{servico.descricao}</Text>
          <Text style={styles.servicoRodape}>
            {servico.origem} - Unidade de medida: {servico.unidadeMedida} -
            Valor unidade: {formatBRL(servico.valorUnidade)} - Total:{" "}
            {servico.valorTotalContratado.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* ---------------- Grelha de métricas (2x2) ---------------- */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Previsto"
            value={`${formatQty(servico.quantidadePrevista, decimals)} ${servico.unidadeMedida}`}
          />
          <MetricCard
            label="Acumulado"
            value={`${formatQty(acumuladoAtual, decimals)} ${servico.unidadeMedida}`}
          />
          <MetricCard
            label="Saldo"
            value={`${formatQty(saldo, decimals)} ${servico.unidadeMedida}`}
          />
          <MetricCard
            label="Executado"
            value={formatBRL(valorExecutadoPeriodo)}
          />
        </View>

        {/* ---------------- Input de quantidade (RF15/RF16) ---------------- */}
        <Text style={styles.inputLabel}>Quantidade executada nesse ciclo:</Text>

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={handleDecrement}
            hitSlop={8}
            disabled={quantidade <= 0}
          >
            <Feather
              name="minus"
              size={20}
              color={quantidade <= 0 ? "#B7C0C8" : cores.azulPetroleo}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.inputValue}
            value={textoQuantidade}
            onChangeText={handleChangeTexto}
            onBlur={handleBlur}
            keyboardType={isInteger ? "number-pad" : "decimal-pad"}
            selectTextOnFocus
            textAlign="center"
          />

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={handleIncrement}
            hitSlop={8}
          >
            <Feather name="plus" size={20} color={cores.azulPetroleo} />
          </TouchableOpacity>
        </View>

        {/* ---------------- Botões de ação ---------------- */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              quantidade <= 0 && styles.actionBtnDisabled,
            ]}
            onPress={handleRegistrar}
            disabled={quantidade <= 0}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              locations={gradianteDistribuicaoDownload}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradiente}
            />
            <Text style={styles.actionBtnLabel}>Registrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleFoto}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              locations={gradianteDistribuicaoDownload}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradiente}
            />
            <Text style={styles.actionBtnLabel}>Foto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={feedback !== null}
        variant={feedback ?? "loading"}
        onRequestClose={() => setFeedback(null)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Estilos                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: cores.fundoCard,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: cores.textoEscuro,
    marginLeft: 15,
  },

  banner: {
    backgroundColor: cores.fundoBanner,
    borderRadius: 16,
    padding: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  bannerText: {
    color: cores.azulPetroleo,
    fontSize: 14,
    fontFamily: fontes.media,
    lineHeight: 20,
  },

  servicoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    ...{
      shadowColor: "#0F172A",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  },
  servicoCodLabel: {
    fontSize: 12,
    fontFamily: fontes.media,
    color: cores.azulPetroleo,
    marginBottom: 4,
  },
  servicoDescricao: {
    fontSize: 18,
    fontWeight: "800",
    color: cores.textoEscuro,
    textTransform: "uppercase",
    lineHeight: 21,
  },
  servicoRodape: {
    fontSize: 12,
    color: cores.azulPetroleo,
    fontFamily: fontes.media,
    marginTop: 10,
    lineHeight: 16,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metricCard: {
    width: "48%",
    backgroundColor: cores.fundoCardMetric,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: fontes.semiNegrito,
    color: cores.textoEscuro,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: cores.azulPetroleo,
  },

  inputLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: cores.textoEscuro,
    marginBottom: 12,
    marginLeft: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: cores.fundoBanner,
    borderRadius: 15,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: cores.azulPetroleo,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  inputValue: {
    fontSize: 16,
    fontWeight: "700",
    color: cores.azulPetroleo,
    minWidth: 80,
    paddingVertical: 0,
    textAlign: "center",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  gradiente: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  actionBtnDisabled: {
    backgroundColor: "#B7C0C8",
  },
  actionBtnLabel: {
    color: "#FFFFFF",
    fontFamily: fontes.semiNegrito,
    fontSize: 15,
    paddingVertical: 14,
    zIndex: 1,
  },
});
