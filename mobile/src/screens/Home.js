import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import HomeHeader from "../components/HomeHeader";
import BannerModelo from "../components/BannerModelo";
import ObraCard from "../components/ObraCard";
import { cores, bordas, dimensoes, fontes } from "../styles/theme";

const MOCK_OBRAS = [
  {
    id: "1",
    nome: "Residencial Alpha",
    ciclo: 10,
    servicos: 53,
    valor: "152.121,00",
    progresso: 90,
    imagem: require("../utils/img/obra (1).jpg"),
  },
  {
    id: "2",
    nome: "Edifício Comercial Beta",
    ciclo: 3,
    servicos: 20,
    valor: "52.728,00",
    progresso: 35,
    imagem: require("../utils/img/obra (2).jpg"),
  },
];

export default function Home() {
  const [busca, setBusca] = useState("");

  return (
    <View style={styles.container}>
      <HomeHeader />

      <FlatList
        data={MOCK_OBRAS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ObraCard obra={item} />}
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
});
