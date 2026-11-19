import React, { useState, useCallback, useEffect, useRef } from "react";
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
import { Search, Filter, Plus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

import HomeHeader from "../components/HomeHeader";
import BannerModelo from "../components/BannerModelo";
import ObraCard from "../components/ObraCard";
import FiltroObra, {
  FILTROS_OBRA_INICIAIS,
} from "../components/FiltroObra";
import NavBar from "../components/NavBar";
import SyncStatusBanner from "../components/SyncStatusBanner";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import {
  cores,
  bordas,
  dimensoes,
  fontes,
  gradianteDistribuicaoDownload,
  rem,
  moderateScale,
  shadows,
} from "../styles/theme";
import { listarObrasComProgresso } from "../services/api";
import { filtrarObras } from "../utils/filtrarObras";

export default function Home({ navigation }) {
  const { logout } = useAuth();
  const { lastPullAt } = useSync();
  const ultimoPullRef = useRef(lastPullAt);
  const [busca, setBusca] = useState("");
  const [obras, setObras] = useState([]);
  const [abaSelecionada, setAbaSelecionada] = useState("ativas");
  const [filtros, setFiltros] = useState({ ...FILTROS_OBRA_INICIAIS });
  const [filtroVisivel, setFiltroVisivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarObras = useCallback(async (isRefresh = false, { pularSync = false } = {}) => {
    if (isRefresh) {
      setRecarregando(true);
    } else {
      setCarregando(true);
    }
    setErro(null);

    try {
      const dados = await listarObrasComProgresso({
        incluirArquivadas:
          abaSelecionada === "arquivadas",
        incluirEncerradas:
          abaSelecionada === "concluidas",
        pularSyncEmSegundoPlano: pularSync,
      });
      setObras(dados);
    } catch (err) {
      console.error("Erro ao carregar obras na Home:", err);
      setErro(err.message || "Não foi possível carregar as obras.");
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, [abaSelecionada]);

  useFocusEffect(
    useCallback(() => {
      carregarObras(true);
    }, [carregarObras]),
  );

  useEffect(() => {
    if (lastPullAt && lastPullAt !== ultimoPullRef.current) {
      ultimoPullRef.current = lastPullAt;
      carregarObras(true, { pularSync: true });
    }
  }, [lastPullAt, carregarObras]);

  const handleSair = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  const obrasDaAba = obras.filter((obra) => {
    const arquivada = obra.status === "arquivada";
    const progressoReal = Number(
      obra._raw?.estrutura?.progresso_geral_percentual ?? obra.progresso ?? 0,
    );
    const concluida = obra.status === "encerrada" || progressoReal >= 100;

    if (abaSelecionada === "ativas" && (arquivada || concluida)) return false;
    if (abaSelecionada === "concluidas" && (arquivada || !concluida)) return false;
    if (abaSelecionada === "arquivadas" && !arquivada) return false;
    return true;
  });
  const obrasComFiltros = filtrarObras(obrasDaAba, filtros);
  const obrasFiltradas = obrasComFiltros.filter((obra) => {
    if (!busca.trim()) return true;
    return obra.nome?.toLowerCase().includes(busca.trim().toLowerCase());
  });
  const quantidadeFiltrosAtivos = Object.values(filtros).filter(Boolean).length;

  const abaAtivaNavBar =
    abaSelecionada === "arquivadas"
      ? "Arquivadas"
      : abaSelecionada === "concluidas"
        ? "Concluidas"
        : "Obras";

  const handleChangeAbaNavBar = (novaAba) => {
    if (novaAba === "Arquivadas") {
      setAbaSelecionada("arquivadas");
    } else if (novaAba === "Concluidas") {
      setAbaSelecionada("concluidas");
    } else {
      setAbaSelecionada("ativas");
    }
  };

  const handleAdicionarObra = () => {
    navigation.navigate("NovaObra");
  };

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
        <Feather
          name="inbox"
          size={moderateScale(36)}
          color={cores.textoSecundario}
        />
        <Text style={styles.textoFeedback}>
          {quantidadeFiltrosAtivos > 0
            ? "Nenhuma obra encontrada com esses filtros."
            : busca.trim()
            ? `Nenhuma obra encontrada para "${busca}".`
            : abaSelecionada === "arquivadas"
            ? "Nenhuma obra arquivada encontrada."
            : abaSelecionada === "concluidas"
            ? "Nenhuma obra concluída até o momento."
            : "Nenhuma obra cadastrada até o momento."}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HomeHeader
        onLogout={handleSair}
        onPressPerfil={() => navigation?.navigate("Perfil")}
      />

      <FlatList
        data={obrasFiltradas}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ObraCard
            obra={item}
            onPress={() => {
              navigation?.navigate("AcompanhamentoObra", {
                obraId: item.id,
                imagem: item.imagem,
                nome: item.nome,
              });
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
            {abaAtivaNavBar === "Obras" && <SyncStatusBanner />}

            <View style={styles.linhaTitulo}>
              <Text style={styles.titulo}>
                {abaAtivaNavBar === "Concluidas"
                  ? "Obras Concluídas"
                  : abaAtivaNavBar === "Arquivadas"
                  ? "Obras Arquivadas"
                  : "Minhas Obras"}
              </Text>
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

              <TouchableOpacity
                style={[
                  styles.botaoFiltro,
                  quantidadeFiltrosAtivos > 0 && styles.botaoFiltroAtivo,
                ]}
                onPress={() => setFiltroVisivel(true)}
                activeOpacity={0.8}
                accessibilityLabel="Filtrar obras"
              >
                <Filter size={moderateScale(20)} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {abaAtivaNavBar === "Obras" && (
              <>
                <BannerModelo />

                <TouchableOpacity
                  style={styles.botaoAdicionarObra}
                  onPress={handleAdicionarObra}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar uma obra"
                >
                  <LinearGradient
                    colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
                    locations={gradianteDistribuicaoDownload}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.iconeAdicionarObra}
                  >
                    <Plus
                      size={moderateScale(18)}
                      color="#FFFFFF"
                      strokeWidth={6}
                    />
                  </LinearGradient>
                  <Text style={styles.textoAdicionarObra}>
                    Adicionar uma obra
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        }
        contentContainerStyle={styles.listaConteudo}
      />

      <FiltroObra
        visible={filtroVisivel}
        onClose={() => setFiltroVisivel(false)}
        filtrosAtuais={filtros}
        onApply={setFiltros}
        onClear={() => setFiltros({ ...FILTROS_OBRA_INICIAIS })}
      />

      <NavBar abaAtiva={abaAtivaNavBar} onChangeAba={handleChangeAbaNavBar} />
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
  botaoAdicionarObra: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: moderateScale(56),
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(20),
    paddingHorizontal: moderateScale(12),
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: cores.verdeAgua,
    borderRadius: moderateScale(14),
    ...shadows.padrao,
  },
  iconeAdicionarObra: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
  },
  textoAdicionarObra: {
    marginLeft: moderateScale(10),
    fontFamily: fontes.bold,
    fontSize: rem(0.9),
    color: cores.azulPetroleo,
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
    position: "relative",
    width: dimensoes.alturaInput,
    height: dimensoes.alturaInput,
    borderRadius: moderateScale(bordas.input),
    backgroundColor: cores.azulPetroleo,
    justifyContent: "center",
    alignItems: "center",
  },
  botaoFiltroAtivo: {
    backgroundColor: cores.ciano,
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
