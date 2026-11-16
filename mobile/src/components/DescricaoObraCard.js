import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes, moderateScale } from "../styles/theme";

/**
 * Componente padronizado para exibição da descrição da obra com expansão dinâmica.
 */
export default function DescricaoObraCard({
  descricao,
  rotulo = "Descrição:",
  limiteCaracteres = 150,
}) {
  const [expandida, setExpandida] = useState(false);

  const texto =
    descricao && typeof descricao === "string" && descricao.trim().length > 0
      ? descricao.trim()
      : "Nenhuma descrição informada para esta obra.";

  const textoLongo = texto.length > limiteCaracteres;

  return (
    <View style={styles.container}>
      {Boolean(rotulo) && <Text style={styles.rotulo}>{rotulo}</Text>}
      <View style={styles.caixaDescricao}>
        <Text
          style={styles.textoDescricao}
          numberOfLines={expandida || !textoLongo ? undefined : 4}
        >
          {texto}
        </Text>

        {textoLongo && (
          <TouchableOpacity
            style={styles.botaoExpandir}
            onPress={() => setExpandida((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Feather
              name={expandida ? "chevron-up" : "chevron-down"}
              size={20}
              color={cores.titulo}
            />
            <Text style={styles.textoExpandir}>
              {expandida ? "Ver menos" : "Ver descrição completa"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  rotulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(14),
    color: cores.titulo,
    marginTop: 14,
    marginBottom: 8,
  },
  caixaDescricao: {
    backgroundColor: "#E6E5E0",
    borderRadius: 15,
    padding: 16,
  },
  textoDescricao: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    color: cores.rotulo,
    lineHeight: 21,
  },
  botaoExpandir: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  textoExpandir: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(13.5),
    color: cores.titulo,
    marginLeft: 6,
  },
});
