import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import {
  ChevronLeft,
  Menu,
  AlertTriangle,
  Camera,
  MapPin,
  Calendar,
  X,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import api, { deletarObra, arquivarObra, obterObra } from "../services/api";
import { listarCiclosObra, encerrarCiclo } from "../services/cicloService";
import {
  listarFotografiasPorObra,
  excluirFotografia,
} from "../repositories/fotografiaRepository";
import ModalEncerrarCiclo from "../components/ModalEncerrarCiclo";
import ModalAvisoEncerrarCiclo from "../components/ModalAvisoEncerrarCiclo";
import ModalGerarPlanilha from "../components/ModalGerarPlanilha";
import planilhaFinalService from "../services/planilhaFinalService";
import theme, { rem, moderateScale } from "../styles/theme";
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
    "rgba(246, 244, 240, 0)",
    "rgba(246, 244, 240, 0.30)",
    "rgba(246, 244, 240, 0.80)",
    theme.cores.fundoCard,
    theme.cores.fundoCard,
  ],
};

function quebrarTextoLongo(texto) {
  if (!texto || typeof texto !== "string") return "";
  // Permite que palavras contínuas muito longas sem espaços quebrem de linha sem estourar a tela
  return texto.replace(/([^\s]{10})(?=[^\s])/g, "$1\u200B");
}

function formatarDataHora(dataString) {
  if (!dataString) return "";
  try {
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return dataString;
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return dataString;
  }
}

