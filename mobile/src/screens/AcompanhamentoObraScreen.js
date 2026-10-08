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
import { ChevronLeft, Menu } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import api, { obterObra } from "../services/api";
import { listarCiclosObra, encerrarCiclo } from "../services/cicloService";
import ModalEncerrarCiclo from "../components/ModalEncerrarCiclo";
import ModalAvisoEncerrarCiclo from "../components/ModalAvisoEncerrarCiclo";
import theme from "../styles/theme";
import EtapaCard from "../components/EtapaCard";
import MenuOpcoesObra from "../components/MenuOpcoesObra";

// Padrões locais de cabeçalho e navegação (exceções não mapeadas no theme.js)
const LOCAL_COLORS = {
  progressTrack: "#E2E8F0",
  tabAtivaVerde: "#40DEB5",
};

const FADE_GRADIENTS = {
  topFade: ["rgba(0, 0, 0, 0.65)", "rgba(0, 0, 0, 0.25)", "transparent"],
  headerFade: [
    "rgba(246, 244, 240, 0)",
    "rgba(246, 244, 240, 0.04)",
    "rgba(246, 244, 240, 0.20)",
    "rgba(246, 244, 240, 0.50)",
    "rgba(246, 244, 240, 1.0)",
    theme.cores.fundoCard,
    theme.cores.fundoCard,
  ],
};

function quebrarTextoLongo(texto) {
  if (!texto || typeof texto !== "string") return "";
  // Permite que palavras contínuas muito longas sem espaços quebrem de linha sem estourar a tela
  return texto.replace(/([^\s]{10})(?=[^\s])/g, "$1\u200B");
}

