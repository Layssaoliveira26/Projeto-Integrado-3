import React, { useId } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Defs, LinearGradient, Stop } from "react-native-svg";
import { Check } from "lucide-react-native";
import {
  cores,
  fontes,
  gradienteCores,
  gradienteDistribuicaoCompleta,
  moderateScale,
} from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import AlertTriangleGradient from "./AlertTriangleGradient";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";

export default function ModalGerarPlanilha({
  visivel,
  estado = "gerando",
  mensagemErro = "",
  onBaixarArquivo = () => {},
  onVerPlanilha = () => {},
  onFechar = () => {},
}) {
  const gradienteId = `modalGerarPlanilha${useId().replace(/:/g, "")}`;

  if (!visivel) return null;

  const carregando = estado === "gerando" || estado === "baixando";
  const sucesso = estado === "gerada" || estado === "concluido";

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={carregando ? () => {} : onFechar}
      statusBarTranslucent
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        {!carregando && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onFechar}
            accessibilityLabel="Fechar"
          />
        )}
        <View
          style={[
            ESTILOS_COMPARTILHADOS_MODAL.card,
            styles.card,
            sucesso && styles.cardSucesso,
          ]}
        >
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

          {estado === "gerando" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeSpinner}>
                <ActivityIndicator size="large" color={cores.azulPetroleo} />
              </View>
              <Text style={styles.titulo}>Gerando planilha</Text>
              <Text style={styles.subtitulo}>
                Construindo estrutura da planilha final de medições.
              </Text>
            </View>
          )}

          {estado === "gerada" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeSucesso}>
                <Check
                  color={`url(#${gradienteId})`}
                  size={moderateScale(40)}
                  strokeWidth={2.8}
                >
                  <Defs>
                    <LinearGradient
                      id={gradienteId}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      {gradienteCores.map((cor, indice) => (
                        <Stop
                          key={`${cor}-${indice}`}
                          offset={`${gradienteDistribuicaoCompleta[indice] * 100}%`}
                          stopColor={cor}
                        />
                      ))}
                    </LinearGradient>
                  </Defs>
                </Check>
              </View>
              <Text style={styles.titulo}>Planilha final gerada</Text>
              <Text style={styles.subtitulo}>
                Sua planilha final de medições foi gerada com sucesso!
              </Text>

              <View style={styles.botoesContainer}>
                <Pressable
                  style={({ pressed }) => [
                    ESTILOS_BOTOES_MODAL.botao,
                    ESTILOS_BOTOES_MODAL.botaoPrimario,
                    pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                  ]}
                  onPress={onBaixarArquivo}
                  accessibilityRole="button"
                  accessibilityLabel="Baixar arquivo da planilha final"
                >
                  <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                    Baixar arquivo
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    ESTILOS_BOTOES_MODAL.botao,
                    ESTILOS_BOTOES_MODAL.botaoSecundario,
                    styles.botaoUltimo,
                    pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                  ]}
                  onPress={onVerPlanilha}
                  accessibilityRole="button"
                  accessibilityLabel="Ver planilha final gerada"
                >
                  <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                    Ver planilha
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {estado === "baixando" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeSpinner}>
                <ActivityIndicator size="large" color={cores.azulPetroleo} />
              </View>
              <Text style={styles.titulo}>Baixando</Text>
              <Text style={styles.subtitulo}>
                Baixando arquivo da planilha final de medições.
              </Text>
            </View>
          )}

          {estado === "concluido" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeSucesso}>
                <Check
                  color={`url(#${gradienteId})`}
                  size={moderateScale(40)}
                  strokeWidth={2.8}
                >
                  <Defs>
                    <LinearGradient
                      id={gradienteId}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      {gradienteCores.map((cor, indice) => (
                        <Stop
                          key={`${cor}-${indice}`}
                          offset={`${gradienteDistribuicaoCompleta[indice] * 100}%`}
                          stopColor={cor}
                        />
                      ))}
                    </LinearGradient>
                  </Defs>
                </Check>
              </View>
              <Text style={styles.titulo}>Download concluído</Text>
              <Text style={styles.subtitulo}>
                Arquivo baixado com sucesso.
              </Text>

              <View style={styles.botoesContainer}>
                <Pressable
                  style={({ pressed }) => [
                    ESTILOS_BOTOES_MODAL.botao,
                    ESTILOS_BOTOES_MODAL.botaoSecundario,
                    styles.botaoUltimo,
                    pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                  ]}
                  onPress={onFechar}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar modal de download"
                >
                  <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>Certo</Text>
                </Pressable>
              </View>
            </View>
          )}

          {estado === "erro" && (
            <View style={styles.conteudo}>
              <View style={styles.iconeErro}>
                <AlertTriangleGradient
                  size={moderateScale(48)}
                  strokeWidth={2.4}
                />
              </View>
              <Text style={styles.titulo}>Erro ao gerar planilha</Text>
              <Text style={styles.subtitulo}>
                {mensagemErro ||
                  "Não foi possível gerar a planilha final de medição."}
              </Text>

              <View style={styles.botoesContainer}>
                <Pressable
                  style={({ pressed }) => [
                    ESTILOS_BOTOES_MODAL.botao,
                    ESTILOS_BOTOES_MODAL.botaoSecundario,
                    styles.botaoUltimo,
                    pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                  ]}
                  onPress={onFechar}
                  accessibilityRole="button"
                  accessibilityLabel="Certo"
                >
                  <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>Certo</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
  },
  cardSucesso: {
    backgroundColor: "#DFF7EF",
  },
  conteudo: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(28),
  },
  iconeSpinner: {
    marginBottom: moderateScale(16),
  },
  iconeSucesso: {
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
  },
  iconeErro: {
    marginBottom: moderateScale(10),
  },
  titulo: {
    fontSize: moderateScale(20),
    fontFamily: fontes.negrito,
    color: "#1E3A5F",
    textAlign: "center",
    marginBottom: moderateScale(8),
  },
  subtitulo: {
    fontSize: moderateScale(13.5),
    fontFamily: fontes.media,
    color: "#0F5F6E",
    textAlign: "center",
    lineHeight: moderateScale(19),
    marginBottom: moderateScale(4),
  },
  botoesContainer: {
    width: "100%",
    marginTop: moderateScale(16),
  },
  botaoUltimo: {
    marginBottom: 0,
  },
});
