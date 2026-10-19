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
import { Search, Filter } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";

import HomeHeader from "../components/HomeHeader";
import BannerModelo from "../components/BannerModelo";
import ObraCard from "../components/ObraCard";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/AuthContext";
import { cores, bordas, dimensoes, fontes, rem, moderateScale } from "../styles/theme";
import { listarObrasComProgresso, baixarModeloPlanilha } from "../services/api";

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

  useFocusEffect(
    useCallback(() => {
      carregarObras(true);
    }, [carregarObras])
  );

  const handleSair = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  const obrasFiltradas = obras.filter((obra) => {
    if (obra.status === "arquivada") return false;
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
            size={moderateScale(36)}
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
        <Feather name="inbox" size={moderateScale(36)} color={cores.textoSecundario} />
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
            onPress={() => {
              if (!item.servicos || item.servicos === 0) {
                navigation?.navigate("ImportarPlanilha", {
                  obraId: item.id,
                  nome: item.nome,
                });
              } else {
                navigation?.navigate("AcompanhamentoObra", {
                  obraId: item.id,
                  imagem: item.imagem,
                  nome: item.nome,
                });
              }
            }}
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
            <View style={styles.linhaTitulo}>
              <Text style={styles.titulo}>Minhas Obras</Text>
            </View>

            <View style={styles.linhaPesquisa}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Pesquisar por obra..."
                  placeholderTextColor={cores.textoSecundario}
                  value={busca}
                  onChangeText={setBusca}
                />
                <Search
                  size={moderateScale(20)}
                  color={cores.rotulo}
                  strokeWidth={2.2}
                />
              </View>

              <TouchableOpacity style={styles.botaoFiltro} activeOpacity={0.8}>
                <Filter size={moderateScale(20)} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <BannerModelo onPress={baixarModeloPlanilha} />
          </>
        }
        contentContainerStyle={styles.listaConteudo}
      />

      <NavBar abaAtiva="Obras" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundoCard,
    position: "relative",
  },
  listaConteudo: {
    paddingBottom: moderateScale(96),
  },
  linhaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(16),
    marginBottom: moderateScale(10),
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.35),
    color: cores.titulo,
  },
  linhaPesquisa: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(16),
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(bordas.input),
    height: dimensoes.alturaInput,
    paddingHorizontal: moderateScale(14),
    marginRight: moderateScale(10),
  },
  input: {
    flex: 1,
    fontFamily: fontes.media,
    fontSize: rem(0.875),
    color: cores.textoEscuro,
    paddingVertical: 0,
    marginRight: moderateScale(8),
  },
  botaoFiltro: {
    width: dimensoes.alturaInput,
    height: dimensoes.alturaInput,
    borderRadius: moderateScale(bordas.input),
    backgroundColor: cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
  },
  containerFeedback: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(36),
    paddingHorizontal: moderateScale(24),
  },
  textoFeedback: {
    fontFamily: fontes.regular,
    fontSize: rem(0.875),
    color: cores.textoSecundario,
    marginTop: moderateScale(10),
    textAlign: "center",
  },
  textoErro: {
    fontFamily: fontes.regular,
    fontSize: rem(0.875),
    color: cores.textoEscuro,
    marginTop: moderateScale(10),
    marginBottom: moderateScale(14),
    textAlign: "center",
  },
  botaoTentarNovamente: {
    backgroundColor: cores.azulPetroleo,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(18),
    borderRadius: moderateScale(bordas.input),
  },
  textoBotaoTentarNovamente: {
    fontFamily: fontes.media,
    fontSize: rem(0.875),
    color: "#FFFFFF",
  },
});

