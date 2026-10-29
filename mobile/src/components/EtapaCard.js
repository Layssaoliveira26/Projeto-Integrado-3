import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pencil, Camera } from "lucide-react-native";
import Svg, { Polygon } from "react-native-svg";
import CircleGradientProgress from "./CircleGradientProgress";
import theme, { rem, moderateScale } from "../styles/theme";

// Cores e estilos visuais locais específicos das etapas e serviços
const LOCAL_COLORS = {
  textoEtapaEscuro: "#1E293B",
  servicoNome: "#172B4D",
  servicoBorderTop: "#E3DFDA",
  servicoBorderBottom: "#ECE8E3",
};

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
}) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;
  const [isAberta, setIsAberta] = useState(false);

  const progressoEtapa = Math.round(etapa?.progresso_etapa_percentual || 0);
  const totalServicos = etapa?.total_servicos || etapa?.servicos?.length || 0;
  const idObraEfetivo = obraId || etapa?.obra_id;

  const irParaMedicao = (servico) => {
    navigation?.navigate?.("Medicao", {
      servicoId: servico.id,
      cicloId: cicloAtivoId,
      obraId: idObraEfetivo,
      etapaId: etapa?.id,
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
    <View style={[styles.etapaCard, !isAberta && styles.etapaCardFechada]}>
      <TouchableOpacity
        style={styles.etapaHeader}
        onPress={() => setIsAberta((prev) => !prev)}
        activeOpacity={0.8}
      >
        <CircleGradientProgress
          percentage={progressoEtapa}
          size={moderateScale(54)}
          strokeWidth={moderateScale(5.2)}
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
              fill={theme.cores.azulEscuro}
            />
          </Svg>
        </View>
      </TouchableOpacity>

      {isAberta && (
        <View style={styles.servicosList}>
          {etapa?.servicos?.map((servico) => (
            <View key={servico.id} style={styles.servicoItem}>
              <TouchableOpacity
                style={styles.servicoMain}
                onPress={() => irParaMedicao(servico)}
                activeOpacity={0.7}
              >
                <Text
                  style={styles.servicoNome}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {servico.descricao}
                </Text>
                <Text style={styles.servicoValores}>
                  R${" "}
                  {Number(servico.valor_acumulado_atual || 0).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2 },
                  )}{" "}
                  / R${" "}
                  {Number(servico.preco_total_orcado || 0).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2 },
                  )}
                </Text>
              </TouchableOpacity>
              <View style={styles.servicoAcao}>
                <Text style={styles.servicoPercentual}>
                  {Math.round(servico.percentual_execucao || 0)}%
                </Text>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => irParaFoto(servico)}
                  activeOpacity={0.7}
                  accessibilityLabel="Tirar foto do serviço"
                >
                  <Camera
                    color={theme.cores.azulPetroleo}
                    size={moderateScale(20)}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => irParaMedicao(servico)}
                  activeOpacity={0.7}
                  accessibilityLabel="Registrar medição do serviço"
                >
                  <Pencil
                    color={theme.cores.azulPetroleo}
                    size={moderateScale(19)}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  etapaCard: {
    backgroundColor: theme.cores.fundoCard,
    borderRadius: moderateScale(22),
    shadowColor: "#0F2F3F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  etapaCardFechada: {
    backgroundColor: theme.cores.fundoCard,
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(18),
  },
  etapaInfo: {
    flex: 1,
    marginLeft: moderateScale(14),
    marginRight: moderateScale(10),
    justifyContent: "center",
  },
  etapaNome: {
    fontSize: rem(1.08),
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulEscuro,
    lineHeight: rem(1.28),
  },
  etapaSubtext: {
    fontSize: rem(0.85),
    fontFamily: theme.fontes.media,
    color: theme.cores.azulPetroleo,
    marginTop: moderateScale(2),
  },
  caretContainer: {
    paddingHorizontal: moderateScale(4),
    paddingVertical: moderateScale(6),
    justifyContent: "center",
    alignItems: "center",
  },
  servicosList: {
    backgroundColor: theme.cores.fundoCard,
    borderTopWidth: 1,
    borderTopColor: "#ECE8E3",
    borderBottomLeftRadius: moderateScale(22),
    borderBottomRightRadius: moderateScale(22),
  },
  servicoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(18),
    borderBottomWidth: 1,
    borderBottomColor: "#ECE8E3",
  },
  servicoMain: {
    flex: 1,
    paddingRight: moderateScale(10),
  },
  servicoNome: {
    maxWidth: "88%",
    fontSize: rem(0.88),
    fontFamily: theme.fontes.semiNegrito,
    color: "#1E293B",
  },
  servicoValores: {
    fontSize: rem(0.78),
    fontFamily: theme.fontes.semiNegrito,
    color: theme.cores.azulPetroleo,
    marginTop: moderateScale(3),
  },
  servicoAcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
  servicoPercentual: {
    fontSize: rem(1.18),
    fontFamily: theme.fontes.negrito,
    color: theme.cores.ciano,
  },
  actionButton: {
    padding: moderateScale(6),
  },
});
