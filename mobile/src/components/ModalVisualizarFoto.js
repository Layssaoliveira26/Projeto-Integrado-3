import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { X, Calendar, MapPin } from "lucide-react-native";
import theme, { moderateScale, rem } from "../styles/theme";

function formatarDataHora(dataString) {
  if (!dataString) return "";
  try {
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return dataString;
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return dataString;
  }
}

export default function ModalVisualizarFoto({
  foto,
  onFechar,
  mapServicos = {},
  nomeObra = "Acompanhamento da obra",
}) {
  if (!foto) return null;

  const servicoInfo = mapServicos[foto?.servico_id];
  const uriFoto = foto.caminho_local || foto.caminho_comprimido;

  return (
    <Modal
      visible={Boolean(foto)}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <View style={styles.modalFotoFundo}>
        <View style={styles.modalFotoCard}>
          <View style={styles.modalFotoHeader}>
            <View style={{ flex: 1, marginRight: moderateScale(10) }}>
              <Text style={styles.modalFotoTitulo} numberOfLines={2}>
                {servicoInfo?.nome || "Fotografia do Serviço"}
              </Text>
              <Text style={styles.modalFotoSubtitulo} numberOfLines={1}>
                {servicoInfo?.etapaNome || nomeObra}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalFotoFecharBtn}
              onPress={onFechar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalFotoImagemContainer}>
            <Image
              source={{ uri: uriFoto }}
              style={styles.modalFotoImagem}
              resizeMode="contain"
            />
          </View>

          <View style={styles.modalFotoFooter}>
            <View style={styles.modalFotoLinhaInfo}>
              <Calendar size={13} color="#CBD5E1" />
              <Text style={styles.modalFotoTextoInfo}>
                Capturada em:{" "}
                {formatarDataHora(foto.data_hora_captura || foto.created_at)}
              </Text>
            </View>

            {Boolean(foto.possui_localizacao && foto.latitude) && (
              <View style={styles.modalFotoLinhaInfo}>
                <MapPin size={13} color="#00E5BC" />
                <Text style={[styles.modalFotoTextoInfo, { color: "#00E5BC" }]}>
                  Lat: {Number(foto.latitude).toFixed(6)} | Lon:{" "}
                  {Number(foto.longitude).toFixed(6)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFotoFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
  },
  modalFotoCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0F172A",
    borderRadius: moderateScale(20),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalFotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalFotoTitulo: {
    color: "#FFFFFF",
    fontSize: rem(0.95),
    fontFamily: theme.fontes.negrito,
  },
  modalFotoSubtitulo: {
    color: "#94A3B8",
    fontSize: rem(0.75),
    fontFamily: theme.fontes.regular,
    marginTop: moderateScale(2),
  },
  modalFotoFecharBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalFotoImagemContainer: {
    width: "100%",
    height: moderateScale(320),
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  modalFotoImagem: {
    width: "100%",
    height: "100%",
  },
  modalFotoFooter: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: "#0F172A",
    gap: moderateScale(6),
  },
  modalFotoLinhaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
  },
  modalFotoTextoInfo: {
    color: "#94A3B8",
    fontSize: rem(0.7),
    fontFamily: theme.fontes.regular,
  },
});
