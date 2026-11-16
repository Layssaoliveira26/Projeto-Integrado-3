import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { cores, fontes, moderateScale } from "../styles/theme";
import HistoricoConclusaoCard from "./HistoricoConclusaoCard";
import { formatarData, formatarTempoAdicionado } from "../utils/formatadores";

/**
 * Seção que gerencia a exibição do histórico de prorrogações ou o estado vazio.
 */
export default function SecaoHistoricoConclusao({
  historico = [],
  ultimaAtualizacao,
}) {
  const lista = Array.isArray(historico) ? historico : [];
  const temHistorico = lista.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.tituloSecao}>Alterações da data de conclusão</Text>

      {!temHistorico ? (
        <View style={styles.cardSemHistorico}>
          <Text style={styles.textoSemHistorico}>
            Não há histórico de alteração na data de conclusão do projeto.
          </Text>
        </View>
      ) : (
        <View style={styles.secaoComHistorico}>
          <View style={styles.cardUltimaAtualizacao}>
            <Text style={styles.textoUltimaAtualizacao}>
              Última atualização ocorreu em{" "}
              {ultimaAtualizacao || "Data não informada"}
            </Text>
          </View>

          {lista.map((item, index) => (
            <HistoricoConclusaoCard
              key={item.id || index}
              dataAnterior={formatarData(item.data_anterior)}
              dataConclusao={formatarData(item.data_conclusao || item.data_nova)}
              tempoAdicionado={formatarTempoAdicionado(item)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  tituloSecao: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(15),
    color: cores.titulo,
    marginTop: 24,
    marginBottom: 12,
  },
  cardSemHistorico: {
    backgroundColor: "#E0EAE7",
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  textoSemHistorico: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    color: cores.rotulo,
    lineHeight: 20,
  },
  secaoComHistorico: {
    width: "100%",
  },
  cardUltimaAtualizacao: {
    backgroundColor: "#E0EAE7",
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  textoUltimaAtualizacao: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    color: cores.rotulo,
    lineHeight: 20,
  },
});
