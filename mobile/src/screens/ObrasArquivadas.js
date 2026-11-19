import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Archive, ArrowLeft, Search } from "lucide-react-native";

import HomeHeader from "../components/HomeHeader";
import ObraCard from "../components/ObraCard";
import { listarObrasComProgresso } from "../services/api";
import {
  bordas,
  cores,
  dimensoes,
  fontes,
  moderateScale,
  rem,
} from "../styles/theme";

export default function ObrasArquivadas({ navigation }) {
  const [busca, setBusca] = useState("");
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarObras = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRecarregando(true);
    else setCarregando(true);
    setErro(null);

    try {
      const dados = await listarObrasComProgresso({ incluirArquivadas: true });
      setObras(dados.filter((obra) => obra.status === "arquivada"));
    } catch (error) {
      console.error("Erro ao carregar obras arquivadas:", error);
      setErro(error.message || "Não foi possível carregar as obras arquivadas.");
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

  const obrasFiltradas = obras.filter((obra) =>
    obra.nome?.toLowerCase().includes(busca.trim().toLowerCase())
  );

  const renderFeedback = () => {
    if (carregando) {
      return (
        <View style={styles.feedback}>
          <ActivityIndicator size="large" color={cores.azulPetroleo} />
          <Text style={styles.feedbackTexto}>Carregando obras arquivadas...</Text>
        </View>
      );
    }

    if (erro) {
      return (
        <View style={styles.feedback}>
          <Text style={styles.feedbackTexto}>{erro}</Text>
          <TouchableOpacity style={styles.botaoTentar} onPress={() => carregarObras()}>
            <Text style={styles.botaoTentarTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.feedback}>
        <Archive size={moderateScale(38)} color={cores.textoSecundario} />
        <Text style={styles.feedbackTexto}>
          {busca.trim()
            ? `Nenhuma obra arquivada encontrada para "${busca}".`
            : "Nenhuma obra arquivada até o momento."}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HomeHeader />

      <FlatList
        data={obrasFiltradas}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.lista}
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
            <View style={styles.cabecalhoPagina}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.botaoVoltar}
                accessibilityRole="button"
                accessibilityLabel="Voltar para minhas obras"
              >
                <ArrowLeft size={moderateScale(22)} color={cores.azulPetroleo} />
              </TouchableOpacity>
              <View style={styles.tituloArea}>
                <Text style={styles.titulo}>Obras arquivadas</Text>
                <Text style={styles.subtitulo}>
                  Consulte as obras retiradas da lista principal
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Pesquisar por obra..."
                placeholderTextColor={cores.textoSecundario}
                value={busca}
                onChangeText={setBusca}
              />
              <Search size={moderateScale(20)} color={cores.rotulo} strokeWidth={2.2} />
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ObraCard
            obra={item}
            onPress={() =>
              navigation.navigate("AcompanhamentoObra", {
                obraId: item.id,
                imagem: item.imagem,
                nome: item.nome,
              })
            }
          />
        )}
        ListEmptyComponent={renderFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundoCard,
  },
  lista: {
    paddingBottom: moderateScale(24),
  },
  cabecalhoPagina: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(18),
    marginBottom: moderateScale(14),
  },
  botaoVoltar: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    backgroundColor: cores.fundoBanner,
    alignItems: "center",
    justifyContent: "center",
    marginRight: moderateScale(12),
  },
  tituloArea: {
    flex: 1,
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.3),
    color: cores.titulo,
  },
  subtitulo: {
    fontFamily: fontes.regular,
    fontSize: rem(0.75),
    color: cores.textoSecundario,
    marginTop: moderateScale(2),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: dimensoes.alturaInput,
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(18),
    paddingHorizontal: moderateScale(14),
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(bordas.input),
  },
  input: {
    flex: 1,
    marginRight: moderateScale(8),
    paddingVertical: 0,
    fontFamily: fontes.media,
    fontSize: rem(0.875),
    color: cores.textoEscuro,
  },
  feedback: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(36),
  },
  feedbackTexto: {
    marginTop: moderateScale(10),
    fontFamily: fontes.regular,
    fontSize: rem(0.875),
    color: cores.textoSecundario,
    textAlign: "center",
  },
  botaoTentar: {
    marginTop: moderateScale(14),
    paddingHorizontal: moderateScale(18),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(bordas.input),
    backgroundColor: cores.azulPetroleo,
  },
  botaoTentarTexto: {
    fontFamily: fontes.media,
    fontSize: rem(0.875),
    color: "#FFFFFF",
  },
});
