import React, { useId } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Defs, LinearGradient, Stop } from "react-native-svg";
import {
  Trash2,
  CheckCircle2,
  Table2,
  Info,
  Edit3,
  Archive,
} from "lucide-react-native";
import theme from "../styles/theme";

const OPCOES = [
  { chave: "excluir", label: "Excluir obra", Icone: Trash2, ativo: true },
  {
    chave: "encerrarCiclo",
    label: "Encerrar ciclo atual",
    Icone: CheckCircle2,
    ativo: true,
  },
  {
    chave: "gerarPlanilha",
    label: "Gerar planilha final",
    Icone: Table2,
    ativo: true,
  },
  {
    chave: "dadosProjeto",
    label: "Dados do Projeto",
    Icone: Info,
    ativo: true,
  },
  { chave: "editarObra", label: "Editar obra", Icone: Edit3, ativo: true },
  { chave: "arquivar", label: "Arquivar obra", Icone: Archive, ativo: false },
];

function IconeGradiente({ Icone, ativo }) {
  const gradientId = `menuIcon${useId().replace(/:/g, "")}`;

  return (
    <Icone
      color={`url(#${gradientId})`}
      size={22}
      strokeWidth={2.5}
      opacity={ativo ? 1 : 0.45}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          {theme.gradienteCores.map((cor, index) => (
            <Stop
              key={`${cor}-${index}`}
              offset={`${theme.gradienteDistribuicaoCompleta[index] * 100}%`}
              stopColor={cor}
            />
          ))}
        </LinearGradient>
      </Defs>
    </Icone>
  );
}

export default function MenuOpcoesObra({ visivel, onFechar, onSelecionar }) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      {/* Fundo transparente: toque fora fecha o menu, sem escurecer a tela */}
      <TouchableOpacity
        style={styles.fundo}
        activeOpacity={1}
        onPress={onFechar}
      >
        {/* Bloqueia a propagação do toque para o fundo quando o toque é dentro do menu */}
        <TouchableOpacity activeOpacity={1} style={styles.folha}>
          {OPCOES.map((opcao, indice) => {
            const Icone = opcao.Icone;
            const corTexto = opcao.ativo
              ? theme.cores.titulo
              : theme.cores.textoSecundario;

            return (
              <TouchableOpacity
                key={opcao.chave}
                style={[
                  styles.item,
                  indice === OPCOES.length - 1 && styles.itemSemBorda,
                ]}
                disabled={!opcao.ativo}
                activeOpacity={0.7}
                onPress={() => {
                  onSelecionar(opcao.chave);
                  onFechar();
                }}
              >
                <IconeGradiente Icone={Icone} ativo={opcao.ativo} />
                <Text style={[styles.texto, { color: corTexto }]}>
                  {opcao.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  folha: {
    position: "absolute",
    top: 80,
    right: 25,
    width: 248,
    backgroundColor: "#FBFAF8",
    borderRadius: theme.bordas.cardObras,
    paddingVertical: 4,
    ...theme.shadows.padrao,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E3DFDA",
  },
  itemSemBorda: {
    borderBottomWidth: 0,
  },
  texto: {
    fontFamily: theme.fontes.semiNegrito,
    fontSize: 15,
    marginLeft: 16,
  },
});
