import React, { useState } from "react";
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

import { cores, bordas, dimensoes, fontes } from "../styles/theme";
import { criarObra } from "../services/api";

export default function NovaObra({ navigation }) {
  const [imagemCapa, setImagemCapa] = useState(null);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [descricao, setDescricao] = useState("");

  const [modalErroVisivel, setModalErroVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Formatação automática simples para data no formato DD/MM/AAAA
  const aplicarMascaraData = (texto) => {
    const apenasNumeros = texto.replace(/\D/g, "").slice(0, 8);
    if (apenasNumeros.length <= 2) return apenasNumeros;
    if (apenasNumeros.length <= 4) {
      return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2)}`;
    }
    return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2, 4)}/${apenasNumeros.slice(4, 8)}`;
  };

  // Alterna para imagem padrão ou limpa caso já esteja selecionada
  const handleSelecionarImagemPadrao = () => {
    if (imagemCapa) {
      setImagemCapa(null);
    } else {
      setImagemCapa(require("../utils/img/obra1.jpg"));
    }
  };

  const handleProximoPasso = async () => {
    // Validação dos campos obrigatórios demarcados com *
    const nomeValido = nome.trim().length > 0;
    const enderecoValido = endereco.trim().length > 0;
    const dataInicioValida = dataInicio.trim().length === 10;
    const dataConclusaoValida = dataConclusao.trim().length === 10;

    if (!nomeValido || !enderecoValido || !dataInicioValida || !dataConclusaoValida) {
      setModalErroVisivel(true);
      return;
    }

    try {
      setSalvando(true);
      await criarObra({
        nome: nome.trim(),
        endereco: endereco.trim(),
        data_inicio: dataInicio.trim(),
        data_conclusao: dataConclusao.trim(),
        descricao: descricao.trim(),
      });

      if (navigation && navigation.goBack) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Erro ao cadastrar obra:", error);
      alert(error.message || "Erro ao salvar a obra. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation && navigation.goBack && navigation.goBack()}
            activeOpacity={0.7}
            accessibilityLabel="Voltar"
          >
            <Feather name="chevron-left" size={28} color={cores.titulo} />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Nova Obra</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollConteudo}
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
                  <Feather name="upload-cloud" size={32} color={cores.verdeAgua} />
                </View>
              </View>
            ) : (
              <Feather name="upload-cloud" size={36} color={cores.textoSecundario} />
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
        />

        {/* Campo *Endereço */}
        <Text style={styles.rotulo}>*Endereço:</Text>
        <TextInput
          style={[styles.input, endereco.trim() && styles.inputPreenchido]}
          placeholder="Ex: Rua Miguelina Martins, 2328, Centro..."
          placeholderTextColor="#94A3B8"
          value={endereco}
          onChangeText={setEndereco}
        />

        {/* Datas lado a lado */}
        <View style={styles.linhaDatas}>
          <View style={styles.colunaData}>
            <Text style={styles.rotulo}>*Data de início:</Text>
            <TextInput
              style={[styles.input, dataInicio.length === 10 && styles.inputPreenchido]}
              placeholder="/  /"
              placeholderTextColor="#94A3B8"
              value={dataInicio}
              onChangeText={(txt) => setDataInicio(aplicarMascaraData(txt))}
              keyboardType="numeric"
              maxLength={10}
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
              onChangeText={(txt) => setDataConclusao(aplicarMascaraData(txt))}
              keyboardType="numeric"
              maxLength={10}
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
        />

        {/* Botão Próximo passo */}
        <TouchableOpacity
          style={styles.botaoProximoPasso}
          onPress={handleProximoPasso}
          disabled={salvando}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[cores.ciano, cores.verdeAgua]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradienteBotao}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.textoBotaoProximoPasso}>Próximo passo</Text>
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
            <View style={styles.modalIconeContainer}>
              <Feather name="alert-triangle" size={44} color={cores.azulEsverdeado} />
            </View>

            <Text style={styles.modalTitulo}>Erro!</Text>

            <Text style={styles.modalMensagem}>
              Algumas informações estão pendentes no formulário.{"\n"}
              Preencha todos os campos obrigatórios.
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  botaoVoltar: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  tituloHeader: {
    fontFamily: fontes.negrito,
    fontSize: 20,
    color: cores.titulo,
  },
  scrollConteudo: {
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  cardInfo: {
    backgroundColor: "#DEF3F0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  textoCardInfo: {
    fontFamily: fontes.media,
    fontSize: 13,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
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
    fontSize: 13,
    color: cores.rotulo,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  modalBotao: {
    width: "100%",
    height: 48,
    backgroundColor: cores.azulPetroleo,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotao: {
    fontFamily: fontes.semiNegrito,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
