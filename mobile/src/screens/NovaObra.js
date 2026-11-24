import React, { useState, useRef } from "react";
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
  useKeyboardPadding,
} from "../styles/theme";
import { criarObra } from "../services/api";
import { selecionarEPersistirImagemCapa } from "../utils/imagemCapaUtils";

export default function NovaObra({ navigation }) {
  const scrollViewRef = useRef(null);
  const { feedback, executar } = useFeedbackAcao();
  const keyboardPadding = useKeyboardPadding(
    moderateScale(36),
    moderateScale(24),
  );
  const [imagemCapa, setImagemCapa] = useState(null);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [descricao, setDescricao] = useState("");

  const [modalErroVisivel, setModalErroVisivel] = useState(false);
  const [mensagemErroModal, setMensagemErroModal] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Formatação automática para data no formato DD/MM/AAAA com bloqueio de dia > 31 e mês > 12
  const aplicarMascaraData = (texto) => {
    const apenasNumeros = texto.replace(/\D/g, "").slice(0, 8);
    let dia = apenasNumeros.slice(0, 2);
    let mes = apenasNumeros.slice(2, 4);
    const ano = apenasNumeros.slice(4, 8);

    if (dia.length === 2) {
      const d = parseInt(dia, 10);
      if (d > 31) dia = "31";
      else if (d === 0) dia = "01";
    }

    if (mes.length === 2) {
      const m = parseInt(mes, 10);
      if (m > 12) mes = "12";
      else if (m === 0) mes = "01";
    }

    if (apenasNumeros.length <= 2) return dia;
    if (apenasNumeros.length <= 4) return `${dia}/${mes}`;
    return `${dia}/${mes}/${ano}`;
  };

  const validarDataValida = (valor, obrigatorio = true) => {
    if (!valor || valor.trim().length === 0) return !obrigatorio;
    const str = valor.trim();
    if (str.length !== 10) return false;
    const partes = str.split("/");
    if (partes.length !== 3) return false;
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10);
    const ano = parseInt(partes[2], 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
    if (mes < 1 || mes > 12) return false;
    if (ano < 1900 || ano > 2100) return false;

    const diasNoMes = new Date(ano, mes, 0).getDate();
    return dia >= 1 && dia <= diasNoMes;
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
      setModalErroVisivel(true);
    }
  };

  const converterParaIso = (valor) => {
    const partes = String(valor || "").trim().split("/");
    if (partes.length !== 3) return null;
    return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
  };

  const handleCadastrarObra = async () => {
    // Validação dos campos obrigatórios demarcados com *
    const nomeValido = nome.trim().length > 0;
    const enderecoValido = endereco.trim().length > 0;
    const dataInicioValida = validarDataValida(dataInicio, true);
    const dataConclusaoValida = validarDataValida(dataConclusao, true);

    if (!nomeValido || !enderecoValido) {
      setMensagemErroModal("Preencha todos os campos obrigatórios.");
      setModalErroVisivel(true);
      return;
    }

    if (!dataInicioValida || !dataConclusaoValida) {
      setMensagemErroModal(
        "As datas devem estar no formato DD/MM/AAAA com mês válido (01 a 12).",
      );
      setModalErroVisivel(true);
      return;
    }

    const isoInicio = converterParaIso(dataInicio);
    const isoConclusao = converterParaIso(dataConclusao);
    if (isoInicio && isoConclusao && isoConclusao < isoInicio) {
      setMensagemErroModal("A data de conclusão não pode ser anterior à data de início.");
      setModalErroVisivel(true);
      return;
    }

    setSalvando(true);
    try {
      await executar(
        "cadastrarObra",
        () =>
          criarObra({
            nome: nome.trim(),
            endereco: endereco.trim(),
            data_inicio: dataInicio.trim(),
            data_conclusao: dataConclusao.trim(),
            descricao: descricao.trim(),
            imagem_capa: typeof imagemCapa === "string" ? imagemCapa : null,
          }),
        {
          duracaoSucesso: 1200,
          aoConcluir: () => {
            if (navigation?.canGoBack?.() && navigation?.goBack) {
              navigation.goBack();
            } else {
              navigation?.navigate?.("Home");
            }
          },
          aoFalhar: (error) => {
            console.error("Erro ao cadastrar obra:", error);
            setMensagemErroModal(
              error.message || "Erro ao salvar a obra. Tente novamente.",
            );
            setModalErroVisivel(true);
          },
        },
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
          <Text style={styles.tituloHeader}>Nova Obra</Text>
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
          {/* Banner Informativo */}
          <View style={styles.cardInfo}>
            <Text style={styles.textoCardInfo}>
              Preencha as informações sobre a nova obra abaixo.
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
              accessibilityLabel="Usar ou remover imagem padrão da capa"
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
                  dataInicio.length === 10 && styles.inputPreenchido,
                ]}
                placeholder="/  /"
                placeholderTextColor="#94A3B8"
                value={dataInicio}
                onChangeText={(txt) => setDataInicio(aplicarMascaraData(txt))}
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
                  dataConclusao.length === 10 && styles.inputPreenchido,
                ]}
                placeholder="/  /"
                placeholderTextColor="#94A3B8"
                value={dataConclusao}
                onChangeText={(txt) =>
                  setDataConclusao(aplicarMascaraData(txt))
                }
                keyboardType="numeric"
                maxLength={10}
                onFocus={() =>
                  scrollViewRef.current?.scrollTo({ y: 200, animated: true })
                }
              />
            </View>
          </View>

          {/* Campo Descrição (opcional) */}
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
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          />

          {/* Botão Próximo passo */}
          <TouchableOpacity
            style={styles.botaoProximoPasso}
            onPress={handleCadastrarObra}
            disabled={salvando || feedback.visible}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              locations={gradianteDistribuicaoDownload}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradienteBotao}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.textoBotaoProximoPasso}>
                  Cadastrar obra
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal de Validação / Erro (Figma tela 3) */}
        <Modal
          visible={modalErroVisivel}
          transparent
          animationType="fade"
          onRequestClose={() => setModalErroVisivel(false)}
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
                onPress={() => setModalErroVisivel(false)}
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
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
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
    backgroundColor: "#FFFFFF",
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
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 20,
  },
  textoCardInfo: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.rotulo,
    lineHeight: 18,
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
    height: 100,
    backgroundColor: cores.fundoInput,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#BCE3DE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
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
    width: 90,
    height: 100,
    backgroundColor: cores.azulPetroleo,
    borderRadius: 16,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputPreenchido: {
    backgroundColor: "#EBFBF8",
    borderColor: cores.verdeAgua,
    color: cores.azulPetroleo,
    fontFamily: fontes.media,
  },
  linhaDatas: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colunaData: {
    width: "48%",
  },
  inputDescricao: {
    height: undefined,
    minHeight: moderateScale(96),
    maxHeight: moderateScale(220),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(12),
    lineHeight: moderateScale(20),
    textAlignVertical: "top",
    marginBottom: 26,
  },
  botaoProximoPasso: {
    width: "100%",
    height: 52,
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 6,
  },
  gradienteBotao: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoProximoPasso: {
    fontFamily: fontes.semiNegrito,
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(12),
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: cores.fundoCard,
    borderRadius: moderateScale(16),
    paddingTop: moderateScale(46),
    paddingBottom: moderateScale(28),
    paddingHorizontal: moderateScale(22),
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
    height: moderateScale(14),
    backgroundColor: cores.verdeClaro,
  },
  modalIconeContainer: {
    marginBottom: moderateScale(10),
  },
  modalTitulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.4),
    color: cores.titulo,
    marginBottom: moderateScale(8),
  },
  modalMensagem: {
    fontFamily: fontes.media,
    fontSize: rem(0.9),
    color: cores.rotulo,
    textAlign: "center",
    lineHeight: rem(1.25),
  },
  modalMensagemDestaque: {
    fontFamily: fontes.bold,
    fontSize: rem(0.9),
    color: cores.rotulo,
    textAlign: "center",
    lineHeight: rem(1.25),
    marginBottom: moderateScale(22),
  },
  modalBotao: {
    width: "100%",
    height: moderateScale(50),
    backgroundColor: cores.azulPetroleo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotao: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(1),
    color: "#FFFFFF",
  },
});
