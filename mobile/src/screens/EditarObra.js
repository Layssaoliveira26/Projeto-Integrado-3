import React, { useState, useEffect, useCallback } from "react";
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
} from "../styles/theme";
import api from "../services/api";

export default function EditarObra({ navigation, route }) {
  const obraId = route?.params?.obraId;

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);

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

  // Carrega os dados atuais da obra para preencher o formulário.
  // Não existe GET /obras/:id no backend hoje — tentamos essa rota primeiro
  // (caso seja adicionada futuramente) e, se falhar, caímos para listar
  // todas as obras do usuário e filtrar pelo id, igual ao fallback já
  // usado em AcompanhamentoObraScreen.js.
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
        const resposta = await api.get(`/obras/${obraId}`);
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
      // data_inicio/data_conclusao ainda não existem no backend — os campos
      // ficam vazios até esses dados serem persistidos e devolvidos pela API.
      setDataInicio(
        obra.data_inicio ? aplicarMascaraData(obra.data_inicio) : "",
      );
      setDataConclusao(
        obra.data_conclusao ? aplicarMascaraData(obra.data_conclusao) : "",
      );
      setDescricao(obra.descricao || "");
      // Não há coluna de imagem na tabela de obras hoje; mantemos vazio
      // até o backend suportar upload/armazenamento de capa.
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

  const handleSalvarAlteracoes = async () => {
    // Validação dos campos obrigatórios demarcados com *
    const nomeValido = nome.trim().length > 0;
    const enderecoValido = endereco.trim().length > 0;
    const dataInicioValida = dataInicio.trim().length === 10;
    const dataConclusaoValida = dataConclusao.trim().length === 10;

    if (
      !nomeValido ||
      !enderecoValido ||
      !dataInicioValida ||
      !dataConclusaoValida
    ) {
      setModalErroVisivel(true);
      return;
    }

    try {
      setSalvando(true);

      // O token de autenticação é injetado automaticamente pela instância
      // de api (interceptor em services/api.js) — nenhuma configuração
      // extra é necessária aqui para que a validação de dono da obra
      // (RN02) funcione no backend.
      await api.put(`/obras/${obraId}`, {
        nome: nome.trim(),
        endereco: endereco.trim(),
        data_inicio: dataInicio.trim(),
        data_conclusao: dataConclusao.trim(),
        descricao: descricao.trim(),
      });

      Alert.alert("Sucesso", "Obra atualizada com sucesso.", [
        {
          text: "OK",
          onPress: () => navigation?.goBack?.(),
        },
      ]);
    } catch (error) {
      console.error(
        "Erro ao atualizar obra:",
        error.response?.data || error.message,
      );
      Alert.alert(
        "Erro",
        error.response?.data?.erro ||
          error.message ||
          "Erro ao salvar as alterações. Tente novamente.",
      );
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              size={35}
              color={cores.titulo}
              strokeWidth={5}
            />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Editar Dados</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollConteudo}
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
                Algumas informações estão pendentes no formulário.
              </Text>
              <Text style={styles.modalMensagemDestaque}>
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
    paddingHorizontal: 24,
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
