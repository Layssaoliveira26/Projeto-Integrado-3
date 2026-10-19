import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, Camera } from "lucide-react-native";
import theme from "../styles/theme";
import SucessoModal from "../components/SucessoModal";

export default function CapturaFotoScreen({ route, navigation }) {
  const { servicoId, cicloId, obraId, etapaId } = route.params || {};

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedDate, setCapturedDate] = useState("");
  const [capturedTime, setCapturedTime] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);

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
        <ActivityIndicator size="large" color="#00E5BC" />
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
          quality: 0.85,
          base64: false,
        });

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
        setCapturedPhoto(photo.uri);
      } catch (err) {
        console.error(err);
      } finally {
        setCarregandoFoto(false);
      }
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDate("");
    setCapturedTime("");
  };

  const handleConfirmar = async () => {
    if (!capturedPhoto) return;
    setEnviando(true);
    
    try {
      const fileName = `foto_servico_${servicoId}_ciclo_${cicloId}_${Date.now()}.jpg`;
      const destPath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.moveAsync({
        from: capturedPhoto,
        to: destPath,
      });

      const fotoData = {
        id: Date.now().toString(),
        uri: destPath,
        servicoId: servicoId,
        cicloId: cicloId,
        obraId: obraId,
        etapaId: etapaId,
        localizacao: locationText,
        data: capturedDate,
        hora: capturedTime,
      };

      const fotosExistentes = await AsyncStorage.getItem(`@fotos_servico_${servicoId}_ciclo_${cicloId}`);
      const fotosArray = fotosExistentes ? JSON.parse(fotosExistentes) : [];
      fotosArray.push(fotoData);
      await AsyncStorage.setItem(`@fotos_servico_${servicoId}_ciclo_${cicloId}`, JSON.stringify(fotosArray));
      
      setModalVisivel(true);

    } catch (error) {
      console.error(error);
    } finally {
      setEnviando(false);
    }
  };

  const fecharModalEVoltar = () => {
    setModalVisivel(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F4EF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft color="#172B4D" size={28} />
          <Text style={styles.headerTitle}>Capturar foto</Text>
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
                    {locationText || "NomeLocalização"}
                  </Text>
                </View>
                <View style={styles.overlayRight}>
                  <Text style={styles.overlayDate}>{capturedDate || "10/02/2026"}</Text>
                  <Text style={styles.overlayTime}>{capturedTime || "11:52 AM"}</Text>
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
          >
            {carregandoFoto ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Camera color="#FFFFFF" size={28} />
            )}
          </TouchableOpacity>
        </View>

        {capturedPhoto && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRetake}
              activeOpacity={0.8}
              disabled={enviando}
            >
              <Text style={styles.primaryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirmar}
              activeOpacity={0.8}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Registrar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <SucessoModal 
        visible={modalVisivel} 
        onClose={fecharModalEVoltar} 
        mensagem="A foto foi registada e guardada no dispositivo."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.cores?.fundoTela || "#F5F4EF",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme?.cores?.fundoTela || "#F5F4EF",
    padding: 24,
  },
  permissaoTexto: {
    color: "#172B4D",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 20,
  },
  botaoPermissao: {
    backgroundColor: "#00E5BC",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  botaoPermissaoTexto: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#172B4D",
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  cameraCard: {
    width: "100%",
    height: 460,
    borderRadius: 20,
    position: "relative",
    backgroundColor: "#000000",
    marginBottom: 40,
  },
  cameraCardCaptured: {
    borderWidth: 2,
    borderColor: "#00E5BC",
  },
  fullCamera: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
  },
  photoWrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  gridContainer: {
    flex: 1,
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
    borderColor: "rgba(0, 229, 188, 0.5)",
  },
  gridBorderTopBottom: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0, 229, 188, 0.5)",
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
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  overlayLeft: {
    flex: 1,
    paddingRight: 12,
  },
  overlayRight: {
    alignItems: "flex-end",
  },
  overlayLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayDate: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayTime: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  floatingCameraButton: {
    position: "absolute",
    bottom: -28,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00E5BC",
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
    marginTop: 10,
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: "#00E5BC",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});