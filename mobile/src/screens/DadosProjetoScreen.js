import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import {
  cores,
  bordas,
  fontes,
  moderateScale,
} from "../styles/theme";
import {
  obterObra,
  obterHistoricoConclusaoObra,
  obterImagemObra,
} from "../services/api";
import { formatarData, formatarDataHora } from "../utils/formatadores";
import CampoDadosObra from "../components/CampoDadosObra";
import DescricaoObraCard from "../components/DescricaoObraCard";
import SecaoHistoricoConclusao from "../components/SecaoHistoricoConclusao";

export default function DadosProjetoScreen({ navigation, route }) {
  const obraId = route?.params?.obraId || route?.params?.id;
  const obraInicial = route?.params?.obra || null;

  const [obra, setObra] = useState(obraInicial);
  const [historico, setHistorico] = useState(
    Array.isArray(obraInicial?.historico_alteracoes)
      ? obraInicial.historico_alteracoes
      : Array.isArray(obraInicial?.historico_conclusao)
      ? obraInicial.historico_conclusao
      : []
  );
  const [ultimaAtualizacaoServidor, setUltimaAtualizacaoServidor] = useState(null);
  const [carregando, setCarregando] = useState(
    !obraInicial || (!obraInicial.data_inicio && !obraInicial.data_conclusao)
  );
  const [erro, setErro] = useState(null);

  const carregarDados = useCallback(async () => {
    if (!obraId) {
      setCarregando(false);
      return;
    }
    try {
      setErro(null);

      const [dadosObra, dadosHistorico] = await Promise.all([
        obterObra(obraId),
        obterHistoricoConclusaoObra(obraId).catch((err) => {
          console.warn("[DadosProjeto] Aviso ao carregar histórico:", err);
          return null;
        }),
      ]);

      setObra(dadosObra);
      const lista = Array.isArray(dadosHistorico)
        ? dadosHistorico
        : Array.isArray(dadosHistorico?.historico)
        ? dadosHistorico.historico
        : [];
      setHistorico(lista);
      if (dadosHistorico?.ultima_atualizacao) {
        setUltimaAtualizacaoServidor(dadosHistorico.ultima_atualizacao);
      }
    } catch (err) {
      console.warn("[DadosProjeto] Erro ao carregar obra:", err);
      setErro("Não foi possível carregar as informações da obra.");
    } finally {
      setCarregando(false);
    }
  }, [obraId]);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  const listaHistorico =
    historico.length > 0
      ? historico
      : obra?.historico_alteracoes || obra?.historico_conclusao || [];

  const dataUltimaAtualizacao =
    ultimaAtualizacaoServidor ||
    formatarDataHora(listaHistorico[0]?.created_at) ||
    formatarData(obra?.ultima_atualizacao_conclusao || obra?.updated_at);

  const imagemFonte =
    obra?.imagemCapa ||
    obra?.imagem ||
    obterImagemObra(0, obra?.id || obraId);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F4F0" />

      {/* Header com botão de voltar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={30} color={cores.titulo} />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Dados do Projeto</Text>
      </View>

      {carregando ? (
        <View style={styles.centralizado}>
          <ActivityIndicator size="large" color={cores.azulPetroleo} />
          <Text style={styles.textoCarregando}>Carregando informações...</Text>
        </View>
      ) : erro && !obra ? (
        <View style={styles.centralizado}>
          <Text style={styles.textoErro}>{erro}</Text>
          <TouchableOpacity style={styles.botaoRecarregar} onPress={carregarDados}>
            <Text style={styles.textoBotaoRecarregar}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Imagem da Capa */}
          <Text style={styles.rotulo}>Imagem da capa:</Text>
          <View style={styles.containerImagemCapa}>
            <Image
              source={
                typeof imagemFonte === "string"
                  ? { uri: imagemFonte }
                  : imagemFonte
              }
              style={styles.imagemCapa}
              resizeMode="cover"
            />
          </View>

          {/* Campo Nome */}
          <CampoDadosObra
            rotulo="Nome:"
            valor={obra?.nome}
          />

          {/* Campo Endereço */}
          <CampoDadosObra
            rotulo="Endereço:"
            valor={obra?.endereco}
          />

          {/* Linha com Datas de Início e Conclusão */}
          <View style={styles.linhaDatas}>
            <CampoDadosObra
              rotulo="Data de início:"
              valor={formatarData(obra?.data_inicio)}
              containerStyle={styles.colunaDataEsquerda}
              caixaStyle={styles.caixaData}
            />

            <CampoDadosObra
              rotulo="Data de conclusão:"
              valor={formatarData(obra?.data_conclusao)}
              containerStyle={styles.colunaDataDireita}
              caixaStyle={styles.caixaData}
            />
          </View>

          {/* Campo Descrição */}
          <DescricaoObraCard
            descricao={obra?.descricao}
          />

          {/* Seção Alterações da data de conclusão */}
          <SecaoHistoricoConclusao
            historico={listaHistorico}
            ultimaAtualizacao={dataUltimaAtualizacao}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F4F0",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 20 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  botaoVoltar: {
    marginRight: 8,
    marginLeft: -6,
  },
  tituloHeader: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(22),
    color: cores.titulo,
  },
  centralizado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  textoCarregando: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.textoSecundario,
    marginTop: 12,
  },
  textoErro: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.titulo,
    textAlign: "center",
    marginBottom: 16,
  },
  botaoRecarregar: {
    backgroundColor: cores.azulPetroleo,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: bordas.input,
  },
  textoBotaoRecarregar: {
    fontFamily: fontes.semiNegrito,
    color: "#FFFFFF",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  rotulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(14),
    color: cores.titulo,
    marginTop: 14,
    marginBottom: 8,
  },
  containerImagemCapa: {
    width: "100%",
    height: 125,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#E6E5E0",
  },
  imagemCapa: {
    width: "100%",
    height: "100%",
  },
  linhaDatas: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  colunaDataEsquerda: {
    flex: 1,
    marginRight: 6,
  },
  colunaDataDireita: {
    flex: 1,
    marginLeft: 6,
  },
  caixaData: {
    alignItems: "center",
  },
});
