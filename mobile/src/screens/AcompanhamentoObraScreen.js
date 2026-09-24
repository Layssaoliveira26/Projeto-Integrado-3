import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { ChevronLeft, Menu, ChevronDown, ChevronUp, Pencil } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

function CircleProgress({ percentage = 0, size = 46, strokeWidth = 3.5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (circumference * clamped) / 100;

  return (
    <View style={styles.circleProgressContainer}>
      <Svg width={size} height={size} style={styles.circleSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#09D1C7"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Text style={styles.circleText}>{clamped}%</Text>
    </View>
  );
}

export default function AcompanhamentoObraScreen({ navigation, route }) {
  const [dadosObra, setDadosObra] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [etapasAbertas, setEtapasAbertas] = useState({});
  const [abaAtiva, setAbaAtiva] = useState("Etapas");

  const carregarEstrutura = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) {
        setCarregando(true);
      }
      let targetId = route?.params?.obraId;
      if (!targetId) {
        const lista = await api.listarObras().catch(() => []);
        if (Array.isArray(lista) && lista.length > 0) {
          targetId = lista[0].id;
        } else {
          targetId = "b2c3d4e5-0000-0000-0000-000000000002";
        }
      }
      const response = await api.get(`/obras/estrutura/${targetId}`);
      setDadosObra(response?.data || response);
    } catch (error) {
      console.error("Erro ao carregar obra:", error.response?.data || error.message);
    } finally {
      setCarregando(false);
    }
  }, [route?.params?.obraId]);

  useFocusEffect(
    useCallback(() => {
      carregarEstrutura(Boolean(dadosObra));
    }, [carregarEstrutura, Boolean(dadosObra)])
  );

  const toggleEtapa = (id) => {
    setEtapasAbertas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (carregando) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00875A" />
      </View>
    );
  }

  const progressoGeral = Math.round(dadosObra?.progresso_geral_percentual || 0);

  const imagemParam = route?.params?.imagem;
  const imagemSource = imagemParam
    ? typeof imagemParam === "string"
      ? { uri: imagemParam }
      : imagemParam
    : require("../utils/img/obra1.jpg");

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ImageBackground
          source={imagemSource}
          style={styles.headerBackground}
          imageStyle={styles.headerImage}
        >
          {/* Sombra no topo para leitura do título sobre a foto */}
          <LinearGradient
            colors={[
              "rgba(0, 0, 0, 0.65)",
              "rgba(0, 0, 0, 0.25)",
              "transparent",
            ]}
            locations={[0, 0.5, 1]}
            style={styles.topFade}
            pointerEvents="none"
          />

          {/* Transição suave na base para integrar com o fundo #F6F4F0 */}
          <LinearGradient
            colors={[
              "rgba(246, 244, 240, 0)",
              "rgba(246, 244, 240, 0.04)",
              "rgba(246, 244, 240, 0.20)",
              "rgba(246, 244, 240, 0.50)",
              "rgba(246, 244, 240, 0.85)",
              "#F6F4F0",
              "#F6F4F0",
            ]}
            locations={[0, 0.18, 0.32, 0.46, 0.58, 0.66, 1.0]}
            style={styles.headerFade}
            pointerEvents="none"
          />

          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation?.goBack?.()}
                  activeOpacity={0.7}
                >
                  <ChevronLeft color="#FFF" size={32} strokeWidth={2.8} />
                </TouchableOpacity>
                <Text style={styles.obraTitulo} numberOfLines={1} ellipsizeMode="tail">
                  {dadosObra?.nome || "NomeObra"}
                </Text>
              </View>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
                <Menu color="#FFF" size={28} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressoSection}>
              <Text style={styles.progressoLabel}>Progresso geral</Text>
              <Text style={styles.progressoValor}>{progressoGeral}%</Text>
              <View style={styles.progressBarTrack}>
                <LinearGradient
                  colors={["#81EF99", "#46DFB3", "#09D1C7", "#16929C", "#0D6579"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.progressBarFill, { width: `${Math.min(Math.max(progressoGeral, 0), 100)}%` }]}
                />
              </View>
            </View>

            <View style={styles.cicloRow}>
              <Text style={styles.cicloText}>
                Ciclo {String(dadosObra?.ciclo_ativo?.numero_ciclo || 1).padStart(2, "0")} - {dadosObra?.ciclo_ativo?.status === "aberto" ? "Aberto" : "Encerrado"}
              </Text>
              <Text style={styles.valoresText}>
                R$ {Number(dadosObra?.valor_executado_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {Number(dadosObra?.valor_orcado_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.tabsContainer}>
              {["Etapas", "Fotos", "Ciclos"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabButton, abaAtiva === tab && styles.tabButtonActive]}
                  onPress={() => setAbaAtiva(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, abaAtiva === tab && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ImageBackground>

        <View style={styles.listaContainer}>
          {dadosObra?.etapas?.map((etapa) => {
            const isAberta = !!etapasAbertas[etapa.id];
            const progressoEtapa = Math.round(etapa.progresso_etapa_percentual || 0);

            return (
              <View key={etapa.id} style={styles.etapaCard}>
                <TouchableOpacity
                  style={styles.etapaHeader}
                  onPress={() => toggleEtapa(etapa.id)}
                  activeOpacity={0.8}
                >
                  <CircleProgress percentage={progressoEtapa} />
                  <View style={styles.etapaInfo}>
                    <Text style={styles.etapaNome}>{etapa.nome}</Text>
                    <Text style={styles.etapaSubtext}>{etapa.total_servicos || etapa.servicos?.length || 0} serviços</Text>
                  </View>
                  {isAberta ? <ChevronUp color="#0D6579" size={20} /> : <ChevronDown color="#0D6579" size={20} />}
                </TouchableOpacity>

                {isAberta && (
                  <View style={styles.servicosList}>
                    {etapa.servicos?.map((servico) => (
                      <View key={servico.id} style={styles.servicoItem}>
                        <View style={styles.servicoMain}>
                          <Text style={styles.servicoNome}>{servico.descricao}</Text>
                          <Text style={styles.servicoValores}>
                            R$ {Number(servico.valor_acumulado_atual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {Number(servico.preco_total_orcado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.servicoAcao}>
                          <Text style={styles.servicoPercentual}>{Math.round(servico.percentual_execucao || 0)}%</Text>
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() =>
                              navigation?.navigate?.("Medicao", {
                                servicoId: servico.id,
                                cicloId: dadosObra?.ciclo_ativo?.id,
                              })
                            }
                          >
                            <Pencil color="#0D6579" size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F4F0",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerBackground: {
    width: "100%",
    position: "relative",
    backgroundColor: "#F6F4F0",
  },
  headerImage: {
    resizeMode: "cover",
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  headerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 290,
  },
  overlay: {
    backgroundColor: "transparent",
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  backButton: {
    padding: 2,
    marginLeft: -4,
  },
  obraTitulo: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconButton: {
    padding: 4,
  },
  progressoSection: {
    marginTop: 44,
  },
  progressoLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressoValor: {
    color: "#FFFFFF",
    fontSize: 66,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: -2,
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressBarTrack: {
    height: 9,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 10,
  },
  cicloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 2,
  },
  cicloText: {
    color: "#0D6579",
    fontWeight: "bold",
    fontSize: 13,
  },
  valoresText: {
    color: "#0D6579",
    fontWeight: "bold",
    fontSize: 12,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    maxWidth: 106,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#0D6579",
    justifyContent: "center",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#40DEB5",
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listaContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  etapaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0px 2px 8px 0px rgba(0, 0, 0, 0.08)",
    elevation: 2,
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  circleProgressContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 14,
  },
  circleSvg: {
    position: "absolute",
    transform: [{ rotate: "-90deg" }],
  },
  circleText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D6579",
  },
  etapaInfo: {
    flex: 1,
  },
  etapaNome: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  etapaSubtext: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0D6579",
    marginTop: 2,
  },
  servicosList: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F2",
  },
  servicoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  servicoMain: {
    flex: 1,
    paddingRight: 8,
  },
  servicoNome: {
    fontSize: 14,
    fontWeight: "600",
    color: "#172B4D",
  },
  servicoValores: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D6579",
    marginTop: 4,
  },
  servicoAcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  servicoPercentual: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#16929C",
  },
  editButton: {
    padding: 6,
  },
});