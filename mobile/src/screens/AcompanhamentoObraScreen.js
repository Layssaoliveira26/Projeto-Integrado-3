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
} from "react-native";
import {
  ChevronLeft,
  Menu,
  Camera,
  MapPin,
  Calendar,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

import api, { obterObra } from "../services/api";
import { listarCiclosObra } from "../services/cicloService";
import { listarFotografiasPorObra } from "../repositories/fotografiaRepository";
import NavBarAcompanhamento from "../components/NavBarAcompanhamento";
import SyncStatusBanner from "../components/SyncStatusBanner";
import EtapaCard from "../components/EtapaCard";
import ObraZeradaView from "../components/ObraZeradaView";
import MenuAcoesObra from "../components/MenuAcoesObra";
import ModalVisualizarFoto from "../components/ModalVisualizarFoto";
import theme, { fontes, rem, moderateScale } from "../styles/theme";

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
  const insets = useSafeAreaInsets();
  const [dadosObra, setDadosObra] = useState(null);
  const [listaCiclos, setListaCiclos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("Etapas");
  const [mapearAction, setMapearAction] = useState(null);

  const handleMapearActionChange = useCallback((action) => {
    setMapearAction(() => action);
  }, []);

  const [menuVisivel, setMenuVisivel] = useState(false);
  const [modalEncerrarCicloAberto, setModalEncerrarCicloAberto] =
    useState(false);

  const [fotosObra, setFotosObra] = useState([]);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);
  const [filtroCicloId, setFiltroCicloId] = useState(null);
  const [modalFiltroCicloVisivel, setModalFiltroCicloVisivel] = useState(false);

  const mapCiclos = useMemo(() => {
    const mapa = {};
    (listaCiclos || []).forEach((c) => {
      mapa[c.id] = c.numero_ciclo;
      mapa[String(c.id)] = c.numero_ciclo;
    });
    return mapa;
  }, [listaCiclos]);

  const fotosFiltradas = useMemo(() => {
    if (!filtroCicloId) return fotosObra;
    return fotosObra.filter(
      (f) =>
        f.ciclo_id === filtroCicloId ||
        String(f.ciclo_id) === String(filtroCicloId)
    );
  }, [fotosObra, filtroCicloId]);

  const obraIdEfetivo =
    dadosObra?.obra_id ||
    dadosObra?.id ||
    route?.params?.obraId ||
    route?.params?.id;

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

  const servicosComFotoIds = useMemo(() => {
    const ids = new Set();
    fotosObra.forEach((f) => {
      if (f.servico_id) {
        ids.add(String(f.servico_id));
      }
    });
    return ids;
  }, [fotosObra]);

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
            setDadosObra({
              obra_id: targetId,
              nome:
                dados?.nome || route?.params?.nome || "Acompanhamento da Obra",
              ciclo_ativo: dados?.ciclo_ativo || null,
              progresso_geral_percentual: 0,
              valor_executado_total: 0,
              valor_orcado_total: 0,
              etapas: [],
            });
            return;
          }

          setDadosObra(dados);
        }
      } catch (error) {
        let nomeFallback = null;
        try {
          const obraRes = await obterObra(targetId);
          nomeFallback = obraRes?.nome;
        } catch {
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
            ? [...ciclosRes].sort(
                (a, b) => Number(b.numero_ciclo) - Number(a.numero_ciclo),
              )
            : [];
          setListaCiclos(ciclosOrdenados);
        }
      } catch (error) {
        console.error(
          "Erro ao listar ciclos da obra:",
          error?.response?.data || error?.message,
        );
      }
    },
    [route?.params?.obraId, route?.params?.id, route?.params?.nome],
  );

  const handleMapeamentoSucesso = useCallback(() => {
    carregarEstrutura(false);
  }, [carregarEstrutura]);

  const carregarFotos = useCallback(async () => {
    const targetId = obraIdEfetivo;
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
  }, [obraIdEfetivo]);

  useFocusEffect(
    useCallback(() => {
      carregarEstrutura(Boolean(dadosObra));
      carregarFotos();
    }, [carregarEstrutura, carregarFotos, Boolean(dadosObra)]),
  );

  if (carregando && !dadosObra) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.cores.azulPetroleo} />
      </View>
    );
  }

  const progressoGeral = Math.min(
    100,
    Math.max(0, Math.round(dadosObra?.progresso_geral_percentual || 0)),
  );
  const imagemParam = route?.params?.imagem;
  const imagemSource = imagemParam
    ? typeof imagemParam === "string"
      ? { uri: imagemParam }
      : imagemParam
    : require("../utils/img/obra1.jpg");

  const numeroCicloAtual = String(
    dadosObra?.ciclo_ativo?.numero_ciclo || 1,
  ).padStart(2, "0");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          mapearAction && styles.scrollContentComMapear,
        ]}
      >
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
            locations={[0, 0.35, 0.48, 0.6, 0.68, 1.0]}
            style={styles.headerFade}
            pointerEvents="none"
          />

          <View
            style={[
              styles.overlay,
              { paddingTop: Math.max(insets.top, moderateScale(20)) + moderateScale(10) },
            ]}
          >
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation?.goBack?.()}
                  activeOpacity={0.7}
                >
                  <ChevronLeft
                    color="#FFFFFF"
                    size={moderateScale(28)}
                    strokeWidth={2.5}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.obraTitulo,
                    (dadosObra?.nome || route?.params?.nome || "").length >
                      25 && styles.obraTituloLongo,
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
                <Menu
                  color="#FFFFFF"
                  size={moderateScale(26)}
                  strokeWidth={2.5}
                />
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
                Ciclo {numeroCicloAtual} -{" "}
                {dadosObra?.ciclo_ativo?.status === "aberto"
                  ? "Aberto"
                  : dadosObra?.ciclo_ativo
                    ? "Encerrado"
                    : "Aberto"}
              </Text>
              <Text style={styles.valoresText}>
                R${" "}
                {Number(dadosObra?.valor_executado_total || 0).toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )}{" "}
                / R${" "}
                {Number(dadosObra?.valor_orcado_total || 0).toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )}
              </Text>
            </View>
          </View>
        </ImageBackground>

        <SyncStatusBanner compact />

        <View style={styles.listaContainer}>
          {abaAtiva === "Etapas" &&
            (dadosObra?.etapas && dadosObra.etapas.length > 0 ? (
              dadosObra.etapas.map((etapa) => (
                <EtapaCard
                  key={etapa.id}
                  etapa={etapa}
                  navigation={navigation}
                  obraId={obraIdEfetivo}
                  cicloAtivoId={dadosObra?.ciclo_ativo?.id}
                  servicosComFotoIds={servicosComFotoIds}
                  onMedicaoSalva={() => carregarEstrutura(true)}
                />
              ))
            ) : (
              <ObraZeradaView
                obraId={obraIdEfetivo}
                onMapeamentoSucesso={handleMapeamentoSucesso}
                onMapearActionChange={handleMapearActionChange}
              />
            ))}

          {abaAtiva === "Fotos" && (
            <View style={styles.fotosContainer}>
              <View style={styles.fotosBarraAcoes}>
                <TouchableOpacity
                  style={styles.btnAcaoFotos}
                  onPress={() => setModalFiltroCicloVisivel(true)}
                  activeOpacity={0.8}
                >
                  <Filter size={15} color={theme.cores.azulPetroleo} />
                  <Text style={styles.btnAcaoFotosTexto} numberOfLines={1}>
                    {filtroCicloId
                      ? `Ciclo ${String(mapCiclos[filtroCicloId] || "").padStart(2, "0")}`
                      : "Filtrar por ciclo"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAcaoFotos, styles.btnAcaoFotosDestaque]}
                  onPress={() => {
                    const targetCicloId =
                      filtroCicloId ||
                      dadosObra?.ciclo_ativo?.id ||
                      (listaCiclos.length > 0 ? listaCiclos[0].id : null);

                    const numero =
                      (targetCicloId && mapCiclos[targetCicloId]) ||
                      dadosObra?.ciclo_ativo?.numero_ciclo ||
                      (listaCiclos.length > 0 ? listaCiclos[0].numero_ciclo : 1);

                    const obraId =
                      dadosObra?.obra_id ||
                      dadosObra?.id ||
                      route?.params?.obraId ||
                      route?.params?.id;

                    navigation?.navigate?.("PreviaRelatorioFotografico", {
                      obraId,
                      cicloId: targetCicloId,
                      numeroCiclo: numero,
                      dadosObra,
                      obraNome: dadosObra?.nome,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <FileText size={15} color="#FFFFFF" />
                  <Text style={styles.btnAcaoFotosDestaqueTexto} numberOfLines={1}>
                    Relatório Fotográfico
                  </Text>
                </TouchableOpacity>
              </View>

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
              ) : fotosFiltradas.length > 0 ? (
                <View style={styles.fotosGrid}>
                  {fotosFiltradas.map((foto) => {
                    const servicoInfo = mapServicos[foto.servico_id];
                    const uriFoto =
                      foto.caminho_local || foto.caminho_comprimido;
                    const numCicloFoto = mapCiclos[foto.ciclo_id] || 1;
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
                        <View style={styles.fotoCardBadgeCiclo}>
                          <Text style={styles.fotoCardBadgeCicloTexto}>
                            Ciclo {String(numCicloFoto).padStart(2, "0")}
                          </Text>
                        </View>
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
                  <Text style={styles.textoVazioTitulo}>
                    Nenhuma foto anexada
                  </Text>
                  <Text style={styles.textoVazioSub}>
                    As fotografias capturadas nos serviços da obra aparecerão
                    aqui.
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
                              new Date(
                                ciclo.data_encerramento,
                              ).toLocaleDateString("pt-BR")
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
                  <Text style={styles.textoVazioTitulo}>
                    Nenhum ciclo encontrado
                  </Text>
                  <Text style={styles.textoVazioSub}>
                    Os ciclos de medição aparecerão aqui.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {abaAtiva === "Ciclos" && dadosObra?.ciclo_ativo?.status === "aberto" && (
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.encerrarButton}
            onPress={() => setModalEncerrarCicloAberto(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.encerrarButtonText}>
              Encerrar Ciclo {Number(numeroCicloAtual)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ModalVisualizarFoto
        foto={fotoSelecionada}
        onFechar={() => setFotoSelecionada(null)}
        mapServicos={mapServicos}
        nomeObra={dadosObra?.nome}
      />

      <MenuAcoesObra
        visivel={menuVisivel}
        onFechar={() => setMenuVisivel(false)}
        dadosObra={dadosObra}
        navigation={navigation}
        onObraAtualizada={() => carregarEstrutura(true)}
        modalEncerrarAbertoExterno={modalEncerrarCicloAberto}
        onFecharModalEncerrarExterno={() => setModalEncerrarCicloAberto(false)}
      />

      <NavBarAcompanhamento
        abaAtiva={abaAtiva}
        aboveBar={
          mapearAction ? (
            <TouchableOpacity
              style={styles.botaoMapear}
              onPress={mapearAction}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Mapear"
            >
              <LinearGradient
                colors={["#09D1C7", "#46DFB3", "#81EF99"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradienteMapear}
              >
                <Text style={styles.textoBotaoMapear}>Mapear</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null
        }
        onChangeAba={(novaAba) => {
          setAbaAtiva(novaAba);
          if (novaAba === "Fotos") {
            carregarFotos();
          }
        }}
      />

      <Modal
        visible={modalFiltroCicloVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFiltroCicloVisivel(false)}
      >
        <TouchableOpacity
          style={styles.modalFiltroFundo}
          activeOpacity={1}
          onPress={() => setModalFiltroCicloVisivel(false)}
        >
          <View style={styles.modalFiltroCard}>
            <View style={styles.modalFiltroHeader}>
              <Text style={styles.modalFiltroTitulo}>Filtrar fotos por ciclo</Text>
              <TouchableOpacity
                onPress={() => setModalFiltroCicloVisivel(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#0F2A38" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.itemFiltroCiclo,
                filtroCicloId === null && styles.itemFiltroCicloAtivo,
              ]}
              onPress={() => {
                setFiltroCicloId(null);
                setModalFiltroCicloVisivel(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.itemFiltroCicloTexto,
                  filtroCicloId === null && styles.itemFiltroCicloTextoAtivo,
                ]}
              >
                Todos os ciclos
              </Text>
              {filtroCicloId === null && <Check size={18} color="#0D6579" />}
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: 240 }}>
              {listaCiclos.map((ciclo) => {
                const isSelected =
                  filtroCicloId === ciclo.id ||
                  String(filtroCicloId) === String(ciclo.id);
                return (
                  <TouchableOpacity
                    key={ciclo.id}
                    style={[
                      styles.itemFiltroCiclo,
                      isSelected && styles.itemFiltroCicloAtivo,
                    ]}
                    onPress={() => {
                      setFiltroCicloId(ciclo.id);
                      setModalFiltroCicloVisivel(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.itemFiltroCicloTexto,
                        isSelected && styles.itemFiltroCicloTextoAtivo,
                      ]}
                    >
                      Ciclo {String(ciclo.numero_ciclo).padStart(2, "0")}
                      {ciclo.status === "aberto" ? " (Aberto)" : " (Encerrado)"}
                    </Text>
                    {isSelected && <Check size={18} color="#0D6579" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: moderateScale(140),
  },
  scrollContentComMapear: {
    paddingBottom: moderateScale(200),
  },
  botaoMapear: {
    borderRadius: moderateScale(14),
    overflow: "hidden",
    shadowColor: "#09D1C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  gradienteMapear: {
    height: moderateScale(52),
    alignItems: "center",
    justifyContent: "center",
  },
  textoBotaoMapear: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(18),
    color: "#FFFFFF",
  },
  headerBackground: {
    width: "100%",
    minHeight: moderateScale(270),
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 2,
  },
  overlay: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 22,
    zIndex: 3,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  obraTitulo: {
    fontSize: 22,
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
    flexShrink: 1,
  },
  obraTituloLongo: {
    fontSize: 18,
    lineHeight: 22,
  },
  iconButton: {
    padding: 6,
  },
  progressoSection: {
    marginBottom: 16,
  },
  progressoLabel: {
    fontSize: 14,
    fontFamily: theme.fontes.semiNegrito,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  progressoValor: {
    fontSize: 48,
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
    lineHeight: 52,
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  cicloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  cicloText: {
    fontSize: 12,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulPetroleo,
  },
  valoresText: {
    fontSize: 12,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulPetroleo,
  },
  listaContainer: {
    paddingTop: 10,
  },
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
  ciclosContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  cicloCard: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  cicloCardTitle: {
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
    marginBottom: 4,
  },
  cicloCardStatus: {
    fontSize: 13,
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
  },
  cardVazio: {
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
    marginHorizontal: 20,
    ...theme.shadows.padrao,
  },
  textoVazioTitulo: {
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
    marginBottom: 6,
  },
  textoVazioSub: {
    fontSize: 13,
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
    textAlign: "center",
  },
  footerContainer: {
    position: "absolute",
    bottom: moderateScale(85),
    left: 20,
    right: 20,
  },
  encerrarButton: {
    backgroundColor: theme.cores.azulPetroleo,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  encerrarButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
  },
  fotosBarraAcoes: {
    flexDirection: "row",
    gap: moderateScale(10),
    marginBottom: moderateScale(16),
    width: "100%",
  },
  btnAcaoFotos: {
    flex: 1,
    height: moderateScale(40),
    borderRadius: moderateScale(12),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
    paddingHorizontal: moderateScale(10),
    ...theme.shadows.padrao,
  },
  btnAcaoFotosTexto: {
    color: theme.cores.azulPetroleo,
    fontSize: rem(0.78),
    fontFamily: theme.fontes.semiNegrito,
  },
  btnAcaoFotosDestaque: {
    backgroundColor: theme.cores.azulPetroleo,
    borderWidth: 0,
  },
  btnAcaoFotosDestaqueTexto: {
    color: "#FFFFFF",
    fontSize: rem(0.78),
    fontFamily: theme.fontes.negrito,
  },
  fotoCardBadgeCiclo: {
    position: "absolute",
    top: moderateScale(6),
    left: moderateScale(6),
    backgroundColor: "rgba(13, 101, 121, 0.90)",
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 188, 0.3)",
  },
  fotoCardBadgeCicloTexto: {
    color: "#00E5BC",
    fontSize: rem(0.6),
    fontFamily: theme.fontes.negrito,
  },
  modalFiltroFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
  },
  modalFiltroCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: moderateScale(18),
    ...theme.shadows.padrao,
  },
  modalFiltroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: moderateScale(14),
    paddingBottom: moderateScale(8),
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalFiltroTitulo: {
    fontSize: rem(0.95),
    fontFamily: theme.fontes.negrito,
    color: "#0F2A38",
  },
  itemFiltroCiclo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: moderateScale(11),
    paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(8),
    marginBottom: moderateScale(4),
  },
  itemFiltroCicloAtivo: {
    backgroundColor: "#E0F2FE",
  },
  itemFiltroCicloTexto: {
    fontSize: rem(0.85),
    fontFamily: theme.fontes.regular,
    color: "#0F2A38",
  },
  itemFiltroCicloTextoAtivo: {
    color: theme.cores.azulPetroleo,
    fontFamily: theme.fontes.negrito,
  },
});