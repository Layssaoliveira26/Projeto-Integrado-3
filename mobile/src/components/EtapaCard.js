import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Camera } from "lucide-react-native";
import Svg, { Polygon } from "react-native-svg";
import CircleGradientProgress from "./CircleGradientProgress";
import theme, { fontes, moderateScale } from "../styles/theme";

const formatarNomeEtapa = (texto) => {
  if (!texto) return "";
  return texto
    .replace(/\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{2,}\b/g, (match) => {
      return match.charAt(0) + match.slice(1).toLowerCase();
    })
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (match) => match.toLowerCase());
};

export default function EtapaCard({
  etapa,
  navigation: propNavigation,
  cicloAtivoId,
  obraId,
  onMedicaoSalva,
  servicosComFotoIds,
  somenteLeitura = false,
}) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;
  const [isAberta, setIsAberta] = useState(false);

  const progressoEtapa = Math.min(
    100,
    Math.max(0, Math.round(etapa?.progresso_etapa_percentual || 0)),
  );
  const totalServicos = etapa?.total_servicos || etapa?.servicos?.length || 0;
  const idObraEfetivo = obraId || etapa?.obra_id;

  const irParaMedicao = (servico) => {
    navigation?.navigate?.("Medicao", {
      servicoId: servico.id,
      cicloId: cicloAtivoId,
      obraId: idObraEfetivo,
      etapaId: etapa?.id,
      encerrado: Boolean(somenteLeitura),
    });
  };

  const irParaFoto = (servico) => {
    navigation?.navigate?.("CapturaFoto", {
      servicoId: servico.id,
      cicloId: cicloAtivoId,
      obraId: idObraEfetivo,
      etapaId: etapa?.id,
      servicoNome: servico.descricao,
    });
  };

  return (
    <View
      style={[
        styles.etapaCard,
        isAberta ? styles.etapaCardAberta : styles.etapaCardFechada,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.etapaHeader,
          isAberta ? styles.etapaHeaderAberta : styles.etapaHeaderFechada,
        ]}
        onPress={() => setIsAberta((prev) => !prev)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Etapa ${etapa?.nome}. Progresso ${progressoEtapa}%. ${totalServicos} serviços.`}
      >
        <CircleGradientProgress
          percentage={progressoEtapa}
          size={moderateScale(50)}
          strokeWidth={moderateScale(4.8)}
        />
        <View style={styles.etapaInfo}>
          <Text style={styles.etapaNome}>{formatarNomeEtapa(etapa?.nome)}</Text>
          <Text style={styles.etapaSubtext}>{totalServicos} serviços</Text>
        </View>
        <View style={styles.caretContainer}>
          <Svg
            width={moderateScale(12)}
            height={moderateScale(7)}
            viewBox="0 0 12 7"
          >
            <Polygon
              points={isAberta ? "0,7 12,7 6,0" : "0,0 12,0 6,7"}
              fill={isAberta ? "#0D6579" : "#223B59"}
            />
          </Svg>
        </View>
      </TouchableOpacity>

      {isAberta && (
        <View style={styles.servicosList}>
          {etapa?.servicos?.map((servico, index) => {
            const isUltimo = index === (etapa?.servicos?.length || 0) - 1;
            const possuiFoto = Boolean(
              (servico.total_fotos && servico.total_fotos > 0) ||
              servico.possui_foto ||
              servico.tem_foto ||
              (servicosComFotoIds &&
                servicosComFotoIds.has(String(servico.id))),
            );

            const corCamera = possuiFoto ? "#00D2B4" : "#0D6579";

            return (
              <TouchableOpacity
                key={servico.id}
                style={[
                  styles.servicoCardTouch,
                  isUltimo && styles.servicoCardUltimo,
                ]}
                onPress={() => irParaMedicao(servico)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Serviço ${servico.descricao}. Toque para registrar medição.`}
              >
                <View style={styles.servicoMain}>
                  <Text
                    style={styles.servicoNome}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {servico.descricao}
                  </Text>
                  <Text style={styles.servicoValores}>
                    R${" "}
                    {Number(servico.valor_acumulado_atual || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}{" "}
                    / R${" "}
                    {Number(servico.preco_total_orcado || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}
                  </Text>
                </View>

                <View style={styles.servicoAcao}>
                  <Text style={styles.servicoPercentual}>
                    {Math.min(
                      100,
                      Math.max(0, Math.round(servico.percentual_execucao || 0)),
                    )}
                    %
                  </Text>

                  {!somenteLeitura && (
                    <TouchableOpacity
                      style={styles.actionButtonCamera}
                      onPress={(e) => {
                        if (e && typeof e.stopPropagation === "function") {
                          e.stopPropagation();
                        }
                        irParaFoto(servico);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Tirar foto do serviço"
                    >
                      <Camera
                        color={corCamera}
                        size={moderateScale(26)}
                        strokeWidth={2.2}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  etapaCard: {
    marginHorizontal: 0,
    marginBottom: moderateScale(3),
    overflow: "hidden",
    shadowColor: "#0F2F3F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  etapaCardFechada: {
    backgroundColor: "#F7F5F0",
  },
  etapaCardAberta: {
    backgroundColor: "#EAE7E2",
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(18),
  },
  etapaHeaderFechada: {
    backgroundColor: "#F7F5F0",
  },
  etapaHeaderAberta: {
    backgroundColor: "#EAE7E2",
    borderBottomWidth: 1.5,
    borderBottomColor: "#FFFFFF",
  },
  etapaInfo: {
    flex: 1,
    marginLeft: moderateScale(14),
    marginRight: moderateScale(10),
    justifyContent: "center",
  },
  etapaNome: {
    fontSize: moderateScale(16),
    fontFamily: fontes.negrito,
    color: "#223B59",
    lineHeight: moderateScale(21),
  },
  etapaSubtext: {
    fontSize: moderateScale(13),
    fontFamily: fontes.regular,
    color: "#0D6579",
    marginTop: moderateScale(2),
  },
  caretContainer: {
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(6),
    justifyContent: "center",
    alignItems: "center",
  },
  servicosList: {
    backgroundColor: "#EAE7E2",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  servicoCardTouch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F5F0",
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(18),
    borderBottomWidth: 1.5,
    borderBottomColor: "#FFFFFF",
  },
  servicoCardUltimo: {
    borderBottomWidth: 0,
  },
  servicoMain: {
    flex: 1,
    paddingRight: moderateScale(14),
  },
  servicoNome: {
    fontSize: moderateScale(15),
    fontFamily: fontes.negrito,
    color: "#223B59",
    lineHeight: moderateScale(20),
  },
  servicoValores: {
    fontSize: moderateScale(13),
    fontFamily: fontes.semiNegrito,
    color: "#0D6579",
    marginTop: moderateScale(4),
  },
  servicoAcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16),
  },
  servicoPercentual: {
    fontSize: moderateScale(22),
    fontFamily: fontes.negrito,
    color: "#00D2B4",
    textAlign: "right",
  },
  actionButtonCamera: {
    padding: moderateScale(4),
    justifyContent: "center",
    alignItems: "center",
  },
});
