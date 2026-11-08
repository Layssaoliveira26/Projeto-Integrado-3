import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Share2,
  FileText,
  Camera,
  Layers,
  X,
  CheckCircle2,
} from "lucide-react-native";
import {
  obterDadosRelatorioFotografico,
  exportarRelatorioFotograficoPdf,
} from "../services/relatorioFotograficoService";
import theme, { rem, moderateScale } from "../styles/theme";

export default function PreviaRelatorioFotograficoScreen({ route, navigation }) {
  const {
    obraId,
    cicloId,
    dadosObra,
    numeroCiclo = 1,
    obraNome = "Obra",
  } = route?.params || {};

  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [dadosRelatorio, setDadosRelatorio] = useState(null);
  const [fotoSelecionada, setFotoSelecionada] = useState(null);

  const carregarRelatorio = useCallback(async () => {
    try {
      setCarregando(true);
      const dados = await obterDadosRelatorioFotografico({
        obraId,
        cicloId,
        dadosObra,
        numeroCiclo,
      });
      setDadosRelatorio(dados);
    } catch (error) {
      console.error("Erro ao carregar prévia do relatório:", error);
      Alert.alert(
        "Erro",
        "Não foi possível carregar os dados fotográficos do ciclo."
      );
    } finally {
      setCarregando(false);
    }
  }, [obraId, cicloId, dadosObra, numeroCiclo]);

  useEffect(() => {
    carregarRelatorio();
  }, [carregarRelatorio]);

  const handleExportarPdf = async () => {
    if (!dadosRelatorio || dadosRelatorio.totalFotos === 0) {
      Alert.alert(
        "Aviso",
        "Este ciclo não possui fotografias registradas para exportação."
      );
      return;
    }

    try {
      setExportando(true);
      await exportarRelatorioFotograficoPdf(dadosRelatorio);
    } catch (error) {
      console.error("Erro na exportação do PDF:", error);
      Alert.alert(
        "Falha na Exportação",
        error?.message || "Não foi possível gerar o arquivo PDF."
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.botaoVoltar}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={28} color={theme.cores.azulPetroleo} />
        </TouchableOpacity>

        <View style={styles.headerTextoContainer}>
          <Text style={styles.headerTitulo} numberOfLines={1}>
            Relatório Fotográfico
          </Text>
          <Text style={styles.headerSubtitulo} numberOfLines={1}>
            Ciclo {String(numeroCiclo).padStart(2, "0")} • {dadosRelatorio?.obraNome || obraNome}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.botaoCompartilharTopo,
            (!dadosRelatorio || dadosRelatorio.totalFotos === 0 || exportando) && {
              opacity: 0.4,
            },
          ]}
          onPress={handleExportarPdf}
          disabled={!dadosRelatorio || dadosRelatorio.totalFotos === 0 || exportando}
          activeOpacity={0.8}
        >
          {exportando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Share2 size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.centroCarregando}>
          <ActivityIndicator size="large" color={theme.cores.azulPetroleo} />
          <Text style={styles.textoCarregando}>
            Organizando fotos do ciclo...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cards de Resumo */}
          <View style={styles.resumoContainer}>
            <View style={styles.resumoCard}>
              <View style={styles.resumoIconeBox}>
                <Camera size={18} color={theme.cores.azulPetroleo} />
              </View>
              <Text style={styles.resumoValor}>
                {dadosRelatorio?.totalFotos || 0}
              </Text>
              <Text style={styles.resumoRotulo}>Total de Fotos</Text>
            </View>

            <View style={styles.resumoCard}>
              <View style={styles.resumoIconeBox}>
                <Layers size={18} color="#0D9488" />
              </View>
              <Text style={styles.resumoValor}>
                {dadosRelatorio?.totalServicosComFotos || 0}
              </Text>
              <Text style={styles.resumoRotulo}>Serviços Medidos</Text>
            </View>

            <View style={styles.resumoCard}>
              <View style={styles.resumoIconeBox}>
                <FileText size={18} color="#0284C7" />
              </View>
              <Text style={styles.resumoValor}>
                {dadosRelatorio?.etapas?.length || 0}
              </Text>
              <Text style={styles.resumoRotulo}>Etapas Cobertas</Text>
            </View>
          </View>

          {/* Lista de Etapas e Serviços */}
          {dadosRelatorio?.etapas && dadosRelatorio.etapas.length > 0 ? (
            dadosRelatorio.etapas.map((etapa) => (
              <View key={etapa.id} style={styles.etapaSecao}>
                <View style={styles.etapaCabecalho}>
                  <View style={styles.etapaBarraVertical} />
                  <Text style={styles.etapaTitulo}>{etapa.nome}</Text>
                </View>

                {etapa.servicos.map((servico) => (
                  <View key={servico.id} style={styles.servicoCard}>
                    <View style={styles.servicoCabecalho}>
                      <Text style={styles.servicoDescricao}>
                        {servico.codigo ? `${servico.codigo} - ` : ""}
                        {servico.descricao}
                      </Text>
                      <Text style={styles.servicoBadgeFotos}>
                        {servico.fotos.length}{" "}
                        {servico.fotos.length === 1 ? "foto" : "fotos"}
                      </Text>
                    </View>

                    {/* Grade de Fotografias */}
                    <View style={styles.fotosGrid}>
                      {servico.fotos.map((foto) => (
                        <TouchableOpacity
                          key={foto.id}
                          style={styles.fotoCard}
                          onPress={() => setFotoSelecionada(foto)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: foto.uri }}
                            style={styles.fotoImagem}
                            resizeMode="cover"
                          />

                          <View style={styles.badgeCicloFoto}>
                            <Text style={styles.badgeCicloFotoTexto}>
                              Ciclo {String(numeroCiclo).padStart(2, "0")}
                            </Text>
                          </View>

                          <View style={styles.fotoInfoBox}>
                            <View style={styles.fotoInfoLinha}>
                              <Calendar size={11} color="#64748B" />
                              <Text
                                style={styles.fotoInfoData}
                                numberOfLines={1}
                              >
                                {foto.dataHoraFormatada}
                              </Text>
                            </View>

                            <View style={styles.fotoInfoLinha}>
                              <MapPin
                                size={11}
                                color={
                                  foto.possuiCoordenadas ? "#0D9488" : "#94A3B8"
                                }
                              />
                              <Text
                                style={[
                                  styles.fotoInfoGps,
                                  foto.possuiCoordenadas &&
                                  styles.fotoInfoGpsAtivo,
                                ]}
                                numberOfLines={1}
                              >
                                {foto.coordenadasTexto}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.vazioCard}>
              <View style={styles.vazioIconeContainer}>
                <Camera size={44} color="#94A3B8" strokeWidth={1.5} />
              </View>
              <Text style={styles.vazioTitulo}>
                Nenhuma foto registrada neste ciclo
              </Text>
              <Text style={styles.vazioDescricao}>
                Para gerar o relatório fotográfico, realize a captura de fotos nos
                serviços medidos deste ciclo.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Barra de Ação Inferior */}
      {dadosRelatorio && dadosRelatorio.totalFotos > 0 && (
        <View style={styles.rodapeBarra}>
          <TouchableOpacity
            style={[styles.botaoExportar, exportando && styles.botaoDesabilitado]}
            onPress={handleExportarPdf}
            disabled={exportando}
            activeOpacity={0.85}
          >
            {exportando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <FileText size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.botaoExportarTexto}>
                  Exportar Relatório em PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de Zoom e Detalhe da Foto */}
      <Modal
        visible={Boolean(fotoSelecionada)}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoSelecionada(null)}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.modalTitulo} numberOfLines={2}>
                  {fotoSelecionada?.servicoDescricao || "Fotografia do Serviço"}
                </Text>
                <Text style={styles.modalSubtitulo}>
                  Ciclo {String(numeroCiclo).padStart(2, "0")} • {dadosRelatorio?.obraNome}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalFecharBtn}
                onPress={() => setFotoSelecionada(null)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalImagemContainer}>
              <Image
                source={{ uri: fotoSelecionada?.uri }}
                style={styles.modalImagem}
                resizeMode="contain"
              />
            </View>

            <View style={styles.modalFooter}>
              <View style={styles.modalLinhaInfo}>
                <Calendar size={13} color="#CBD5E1" />
                <Text style={styles.modalTextoInfo}>
                  Capturada em: {fotoSelecionada?.dataHoraFormatada}
                </Text>
              </View>

              <View style={styles.modalLinhaInfo}>
                <MapPin
                  size={13}
                  color={
                    fotoSelecionada?.possuiCoordenadas ? "#00E5BC" : "#94A3B8"
                  }
                />
                <Text
                  style={[
                    styles.modalTextoInfo,
                    fotoSelecionada?.possuiCoordenadas && { color: "#00E5BC" },
                  ]}
                >
                  {fotoSelecionada?.coordenadasTexto}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F4F0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  botaoVoltar: {
    padding: moderateScale(4),
    marginRight: moderateScale(8),
  },
  headerTextoContainer: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: rem(1.1),
    fontFamily: theme.fontes.negrito,
    color: "#0F2A38",
  },
  headerSubtitulo: {
    fontSize: rem(0.75),
    fontFamily: theme.fontes.regular,
    color: "#64748B",
    marginTop: moderateScale(2),
  },
  botaoCompartilharTopo: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(12),
    backgroundColor: theme.cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  centroCarregando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: moderateScale(10),
  },
  textoCarregando: {
    color: "#64748B",
    fontSize: rem(0.85),
    fontFamily: theme.fontes.regular,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(100),
  },
  resumoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: moderateScale(8),
    marginBottom: moderateScale(18),
  },
  resumoCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  resumoIconeBox: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(4),
  },
  resumoValor: {
    fontSize: rem(1.15),
    fontFamily: theme.fontes.negrito,
    color: "#0F2A38",
  },
  resumoRotulo: {
    fontSize: rem(0.65),
    fontFamily: theme.fontes.regular,
    color: "#64748B",
    textAlign: "center",
    marginTop: moderateScale(2),
  },
  etapaSecao: {
    marginBottom: moderateScale(20),
  },
  etapaCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: moderateScale(10),
  },
  etapaBarraVertical: {
    width: 4,
    height: 18,
    backgroundColor: theme.cores.azulPetroleo,
    borderRadius: 2,
    marginRight: moderateScale(8),
  },
  etapaTitulo: {
    fontSize: rem(0.95),
    fontFamily: theme.fontes.negrito,
    color: "#0F2A38",
  },
  servicoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    marginBottom: moderateScale(12),
    ...theme.shadows.padrao,
  },
  servicoCabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: moderateScale(12),
    gap: moderateScale(8),
  },
  servicoDescricao: {
    flex: 1,
    fontSize: rem(0.85),
    fontFamily: theme.fontes.semiNegrito,
    color: "#0F2A38",
    lineHeight: 20,
  },
  servicoBadgeFotos: {
    fontSize: rem(0.7),
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulPetroleo,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(6),
  },
  fotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: moderateScale(12),
  },
  fotoCard: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: moderateScale(10),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fotoImagem: {
    width: "100%",
    height: moderateScale(120),
  },
  badgeCicloFoto: {
    position: "absolute",
    top: moderateScale(6),
    left: moderateScale(6),
    backgroundColor: "rgba(13, 101, 121, 0.90)",
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(4),
  },
  badgeCicloFotoTexto: {
    color: "#00E5BC",
    fontSize: rem(0.6),
    fontFamily: theme.fontes.negrito,
  },
  fotoInfoBox: {
    padding: moderateScale(8),
    gap: moderateScale(3),
  },
  fotoInfoLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
  },
  fotoInfoData: {
    fontSize: rem(0.65),
    fontFamily: theme.fontes.regular,
    color: "#475569",
    flex: 1,
  },
  fotoInfoGps: {
    fontSize: rem(0.65),
    fontFamily: theme.fontes.regular,
    color: "#94A3B8",
    flex: 1,
  },
  fotoInfoGpsAtivo: {
    color: "#0D9488",
    fontFamily: theme.fontes.semiNegrito,
  },
  vazioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    padding: moderateScale(32),
    alignItems: "center",
    marginTop: moderateScale(20),
    ...theme.shadows.padrao,
  },
  vazioIconeContainer: {
    marginBottom: moderateScale(12),
  },
  vazioTitulo: {
    fontSize: rem(0.95),
    fontFamily: theme.fontes.negrito,
    color: "#0F2A38",
    textAlign: "center",
    marginBottom: moderateScale(6),
  },
  vazioDescricao: {
    fontSize: rem(0.8),
    fontFamily: theme.fontes.regular,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  rodapeBarra: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(14),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    ...theme.shadows.padrao,
  },
  botaoExportar: {
    height: moderateScale(48),
    backgroundColor: theme.cores.azulPetroleo,
    borderRadius: moderateScale(12),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoExportarTexto: {
    color: "#FFFFFF",
    fontSize: rem(0.9),
    fontFamily: theme.fontes.negrito,
  },
  // Modal de Zoom
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0F172A",
    borderRadius: moderateScale(20),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalTitulo: {
    color: "#FFFFFF",
    fontSize: rem(0.9),
    fontFamily: theme.fontes.negrito,
  },
  modalSubtitulo: {
    color: "#94A3B8",
    fontSize: rem(0.7),
    fontFamily: theme.fontes.regular,
    marginTop: moderateScale(2),
  },
  modalFecharBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImagemContainer: {
    width: "100%",
    height: moderateScale(320),
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImagem: {
    width: "100%",
    height: "100%",
  },
  modalFooter: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: "#0F172A",
    gap: moderateScale(6),
  },
  modalLinhaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
  },
  modalTextoInfo: {
    color: "#CBD5E1",
    fontSize: rem(0.75),
    fontFamily: theme.fontes.regular,
  },
});
