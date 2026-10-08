import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { requisicao } from "../services/api";

function CircleProgress({ percentage = 0, size = 68, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (circumference * clamped) / 100;

  return (
    <View style={styles.circleProgressContainer}>
      <Svg width={size} height={size} style={styles.circleSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#09D1C7"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export default function DetalhesCicloScreen({ route, navigation }) {
  const { cicloId, obraNome, numeroCiclo } = route.params || {};
  const [carregando, setCarregando] = useState(true);
  const [dadosCiclo, setDadosCiclo] = useState(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregarDetalhes();
  }, [cicloId]);

  const carregarDetalhes = async () => {
    try {
      setCarregando(true);
      const res = await requisicao(`/ciclos/${cicloId}/detalhes`);
      setDadosCiclo(res);
    } catch (error) {
      console.error("Erro ao carregar detalhes do ciclo:", error);
    } finally {
      setCarregando(false);
    }
  };

  const formatarData = (dataIso) => {
    if (!dataIso) return "--/--/----";
    return new Date(dataIso).toLocaleDateString("pt-BR");
  };

  const servicosFiltrados = (dadosCiclo?.servicos || []).filter((s) =>
    (s.descricao || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#0D6579" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Ciclo {String(dadosCiclo?.numero_ciclo || numeroCiclo || 1).padStart(2, "0")}
          </Text>
          <Text style={styles.headerSub}>
            Obra: <Text style={styles.headerObraNome}>{dadosCiclo?.obra_nome || obraNome || "Obra"}</Text>
          </Text>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator
          size="large"
          color="#0D6579"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={servicosFiltrados}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <View style={styles.cardProgresso}>
                <View style={styles.cardTopRow}>
                  <CircleProgress
                    percentage={dadosCiclo?.progresso_atribuido || 0}
                  />
                  <View style={styles.cardTopInfo}>
                    <Text style={styles.cardLabel}>Progresso atribuído</Text>
                    <Text style={styles.cardPorcentagem}>
                      {dadosCiclo?.progresso_atribuido || 0}%
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoText}>
                    Duração de ciclo:{" "}
                    <Text style={styles.infoBold}>
                      {dadosCiclo?.duracao_dias || 0} dias
                    </Text>
                  </Text>
                  <Text style={styles.infoText}>
                    Data de início:{" "}
                    <Text style={styles.infoBold}>
                      {formatarData(dadosCiclo?.data_inicio)}
                    </Text>
                  </Text>
                  <Text style={styles.infoText}>
                    Data de término:{" "}
                    <Text style={styles.infoBold}>
                      {formatarData(dadosCiclo?.data_encerramento)}
                    </Text>
                  </Text>
                </View>
              </View>

              <Text style={styles.secaoTitulo}>Serviços medidos</Text>

              <View style={styles.buscaContainer}>
                <TextInput
                  style={styles.buscaInput}
                  placeholder="Pesquisar por serviço..."
                  placeholderTextColor="#94A3B8"
                  value={busca}
                  onChangeText={setBusca}
                />
                <Ionicons name="search-outline" size={20} color="#0D6579" />
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.cardServico}>
              <View style={styles.servicoInfo}>
                <Text style={styles.servicoNome}>{item.descricao}</Text>
                <Text style={styles.servicoValor}>
                  R${" "}
                  {Number(item.valor_medido || 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>

              <View style={styles.servicoAcoes}>
                <Text style={styles.servicoPercentual}>
                  {item.percentual}%
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation?.navigate?.("Medicao", {
                      servicoId: item.id,
                      cicloId: cicloId,
                      encerrado: true,
                    })
                  }
                  style={styles.eyeButton}
                >
                  <Ionicons name="eye-outline" size={24} color="#0D6579" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F4F0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F2A38",
  },
  headerSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F2A38",
    marginTop: 2,
  },
  headerObraNome: {
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  cardProgresso: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    marginBottom: 24,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  circleProgressContainer: {
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  circleSvg: {
    transform: [{ rotate: "-90deg" }],
  },
  cardTopInfo: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0D6579",
  },
  cardPorcentagem: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0D6579",
    marginTop: -2,
  },
  infoGroup: {
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#0D6579",
  },
  infoBold: {
    fontWeight: "700",
    color: "#0D6579",
  },
  secaoTitulo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F2A38",
    marginBottom: 12,
  },
  buscaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBE8E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    marginBottom: 16,
  },
  buscaInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  cardServico: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  servicoInfo: {
    flex: 1,
    paddingRight: 12,
  },
  servicoNome: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F2A38",
  },
  servicoValor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0D6579",
    marginTop: 4,
  },
  servicoAcoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  servicoPercentual: {
    fontSize: 20,
    fontWeight: "800",
    color: "#09D1C7",
  },
  eyeButton: {
    padding: 4,
  },
});