export default function AcompanhamentoObraScreen({ navigation, route }) {
  const [dadosObra, setDadosObra] = useState(null);
  const [listaCiclos, setListaCiclos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("Etapas");

  // Modais de Ciclo (US20 / US21 / US29)
  const [modalPrimeiraConfirmacaoVisivel, setModalPrimeiraConfirmacaoVisivel] = useState(false);
  const [modalEncerrarVisivel, setModalEncerrarVisivel] = useState(false);
  const [encerrandoCiclo, setEncerrandoCiclo] = useState(false);

  // Menu de Opções e Modais de Exclusão (US06) e Arquivamento (US07)
  const [menuVisivel, setMenuVisivel] = useState(false);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);
  const [modalArquivarAberto, setModalArquivarAberto] = useState(false);
  const [processandoArquivamento, setProcessandoArquivamento] = useState(false);

  // Fotografias da obra (US25)
  const [fotosObra, setFotosObra] = useState([]);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);

  const mapServicos = useMemo(() => {
    const mapa = {};
    if (dadosObra?.etapas) {
      dadosObra.etapas.forEach((etapa) => {
        if (etapa.servicos) {
          etapa.servicos.forEach((srv) => {
            mapa[srv.id] = {
              nome: srv.descricao,
              etapaNome: etapa.nome,
            };
          });
        }
      });
    }
    return mapa;
  }, [dadosObra]);

  // Modal de Geração da Planilha Final de Medição (US22)
  const [modalPlanilhaVisivel, setModalPlanilhaVisivel] = useState(false);
  const [estadoPlanilha, setEstadoPlanilha] = useState("gerando");
  const [mensagemErroPlanilha, setMensagemErroPlanilha] = useState("");
  const [dadosPlanilhaFinal, setDadosPlanilhaFinal] = useState(null);

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

      // Carregar histórico de ciclos da obra
      try {
        if (targetId) {
          const ciclosRes = await listarCiclosObra(targetId).catch(() => []);
          const ciclosOrdenados = Array.isArray(ciclosRes)
            ? [...ciclosRes].sort((a, b) => Number(b.numero_ciclo) - Number(a.numero_ciclo))
            : [];
          setListaCiclos(ciclosOrdenados);
        }
      } catch (error) {
        console.error("Erro ao listar ciclos da obra:", error?.response?.data || error?.message);
      }
    },
    [route?.params?.obraId, route?.params?.id, route?.params?.nome, navigation],
  );

  const carregarFotos = useCallback(async () => {
    const targetId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;
    if (!targetId) return;
    try {
      setCarregandoFotos(true);
      const fotos = await listarFotografiasPorObra(targetId);
      setFotosObra(fotos || []);
    } catch (err) {
      console.error("Erro ao carregar fotos da obra:", err);
    } finally {
      setCarregandoFotos(false);
    }
  }, [dadosObra?.obra_id, route?.params?.obraId, route?.params?.id]);

  useFocusEffect(
    useCallback(() => {
      carregarEstrutura(Boolean(dadosObra));
      carregarFotos();
    }, [carregarEstrutura, carregarFotos, Boolean(dadosObra)]),
  );

  // Ações disparadas a partir do MenuOpcoesObra (bottom sheet do ícone de menu)
  const handleSelecionarOpcaoMenu = (chave) => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;

    switch (chave) {
      case "editarObra":
        setMenuVisivel(false);
        navigation?.navigate?.("EditarObra", { obraId });
        break;

      case "excluir":
        setMenuVisivel(false);
        setModalExcluirAberto(true);
        break;

      case "arquivar":
        setMenuVisivel(false);
        setModalArquivarAberto(true);
        break;

      case "encerrarCiclo":
        setMenuVisivel(false);
        if (dadosObra?.ciclo_ativo?.status === "aberto") {
          setModalPrimeiraConfirmacaoVisivel(true);
        } else {
          Alert.alert("Aviso", "Esta obra não possui um ciclo aberto para encerramento.");
        }
        break;

      case "gerarPlanilha":
        setMenuVisivel(false);
        handleIniciarGeracaoPlanilha();
        break;

      default:
        setMenuVisivel(false);
        break;
    }
  };

  const handleIniciarGeracaoPlanilha = async () => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado.");
      return;
    }

    const cicloId = dadosObra?.ciclo_ativo?.id || null;
    setMensagemErroPlanilha("");
    setEstadoPlanilha("gerando");
    setModalPlanilhaVisivel(true);

    try {
      const dados = await planilhaFinalService.obterPlanilhaFinal(obraId, cicloId);
      setDadosPlanilhaFinal(dados);
      setEstadoPlanilha("gerada");
    } catch (err) {
      console.error("Erro ao gerar planilha final:", err);
      setMensagemErroPlanilha(
        err.message || "Não foi possível gerar a planilha final de medições.",
      );
      setEstadoPlanilha("erro");
    }
  };

  const handleBaixarArquivoPlanilha = async () => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;
    const cicloId = dadosObra?.ciclo_ativo?.id || null;
    const nomeObra = dadosObra?.nome || route?.params?.nome || "Obra";

    try {
      setEstadoPlanilha("baixando");
      await planilhaFinalService.baixarPlanilhaFinal(obraId, cicloId, nomeObra);
      setEstadoPlanilha("concluido");
    } catch (err) {
      console.error("Erro ao baixar planilha:", err);
      setMensagemErroPlanilha(
        err.message || "Não foi possível baixar o arquivo da planilha final.",
      );
      setEstadoPlanilha("erro");
    }
  };

  const handleVerPlanilha = () => {
    setModalPlanilhaVisivel(false);
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;

    if (navigation?.getState()?.routeNames?.includes("VisualizarPlanilhaFinal")) {
      navigation.navigate("VisualizarPlanilhaFinal", {
        obraId,
        dadosPlanilha: dadosPlanilhaFinal,
        nome: dadosObra?.nome || route?.params?.nome,
      });
    } else {
      Alert.alert(
        "Visualização em Tela",
        "A tela de visualização (US23) será disponibilizada em breve. O download do arquivo Excel (.xlsx) já pode ser realizado pelo botão 'Baixar arquivo'.",
      );
    }
  };

  const handleConfirmarExclusao = async () => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado para exclusão.");
      return;
    }

    try {
      setProcessandoExclusao(true);
      await (deletarObra ? deletarObra(obraId) : api.deletarObra(obraId));
      setModalExcluirAberto(false);
      navigation?.navigate?.("Home");
    } catch (error) {
      console.error("Erro ao excluir obra:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível excluir a obra. Tente novamente.",
      );
    } finally {
      setProcessandoExclusao(false);
    }
  };

  const handleConfirmarArquivamento = async () => {
    const obraId =
      dadosObra?.obra_id || route?.params?.obraId || route?.params?.id;
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado para arquivamento.");
      return;
    }

    try {
      setProcessandoArquivamento(true);
      await (arquivarObra ? arquivarObra(obraId) : api.arquivarObra(obraId));
      setModalArquivarAberto(false);
      navigation?.navigate?.("Home");
    } catch (error) {
      console.error("Erro ao arquivar obra:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível arquivar a obra. Tente novamente.",
      );
    } finally {
      setProcessandoArquivamento(false);
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
      console.error("Erro ao encerrar ciclo:", error);
      Alert.alert("Erro", error?.message || "Não foi possível encerrar o ciclo.");
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
          {/* Sombra no topo para leitura do título sobre a foto */}
          <LinearGradient
            colors={FADE_GRADIENTS.topFade}
            locations={[0, 0.5, 1]}
            style={styles.topFade}
            pointerEvents="none"
          />

          {/* Transição suave na base para integrar com o fundo theme.cores.fundoCard */}
          <LinearGradient
            colors={FADE_GRADIENTS.headerFade}
            locations={[0, 0.35, 0.48, 0.60, 0.68, 1.0]}
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
                  <ChevronLeft color="#FFFFFF" size={moderateScale(28)} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.obraTitulo,
                    (dadosObra?.nome || route?.params?.nome || "").length > 25 &&
                      styles.obraTituloLongo,
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
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
                <Menu color="#FFFFFF" size={moderateScale(26)} strokeWidth={2.5} />
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
                    {
                      width: `${Math.min(Math.max(progressoGeral, 0), 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.cicloRow}>
              <Text style={styles.cicloText}>
                Ciclo {numeroCicloAtual} - {dadosObra?.ciclo_ativo?.status === "aberto" ? "Aberto" : dadosObra?.ciclo_ativo ? "Encerrado" : "Sem ciclo ativo"}
              </Text>
              <Text style={styles.valoresText}>
                R${" "}
                {Number(dadosObra?.valor_executado_total || 0).toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}{" "}
                / R${" "}
                {Number(dadosObra?.valor_orcado_total || 0).toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}
              </Text>
            </View>

            <View style={styles.tabsContainer}>
              {["Etapas", "Fotos", "Ciclos"].map((tab) => {
                const isAtiva = abaAtiva === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabButton, isAtiva && styles.tabButtonActive]}
                    onPress={() => setAbaAtiva(tab)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.tabText, isAtiva && styles.tabTextActive]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
                  obraId={
                    dadosObra?.obra_id ||
                    dadosObra?.id ||
                    route?.params?.obraId ||
                    route?.params?.id
                  }
                  cicloAtivoId={dadosObra?.ciclo_ativo?.id}
                  onMedicaoSalva={() => carregarEstrutura(true)}
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

          {abaAtiva === "Fotos" && (
            <View style={styles.fotosContainer}>
              {carregandoFotos ? (
                <View style={styles.fotosCarregando}>
                  <ActivityIndicator
                    size="small"
                    color={theme.cores.azulPetroleo}
                  />
                  <Text style={styles.fotosCarregandoTexto}>
                    Carregando fotos...
                  </Text>
                </View>
              ) : fotosObra.length > 0 ? (
                <View style={styles.fotosGrid}>
                  {fotosObra.map((foto) => {
                    const servicoInfo = mapServicos[foto.servico_id];
                    const uriFoto =
                      foto.caminho_local || foto.caminho_comprimido;
                    return (
                      <TouchableOpacity
                        key={foto.id}
                        style={styles.fotoCard}
                        onPress={() => setFotoSelecionada(foto)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: uriFoto }}
                          style={styles.fotoCardImagem}
                          resizeMode="cover"
                        />
                        <View style={styles.fotoCardOverlay}>
                          <Text
                            style={styles.fotoCardServico}
                            numberOfLines={1}
                          >
                            {servicoInfo?.nome ||
                              "Serviço #" + (foto.servico_id || "")}
                          </Text>
                          <View style={styles.fotoCardRodape}>
                            <View style={styles.fotoCardDataContainer}>
                              <Calendar size={11} color="#CBD5E1" />
                              <Text style={styles.fotoCardData}>
                                {formatarDataHora(
                                  foto.data_hora_captura || foto.created_at,
                                )}
                              </Text>
                            </View>
                            {Boolean(foto.possui_localizacao) && (
                              <View style={styles.fotoCardGpsTag}>
                                <MapPin size={10} color="#00E5BC" />
                                <Text style={styles.fotoCardGpsTexto}>GPS</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.cardVazio}>
                  <View style={styles.iconeVazioContainer}>
                    <Camera
                      size={moderateScale(36)}
                      color={theme.cores.cinzaBorda}
                      strokeWidth={1.5}
                    />
                  </View>
                  <Text style={styles.textoVazioTitulo}>Nenhuma foto anexada</Text>
                  <Text style={styles.textoVazioSub}>
                    As fotografias capturadas nos serviços da obra aparecerão aqui.
                  </Text>
                </View>
              )}
            </View>
          )}

          {abaAtiva === "Ciclos" && (
            <View style={styles.ciclosContainer}>
              {listaCiclos.length > 0 ? (
                listaCiclos.map((ciclo) => (
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
                          ? "Encerrado em " +
                            new Date(ciclo.data_encerramento).toLocaleDateString("pt-BR")
                          : "Encerrado"}
                      </Text>
                    </View>
                    <ChevronLeft
                      color="#0D6579"
                      size={24}
                      style={{ transform: [{ rotate: "180deg" }] }}
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.cardVazio}>
                  <Text style={styles.textoVazioTitulo}>Nenhum ciclo encontrado</Text>
                  <Text style={styles.textoVazioSub}>
                    Os ciclos de medição aparecerão aqui.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Botão fixo no rodapé na aba Ciclos (estilo Figma) */}
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

      {/* Modais de Ciclo (US20 / US21 / US29) */}
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

      {/* Menu suspenso de ações da obra (Figma) */}
      <MenuOpcoesObra
        visivel={menuVisivel}
        onFechar={() => setMenuVisivel(false)}
        onSelecionar={handleSelecionarOpcaoMenu}
        onSelecionarOpcao={handleSelecionarOpcaoMenu}
      />

      {/* Modal de Exclusão de Obra (US06 / RF06) */}
      <Modal
        visible={modalExcluirAberto}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processandoExclusao) setModalExcluirAberto(false);
        }}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcone}>
              <AlertTriangle color="#09D1C7" size={48} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitulo}>Excluir obra</Text>
            <Text style={styles.modalMensagem}>
              Tem certeza que deseja excluir essa obra? Esta ação será permanente.
            </Text>

            <TouchableOpacity
              style={styles.modalBotaoConfirmar}
              onPress={handleConfirmarExclusao}
              disabled={processandoExclusao}
              activeOpacity={0.85}
            >
              {processandoExclusao ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalTextoBotaoConfirmar}>Excluir</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalBotaoCancelar}
              onPress={() => setModalExcluirAberto(false)}
              disabled={processandoExclusao}
              activeOpacity={0.85}
            >
              <Text style={styles.modalTextoBotaoCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Arquivamento de Obra (US07 / RF07) */}
      <Modal
        visible={modalArquivarAberto}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processandoArquivamento) setModalArquivarAberto(false);
        }}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcone}>
              <AlertTriangle color="#09D1C7" size={48} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitulo}>Arquivar obra</Text>
            <Text style={styles.modalMensagem}>
              Tem certeza que deseja arquivar a obra?{"\n"}Você poderá desfazer esta ação.
            </Text>

            <TouchableOpacity
              style={styles.modalBotaoConfirmar}
              onPress={handleConfirmarArquivamento}
              disabled={processandoArquivamento}
              activeOpacity={0.85}
            >
              {processandoArquivamento ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalTextoBotaoConfirmar}>Arquivar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalBotaoCancelar}
              onPress={() => setModalArquivarAberto(false)}
              disabled={processandoArquivamento}
              activeOpacity={0.85}
            >
              <Text style={styles.modalTextoBotaoCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalhe e Visualização da Fotografia (US25) */}
      <Modal
        visible={Boolean(fotoSelecionada)}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoSelecionada(null)}
      >
        <View style={styles.modalFotoFundo}>
          <View style={styles.modalFotoCard}>
            <View style={styles.modalFotoHeader}>
              <View style={{ flex: 1, marginRight: moderateScale(10) }}>
                <Text style={styles.modalFotoTitulo} numberOfLines={2}>
                  {mapServicos[fotoSelecionada?.servico_id]?.nome ||
                    "Fotografia do Serviço"}
                </Text>
                <Text style={styles.modalFotoSubtitulo} numberOfLines={1}>
                  {mapServicos[fotoSelecionada?.servico_id]?.etapaNome ||
                    dadosObra?.nome ||
                    "Acompanhamento da obra"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalFotoFecharBtn}
                onPress={() => setFotoSelecionada(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFotoImagemContainer}>
              <Image
                source={{
                  uri:
                    fotoSelecionada?.caminho_local ||
                    fotoSelecionada?.caminho_comprimido,
                }}
                style={styles.modalFotoImagem}
                resizeMode="contain"
              />
            </View>

            <View style={styles.modalFotoFooter}>
              <View style={styles.modalFotoLinhaInfo}>
                <Calendar size={13} color="#CBD5E1" />
                <Text style={styles.modalFotoTextoInfo}>
                  Capturada em:{" "}
                  {formatarDataHora(
                    fotoSelecionada?.data_hora_captura ||
                      fotoSelecionada?.created_at,
                  )}
                </Text>
              </View>

              {Boolean(fotoSelecionada?.possui_localizacao && fotoSelecionada?.latitude) && (
                <View style={styles.modalFotoLinhaInfo}>
                  <MapPin size={13} color="#00E5BC" />
                  <Text style={[styles.modalFotoTextoInfo, { color: "#00E5BC" }]}>
                    Lat: {Number(fotoSelecionada.latitude).toFixed(6)} | Lon:{" "}
                    {Number(fotoSelecionada.longitude).toFixed(6)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Geração de Planilha Final (US22) */}
      <ModalGerarPlanilha
        visivel={modalPlanilhaVisivel}
        estado={estadoPlanilha}
        mensagemErro={mensagemErroPlanilha}
        onBaixarArquivo={handleBaixarArquivoPlanilha}
        onVerPlanilha={handleVerPlanilha}
        onFechar={() => setModalPlanilhaVisivel(false)}
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
    paddingBottom: 110,
  },
  headerBackground: {
    width: "100%",
    minHeight: moderateScale(370),
    position: "relative",
    overflow: "hidden",
    backgroundColor: theme.cores.fundoCard,
  },
  headerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    opacity: 0.88,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
  },
  headerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: -1,
    zIndex: 1,
  },
  overlay: {
    flex: 1,
    paddingTop: moderateScale(42),
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(16),
    zIndex: 10,
    elevation: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: moderateScale(10),
  },
  backButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -moderateScale(4),
    flexShrink: 0,
  },
  obraTitulo: {
    color: "#FFFFFF",
    fontSize: rem(1.2),
    lineHeight: rem(1.4),
    fontFamily: theme.fontes.negrito,
    marginLeft: moderateScale(10),
    flex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  obraTituloLongo: {
    fontSize: rem(1.02),
    lineHeight: rem(1.28),
  },
  iconButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
    flexShrink: 0,
  },
  progressoSection: {
    marginTop: moderateScale(42),
    alignItems: "flex-start",
    width: "100%",
  },
  progressoLabel: {
    color: "#FFFFFF",
    fontSize: rem(0.9),
    fontFamily: theme.fontes.semiNegrito,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: moderateScale(2),
  },
  progressoValor: {
    color: "#FFFFFF",
    fontSize: rem(3.6),
    fontFamily: theme.fontes.negrito,
    letterSpacing: -1,
    marginVertical: 0,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressBarTrack: {
    height: moderateScale(8),
    backgroundColor: "#E8E5E0",
    borderRadius: moderateScale(8),
    overflow: "hidden",
    width: "100%",
    marginTop: moderateScale(6),
  },
  progressBarFill: {
    height: "100%",
    borderRadius: moderateScale(8),
  },
  cicloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: moderateScale(16),
    width: "100%",
  },
  cicloText: {
    color: theme.cores.azulPetroleo,
    fontFamily: theme.fontes.semiNegrito,
    fontSize: rem(0.8),
  },
  valoresText: {
    color: theme.cores.azulPetroleo,
    fontFamily: theme.fontes.semiNegrito,
    fontSize: rem(0.75),
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: moderateScale(16),
    gap: moderateScale(8),
    width: "100%",
  },
  tabButton: {
    flex: 1,
    height: moderateScale(38),
    borderRadius: moderateScale(14),
    backgroundColor: theme.cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: LOCAL_COLORS.tabAtivaVerde,
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: rem(0.85),
    fontFamily: theme.fontes.semiNegrito,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listaContainer: {
    paddingHorizontal: 0,
    paddingTop: moderateScale(16),
    marginTop: -moderateScale(3),
    backgroundColor: theme.cores.fundoCard,
    gap: moderateScale(12),
  },
  cardVazio: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    marginHorizontal: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.padrao,
  },
  textoVazioTitulo: {
    fontFamily: theme.fontes.negrito,
    fontSize: 16,
    color: theme.cores.titulo,
    marginBottom: 6,
    textAlign: "center",
  },
  textoVazioSub: {
    fontFamily: theme.fontes.regular,
    fontSize: 13,
    color: theme.cores.textoSecundario,
    textAlign: "center",
  },
  ciclosContainer: {
    paddingHorizontal: moderateScale(20),
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
    ...theme.shadows.padrao,
  },
  cicloCardTitle: {
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
  },
  cicloCardStatus: {
    fontSize: 13,
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
    marginTop: 4,
  },
  footerContainer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  encerrarButton: {
    width: "90%",
    maxWidth: 340,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  encerrarButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
  },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  modalIcone: {
    marginBottom: 12,
  },
  modalTitulo: {
    fontSize: 22,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
    marginBottom: 10,
  },
  modalMensagem: {
    fontSize: 13,
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 22,
  },
  modalBotaoConfirmar: {
    width: "100%",
    height: 46,
    backgroundColor: theme.cores.azulPetroleo,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    cursor: "pointer",
  },
  modalTextoBotaoConfirmar: {
    fontSize: 15,
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
  modalBotaoCancelar: {
    width: "100%",
    height: 46,
    backgroundColor: theme.cores.titulo,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
  },
  modalTextoBotaoCancelar: {
    fontSize: 15,
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
  // Estilos da Galeria de Fotos (US25)
  fotosContainer: {
    paddingHorizontal: moderateScale(20),
    width: "100%",
  },
  fotosCarregando: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(40),
    gap: moderateScale(8),
  },
  fotosCarregandoTexto: {
    color: theme.cores.textoSecundario,
    fontSize: rem(0.85),
    fontFamily: theme.fontes.regular,
  },
  fotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: moderateScale(14),
  },
  fotoCard: {
    width: "48%",
    height: moderateScale(170),
    borderRadius: moderateScale(14),
    overflow: "hidden",
    backgroundColor: "#1E293B",
    position: "relative",
    ...theme.shadows.padrao,
  },
  fotoCardImagem: {
    width: "100%",
    height: "100%",
  },
  fotoCardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: moderateScale(8),
    backgroundColor: "rgba(14, 42, 56, 0.82)",
  },
  fotoCardServico: {
    color: "#FFFFFF",
    fontSize: rem(0.75),
    fontFamily: theme.fontes.semiNegrito,
    marginBottom: moderateScale(4),
  },
  fotoCardRodape: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fotoCardDataContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
    flex: 1,
  },
  fotoCardData: {
    color: "#CBD5E1",
    fontSize: rem(0.65),
    fontFamily: theme.fontes.regular,
  },
  fotoCardGpsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(2),
    backgroundColor: "rgba(0, 229, 188, 0.15)",
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
  },
  fotoCardGpsTexto: {
    color: "#00E5BC",
    fontSize: rem(0.6),
    fontFamily: theme.fontes.negrito,
  },
  iconeVazioContainer: {
    marginBottom: moderateScale(10),
  },
  // Modal de Detalhe e Zoom da Foto (US25)
  modalFotoFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
  },
  modalFotoCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0F172A",
    borderRadius: moderateScale(20),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalFotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalFotoTitulo: {
    color: "#FFFFFF",
    fontSize: rem(0.95),
    fontFamily: theme.fontes.negrito,
  },
  modalFotoSubtitulo: {
    color: "#94A3B8",
    fontSize: rem(0.75),
    fontFamily: theme.fontes.regular,
    marginTop: moderateScale(2),
  },
  modalFotoFecharBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalFotoImagemContainer: {
    width: "100%",
    height: moderateScale(320),
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalFotoImagem: {
    width: "100%",
    height: "100%",
  },
  modalFotoFooter: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: "#0F172A",
    gap: moderateScale(6),
  },
  modalFotoLinhaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
  },
  modalFotoTextoInfo: {
    color: "#CBD5E1",
    fontSize: rem(0.75),
    fontFamily: theme.fontes.regular,
  },
});
