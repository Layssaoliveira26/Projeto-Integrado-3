import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Move,
  Download,
} from "lucide-react-native";
import theme, { cores, moderateScale, rem } from "../styles/theme";
import planilhaFinalService from "../services/planilhaFinalService";
import ModalGerarPlanilha from "../components/ModalGerarPlanilha";

/**
 * Utilitário de formatação de valores em Real (pt-BR)
 */
function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "R$ 0,00";
  const num = Number(valor);
  return (
    "R$ " +
    num
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

/**
 * Utilitário de formatação de quantidade
 */
function formatarQtd(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "0";
  const num = Number(valor);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(".", ",");
}

/**
 * Utilitário de formatação de percentual
 */
function formatarPercentual(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "0,00%";
  return `${Number(valor).toFixed(2).replace(".", ",")}%`;
}

export default function PreviaPlanilhaScreen({ navigation, route }) {
  const obraId = route?.params?.obraId || route?.params?.id;
  const cicloId = route?.params?.cicloId || null;
  const nomeObra = route?.params?.nome || route?.params?.nomeObra || "Obra";

  const [dados, setDados] = useState(route?.params?.dadosPlanilha || null);
  const [carregando, setCarregando] = useState(!route?.params?.dadosPlanilha);
  const [erro, setErro] = useState(null);

  // Filtro de exibição: "todos" | "inconsistencias"
  const [filtroApenasInconsistencias, setFiltroApenasInconsistencias] = useState(false);

  // Estados dos modais de download (Figma screens 2 e 3)
  const [modalDownloadVisivel, setModalDownloadVisivel] = useState(false);
  const [estadoDownload, setEstadoDownload] = useState("baixando"); // "baixando" | "concluido" | "erro"
  const [mensagemErroDownload, setMensagemErroDownload] = useState("");

  useEffect(() => {
    if (!dados && obraId) {
      carregarDados();
    }
  }, [obraId, cicloId]);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await planilhaFinalService.obterPlanilhaFinal(obraId, cicloId);
      setDados(res);
    } catch (err) {
      console.error("Erro ao carregar prévia da planilha final:", err);
      setErro(err.message || "Não foi possível carregar a prévia da planilha.");
    } finally {
      setCarregando(false);
    }
  };

  // Identificação e contagem de inconsistências (Checklist 2 da US23)
  const inconsistencias = useMemo(() => {
    if (!dados?.etapas) return [];
    const lista = [];
    dados.etapas.forEach((etapa) => {
      (etapa.servicos || []).forEach((servico) => {
        const saldoQtd = Number(servico.saldo_quantidade);
        const saldoVal = Number(servico.saldo_valor);
        if (saldoQtd < 0 || saldoVal < 0) {
          lista.push({
            servicoId: servico.id,
            codigo: servico.codigo_servico,
            descricao: servico.descricao,
            saldoQtd,
            saldoVal,
          });
        }
      });
    });
    return lista;
  }, [dados]);

  const temInconsistencias = inconsistencias.length > 0;

  // Filtragem dos serviços se o usuário clicar para ver apenas inconsistências
  const etapasExibidas = useMemo(() => {
    if (!dados?.etapas) return [];
    if (!filtroApenasInconsistencias) return dados.etapas;

    return dados.etapas
      .map((etapa) => ({
        ...etapa,
        servicos: (etapa.servicos || []).filter(
          (s) => Number(s.saldo_quantidade) < 0 || Number(s.saldo_valor) < 0
        ),
      }))
      .filter((etapa) => etapa.servicos.length > 0);
  }, [dados, filtroApenasInconsistencias]);

  const handleBaixarArquivo = async () => {
    try {
      setMensagemErroDownload("");
      setEstadoDownload("baixando");
      setModalDownloadVisivel(true);
      await planilhaFinalService.baixarPlanilhaFinal(obraId, cicloId, nomeObra);
      setEstadoDownload("concluido");
    } catch (err) {
      console.error("Erro ao baixar planilha:", err);
      setMensagemErroDownload(err.message || "Falha ao baixar planilha.");
      setEstadoDownload("erro");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Cabeçalho superior (Figma) */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityLabel="Voltar"
          >
            <ChevronLeft size={28} color={cores.textoEscuro} />
          </TouchableOpacity>

          <View style={styles.headerTextos}>
            <Text style={styles.tituloHeader}>Pré-visualização</Text>
            <Text style={styles.subtituloHeader}>
              Arraste para visualizar a planilha final das medições.
            </Text>
          </View>
        </View>

        {/* Banner de Inconsistências (Checklist 2 - Sinalização) */}
        {dados && (
          <View
            style={[
              styles.cardInconsistencias,
              temInconsistencias ? styles.cardAlerta : styles.cardSucesso,
            ]}
          >
            <View style={styles.inconsistenciaLinha}>
              {temInconsistencias ? (
                <AlertTriangle size={20} color="#DC2626" style={styles.iconeAlerta} />
              ) : (
                <CheckCircle2 size={20} color="#16A34A" style={styles.iconeAlerta} />
              )}
              <View style={styles.inconsistenciaTextos}>
                <Text
                  style={[
                    styles.inconsistenciaTitulo,
                    temInconsistencias ? styles.textoAlerta : styles.textoSucesso,
                  ]}
                >
                  {temInconsistencias
                    ? `${inconsistencias.length} inconsistência(s) detectada(s)`
                    : "Nenhuma inconsistência detectada"}
                </Text>
                <Text style={styles.inconsistenciaSubtitulo}>
                  {temInconsistencias
                    ? "Há serviços com medição acima do orçamento previsto (saldo negativo)."
                    : "Todas as medições registradas estão em conformidade com o orçado."}
                </Text>
              </View>

              {temInconsistencias && (
                <TouchableOpacity
                  style={[
                    styles.botaoFiltro,
                    filtroApenasInconsistencias && styles.botaoFiltroAtivo,
                  ]}
                  onPress={() => setFiltroApenasInconsistencias((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.textoBotaoFiltro,
                      filtroApenasInconsistencias && styles.textoBotaoFiltroAtivo,
                    ]}
                  >
                    {filtroApenasInconsistencias ? "Ver tudo" : "Filtrar"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Estado de Carregamento */}
        {carregando && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={cores.azulPetroleo} />
            <Text style={styles.textoCarregando}>Carregando prévia da planilha...</Text>
          </View>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <View style={styles.centerContainer}>
            <AlertTriangle size={40} color="#DC2626" />
            <Text style={styles.textoErro}>{erro}</Text>
            <TouchableOpacity style={styles.botaoTentarNovamente} onPress={carregarDados}>
              <Text style={styles.textoBotaoTentarNovamente}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Container da Planilha (Figma: Borda arredondada teal com suporte a rolagem bidirecional) */}
        {!carregando && !erro && dados && (
          <View style={styles.planilhaViewport}>
            {/* Dica visual de movimentação bidirecional */}
            <View style={styles.dicaScroll}>
              <Move size={14} color="#0D6579" />
              <Text style={styles.textoDicaScroll}>
                Role vertical e horizontalmente para conferir
              </Text>
            </View>

            <ScrollView
              horizontal
              style={styles.scrollHorizontal}
              contentContainerStyle={styles.scrollHorizontalContent}
              bounces={false}
            >
              <View style={styles.tabelaWrapper}>
                {/* Linha de Cabeçalho Fixa no Topo da Tabela */}
                <View style={styles.linhaCabecalho}>
                  <Text style={[styles.celulaCabecalho, styles.colItem]}>ITEM</Text>
                  <Text style={[styles.celulaCabecalho, styles.colCodigo]}>CÓDIGO</Text>
                  <Text style={[styles.celulaCabecalho, styles.colDescricao]}>DESCRIÇÃO</Text>
                  <Text style={[styles.celulaCabecalho, styles.colUnd]}>UND</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>QTD ORÇADA</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>UNITÁRIO (R$)</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>TOTAL ORÇADO (R$)</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>QTD PERÍODO</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>VALOR PERÍODO (R$)</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>QTD ACUMULADA</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>VALOR ACUMULADO (R$)</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>SALDO QTD</Text>
                  <Text style={[styles.celulaCabecalho, styles.colValor]}>SALDO VALOR (R$)</Text>
                  <Text style={[styles.celulaCabecalho, styles.colPct]}>% EXEC</Text>
                  <Text style={[styles.celulaCabecalho, styles.colStatus]}>STATUS</Text>
                </View>

                {/* Corpo Rolável Verticalmente */}
                <ScrollView style={styles.scrollVertical} bounces={false}>
                  <View style={styles.tabelaContainer}>
                  {/* Linhas de Etapas e Serviços */}
                  {etapasExibidas.map((etapa, idxEtapa) => {
                    const numEtapa = etapa.ordem || idxEtapa + 1;
                    return (
                      <View key={`etapa-${etapa.id || numEtapa}`}>
                        {/* Linha da Etapa */}
                        <View style={styles.linhaEtapa}>
                          <Text style={[styles.celulaEtapa, styles.colItem]}>
                            {numEtapa}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colCodigo]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colDescricao]}>
                            {etapa.nome}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colUnd]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>
                            {formatarMoeda(etapa.total_orcado)}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>
                            {formatarMoeda(etapa.total_periodo)}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>—</Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>
                            {formatarMoeda(etapa.total_acumulado)}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colValor]}>—</Text>
                          <Text
                            style={[
                              styles.celulaEtapa,
                              styles.colValor,
                              Number(etapa.total_saldo) < 0 && styles.textoSaldoNegativo,
                            ]}
                          >
                            {formatarMoeda(etapa.total_saldo)}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colPct]}>
                            {formatarPercentual(etapa.percentual_execucao)}
                          </Text>
                          <Text style={[styles.celulaEtapa, styles.colStatus]}>
                            {Number(etapa.total_saldo) < 0 ? "⚠️ Excedido" : "✓ Etapa"}
                          </Text>
                        </View>

                        {/* Serviços da Etapa */}
                        {(etapa.servicos || []).map((servico, idxServico) => {
                          const itemCod = `${numEtapa}.${idxServico + 1}`;
                          const isSaldoNegativo =
                            Number(servico.saldo_quantidade) < 0 ||
                            Number(servico.saldo_valor) < 0;

                          return (
                            <View
                              key={`servico-${servico.id || itemCod}`}
                              style={[
                                styles.linhaServico,
                                isSaldoNegativo && styles.linhaServicoInconsistente,
                              ]}
                            >
                              <Text style={[styles.celulaServico, styles.colItem]}>
                                {itemCod}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colCodigo]}>
                                {servico.codigo_servico || "—"}
                              </Text>
                              <Text
                                style={[styles.celulaServico, styles.colDescricao]}
                                numberOfLines={2}
                              >
                                {servico.descricao}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colUnd]}>
                                {servico.unidade_medida}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarQtd(servico.quantidade_orcada)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarMoeda(servico.preco_unitario)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarMoeda(servico.preco_total)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarQtd(servico.quantidade_periodo)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarMoeda(servico.valor_periodo)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarQtd(servico.quantidade_acumulada)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colValor]}>
                                {formatarMoeda(servico.valor_acumulado)}
                              </Text>
                              <Text
                                style={[
                                  styles.celulaServico,
                                  styles.colValor,
                                  isSaldoNegativo && styles.textoSaldoNegativo,
                                ]}
                              >
                                {formatarQtd(servico.saldo_quantidade)}
                              </Text>
                              <Text
                                style={[
                                  styles.celulaServico,
                                  styles.colValor,
                                  isSaldoNegativo && styles.textoSaldoNegativo,
                                ]}
                              >
                                {formatarMoeda(servico.saldo_valor)}
                              </Text>
                              <Text style={[styles.celulaServico, styles.colPct]}>
                                {formatarPercentual(servico.percentual_execucao)}
                              </Text>
                              <View style={[styles.celulaStatus, styles.colStatus]}>
                                {isSaldoNegativo ? (
                                  <View style={styles.badgeInconsistente}>
                                    <Text style={styles.textoBadgeInconsistente}>
                                      ⚠️ Saldo Excedido
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.badgeNormal}>
                                    <Text style={styles.textoBadgeNormal}>✓ OK</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}

                  {/* Linha de Totais Gerais da Obra */}
                  {dados.totais && (
                    <View style={styles.linhaTotalGeral}>
                      <Text style={[styles.celulaTotalGeral, styles.colItem]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colCodigo]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colDescricao]}>
                        TOTAL GERAL DA OBRA
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colUnd]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>
                        {formatarMoeda(dados.totais.total_orcado)}
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>
                        {formatarMoeda(dados.totais.total_periodo)}
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>—</Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>
                        {formatarMoeda(dados.totais.total_acumulado)}
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colValor]}>—</Text>
                      <Text
                        style={[
                          styles.celulaTotalGeral,
                          styles.colValor,
                          Number(dados.totais.total_saldo) < 0 && styles.textoSaldoNegativo,
                        ]}
                      >
                        {formatarMoeda(dados.totais.total_saldo)}
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colPct]}>
                        {formatarPercentual(dados.totais.percentual_execucao)}
                      </Text>
                      <Text style={[styles.celulaTotalGeral, styles.colStatus]}>
                        Total
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

        {/* Botão Inferior de Download (Figma) */}
        <View style={styles.rodape}>
          <TouchableOpacity
            style={styles.botaoBaixar}
            onPress={handleBaixarArquivo}
            activeOpacity={0.85}
            disabled={carregando || !dados}
            accessibilityLabel="Baixar arquivo da planilha final"
          >
            <Download size={20} color="#0D6579" style={{ marginRight: 8 }} />
            <Text style={styles.textoBotaoBaixar}>Baixar arquivo</Text>
          </TouchableOpacity>
        </View>

        {/* Modais de Download (Figma screens 2 e 3: "Baixando" e "Download concluído") */}
        <ModalGerarPlanilha
          visivel={modalDownloadVisivel}
          estado={estadoDownload}
          mensagemErro={mensagemErroDownload}
          onFechar={() => setModalDownloadVisivel(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.cores.fundoCard || "#F6F4F0",
  },
  container: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(12),
  },
  botaoVoltar: {
    padding: 6,
    marginRight: 6,
    marginLeft: -6,
  },
  headerTextos: {
    flex: 1,
  },
  tituloHeader: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: "#223B59",
    marginBottom: 2,
  },
  subtituloHeader: {
    fontSize: moderateScale(13),
    color: "#64748B",
  },

  // Banner de Inconsistências
  cardInconsistencias: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardAlerta: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  cardSucesso: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  inconsistenciaLinha: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconeAlerta: {
    marginRight: 8,
  },
  inconsistenciaTextos: {
    flex: 1,
  },
  inconsistenciaTitulo: {
    fontSize: moderateScale(13),
    fontWeight: "700",
  },
  textoAlerta: {
    color: "#B91C1C",
  },
  textoSucesso: {
    color: "#15803D",
  },
  inconsistenciaSubtitulo: {
    fontSize: moderateScale(11.5),
    color: "#64748B",
    marginTop: 1,
  },
  botaoFiltro: {
    backgroundColor: "#DC2626",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  botaoFiltroAtivo: {
    backgroundColor: "#334155",
  },
  textoBotaoFiltro: {
    color: "#FFFFFF",
    fontSize: moderateScale(11.5),
    fontWeight: "600",
  },
  textoBotaoFiltroAtivo: {
    color: "#FFFFFF",
  },

  // Viewport Container da Planilha (Figma: moldura arredondada com borda teal)
  planilhaViewport: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#16929C",
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  dicaScroll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1FBF9",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E2F2EF",
    gap: 6,
  },
  textoDicaScroll: {
    fontSize: moderateScale(11),
    color: "#0D6579",
    fontWeight: "500",
  },
  scrollHorizontal: {
    flex: 1,
  },
  scrollHorizontalContent: {
    flexGrow: 1,
  },
  tabelaWrapper: {
    width: 1945,
    flex: 1,
  },
  scrollVertical: {
    flex: 1,
  },
  tabelaContainer: {
    width: 1945,
    paddingBottom: 20,
  },

  // Linhas da Tabela
  linhaCabecalho: {
    width: 1945,
    flexDirection: "row",
    backgroundColor: "#0D6579",
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#0A4F5E",
    alignItems: "center",
  },
  celulaCabecalho: {
    color: "#FFFFFF",
    fontSize: moderateScale(11.5),
    fontWeight: "700",
    paddingHorizontal: 8,
  },

  linhaEtapa: {
    flexDirection: "row",
    backgroundColor: "#E6F4F1",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#D1ECE6",
    alignItems: "center",
  },
  celulaEtapa: {
    color: "#1E293B",
    fontSize: moderateScale(12),
    fontWeight: "700",
    paddingHorizontal: 8,
  },

  linhaServico: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  linhaServicoInconsistente: {
    backgroundColor: "#FFF1F2",
  },
  celulaServico: {
    color: "#334155",
    fontSize: moderateScale(11.5),
    paddingHorizontal: 8,
  },

  linhaTotalGeral: {
    flexDirection: "row",
    backgroundColor: "#223B59",
    paddingVertical: 11,
    borderTopWidth: 2,
    borderTopColor: "#0D6579",
    alignItems: "center",
  },
  celulaTotalGeral: {
    color: "#FFFFFF",
    fontSize: moderateScale(12.5),
    fontWeight: "800",
    paddingHorizontal: 8,
  },

  // Dimensões de Colunas
  colItem: { width: 65, textAlign: "center" },
  colCodigo: { width: 95, textAlign: "center" },
  colDescricao: { width: 280, textAlign: "left" },
  colUnd: { width: 60, textAlign: "center" },
  colValor: { width: 135, textAlign: "right" },
  colPct: { width: 90, textAlign: "right" },
  colStatus: { width: 140, textAlign: "center" },

  celulaStatus: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNormal: {
    backgroundColor: "#DCFCE7",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  textoBadgeNormal: {
    color: "#166534",
    fontSize: 10.5,
    fontWeight: "600",
  },
  badgeInconsistente: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  textoBadgeInconsistente: {
    color: "#991B1B",
    fontSize: 10.5,
    fontWeight: "700",
  },
  textoSaldoNegativo: {
    color: "#DC2626",
    fontWeight: "700",
  },

  // Rodapé com Botão Baixar Arquivo (Figma: botão primário verde vibrante)
  rodape: {
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  botaoBaixar: {
    height: moderateScale(48),
    backgroundColor: cores.verdeAgua || "#46DFB3",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16929C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  textoBotaoBaixar: {
    color: "#0D6579",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },

  // Estados centrais
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  textoCarregando: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  textoErro: {
    marginTop: 12,
    fontSize: 14,
    color: "#DC2626",
    textAlign: "center",
    lineHeight: 20,
  },
  botaoTentarNovamente: {
    marginTop: 16,
    backgroundColor: "#0D6579",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  textoBotaoTentarNovamente: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
