import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { ArrowLeft, Menu, ChevronDown, ChevronUp, Pencil } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import api from "../services/api";

export default function AcompanhamentoObraScreen({ navigation, route }) {
  const [dadosObra, setDadosObra] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [etapasAbertas, setEtapasAbertas] = useState({});
  const [abaAtiva, setAbaAtiva] = useState("Etapas");

  const OBRA_ID =
    route?.params?.obraId || "b2c3d4e5-0000-0000-0000-000000000002";

  useEffect(() => {
    carregarEstrutura();
  }, [OBRA_ID]);

  const carregarEstrutura = async () => {
    try {
      setCarregando(true);
      const response = await api.get(`/obras/estrutura/${OBRA_ID}`);
      setDadosObra(response?.data || response);
    } catch (error) {
      console.error("Erro ao carregar obra:", error.response?.data || error.message);
    } finally {
      setCarregando(false);
    }
  };

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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?q=80&w=1000&auto=format&fit=crop" }}
          style={styles.headerBackground}
          imageStyle={styles.headerImage}
        >
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation?.goBack?.()}
              >
                <ArrowLeft color="#FFF" size={28} />
              </TouchableOpacity>
              <Text style={styles.obraTitulo}>{dadosObra?.nome || "NomeObra"}</Text>
              <TouchableOpacity style={styles.iconButton}>
                <Menu color="#FFF" size={28} />
              </TouchableOpacity>
            </View>

            <LinearGradient
            colors={[
                "transparent",
                "rgba(246,244,240,0.15)",
                "rgba(246,244,240,0.4)",
                "rgba(246,244,240,0.7)",
                "#F6F4F0",
            ]}
            locations={[0, 0.3, 0.55, 0.8, 1]}                style={styles.headerFade}
                pointerEvents="none"
            />

            <View style={styles.progressoSection}>
              <Text style={styles.progressoLabel}>Progresso geral</Text>
              <Text style={styles.progressoValor}>{progressoGeral}%</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressoGeral}%` }]} />
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
                  <View style={styles.circleBadge}>
                    <Text style={styles.circleText}>{progressoEtapa}%</Text>
                  </View>
                  <View style={styles.etapaInfo}>
                    <Text style={styles.etapaNome}>{etapa.nome}</Text>
                    <Text style={styles.etapaSubtext}>{etapa.total_servicos || etapa.servicos?.length || 0} serviços</Text>
                  </View>
                  {isAberta ? <ChevronUp color="#005249" size={20} /> : <ChevronDown color="#005249" size={20} />}
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
                            <Pencil color="#005249" size={18} />
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
    minHeight: 280,
  },
  headerImage: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#213A57",
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 10,
    justifyContent: "space-between",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerFade: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 250,
},
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    padding: 8,
  },
  obraTitulo: {
    color: "#F6F4F0",
    fontSize: 20,
    fontWeight: "bold",
  },
  progressoSection: {
    marginTop: 70,
  },
  progressoLabel: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "bold",
  },
  progressoValor: {
    color: "#FFF",
    fontSize: 64,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 9,
    backgroundColor: "#EAE7E2",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#40DEB5",
    borderRadius: 4,
  },
  cicloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  cicloText: {
    color: "#0D6579",
    fontWeight: "600",
    fontSize: 13,
  },
  valoresText: {
    color: "#0D6579",
    fontWeight: "600",
    fontSize: 12,
  },
tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 8,
  },
  tabButton: {
    width: 95,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#0D6579",
    opacity: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#40DEB5",
  },
  tabText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFF",
  },
  listaContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  etapaCard: {
    backgroundColor: "#F6F4F0",
    borderRadius: 15,
    overflow: "hidden",
    boxShadow: "0px 2px 10px 0px rgba(0, 0, 0, 0.15)",
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  circleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#36B37E",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginRight: 12,
  },
  circleText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#005249",
  },
  etapaInfo: {
    flex: 1,
  },
  etapaNome: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#223B59",
  },
  etapaSubtext: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0D6579",
    marginTop: 2,
  },
  servicosList: {
    backgroundColor: "#F6F4F0",
    borderTopWidth: 1,
    borderTopColor: "#DFE1E6",
  },
  servicoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EBECF0",
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#16929C",
  },
  editButton: {
    padding: 6,
  },
});