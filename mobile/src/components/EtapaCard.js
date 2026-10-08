import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react-native";
import CircleGradientProgress from "./CircleGradientProgress";
import theme from "../styles/theme";

// Cores e estilos visuais locais específicos das etapas e serviços
const LOCAL_COLORS = {
  textoEtapaEscuro: "#1E293B",
  servicoNome: "#172B4D",
  servicoBorderTop: "#E3DFDA",
  servicoBorderBottom: "#ECE8E3",
};

export default function EtapaCard({ etapa, navigation, cicloAtivoId }) {
  const [isAberta, setIsAberta] = useState(false);

  const progressoEtapa = Math.round(etapa?.progresso_etapa_percentual || 0);
  const totalServicos = etapa?.total_servicos || etapa?.servicos?.length || 0;

  return (
    <View style={[styles.etapaCard, !isAberta && styles.etapaCardFechada]}>
      <TouchableOpacity
        style={styles.etapaHeader}
        onPress={() => setIsAberta((prev) => !prev)}
        activeOpacity={0.8}
      >
        <CircleGradientProgress
          percentage={progressoEtapa}
          size={58}
          strokeWidth={5}
        />
        <View style={styles.etapaInfo}>
          <Text style={styles.etapaNome}>{etapa?.nome}</Text>
          <Text style={styles.etapaSubtext}>{totalServicos} serviços</Text>
        </View>
        {isAberta ? (
          <ChevronUp color={theme.cores.titulo} size={20} />
        ) : (
          <ChevronDown color={theme.cores.titulo} size={20} />
        )}
      </TouchableOpacity>

      {isAberta && (
        <View style={styles.servicosList}>
          {etapa?.servicos?.map((servico) => (
            <View key={servico.id} style={styles.servicoItem}>
              <View style={styles.servicoMain}>
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
              </View>
              <View style={styles.servicoAcao}>
                <Text style={styles.servicoPercentual}>
                  {Math.round(servico.percentual_execucao || 0)}%
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() =>
                    navigation?.navigate?.("Medicao", {
                      servicoId: servico.id,
                      cicloId: cicloAtivoId,
                    })
                  }
                >
                  <Pencil color={theme.cores.azulPetroleo} size={25} />
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
    backgroundColor: theme.cores.fundoCardMetric,
    borderRadius: 18,
    overflow: "hidden",
    ...theme.shadows.padrao,
  },
  etapaCardFechada: {
    backgroundColor: theme.cores.fundoCard,
  },
  etapaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  etapaInfo: {
    flex: 1,
  },
  etapaNome: {
    fontSize: 16,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.azulEscuro,
  },
  etapaSubtext: {
    fontSize: 12,
    fontFamily: theme.fontes.media,
    color: theme.cores.azulPetroleo,
    marginTop: -1,
  },
  servicosList: {
    backgroundColor: theme.cores.fundoCard,
    borderTopWidth: 1,
    borderTopColor: LOCAL_COLORS.servicoBorderTop,
  },
  servicoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: LOCAL_COLORS.servicoBorderBottom,
  },
  servicoMain: {
    flex: 1,
    paddingRight: 8,
  },
  servicoNome: {
    maxWidth: "90%",
    fontSize: 14,
    fontFamily: theme.fontes.semiNegrito,
    color: LOCAL_COLORS.servicoNome,
  },
  servicoValores: {
    fontSize: 12,
    fontFamily: theme.fontes.semiNegrito,
    color: theme.cores.azulPetroleo,
    marginTop: 2,
  },
  servicoAcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  servicoPercentual: {
    fontSize: 22,
    fontFamily: theme.fontes.negrito,
    color: theme.cores.ciano,
  },
  editButton: {
    padding: 6,
  },
});
