import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { ChevronLeft, Camera } from "lucide-react-native";
import theme, { cores, fontes, rem, moderateScale } from "../styles/theme";
import FeedbackModal from "../components/FeedbackModal";
import { useAuth } from "../context/AuthContext";
import { salvarFotografia } from "../repositories/fotografiaRepository";

export default function CapturaFotoScreen({ route, navigation }) {
  const { servicoId, cicloId, obraId, etapaId, servicoNome } = route.params || {};
  const { usuario } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedDate, setCapturedDate] = useState("");
  const [capturedTime, setCapturedTime] = useState("");
  const [capturedDateTimeISO, setCapturedDateTimeISO] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState(null); // null | "loading" | "success"

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
      if (status === "granted") {
        obterLocalizacaoAtual();
      } else {
        setLocationText("Localização não permitida");
      }
    })();
  }, []);

  const obterLocalizacaoAtual = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const item = geocode[0];
        const rua = item.street || item.name || "";
        const cidade = item.subregion || item.city || "";
        setLocationText(rua ? `${rua}, ${cidade}` : cidade || "Localização obtida");
      } else {
        setLocationText(
          `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
        );
      }
    } catch (error) {
      setLocationText("Localização indisponível");
    }
  };

  if (!permission || locationPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={cores.verdeAgua} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.permissaoTexto}>
          Precisamos de acesso à câmera para registrar as fotos do serviço.
        </Text>
        <TouchableOpacity style={styles.botaoPermissao} onPress={requestPermission}>
          <Text style={styles.botaoPermissaoTexto}>Conceder Permissão</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tirarFoto = async () => {
    if (cameraRef.current) {
      setCarregandoFoto(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: false,
        });

        const manipulatedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        const agora = new Date();
        const dataFormatada = agora.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const horaFormatada = agora.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        setCapturedDate(dataFormatada);
        setCapturedTime(horaFormatada);
        setCapturedDateTimeISO(agora.toISOString());
        setCapturedPhoto(manipulatedImage.uri);
      } catch (err) {
        console.error("Erro ao tirar foto:", err);
        Alert.alert("Erro", "Não foi possível capturar a foto. Tente novamente.");
      } finally {
        setCarregandoFoto(false);
      }
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDate("");
    setCapturedTime("");
    setCapturedDateTimeISO("");
  };

  const handleConfirmar = async () => {
    if (!capturedPhoto) return;
    setEnviando(true);
    setFeedback("loading");

    try {
      const idFoto = Date.now().toString();
      const fileName = `foto_comprimida_${servicoId || "srv"}_${idFoto}.jpg`;
      const destPath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: capturedPhoto,
        to: destPath,
      });

      const dadosFotografia = {
        id: idFoto,
        obra_id: obraId,
        ciclo_id: cicloId,
        servico_id: servicoId,
        usuario_id: usuario?.id,
        caminho_local: destPath,
        caminho_comprimido: destPath,
        latitude: locationCoords?.latitude || null,
        longitude: locationCoords?.longitude || null,
        possui_localizacao: locationCoords ? 1 : 0,
        data_hora_captura: capturedDateTimeISO,
      };

      await salvarFotografia(dadosFotografia);
      setFeedback("success");
      setTimeout(() => {
        setFeedback(null);
        navigation.goBack();
      }, 1200);
    } catch (error) {
      setFeedback(null);
      console.error("Erro ao salvar fotografia:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto no dispositivo. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={cores.fundoTela} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft color={cores.azulEscuro} size={moderateScale(28)} />
          <View style={{ flex: 1, marginRight: moderateScale(16) }}>
            <Text style={styles.headerTitle}>Capturar foto</Text>
            {Boolean(servicoNome) && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {servicoNome}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.cameraCard, capturedPhoto && styles.cameraCardCaptured]}>
          {capturedPhoto ? (
            <View style={styles.photoWrapper}>
              <Image source={{ uri: capturedPhoto }} style={styles.fullImage} />
              <View style={styles.overlayContainer}>
                <View style={styles.overlayLeft}>
                  <Text style={styles.overlayLabel}>Geolocalização:</Text>
                  <Text style={styles.overlayValue} numberOfLines={1}>
                    {locationText || "Localização"}
                  </Text>
                </View>
                <View style={styles.overlayRight}>
                  <Text style={styles.overlayDate}>{capturedDate}</Text>
                  <Text style={styles.overlayTime}>{capturedTime}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.fullCamera}>
              <CameraView ref={cameraRef} style={styles.fullCamera} facing="back" />
              <View style={styles.gridOverlay}>
                <View style={styles.gridRow}>
                  <View style={styles.gridCell} />
                  <View style={[styles.gridCell, styles.gridBorderLeftRight]} />
                  <View style={styles.gridCell} />
                </View>
                <View style={[styles.gridRow, styles.gridBorderTopBottom]}>
                  <View style={styles.gridCell} />
                  <View style={[styles.gridCell, styles.gridBorderLeftRight]} />
                  <View style={styles.gridCell} />
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridCell} />
                  <View style={[styles.gridCell, styles.gridBorderLeftRight]} />
                  <View style={styles.gridCell} />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.floatingCameraButton}
            onPress={capturedPhoto ? undefined : tirarFoto}
            activeOpacity={capturedPhoto ? 1 : 0.8}
            disabled={carregandoFoto || !!capturedPhoto}
            accessibilityLabel="Capturar foto"
          >
            {carregandoFoto ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Camera color="#FFFFFF" size={moderateScale(28)} />
            )}
          </TouchableOpacity>
        </View>

        {capturedPhoto && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRetake}
              activeOpacity={0.8}
              disabled={enviando}
            >
              <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirmar}
              activeOpacity={0.8}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color={cores.azulEscuro} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Registrar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FeedbackModal
        visible={feedback !== null}
        variant={feedback ?? "loading"}
        title={feedback === "success" ? "Foto registrada" : "Processando foto"}
        message={
          feedback === "success"
            ? "A foto foi registrada e guardada no dispositivo."
            : "Salvando a fotografia no dispositivo..."
        }
        onRequestClose={() => setFeedback(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundoTela,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: cores.fundoTela,
    padding: moderateScale(24),
  },
  permissaoTexto: {
    color: cores.textoEtapaEscuro || "#172B4D",
    fontFamily: fontes.media,
    textAlign: "center",
    fontSize: rem(1),
    marginBottom: moderateScale(20),
  },
  botaoPermissao: {
    backgroundColor: cores.verdeAgua,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(12),
  },
  botaoPermissaoTexto: {
    color: cores.azulEscuro,
    fontSize: rem(0.9),
    fontFamily: fontes.negrito,
  },
  header: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
  headerTitle: {
    color: cores.azulEscuro,
    fontSize: rem(1.2),
    fontFamily: fontes.negrito,
  },
  headerSubtitle: {
    color: cores.textoSecundario,
    fontSize: rem(0.8),
    fontFamily: fontes.regular,
    marginTop: moderateScale(2),
  },
  content: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(20),
  },
  cameraCard: {
    width: "100%",
    height: moderateScale(420),
    borderRadius: moderateScale(20),
    position: "relative",
    backgroundColor: "#000000",
    marginBottom: moderateScale(36),
  },
  cameraCardCaptured: {
    borderWidth: 2,
    borderColor: cores.verdeAgua,
  },
  fullCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(20),
    overflow: "hidden",
  },
  photoWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: moderateScale(18),
    overflow: "hidden",
    position: "relative",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
  },
  gridBorderLeftRight: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0, 229, 188, 0.4)",
  },
  gridBorderTopBottom: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0, 229, 188, 0.4)",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayContainer: {
    position: "absolute",
    top: moderateScale(16),
    left: moderateScale(16),
    right: moderateScale(16),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  overlayLeft: {
    flex: 1,
    paddingRight: moderateScale(12),
  },
  overlayRight: {
    alignItems: "flex-end",
  },
  overlayLabel: {
    color: "#FFFFFF",
    fontSize: rem(0.8),
    fontFamily: fontes.semiNegrito,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayValue: {
    color: "#FFFFFF",
    fontSize: rem(0.8),
    fontFamily: fontes.semiNegrito,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayDate: {
    color: "#FFFFFF",
    fontSize: rem(0.8),
    fontFamily: fontes.semiNegrito,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayTime: {
    color: "#FFFFFF",
    fontSize: rem(0.8),
    fontFamily: fontes.semiNegrito,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  floatingCameraButton: {
    position: "absolute",
    bottom: moderateScale(-26),
    alignSelf: "center",
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    backgroundColor: cores.verdeAgua,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 10,
  },
  actionsContainer: {
    marginTop: moderateScale(10),
    gap: moderateScale(12),
  },
  primaryButton: {
    width: "100%",
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: cores.verdeAgua,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: cores.azulEscuro,
    fontSize: rem(0.95),
    fontFamily: fontes.negrito,
  },
  secondaryButton: {
    width: "100%",
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: cores.azulPetroleo,
    fontSize: rem(0.95),
    fontFamily: fontes.semiNegrito,
  },
});