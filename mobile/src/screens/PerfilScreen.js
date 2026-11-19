import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronLeft,
  SquarePen,
  Camera,
  Image as ImageIcon,
  Eye,
  EyeOff,
  WifiOff,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import * as ImageManipulator from "expo-image-manipulator";

import { useAuth } from "../context/AuthContext";
import ModalConfirmarSenhaPerfil from "../components/ModalConfirmarSenhaPerfil";
import ModalSucessoPerfil from "../components/ModalSucessoPerfil";
import ModalAviso from "../components/ModalAviso";
import { ESTILOS_COMPARTILHADOS_MODAL } from "../components/ModalFeedback";
import {
  cores,
  fontes,
  shadows,
  rem,
  moderateScale,
} from "../styles/theme";

const AVATAR_PADRAO = require("../utils/img/avatar.png");

export default function PerfilScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { usuario, atualizarDadosUsuario } = useAuth();

  const [modoEdicao, setModoEdicao] = useState(false);
  const [nome, setNome] = useState(usuario?.nome || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [fotoSelecionadaUri, setFotoSelecionadaUri] = useState(null);

  const [online, setOnline] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalFotoVisivel, setModalFotoVisivel] = useState(false);
  const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
  const [erroModalSenha, setErroModalSenha] = useState("");
  const [modalSucesso, setModalSucesso] = useState({
    visivel: false,
    titulo: "Sucesso",
    mensagem: "",
  });
  const [modalAviso, setModalAviso] = useState(null);

  const abrirModalAviso = (titulo, mensagem) => {
    setModalAviso({ titulo, mensagem });
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    NetInfo.fetch().then((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!modoEdicao && usuario) {
      setNome(usuario.nome || "");
      setEmail(usuario.email || "");
      setNovaSenha("");
      setFotoSelecionadaUri(null);
    }
  }, [usuario, modoEdicao]);

  const avatarSource = fotoSelecionadaUri
    ? { uri: fotoSelecionadaUri }
    : usuario?.foto_local
    ? { uri: usuario.foto_local }
    : usuario?.foto_url
    ? { uri: usuario.foto_url }
    : AVATAR_PADRAO;

  const primeiroNome = (nome || usuario?.nome || "Usuário").trim().split(" ")[0];

  const abrirModalSucesso = (titulo, mensagem) => {
    setModalSucesso({
      visivel: true,
      titulo,
      mensagem,
    });
  };

  const processarImagemEscolhida = async (uri) => {
    try {
      const manipulada = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (modoEdicao) {
        setFotoSelecionadaUri(manipulada.uri);
        return;
      }

      setFotoSelecionadaUri(manipulada.uri);
      setSalvando(true);

      const resultado = await atualizarDadosUsuario({
        nome: (usuario?.nome || nome || "").trim(),
        email: (usuario?.email || "").trim().toLowerCase(),
        fotoLocalUri: manipulada.uri,
      });

      setFotoSelecionadaUri(null);

      if (resultado?.sincronizado) {
        abrirModalSucesso("Sucesso", "Foto de perfil atualizada com sucesso!");
      } else {
        abrirModalSucesso(
          "Salvo offline",
          "Foto salva no dispositivo e enfileirada para sincronização assim que houver internet."
        );
      }
    } catch (error) {
      abrirModalAviso("Erro", error.message || "Não foi possível atualizar a foto de perfil.");
    } finally {
      setSalvando(false);
    }
  };

  const selecionarFoto = async (origem) => {
    setModalFotoVisivel(false);
    try {
      let ImagePicker = null;
      try {
        ImagePicker = require("expo-image-picker");
      } catch {}

      if (ImagePicker) {
        if (origem === "camera") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            abrirModalAviso("Permissão necessária", "Autorize o acesso à câmera para tirar uma foto.");
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            await processarImagemEscolhida(res.assets[0].uri);
          }
          return;
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            abrirModalAviso("Permissão necessária", "Autorize o acesso à galeria para escolher uma foto.");
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            await processarImagemEscolhida(res.assets[0].uri);
          }
          return;
        }
      }

      const DocumentPicker = require("expo-document-picker");
      const doc = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (!doc.canceled && doc.assets?.[0]?.uri) {
        await processarImagemEscolhida(doc.assets[0].uri);
      }
    } catch {
      abrirModalAviso("Erro", "Não foi possível selecionar a imagem.");
    }
  };

  const iniciarEdicao = () => {
    setModoEdicao(true);
  };

  const validarCamposAntesDeSalvar = () => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo) {
      abrirModalAviso("Campo obrigatório", "O nome não pode ficar em branco.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpo)) {
      abrirModalAviso("E-mail inválido", "Informe um endereço de e-mail válido.");
      return false;
    }

    if (novaSenha && novaSenha.length < 8) {
      abrirModalAviso("Senha inválida", "A nova senha deve conter no mínimo 8 caracteres.");
      return false;
    }

    const alterouEmail = emailLimpo !== (usuario?.email || "").trim().toLowerCase();
    const alterouSenha = Boolean(novaSenha && novaSenha.length > 0);

    if ((alterouEmail || alterouSenha) && !online) {
      abrirModalAviso(
        "Sem conexão",
        "Você está offline. Conecte-se à internet para alterar e-mail ou senha."
      );
      return false;
    }

    return true;
  };

  const executarSalvamento = async (senhaAtual = undefined) => {
    try {
      setSalvando(true);
      setErroModalSenha("");

      const resultado = await atualizarDadosUsuario({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        novaSenha: novaSenha || undefined,
        senhaAtual,
        fotoLocalUri: fotoSelecionadaUri || undefined,
      });

      setModalSenhaVisivel(false);
      setModoEdicao(false);
      setNovaSenha("");
      setFotoSelecionadaUri(null);

      if (resultado?.sincronizado) {
        abrirModalSucesso("Sucesso", "Suas informações foram atualizadas!");
      } else {
        abrirModalSucesso(
          "Salvo offline",
          "Alterações salvas no dispositivo e enfileiradas para sincronização assim que houver internet."
        );
      }
    } catch (error) {
      if (modalSenhaVisivel) {
        setErroModalSenha(error.message || "Não foi possível confirmar a alteração.");
      } else {
        abrirModalAviso("Erro", error.message || "Não foi possível atualizar o perfil.");
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleBotaoPrincipal = () => {
    if (!modoEdicao) {
      iniciarEdicao();
      return;
    }

    if (!validarCamposAntesDeSalvar()) return;

    const emailLimpo = email.trim().toLowerCase();
    const alterouEmail = emailLimpo !== (usuario?.email || "").trim().toLowerCase();
    const alterouSenha = Boolean(novaSenha && novaSenha.length > 0);

    if (alterouEmail || alterouSenha) {
      setErroModalSenha("");
      setModalSenhaVisivel(true);
    } else {
      executarSalvamento();
    }
  };

  return (
    <LinearGradient
      colors={[cores.azulPetroleo, cores.azulEsverdeado, cores.ciano]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradiente}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, moderateScale(20)) + moderateScale(12) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation?.goBack?.()}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft color="#FFFFFF" size={moderateScale(28)} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.headerTitulo}>Perfil</Text>
          </View>

          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setModalFotoVisivel(true)}
              activeOpacity={0.85}
            >
              <Image source={avatarSource} style={styles.avatarImagem} />
              <View style={styles.avatarEditBadge}>
                <SquarePen color="#FFFFFF" size={moderateScale(18)} strokeWidth={2.3} />
              </View>
            </TouchableOpacity>

            <Text style={styles.nomeDestaque} numberOfLines={1}>
              {primeiroNome}
            </Text>
          </View>

          <View style={styles.card}>
            {!online && (
              <View style={styles.offlineBanner}>
                <WifiOff size={moderateScale(15)} color={cores.azulPetroleo} />
                <Text style={styles.offlineBannerTexto}>
                  Modo offline: você pode editar nome e foto. E-mail e senha exigem internet.
                </Text>
              </View>
            )}

            <View style={styles.campoGrupo}>
              <Text style={styles.label}>Nome:</Text>
              <TextInput
                style={[styles.input, modoEdicao && styles.inputEditavel]}
                value={nome}
                onChangeText={setNome}
                editable={modoEdicao && !salvando}
                placeholder="Seu nome completo"
                placeholderTextColor={cores.textoSecundario}
              />
            </View>

            <View style={styles.campoGrupo}>
              <Text style={styles.label}>E-mail:</Text>
              <TextInput
                style={[
                  styles.input,
                  modoEdicao && online && styles.inputEditavel,
                  modoEdicao && !online && styles.inputBloqueadoOffline,
                ]}
                value={email}
                onChangeText={setEmail}
                editable={modoEdicao && online && !salvando}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="seuemail@exemplo.com"
                placeholderTextColor={cores.textoSecundario}
              />
            </View>

            <View style={styles.campoGrupo}>
              <Text style={styles.label}>Senha:</Text>
              <View
                style={[
                  styles.senhaInputContainer,
                  modoEdicao && online && styles.inputEditavel,
                  modoEdicao && !online && styles.inputBloqueadoOffline,
                ]}
              >
                <TextInput
                  style={styles.senhaInput}
                  value={modoEdicao ? novaSenha : "••••••••"}
                  onChangeText={setNovaSenha}
                  editable={modoEdicao && online && !salvando}
                  secureTextEntry={modoEdicao ? !mostrarSenha : true}
                  placeholder={
                    modoEdicao
                      ? online
                        ? "Nova senha (mín. 8 caracteres)"
                        : "Indisponível offline"
                      : "••••••••"
                  }
                  placeholderTextColor={cores.textoSecundario}
                />
                {modoEdicao && online && (
                  <TouchableOpacity
                    onPress={() => setMostrarSenha((prev) => !prev)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {mostrarSenha ? (
                      <EyeOff size={moderateScale(19)} color={cores.azulPetroleo} />
                    ) : (
                      <Eye size={moderateScale(19)} color={cores.azulPetroleo} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.botaoPrincipalWrapper}
              onPress={handleBotaoPrincipal}
              disabled={salvando}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.botaoPrincipal}
              >
                {salvando && !modalSenhaVisivel ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.botaoPrincipalTexto}>
                      {modoEdicao ? "Salvar alterações" : "Alterar informações"}
                    </Text>
                    <SquarePen color="#FFFFFF" size={moderateScale(18)} strokeWidth={2.2} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {modoEdicao && (
              <TouchableOpacity
                style={styles.botaoCancelarEdicao}
                onPress={() => setModoEdicao(false)}
                disabled={salvando}
                activeOpacity={0.75}
              >
                <Text style={styles.botaoCancelarEdicaoTexto}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalFotoVisivel}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalFotoVisivel(false)}
      >
        <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalFotoVisivel(false)}
          />
          <View style={ESTILOS_COMPARTILHADOS_MODAL.card}>
            <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />
            <View style={styles.modalFotoConteudo}>
              <View style={styles.modalFotoHeader}>
                <Text style={styles.modalFotoTitulo}>Alterar foto de perfil</Text>
                <TouchableOpacity onPress={() => setModalFotoVisivel(false)}>
                  <X size={moderateScale(20)} color="#1E3A5F" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.modalFotoOpcao, { marginBottom: moderateScale(12) }]}
                onPress={() => selecionarFoto("camera")}
                activeOpacity={0.8}
              >
                <View style={styles.modalFotoIcone}>
                  <Camera size={moderateScale(20)} color={cores.azulPetroleo} />
                </View>
                <Text style={styles.modalFotoOpcaoTexto}>Tirar foto com a câmera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalFotoOpcao}
                onPress={() => selecionarFoto("galeria")}
                activeOpacity={0.8}
              >
                <View style={styles.modalFotoIcone}>
                  <ImageIcon size={moderateScale(20)} color={cores.azulPetroleo} />
                </View>
                <Text style={styles.modalFotoOpcaoTexto}>Escolher da galeria</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ModalConfirmarSenhaPerfil
        visivel={modalSenhaVisivel}
        carregando={salvando}
        erroExterno={erroModalSenha}
        onConfirmar={(senhaAtual) => executarSalvamento(senhaAtual)}
        onCancelar={() => {
          if (!salvando) setModalSenhaVisivel(false);
        }}
      />

      <ModalSucessoPerfil
        visivel={modalSucesso.visivel}
        titulo={modalSucesso.titulo}
        mensagem={modalSucesso.mensagem}
        onFechar={() =>
          setModalSucesso((prev) => ({ ...prev, visivel: false }))
        }
      />

      <ModalAviso
        visible={Boolean(modalAviso)}
        titulo={modalAviso?.titulo}
        mensagem={modalAviso?.mensagem}
        onFechar={() => setModalAviso(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradiente: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: moderateScale(22),
    paddingBottom: moderateScale(36),
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: moderateScale(20),
  },
  backButton: {
    marginRight: moderateScale(8),
    marginLeft: -moderateScale(4),
  },
  headerTitulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.35),
    color: "#FFFFFF",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: moderateScale(22),
  },
  avatarContainer: {
    position: "relative",
    width: moderateScale(116),
    height: moderateScale(116),
    marginBottom: moderateScale(10),
  },
  avatarImagem: {
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(58),
    backgroundColor: "#F6D5D5",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: moderateScale(2),
    right: moderateScale(2),
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    backgroundColor: "rgba(13, 101, 121, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  nomeDestaque: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.35),
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: cores.fundoCard,
    borderRadius: moderateScale(28),
    paddingHorizontal: moderateScale(22),
    paddingVertical: moderateScale(26),
    ...shadows.padrao,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    backgroundColor: cores.fundoBanner,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    marginBottom: moderateScale(16),
  },
  offlineBannerTexto: {
    flex: 1,
    fontFamily: fontes.media,
    fontSize: rem(0.75),
    color: cores.azulPetroleo,
    lineHeight: moderateScale(16),
  },
  campoGrupo: {
    marginBottom: moderateScale(16),
  },
  label: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.88),
    color: cores.titulo,
    marginBottom: moderateScale(6),
  },
  input: {
    height: moderateScale(46),
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.88),
    color: cores.rotulo,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputEditavel: {
    backgroundColor: "#E4F6F1",
    borderColor: cores.verdeAgua,
  },
  inputBloqueadoOffline: {
    opacity: 0.65,
  },
  senhaInputContainer: {
    height: moderateScale(46),
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  senhaInput: {
    flex: 1,
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.88),
    color: cores.rotulo,
    paddingVertical: 0,
    marginRight: moderateScale(8),
  },
  botaoPrincipalWrapper: {
    marginTop: moderateScale(10),
  },
  botaoPrincipal: {
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
  },
  botaoPrincipalTexto: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.95),
    color: "#FFFFFF",
  },
  botaoCancelarEdicao: {
    marginTop: moderateScale(10),
    height: moderateScale(40),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  botaoCancelarEdicaoTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.85),
    color: cores.textoSecundario,
  },
  modalFotoConteudo: {
    paddingVertical: moderateScale(22),
    paddingHorizontal: moderateScale(20),
  },
  modalFotoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: moderateScale(18),
  },
  modalFotoTitulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(18),
    color: "#1E3A5F",
  },
  modalFotoOpcao: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(12),
    backgroundColor: "#FFFFFF",
    gap: moderateScale(12),
  },
  modalFotoIcone: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
    backgroundColor: cores.fundoBanner,
    justifyContent: "center",
    alignItems: "center",
  },
  modalFotoOpcaoTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.88),
    color: cores.titulo,
  },
});