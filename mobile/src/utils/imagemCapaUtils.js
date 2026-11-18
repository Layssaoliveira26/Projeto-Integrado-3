/**
 * Seleciona uma imagem na galeria do dispositivo, redimensiona para economia de armazenamento
 * e persiste localmente no diretório de documentos do app.
 */
export async function selecionarEPersistirImagemCapa() {
  let ImagePicker = null;
  try {
    ImagePicker = require("expo-image-picker");
  } catch {}

  let uriOriginal = null;

  if (ImagePicker) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      throw new Error(
        "Autorize o acesso à galeria para escolher uma imagem de capa."
      );
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (resultado.canceled || !resultado.assets?.[0]?.uri) {
      return { cancelado: true, uri: null };
    }

    uriOriginal = resultado.assets[0].uri;
  } else {
    let DocumentPicker = null;
    try {
      DocumentPicker = require("expo-document-picker");
    } catch {}

    if (!DocumentPicker) {
      throw new Error("Seletor de imagens indisponível neste dispositivo.");
    }

    const doc = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
    });

    if (doc.canceled || !doc.assets?.[0]?.uri) {
      return { cancelado: true, uri: null };
    }

    uriOriginal = doc.assets[0].uri;
  }
  let uriProcessada = uriOriginal;

  try {
    const ImageManipulator = require("expo-image-manipulator");
    if (ImageManipulator?.manipulateAsync) {
      const manipulada = await ImageManipulator.manipulateAsync(
        uriOriginal,
        [{ resize: { width: 1280 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (manipulada?.uri) {
        uriProcessada = manipulada.uri;
      }
    }
  } catch {}

  let fs = null;
  try {
    fs = require("expo-file-system/legacy");
  } catch {
    try {
      fs = require("expo-file-system");
    } catch {}
  }

  if (fs?.documentDirectory) {
    const dir = `${fs.documentDirectory}capas/`;
    await fs.makeDirectoryAsync(dir, { intermediates: true });
    const destino = `${dir}capa_obra_${Date.now()}.jpg`;
    await fs.copyAsync({ from: uriProcessada, to: destino });
    return { cancelado: false, uri: destino };
  }

  return { cancelado: false, uri: uriProcessada };
}

