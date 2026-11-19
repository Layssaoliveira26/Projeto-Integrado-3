import { StyleSheet } from "react-native";
import { fontes, moderateScale } from "./theme";

export const ESTILOS_BOTOES_MODAL = StyleSheet.create({
  botao: {
    width: "100%",
    minHeight: moderateScale(50),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: moderateScale(14),
  },
  botaoPrimario: {
    marginBottom: moderateScale(8),
    backgroundColor: "#1A8E9A",
  },
  botaoSecundario: {
    backgroundColor: "#0D6070",
  },
  botaoPressionado: {
    opacity: 0.85,
  },
  textoBotao: {
    color: "#FFFFFF",
    fontFamily: fontes.negrito,
    fontSize: moderateScale(15),
  },
});