export default function AcompanhamentoObraScreen({ navigation, route }) {
  const [dadosObra, setDadosObra] = useState(null);
  const [listaCiclos, setListaCiclos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("Etapas");
  
  const [modalPrimeiraConfirmacaoVisivel, setModalPrimeiraConfirmacaoVisivel] = useState(false);
  const [modalEncerrarVisivel, setModalEncerrarVisivel] = useState(false);
  const [encerrandoCiclo, setEncerrandoCiclo] = useState(false);
  const [menuVisivel, setMenuVisivel] = useState(false);

  const carregarEstrutura = useCallback(
    async (silencioso = false) => {
      const targetIdParam = route?.params?.obraId || route?.params?.id;
      let targetId = targetIdParam;

      try {
        if (!silencioso) {
          setCarregando(true);
        }

        if (!targetId) {
          const lista = await api.listarObras().catch(() => []);
          if (Array.isArray(lista) && lista.length > 0) {
            targetId = lista[0].id;
          }
        }
        if (targetId) {
          const response = await api.get(`/obras/estrutura/${targetId}`);
          const dados = response?.data || response;

          if (!dados || !dados.etapas || dados.etapas.length === 0) {
            navigation?.replace("ImportarPlanilha", {
              obraId: targetId,
              nome: dados?.nome || route?.params?.nome,
            });
            return;
          }

          setDadosObra(dados);
        }
      } catch (error) {
        if (error?.status === 404 || error?.response?.status === 404) {
          navigation?.replace("ImportarPlanilha", {
            obraId: targetId,
            nome: route?.params?.nome,
          });
          return;
        }

        let nomeFallback = null;
        try {
          const obraRes = await obterObra(targetId);
          nomeFallback = obraRes?.nome;
        } catch (obraError) {
          const lista = await api.listarObras().catch(() => []);
          const obraEncontrada = lista.find(
            (o) => String(o.id) === String(targetId),
          );
          if (obraEncontrada) {
            nomeFallback = obraEncontrada.nome;
          }
        }

        if (!nomeFallback) {
          nomeFallback = route?.params?.nome;
        }

        setDadosObra({
          obra_id: targetId,
          nome: nomeFallback || "Acompanhamento da Obra",
          ciclo_ativo: null,
          progresso_geral_percentual: 0,
          valor_executado_total: 0,
          valor_orcado_total: 0,
          etapas: [],
        });
      } finally {
        setCarregando(false);
      }


      try {
        if (targetId) {
          const ciclosRes = await listarCiclosObra(targetId).catch(() => []);
          const ciclosOrdenados = Array.isArray(ciclosRes)
            ? [...ciclosRes].sort((a, b) => Number(b.numero_ciclo) - Number(a.numero_ciclo))
            : [];
          setListaCiclos(ciclosOrdenados);
        }
      } catch (error) {
        console.error(error.response?.data || error.message);
      }
    },
    [route?.params?.obraId, route?.params?.id, route?.params?.nome, navigation],
  );

  useFocusEffect(
    useCallback(() => {
      carregarEstrutura(Boolean(dadosObra));
    }, [carregarEstrutura, Boolean(dadosObra)]),
  );

  // Ações disparadas a partir do MenuOpcoesObra (bottom sheet do ícone de menu)
  const handleSelecionarOpcaoMenu = (chave) => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;

    switch (chave) {
      case "editarObra":
        navigation?.navigate?.("EditarObra", { obraId });
        break;

      case "excluir":
        // TODO: exibir confirmação explícita (RF06) antes de chamar
        // api.delete(`/obras/${obraId}`) e navegar de volta para a Home.
        console.log("Excluir obra:", obraId);
        break;

      case "encerrarCiclo":
        // TODO: integrar com o endpoint de encerramento de ciclo (RF29)
        // quando ele existir no backend.
        console.log("Encerrar ciclo atual da obra:", obraId);
        break;

      case "gerarPlanilha":
        // TODO: integrar com a geração/exportação da planilha final
        // (RF18/RF22) quando esse fluxo estiver disponível.
        console.log("Gerar planilha final da obra:", obraId);
        break;

      default:
        break;
    }
  };

  const avancarParaModalDefinitivo = () => {
    setModalPrimeiraConfirmacaoVisivel(false);
    setModalEncerrarVisivel(true);
  };

  const confirmarEncerramento = async () => {
    const cicloAtivoId = dadosObra?.ciclo_ativo?.id;
    if (!cicloAtivoId) return;

    try {
      setEncerrandoCiclo(true);
      await encerrarCiclo(cicloAtivoId);
      setModalEncerrarVisivel(false);
      await carregarEstrutura();
    } catch (error) {
      console.error(error);
    } finally {
      setEncerrandoCiclo(false);
    }
  };

  if (carregando && !dadosObra) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.cores.azulPetroleo} />
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

  const numeroCicloAtual = String(dadosObra?.ciclo_ativo?.numero_ciclo || 1).padStart(2, "0");

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ImageBackground
          source={imagemSource}
          style={styles.headerBackground}
          imageStyle={styles.headerImage}
        >
          <LinearGradient
            colors={FADE_GRADIENTS.topFade}
            locations={[0, 0.5, 1]}
            style={styles.topFade}
            pointerEvents="none"
          />

          <LinearGradient
            colors={FADE_GRADIENTS.headerFade}
            locations={[0, 0.2, 0.32, 0.46, 0.58, 0.66, 1.0]}
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
                  <ChevronLeft color="#FFFFFF" size={35} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={styles.obraTitulo}>
                  {quebrarTextoLongo(
                    dadosObra?.nome || route?.params?.nome || "Nome da Obra",
                  )}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.7}
                onPress={() => setMenuVisivel(true)}
              >
                <Menu color="#FFFFFF" size={32} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressoSection}>
              <Text style={styles.progressoLabel}>Progresso geral</Text>
              <Text style={styles.progressoValor}>{progressoGeral}%</Text>
              <View style={styles.progressBarTrack}>
                <LinearGradient
                  colors={theme.gradienteCoresInvertido.slice(0, 5)}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(Math.max(progressoGeral, 0), 100)}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.cicloRow}>
              <Text style={styles.cicloText}>
                Ciclo {numeroCicloAtual} - {dadosObra?.ciclo_ativo?.status === "aberto" ? "Aberto" : dadosObra?.ciclo_ativo ? "Encerrado" : "Sem ciclo ativo"}
              </Text>
              <Text style={styles.valoresText}>
                R$ {Number(dadosObra?.valor_executado_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {Number(dadosObra?.valor_orcado_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.tabsContainer}>
              {["Etapas", "Fotos", "Ciclos"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    abaAtiva === tab && styles.tabButtonActive,
                  ]}
                  onPress={() => setAbaAtiva(tab)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabText,
                      abaAtiva === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ImageBackground>

        <View style={styles.listaContainer}>
{abaAtiva === "Etapas" &&
            (dadosObra?.etapas && dadosObra.etapas.length > 0 ? (
              dadosObra.etapas.map((etapa) => (
                <EtapaCard
                  key={etapa.id}
                  etapa={etapa}
                  navigation={navigation}
                  cicloAtivoId={dadosObra?.ciclo_ativo?.id}
                />
              ))
            ) : (
              <View style={styles.cardVazio}>
                <Text style={styles.textoVazioTitulo}>
                  Nenhuma etapa cadastrada
                </Text>
                <Text style={styles.textoVazioSub}>
                  Esta obra ainda não possui serviços cadastrados para acompanhamento.
                </Text>
              </View>
            ))}

          {abaAtiva === "Ciclos" && (
            <View style={styles.ciclosContainer}>
              {listaCiclos.map((ciclo) => (
                <TouchableOpacity
                  key={ciclo.id}
                  style={styles.cicloCard}
                  onPress={() =>
                    navigation?.navigate?.("DetalhesCiclo", {
                      cicloId: ciclo.id,
                      obraNome: dadosObra?.nome,
                      numeroCiclo: ciclo.numero_ciclo,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.cicloCardTitle}>
                      Ciclo {String(ciclo.numero_ciclo).padStart(2, "0")}
                    </Text>
                    <Text style={styles.cicloCardStatus}>
                      {ciclo.status === "aberto"
                        ? "Aberto"
                        : ciclo.data_encerramento
                        ? "Encerrado em " + new Date(ciclo.data_encerramento).toLocaleDateString("pt-BR")
                        : "Encerrado"}
                    </Text>
                  </View>
                  <ChevronLeft color="#0D6579" size={24} style={{ transform: [{ rotate: "180deg" }] }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

{/* Botão fixo na parte inferior da tela (estilo do Figma) */}
      {abaAtiva === "Ciclos" && dadosObra?.ciclo_ativo?.status === "aberto" && (
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.encerrarButton}
            onPress={() => setModalPrimeiraConfirmacaoVisivel(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.encerrarButtonText}>
              Encerrar Ciclo {Number(numeroCicloAtual)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ModalAvisoEncerrarCiclo
        visivel={modalPrimeiraConfirmacaoVisivel}
        numeroCiclo={numeroCicloAtual}
        onAvancar={avancarParaModalDefinitivo}
        onCancelar={() => setModalPrimeiraConfirmacaoVisivel(false)}
      />

      <ModalEncerrarCiclo
        visivel={modalEncerrarVisivel}
        carregando={encerrandoCiclo}
        onConfirmar={confirmarEncerramento}
        onCancelar={() => setModalEncerrarVisivel(false)}
      />

      <MenuOpcoesObra
        visivel={menuVisivel}
        onFechar={() => setMenuVisivel(false)}
        onSelecionar={handleSelecionarOpcaoMenu}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.cores.fundoCard,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.cores.fundoCard,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerBackground: {
    width: "100%",
    position: "relative",
    backgroundColor: theme.cores.fundoCard,
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
    height: 370,
  },
  overlay: {
    backgroundColor: "transparent",
    paddingTop: 52,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 14,
  },
  backButton: {
    padding: 2,
    marginLeft: -4,
    marginTop: 2,
  },
  obraTitulo: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fontes.negrito,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconButton: {
    flexShrink: 0,
    padding: 5,
    marginTop: 2,
  },
  progressoSection: {
    marginTop: 90,
  },
  progressoLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: theme.fontes.negrito,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressoValor: {
    color: "#FFFFFF",
    fontSize: 66,
    fontFamily: theme.fontes.negrito,
    marginTop: -20,
    marginBottom: -25,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressBarTrack: {
    height: 9,
    backgroundColor: LOCAL_COLORS.progressTrack,
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
    marginTop: 12,
    paddingHorizontal: 2,
  },
  cicloText: {
    color: theme.cores.azulPetroleo,
    fontFamily: theme.fontes.semiNegrito,
    fontSize: 12,
  },
  valoresText: {
    color: theme.cores.azulPetroleo,
    fontFamily: theme.fontes.semiNegrito,
    fontSize: 12,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    maxWidth: 106,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: LOCAL_COLORS.tabAtivaVerde,
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: 13,
    paddingTop: 3,
    fontFamily: theme.fontes.semiNegrito,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listaContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 5,
  },
  cardVazio: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginHorizontal: 10,
    ...theme.shadows.padrao,
  },
  textoVazioTitulo: {
    fontFamily: theme.fontes.negrito,
    fontSize: 16,
    color: theme.cores.titulo,
    marginBottom: 0,
    textAlign: "center",
  },
  textoVazioSub: {
    fontFamily: theme.fontes.regular,
    fontSize: 13,
    color: theme.cores.textoSecundario,
    textAlign: "center",
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
  ciclosContainer: {
    gap: 12,
  },
  cicloCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  cicloCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  cicloCardStatus: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  footerContainer: {
    position: "absolute",
    bottom: 42,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  encerrarButton: {
    width: 340,
    height: 55,
    borderRadius: 15,
    backgroundColor: "#0D6579",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  encerrarButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});