import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import HomeHeader from "../components/HomeHeader";
import BannerModelo from "../components/BannerModelo";
import ObraCard from "../components/ObraCard";
import { useAuth } from "../context/AuthContext";
import { cores, bordas, dimensoes, fontes } from "../styles/theme";
import { listarObrasComProgresso } from "../services/api";

export default function Home({ navigation }) {
  const { logout } = useAuth();
  const [busca, setBusca] = useState("");
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarObras = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRecarregando(true);
    } else {
      setCarregando(true);
    }
    setErro(null);

    try {
      const dados = await listarObrasComProgresso();
      setObras(dados);
    } catch (err) {
      console.error("Erro ao carregar obras na Home:", err);
      setErro(err.message || "Não foi possível carregar as obras.");
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarObras();
  }, [carregarObras]);

  const handleSair = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  const obrasFiltradas = obras.filter((obra) => {
    if (!busca.trim()) return true;
    return obra.nome?.toLowerCase().includes(busca.trim().toLowerCase());
  });

  const renderFeedbackVazio = () => {
    if (carregando) {
      return (
        <View style={styles.containerFeedback}>
          <ActivityIndicator size="large" color={cores.azulPetroleo} />
          <Text style={styles.textoFeedback}>Carregando obras...</Text>
        </View>
      );
    }

    if (erro) {
      return (
        <View style={styles.containerFeedback}>
          <Feather
            name="alert-circle"
            size={40}
            color={cores.alerta || "#E53935"}
          />
          <Text style={styles.textoErro}>{erro}</Text>
          <TouchableOpacity
            style={styles.botaoTentarNovamente}
            onPress={() => carregarObras()}
          >
            <Text style={styles.textoBotaoTentarNovamente}>
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.containerFeedback}>
        <Feather name="inbox" size={40} color={cores.textoSecundario} />
        <Text style={styles.textoFeedback}>
          {busca.trim()
            ? `Nenhuma obra encontrada para "${busca}".`
            : "Nenhuma obra cadastrada até o momento."}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HomeHeader onLogout={handleSair} />

      <FlatList
        data={obrasFiltradas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ObraCard
            obra={item}
            onPress={() =>
              navigation?.navigate("AcompanhamentoObra", { obraId: item.id })
            }
          />
        )}
        ListEmptyComponent={renderFeedbackVazio}
        refreshControl={
          <RefreshControl
            refreshing={recarregando}
            onRefresh={() => carregarObras(true)}
            colors={[cores.azulPetroleo]}
            tintColor={cores.azulPetroleo}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.titulo}>Minhas Obras</Text>

            <View style={styles.linhaPesquisa}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Pesquisar por obra..."
                  placeholderTextColor={cores.textoSecundario}
                  value={busca}
                  onChangeText={setBusca}
                />
                <Feather
                  name="search"
                  size={24}
                  color={cores.textoSecundario}
                  strokeWidth={5}
                />
              </View>

              <TouchableOpacity style={styles.botaoFiltro}>
                <Feather name="filter" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <BannerModelo />
          </>
        }
        contentContainerStyle={styles.listaConteudo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundoCard,
  },
  listaConteudo: {
    paddingBottom: 100,
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: 22,
    color: cores.titulo,
    marginHorizontal: 25,
    marginTop: 20,
    marginBottom: 12,
  },
  linhaPesquisa: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 25,
    marginBottom: 20,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cores.fundoInput,
    borderRadius: bordas.input,
    height: dimensoes.alturaInput,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.textoEscuro,
    marginLeft: 8,
  },
  botaoFiltro: {
    width: dimensoes.alturaInput,
    height: dimensoes.alturaInput,
    borderRadius: bordas.input,
    backgroundColor: cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
  },
  containerFeedback: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  textoFeedback: {
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoSecundario,
    marginTop: 12,
    textAlign: "center",
  },
  textoErro: {
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    marginTop: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  botaoTentarNovamente: {
    backgroundColor: cores.azulPetroleo,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: bordas.input,
  },
  textoBotaoTentarNovamente: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
