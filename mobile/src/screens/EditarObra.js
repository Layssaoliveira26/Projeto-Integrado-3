import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AlertTriangleGradient from "../components/AlertTriangleGradient";
import ModalFeedback from "../components/ModalFeedback";
import useFeedbackAcao from "../hooks/useFeedbackAcao";

import {
  cores,
  bordas,
  dimensoes,
  fontes,
  gradianteDistribuicaoDownload,
  rem,
  moderateScale,
  isSmallPhone,
  useKeyboardPadding,
} from "../styles/theme";
import api, { obterObra, atualizarObra } from "../services/api";
import { selecionarEPersistirImagemCapa } from "../utils/imagemCapaUtils";
import {
  OPCOES_DIAS_PADRAO,
  aplicarMascaraData,
  validarDataBr,
  formatarDataParaExibicao,
  converterDataBrParaIso,
  calcularDiferencaDiasBr,
  resolverDataBasePrazo,
  calcularEstadoAoAlterarDias,
  calcularEstadoAoSelecionarPresetDias,
  calcularEstadoAoEditarDataManual,
} from "../utils/prazoObraUtils";

export default function EditarObra({ navigation, route }) {
  const scrollViewRef = useRef(null);
  const inputDiasRef = useRef(null);
  const { feedback, executar } = useFeedbackAcao();
  const keyboardPadding = useKeyboardPadding(
    moderateScale(36),
    moderateScale(24),
  );
  const telaPequena = isSmallPhone();
  const obraId = route?.params?.obraId || route?.params?.id;

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);

  const [imagemCapa, setImagemCapa] = useState(null);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [dataConclusaoBase, setDataConclusaoBase] = useState("");
  const [diasAdicionados, setDiasAdicionados] = useState("");
  const [focadoDias, setFocadoDias] = useState(false);
  const [descricao, setDescricao] = useState("");

  const [statusSalvamento, setStatusSalvamento] = useState("idle");
  const [mensagemErroModal, setMensagemErroModal] = useState("");

  // Carrega os dados atuais da obra para preencher o formulário.
  const carregarObra = useCallback(async () => {
    if (!obraId) {
      setErroCarregamento("Obra não identificada.");
      setCarregandoDados(false);
      return;
    }

    try {
      setCarregandoDados(true);
      setErroCarregamento(null);

      let obra = null;

      try {
        const resposta = await obterObra(obraId);
        obra = resposta?.data || resposta;
      } catch (erroRotaDireta) {
        const lista = await api.listarObras().catch(() => []);
        obra = Array.isArray(lista)
          ? lista.find((o) => String(o.id) === String(obraId))
          : null;
      }

      if (!obra) {
        setErroCarregamento("Não foi possível carregar os dados da obra.");
        return;
      }

      const inicioFormatado = formatarDataParaExibicao(obra.data_inicio);
      const conclusaoFormatada = formatarDataParaExibicao(obra.data_conclusao);

      setNome(obra.nome || "");
      setEndereco(obra.endereco || "");
      setDataInicio(inicioFormatado);
      setDataConclusao(conclusaoFormatada);
      setDataConclusaoBase(conclusaoFormatada);
      setDiasAdicionados("");
      setDescricao(obra.descricao || "");
      setImagemCapa(obra.imagem_capa || null);
    } catch (error) {
      console.error(
        "Erro ao carregar obra:",
        error.response?.data || error.message,
      );
      setErroCarregamento("Não foi possível carregar os dados da obra.");
    } finally {
      setCarregandoDados(false);
    }
  }, [obraId]);

  useEffect(() => {
    carregarObra();
  }, [carregarObra]);

  const handleAlterarDataInicio = (txt) => {
    const novaDataInicio = aplicarMascaraData(txt);
    setDataInicio(novaDataInicio);

    if (!validarDataBr(dataConclusaoBase, true) && diasAdicionados) {
      const recalculado = calcularEstadoAoAlterarDias(diasAdicionados, {
        dataConclusaoBase,
        dataConclusaoAtual: dataConclusao,
        dataInicio: novaDataInicio,
      });
      setDataConclusao(recalculado.dataConclusao);
    }
  };

  const handleAlterarDataConclusaoManual = (txt) => {
    const resultado = calcularEstadoAoEditarDataManual(txt, {
      dataConclusaoBase,
    });
    setDataConclusao(resultado.dataConclusao);
    setDiasAdicionados(resultado.diasAdicionados);
    if (resultado.novaDataBase !== dataConclusaoBase) {
      setDataConclusaoBase(resultado.novaDataBase);
    }
  };

  const handleAlterarDias = (txt) => {
    const resultado = calcularEstadoAoAlterarDias(txt, {
      dataConclusaoBase,
      dataConclusaoAtual: dataConclusao,
      dataInicio,
    });
    setDiasAdicionados(resultado.diasAdicionados);
    setDataConclusao(resultado.dataConclusao);
  };

  const handleSelecionarPresetDias = (diasPreset) => {
    inputDiasRef.current?.blur?.();
    setFocadoDias(false);
    const resultado = calcularEstadoAoSelecionarPresetDias(diasPreset, {
      diasAdicionadosAtual: diasAdicionados,
      dataConclusaoBase,
      dataConclusaoAtual: dataConclusao,
      dataInicio,
    });
    setDiasAdicionados(resultado.diasAdicionados);
    setDataConclusao(resultado.dataConclusao);
  };

  // Alterna para imagem padrão ou limpa caso já esteja selecionada
  const handleSelecionarImagemPadrao = () => {
    if (imagemCapa) {
      setImagemCapa(null);
    } else {
      setImagemCapa(require("../utils/img/obra1.jpg"));
    }
  };

  const handleSelecionarImagemCapa = async () => {
    try {
      const resultado = await selecionarEPersistirImagemCapa();
      if (!resultado.cancelado && resultado.uri) {
        setImagemCapa(resultado.uri);
      }
    } catch (error) {
      setMensagemErroModal(
        error?.message || "Não foi possível selecionar a imagem da capa.",
      );
      setStatusSalvamento("error");
    }
  };

  const handleSalvarAlteracoes = async () => {
    const nomeValido = nome.trim().length > 0;
    const enderecoValido = endereco.trim().length > 0;
    const dataInicioPreenchida = dataInicio.trim().length > 0;
    const dataConclusaoPreenchida = dataConclusao.trim().length > 0;
    const dataInicioValida = validarDataBr(dataInicio, true);
    const dataConclusaoValida = validarDataBr(dataConclusao, true);

    if (
      !nomeValido ||
      !enderecoValido ||
      !dataInicioPreenchida ||
      !dataConclusaoPreenchida
    ) {
      setMensagemErroModal("Preencha todos os campos obrigatórios.");
      setStatusSalvamento("error");
      return;
    }

    if (!dataInicioValida || !dataConclusaoValida) {
      setMensagemErroModal(
        "As datas devem estar no formato DD/MM/AAAA com mês válido (01 a 12).",
      );
      setStatusSalvamento("error");
      return;
    }

    const isoInicio = converterDataBrParaIso(dataInicio);
    const isoConclusao = converterDataBrParaIso(dataConclusao);
    if (isoInicio && isoConclusao && isoConclusao < isoInicio) {
      setMensagemErroModal(
        "A data de conclusão não pode ser anterior à data de início.",
      );
      setStatusSalvamento("error");
      return;
    }

    await executar(
      "editarObra",
      () =>
        atualizarObra(obraId, {
          nome: nome.trim(),
          endereco: endereco.trim(),
          data_inicio: dataInicio.trim() || null,
          data_conclusao: dataConclusao.trim() || null,
          descricao: descricao.trim() || null,
          imagem_capa: typeof imagemCapa === "string" ? imagemCapa : null,
        }),
      {
        aoConcluir: () => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            navigation?.navigate?.("AcompanhamentoObra", { obraId });
          }
        },
        aoFalhar: (error) => {
          console.error(
            "Erro ao atualizar obra:",
            error?.dados || error?.message || error,
          );
          setMensagemErroModal(
            error?.dados?.erro ||
              error?.dados?.mensagem ||
              error?.message ||
              "Erro ao salvar as alterações. Tente novamente.",
          );
          setStatusSalvamento("error");
        },
      },
    );
  };

  if (carregandoDados) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={cores.azulPetroleo} />
        </View>
      </SafeAreaView>
    );
  }

  if (erroCarregamento) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.erroTexto}>{erroCarregamento}</Text>
          <TouchableOpacity
            style={styles.botaoTentarNovamente}
            onPress={carregarObra}
          >
            <Text style={styles.textoBotaoPadrao}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const valorExibidoDias = focadoDias
    ? diasAdicionados
    : diasAdicionados
      ? `${diasAdicionados} ${Number(diasAdicionados) === 1 ? "dia" : "dias"}`
      : "";

  const dataBaseEfetiva = resolverDataBasePrazo({
    dataConclusaoBase,
    dataInicio,
  });
  const prazoAlterado =
    Boolean(dataBaseEfetiva) &&
    validarDataBr(dataConclusao, true) &&
    dataConclusao.trim() !== dataBaseEfetiva;
  const diferencaDias = prazoAlterado
    ? calcularDiferencaDiasBr(dataBaseEfetiva, dataConclusao)
    : 0;
  const qtdAbsDias = Math.abs(diferencaDias || 0);
  const sinalDelta = diferencaDias !== null && diferencaDias < 0 ? "-" : "+";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={cores.fundoTela} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() =>
              navigation && navigation.goBack && navigation.goBack()
            }
            activeOpacity={0.7}
            accessibilityLabel="Voltar"
          >
            <Feather
              name="chevron-left"
              size={moderateScale(28)}
              color={cores.titulo}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Editar Obra</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollConteudo,
            { paddingBottom: keyboardPadding },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner Informativo (Figma RF04/RF05) */}
          <View style={styles.cardInfo}>
            <Text style={styles.textoCardInfo}>
              Atualize as informações. Alterações serão salvas. Para verificar
              histórico de datas de conclusão consulte “Dados do Projeto”
            </Text>
          </View>

          {/* Seção Imagem da Capa */}
          <Text style={styles.rotulo}>Imagem da capa:</Text>
          <View style={styles.linhaImagem}>
            <TouchableOpacity
              style={[
                styles.containerUpload,
                imagemCapa && styles.containerUploadComImagem,
              ]}
              onPress={handleSelecionarImagemCapa}
              activeOpacity={0.8}
              accessibilityLabel="Selecionar imagem da capa"
            >
              {imagemCapa ? (
                <View style={styles.areaImagemPreview}>
                  <Image
                    source={
                      typeof imagemCapa === "number"
                        ? imagemCapa
                        : { uri: imagemCapa }
                    }
                    style={styles.imagemCapa}
                    resizeMode="cover"
                  />
                  <View style={styles.overlayIconeUpload}>
                    <Feather
                      name="upload-cloud"
                      size={32}
                      color={cores.verdeAgua}
                    />
                  </View>
                </View>
              ) : (
                <Feather
                  name="upload-cloud"
                  size={36}
                  color={cores.textoSecundario}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoPadrao}
              onPress={handleSelecionarImagemPadrao}
              activeOpacity={0.8}
            >
              <Text style={styles.textoBotaoPadrao}>Padrão</Text>
            </TouchableOpacity>
          </View>

          {/* Campo *Nome */}
          <Text style={styles.rotulo}>*Nome:</Text>
          <TextInput
            style={[styles.input, nome.trim() && styles.inputPreenchido]}
            placeholder="Ex: Feirão Municipal de Trairi 2026"
            placeholderTextColor="#94A3B8"
            value={nome}
            onChangeText={setNome}
            onFocus={() =>
              scrollViewRef.current?.scrollTo({ y: 50, animated: true })
            }
          />

          {/* Campo *Endereço */}
          <Text style={styles.rotulo}>*Endereço:</Text>
          <TextInput
            style={[styles.input, endereco.trim() && styles.inputPreenchido]}
            placeholder="Ex: Rua Miguelina Martins, 2328, Centro..."
            placeholderTextColor="#94A3B8"
            value={endereco}
            onChangeText={setEndereco}
            onFocus={() =>
              scrollViewRef.current?.scrollTo({ y: 120, animated: true })
            }
          />

          {/* Datas lado a lado */}
          <View style={styles.linhaDatas}>
            <View style={styles.colunaData}>
              <Text style={styles.rotulo}>*Data de início:</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputData,
                  dataInicio.length === 10 && styles.inputPreenchido,
                ]}
                placeholder="/  /"
                placeholderTextColor="#94A3B8"
                value={dataInicio}
                onChangeText={handleAlterarDataInicio}
                keyboardType="numeric"
                maxLength={10}
                onFocus={() =>
                  scrollViewRef.current?.scrollTo({ y: 200, animated: true })
                }
              />
            </View>

            <View style={styles.colunaData}>
              <Text style={styles.rotulo}>*Data de conclusão:</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputData,
                  dataConclusao.length === 10 && styles.inputPreenchido,
                ]}
                placeholder="/  /"
                placeholderTextColor="#94A3B8"
                value={dataConclusao}
                onChangeText={handleAlterarDataConclusaoManual}
                keyboardType="numeric"
                maxLength={10}
                onFocus={() =>
                  scrollViewRef.current?.scrollTo({ y: 200, animated: true })
                }
              />
            </View>
          </View>

          {/* Campo Descrição (opcional) - acima de Adicionar dias conforme Figma */}
          <Text style={styles.rotulo}>Descrição:</Text>
          <TextInput
            style={[
              styles.input,
              styles.inputDescricao,
              descricao.trim() && styles.inputPreenchido,
            ]}
            placeholder="Observações adicionais sobre a obra..."
            placeholderTextColor="#94A3B8"
            value={descricao}
            onChangeText={setDescricao}
            multiline
            textAlignVertical="top"
            onFocus={() =>
              scrollViewRef.current?.scrollTo({ y: 280, animated: true })
            }
          />

          {/* Adicionar dias ao prazo final (Figma RF04 -1 e -2) */}
          <View style={styles.secaoPrazoDias}>
            <Text style={styles.rotulo}>Adicionar dias ao prazo final:</Text>

            <View
              style={[
                styles.containerInputDias,
                Boolean(diasAdicionados) && styles.containerInputDiasPreenchido,
              ]}
            >
              <TextInput
                ref={inputDiasRef}
                style={[
                  styles.inputDiasTexto,
                  Boolean(diasAdicionados) && styles.inputDiasTextoPreenchido,
                ]}
                placeholder="Ex: 41 dias"
                placeholderTextColor="#A3A3A3"
                value={valorExibidoDias}
                onChangeText={handleAlterarDias}
                keyboardType="number-pad"
                maxLength={focadoDias ? 4 : 10}
                accessibilityLabel="Quantidade de dias para adicionar ao prazo final"
                onFocus={() => {
                  setFocadoDias(true);
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }}
                onBlur={() => setFocadoDias(false)}
              />
              <TouchableOpacity
                onPress={() => inputDiasRef.current?.focus?.()}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Informar dias para adicionar ao prazo"
              >
                <Feather
                  name="plus-circle"
                  size={moderateScale(23)}
                  color={cores.azulPetroleo}
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.linhaOpcoesDias,
                telaPequena && styles.linhaOpcoesDiasWrap,
              ]}
            >
              {OPCOES_DIAS_PADRAO.map((opcao) => {
                const selecionado =
                  diasAdicionados !== "" && Number(diasAdicionados) === opcao;
                return (
                  <TouchableOpacity
                    key={opcao}
                    style={[
                      styles.chipOpcaoDias,
                      telaPequena && styles.chipOpcaoDiasTelaPequena,
                      selecionado && styles.chipOpcaoDiasSelecionado,
                    ]}
                    onPress={() => handleSelecionarPresetDias(opcao)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selecionado }}
                    accessibilityLabel={`Adicionar ${opcao} dias ao prazo final`}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.textoChipOpcaoDias,
                        selecionado && styles.textoChipOpcaoDiasSelecionado,
                      ]}
                    >
                      +{opcao} dias
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {prazoAlterado && (
              <View style={styles.resumoProrrogacao}>
                <Feather
                  name="calendar"
                  size={moderateScale(21)}
                  color={cores.azulPetroleo}
                />
                <Text style={styles.textoResumoProrrogacao}>
                  {`Prazo anterior: ${dataBaseEfetiva} → Novo: ${dataConclusao}\n(${sinalDelta}${qtdAbsDias} ${
                    qtdAbsDias === 1 ? "dia" : "dias"
                  })`}
                </Text>
              </View>
            )}
          </View>

          {/* Botão Salvar alterações */}
          <TouchableOpacity
            style={styles.botaoProximoPasso}
            onPress={handleSalvarAlteracoes}
            disabled={statusSalvamento !== "idle" || feedback.visible}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              locations={gradianteDistribuicaoDownload}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradienteBotao}
            >
              {feedback.visible && feedback.estado === "loading" ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.textoBotaoProximoPasso}>
                  Salvar alterações
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal de Validação / Erro */}
        <Modal
          visible={statusSalvamento === "error"}
          transparent
          animationType="fade"
          onRequestClose={() => setStatusSalvamento("idle")}
        >
          <View style={styles.modalFundo}>
            <View style={styles.modalCard}>
              <View style={styles.modalAccentBar} />

              <View style={styles.modalIconeContainer}>
                <AlertTriangleGradient />
              </View>

              <Text style={styles.modalTitulo}>Erro!</Text>

              <Text style={styles.modalMensagem}>
                Algumas informações estão pendentes ou inválidas.
              </Text>
              <Text style={styles.modalMensagemDestaque}>
                {mensagemErroModal || "Preencha todos os campos obrigatórios."}
              </Text>

              <TouchableOpacity
                style={styles.modalBotao}
                onPress={() => setStatusSalvamento("idle")}
                activeOpacity={0.85}
              >
                <Text style={styles.modalTextoBotao}>Certo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>

      <ModalFeedback {...feedback} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: cores.fundoTela,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  erroTexto: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.erro,
    textAlign: "center",
    marginBottom: 16,
  },
  botaoTentarNovamente: {
    backgroundColor: cores.azulPetroleo,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: bordas.input,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(10),
    backgroundColor: cores.fundoTela,
  },
  botaoVoltar: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -moderateScale(6),
    marginRight: moderateScale(4),
  },
  tituloHeader: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.35),
    color: cores.titulo,
  },
  scrollConteudo: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(36),
  },
  cardInfo: {
    backgroundColor: cores.fundoBanner,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 20,
  },
  textoCardInfo: {
    fontFamily: fontes.media,
    fontSize: 13.5,
    color: cores.rotulo,
    lineHeight: 19,
  },
  rotulo: {
    fontFamily: fontes.semiNegrito,
    fontSize: 14,
    color: cores.titulo,
    marginBottom: 8,
  },
  linhaImagem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  containerUpload: {
    flex: 1,
    height: 102,
    backgroundColor: cores.fundoInput,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#BCE3DE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  containerUploadComImagem: {
    borderColor: cores.verdeAgua,
  },
  areaImagemPreview: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  imagemCapa: {
    width: "100%",
    height: "100%",
  },
  overlayIconeUpload: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  botaoPadrao: {
    width: 100,
    height: 102,
    backgroundColor: cores.azulPetroleo,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: cores.textoSecundario,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoPadrao: {
    fontFamily: fontes.semiNegrito,
    fontSize: 14,
    color: "#FFFFFF",
  },
  input: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoInput,
    borderRadius: 15,
    paddingHorizontal: 16,
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  inputData: {
    textAlign: "center",
  },
  inputPreenchido: {
    backgroundColor: "#DAF8EF",
    borderColor: cores.verdeAgua,
    color: cores.azulPetroleo,
    fontFamily: fontes.media,
  },
  linhaDatas: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colunaData: {
    width: "47.5%",
  },
  inputDescricao: {
    height: undefined,
    minHeight: moderateScale(50),
    maxHeight: moderateScale(200),
    paddingTop: moderateScale(13),
    paddingBottom: moderateScale(13),
    lineHeight: moderateScale(20),
    textAlignVertical: "top",
    marginBottom: 18,
  },
  secaoPrazoDias: {
    marginBottom: 28,
  },
  containerInputDias: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoInput,
    borderRadius: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  containerInputDiasPreenchido: {
    backgroundColor: "#DAF8EF",
    borderColor: cores.verdeAgua,
  },
  inputDiasTexto: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  },
  inputDiasTextoPreenchido: {
    color: cores.azulPetroleo,
    fontFamily: fontes.media,
  },
  linhaOpcoesDias: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  linhaOpcoesDiasWrap: {
    flexWrap: "wrap",
  },
  chipOpcaoDias: {
    flex: 1,
    height: moderateScale(32),
    backgroundColor: cores.fundoInput,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  chipOpcaoDiasTelaPequena: {
    flex: 0,
    width: "48%",
  },
  chipOpcaoDiasSelecionado: {
    backgroundColor: "#DAF8EF",
    borderColor: cores.verdeAgua,
  },
  textoChipOpcaoDias: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(11.5),
    color: cores.titulo,
    fontVariant: ["tabular-nums"],
  },
  textoChipOpcaoDiasSelecionado: {
    color: cores.azulPetroleo,
  },
  resumoProrrogacao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cores.fundoBanner,
    borderRadius: 15,
    minHeight: moderateScale(64),
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 12,
  },
  textoResumoProrrogacao: {
    flex: 1,
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(12.5),
    color: cores.rotulo,
    lineHeight: 19,
    fontVariant: ["tabular-nums"],
  },
  botaoProximoPasso: {
    width: "100%",
    height: 56,
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 4,
  },
  gradienteBotao: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoProximoPasso: {
    fontFamily: fontes.semiNegrito,
    fontSize: 17,
    color: "#FFFFFF",
  },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: cores.fundoCard,
    borderRadius: 24,
    paddingTop: 34,
    paddingBottom: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  modalAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: cores.verdeClaro,
  },
  modalIconeContainer: {
    marginBottom: 10,
  },
  modalTitulo: {
    fontFamily: fontes.negrito,
    fontSize: 22,
    color: cores.titulo,
    marginBottom: 10,
  },
  modalMensagem: {
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.rotulo,
    textAlign: "center",
    lineHeight: 19,
  },
  modalMensagemDestaque: {
    fontFamily: fontes.semiNegrito,
    fontSize: 14,
    color: cores.rotulo,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  modalBotao: {
    width: "100%",
    height: 48,
    backgroundColor: cores.azulPetroleo,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotao: {
    fontFamily: fontes.semiNegrito,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
