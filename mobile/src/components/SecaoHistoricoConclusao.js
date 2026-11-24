import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes, moderateScale } from "../styles/theme";
import HistoricoConclusaoCard from "./HistoricoConclusaoCard";
import {
  formatarData,
  formatarDataHora,
  formatarDeltaPrazo,
  obterDeltaDiasHistorico,
  resumirHistoricoConclusao,
} from "../utils/formatadores";

const LIMITE_INICIAL_HISTORICO = 3;

/**
 * Seção que gerencia a exibição do histórico de alterações na data de conclusão
 * conforme o novo componente do Figma (Dados do Projeto).
 */
export default function SecaoHistoricoConclusao({
  historico = [],
  ultimaAtualizacao,
}) {
  const [expandido, setExpandido] = useState(false);

  const lista = Array.isArray(historico) ? historico : [];
  const temHistorico = lista.length > 0;
  const { totalAlteracoes, saldoDias } = resumirHistoricoConclusao(lista);
  const quantidadeOculta = Math.max(0, lista.length - LIMITE_INICIAL_HISTORICO);
  const possuiMaisItens = quantidadeOculta > 0;
  const itensVisiveis =
    expandido || !possuiMaisItens
      ? lista
      : lista.slice(0, LIMITE_INICIAL_HISTORICO);

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
            <View style={styles.linhaBadgesResumo}>
              <View style={styles.badgeContagem}>
                <Text style={styles.textoBadgeContagem}>
                  {totalAlteracoes}{" "}
                  {totalAlteracoes === 1 ? "alteração" : "alterações"}
                </Text>
              </View>

              <View style={styles.badgeSaldoTotal}>
                <Text style={styles.textoBadgeSaldoTotal}>
                  {formatarDeltaPrazo(saldoDias)} no total
                </Text>
              </View>
            </View>

            <Text style={styles.textoUltimaAtualizacao}>
              Última atualização ocorreu em{" "}
              {ultimaAtualizacao || "Data não informada"}
            </Text>
          </View>

          {itensVisiveis.map((item, index) => (
            <HistoricoConclusaoCard
              key={item.id || index}
              dataAnterior={formatarData(item.data_anterior)}
              dataConclusao={formatarData(
                item.data_conclusao || item.data_nova,
              )}
              diasAdicionados={obterDeltaDiasHistorico(item)}
              tempoAdicionado={item.tempo_adicionado}
              dataRegistro={formatarDataHora(item.created_at)}
              isMaisRecente={index === 0}
            />
          ))}

          {possuiMaisItens && (
            <TouchableOpacity
              style={styles.botaoExpandir}
              onPress={() => setExpandido((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                expandido
                  ? "Ver menos alterações"
                  : "Ver histórico completo"
              }
            >
              <Feather
                name={expandido ? "chevron-up" : "chevron-down"}
                size={20}
                color={cores.titulo}
              />
              <Text style={styles.textoExpandir}>
                {expandido ? "Ver menos" : "Ver histórico completo"}
              </Text>
            </TouchableOpacity>
          )}
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  linhaBadgesResumo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badgeContagem: {
    backgroundColor: "#719EA7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBadgeContagem: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(12.5),
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  badgeSaldoTotal: {
    backgroundColor: "#DAF8EF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBadgeSaldoTotal: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(12.5),
    color: cores.azulPetroleo,
    fontVariant: ["tabular-nums"],
  },
  textoUltimaAtualizacao: {
    fontFamily: fontes.regular,
    fontSize: moderateScale(12.5),
    color: cores.rotulo,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  botaoExpandir: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 6,
  },
  textoExpandir: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13.5),
    color: cores.titulo,
    marginLeft: 6,
  },
});
