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
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AlertTriangleGradient from "../components/AlertTriangleGradient";

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
import api, { obterObra, atualizarObra } from "../services/api";

export default function EditarObra({ navigation, route }) {
  const scrollViewRef = useRef(null);
  const keyboardPadding = useKeyboardPadding(moderateScale(36), moderateScale(24));
  const obraId = route?.params?.obraId || route?.params?.id;

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);

  const [imagemCapa, setImagemCapa] = useState(null);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [descricao, setDescricao] = useState("");

  const [modalSucessoVisivel, setModalSucessoVisivel] = useState(false);
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

  const validarDataValida = (valor, obrigatorio = false) => {
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

  const formatarDataParaExibicao = (valor) => {
    if (!valor) return "";
    const str = String(valor);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const dataApenas = str.split("T")[0];
      const [ano, mes, dia] = dataApenas.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    return aplicarMascaraData(str);
  };

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

      setNome(obra.nome || "");
      setEndereco(obra.endereco || "");
      setDataInicio(formatarDataParaExibicao(obra.data_inicio));
      setDataConclusao(formatarDataParaExibicao(obra.data_conclusao));
      setDescricao(obra.descricao || "");
      setImagemCapa(null);
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

  // Alterna para imagem padrão ou limpa caso já esteja selecionada
  const handleSelecionarImagemPadrao = () => {
    if (imagemCapa) {
      setImagemCapa(null);
    } else {
      setImagemCapa(require("../utils/img/obra1.jpg"));
    }
  };

  const handleFecharSucesso = () => {
    setModalSucessoVisivel(false);
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.("AcompanhamentoObra", { obraId });
    }
  };

  const handleSalvarAlteracoes = async () => {
    // Validação dos campos obrigatórios
    const nomeValido = nome.trim().length > 0;
    const enderecoValido = endereco.trim().length > 0;
    const dataInicioValida = validarDataValida(dataInicio, false);
    const dataConclusaoValida = validarDataValida(dataConclusao, false);

    if (
      !nomeValido ||
      !enderecoValido ||
      !dataInicioValida ||
      !dataConclusaoValida
    ) {
      if (!dataInicioValida || !dataConclusaoValida) {
        setMensagemErroModal(
          "As datas devem estar no formato DD/MM/AAAA com mês válido (01 a 12).",
        );
      } else {
        setMensagemErroModal("Preencha todos os campos obrigatórios.");
      }
      setModalErroVisivel(true);
      return;
    }

    try {
      setSalvando(true);

      await atualizarObra(obraId, {
        nome: nome.trim(),
        endereco: endereco.trim(),
        data_inicio: dataInicio.trim() || null,
        data_conclusao: dataConclusao.trim() || null,
        descricao: descricao.trim() || null,
      });

      setModalSucessoVisivel(true);
    } catch (error) {
      console.error(
        "Erro ao atualizar obra:",
        error.dados || error.message || error,
      );
      setMensagemErroModal(
        error.dados?.erro ||
          error.dados?.mensagem ||
          error.message ||
          "Erro ao salvar as alterações. Tente novamente.",
      );
      setModalErroVisivel(true);
    } finally {
      setSalvando(false);
    }
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
          <Text style={styles.tituloHeader}>Editar Dados</Text>
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
              Atualize as informações da obra abaixo.
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
              onPress={handleSelecionarImagemPadrao}
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
            onFocus={() => scrollViewRef.current?.scrollTo({ y: 50, animated: true })}
          />

          {/* Campo *Endereço */}
          <Text style={styles.rotulo}>*Endereço:</Text>
          <TextInput
            style={[styles.input, endereco.trim() && styles.inputPreenchido]}
            placeholder="Ex: Rua Miguelina Martins, 2328, Centro..."
            placeholderTextColor="#94A3B8"
            value={endereco}
            onChangeText={setEndereco}
            onFocus={() => scrollViewRef.current?.scrollTo({ y: 120, animated: true })}
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
                onFocus={() => scrollViewRef.current?.scrollTo({ y: 200, animated: true })}
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
                onFocus={() => scrollViewRef.current?.scrollTo({ y: 200, animated: true })}
              />
            </View>
          </View>

          {/* Campo Descrição (opcional) */}
          <Text style={styles.rotulo}>Descrição:</Text>
          <TextInput
            style={[styles.input, styles.inputDescricao]}
            placeholder="Observações adicionais sobre a obra..."
            placeholderTextColor="#94A3B8"
            value={descricao}
            onChangeText={setDescricao}
            multiline
            numberOfLines={3}
            onFocus={() => scrollViewRef.current?.scrollTo({ y: 320, animated: true })}
          />

          {/* Botão Salvar Alterações */}
          <TouchableOpacity
            style={styles.botaoProximoPasso}
            onPress={handleSalvarAlteracoes}
            disabled={salvando}
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
                  Salvar Alterações
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal de Validação / Erro */}
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

        {/* Modal de Confirmação de Sucesso */}
        <Modal
          visible={modalSucessoVisivel}
          transparent
          animationType="fade"
          onRequestClose={handleFecharSucesso}
        >
          <View style={styles.modalFundo}>
            <View style={styles.modalCard}>
              <View
                style={[
                  styles.modalAccentBar,
                  { backgroundColor: cores.verdeAgua },
                ]}
              />

              <View style={styles.modalIconeContainer}>
                <Feather
                  name="check-circle"
                  size={moderateScale(48)}
                  color={cores.verdeAgua}
                />
              </View>

              <Text style={styles.modalTitulo}>Sucesso!</Text>

              <Text style={styles.modalMensagem}>
                As informações da obra foram atualizadas com sucesso.
              </Text>

              <TouchableOpacity
                style={[
                  styles.modalBotao,
                  {
                    backgroundColor: cores.azulPetroleo,
                    marginTop: moderateScale(20),
                  },
                ]}
                onPress={handleFecharSucesso}
                activeOpacity={0.85}
              >
                <Text style={styles.modalTextoBotao}>Concluído</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    height: 80,
    paddingTop: 12,
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
