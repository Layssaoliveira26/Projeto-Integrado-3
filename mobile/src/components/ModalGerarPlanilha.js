import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cores, moderateScale } from "../styles/theme";

/**
 * Estados do modal:
 * - "gerando": carregando dados e gerando planilha
 * - "gerada": sucesso na geração; exibe botões "Baixar arquivo" e "Ver planilha"
 * - "baixando": realizando o download do arquivo .xlsx
 * - "concluido": download concluído com sucesso
 * - "erro": exibição de mensagem de falha
 */
export default function ModalGerarPlanilha({
  visivel,
  estado = "gerando", // "gerando" | "gerada" | "baixando" | "concluido" | "erro"
  mensagemErro = "",
  onBaixarArquivo = () => {},
  onVerPlanilha = () => {},
  onFechar = () => {},
}) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* ESTADO 1: GERANDO */}
          {estado === "gerando" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeContainerNeutro}>
                <ActivityIndicator size="large" color={cores.azulPetroleo} />
              </View>
              <Text style={styles.titulo}>Gerando planilha</Text>
              <Text style={styles.subtitulo}>
                Construindo estrutura da planilha final de medições.
              </Text>
            </View>
          )}

          {/* ESTADO 2: PLANILHA FINAL GERADA */}
          {estado === "gerada" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeContainerSucesso}>
                <Ionicons name="checkmark" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.titulo}>Planilha final gerada</Text>
              <Text style={styles.subtitulo}>
                Sua planilha final de medições foi gerada com sucesso!
              </Text>

              <View style={styles.botoesContainer}>
                <TouchableOpacity
                  style={styles.botaoPrimario}
                  onPress={onBaixarArquivo}
                  activeOpacity={0.8}
                  accessibilityLabel="Baixar arquivo da planilha final"
                >
                  <Text style={styles.textoBotaoPrimario}>Baixar arquivo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botaoSecundario}
                  onPress={onVerPlanilha}
                  activeOpacity={0.7}
                  accessibilityLabel="Ver planilha final gerada"
                >
                  <Text style={styles.textoBotaoSecundario}>Ver planilha</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ESTADO 3: BAIXANDO */}
          {estado === "baixando" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeContainerNeutro}>
                <ActivityIndicator size="large" color={cores.azulPetroleo} />
              </View>
              <Text style={styles.titulo}>Baixando</Text>
              <Text style={styles.subtitulo}>
                Baixando arquivo da planilha final de medições.
              </Text>
            </View>
          )}

          {/* ESTADO 4: DOWNLOAD CONCLUÍDO */}
          {estado === "concluido" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeContainerSucesso}>
                <Ionicons name="checkmark" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.titulo}>Download concluído</Text>
              <Text style={styles.subtitulo}>
                Arquivo baixado com sucesso.
              </Text>

              <View style={styles.botoesContainer}>
                <TouchableOpacity
                  style={styles.botaoPrimario}
                  onPress={onFechar}
                  activeOpacity={0.8}
                  accessibilityLabel="Fechar modal de download"
                >
                  <Text style={styles.textoBotaoPrimario}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ESTADO 5: ERRO */}
          {estado === "erro" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeContainerErro}>
                <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
              </View>
              <Text style={styles.titulo}>Erro ao gerar planilha</Text>
              <Text style={styles.subtitulo}>
                {mensagemErro || "Não foi possível gerar a planilha final de medição."}
              </Text>

              <View style={styles.botoesContainer}>
                <TouchableOpacity
                  style={styles.botaoPrimario}
                  onPress={onFechar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.textoBotaoPrimario}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");
const CARD_WIDTH = Math.min(width * 0.88, 360);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: moderateScale(28),
    paddingHorizontal: moderateScale(22),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  conteudo: {
    width: "100%",
    alignItems: "center",
  },
  iconeContainerNeutro: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
  },
  iconeContainerSucesso: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconeContainerErro: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
  },
  titulo: {
    fontSize: moderateScale(19),
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: moderateScale(8),
  },
  subtitulo: {
    fontSize: moderateScale(14),
    fontWeight: "400",
    color: "#64748B",
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(22),
    paddingHorizontal: 8,
  },
  botoesContainer: {
    width: "100%",
    gap: moderateScale(10),
  },
  botaoPrimario: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: cores.azulPetroleo || "#0D6579",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: cores.azulPetroleo || "#0D6579",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  textoBotaoPrimario: {
    color: "#FFFFFF",
    fontSize: moderateScale(15),
    fontWeight: "600",
  },
  botaoSecundario: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  textoBotaoSecundario: {
    color: "#334155",
    fontSize: moderateScale(15),
    fontWeight: "600",
  },
});
