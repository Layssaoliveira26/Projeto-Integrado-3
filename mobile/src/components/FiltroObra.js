import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fontes, shadows, rem, moderateScale } from "../styles/theme";
import {
  CHAVES_FILTRO_OBRA,
  FILTROS_OBRA_INICIAIS,
  VALORES_FILTRO_OBRA,
} from "../utils/filtroObraConstantes";

export { CHAVES_FILTRO_OBRA, FILTROS_OBRA_INICIAIS, VALORES_FILTRO_OBRA };

const OPCOES_DATA = [
  { rotulo: "Última semana", valor: VALORES_FILTRO_OBRA.SEMANA },
  { rotulo: "Último mês", valor: VALORES_FILTRO_OBRA.MES },
  { rotulo: "Último trimestre", valor: VALORES_FILTRO_OBRA.TRIMESTRE },
  { rotulo: "Último semestre", valor: VALORES_FILTRO_OBRA.SEMESTRE },
  { rotulo: "+1 ano", valor: VALORES_FILTRO_OBRA.ANO_MAIS },
];

export const CONFIGURACAO_FILTROS_OBRA = [
  {
    chave: CHAVES_FILTRO_OBRA.DATA_CRIACAO,
    rotulo: "Data da criação",
    opcoes: OPCOES_DATA,
  },
  {
    chave: CHAVES_FILTRO_OBRA.REGISTRO_MEDICAO,
    rotulo: "Registro de medição",
    opcoes: OPCOES_DATA,
  },
  {
    chave: CHAVES_FILTRO_OBRA.PROGRESSO,
    rotulo: "Progresso",
    opcoes: [
      { rotulo: "Nenhum", valor: VALORES_FILTRO_OBRA.NENHUM },
      { rotulo: "Abaixo de 50%", valor: VALORES_FILTRO_OBRA.ABAIXO_50 },
      { rotulo: "Acima de 50%", valor: VALORES_FILTRO_OBRA.ACIMA_50 },
    ],
  },
  {
    chave: CHAVES_FILTRO_OBRA.CICLOS,
    rotulo: "Quantidade de ciclos",
    opcoes: [
      { rotulo: "Primeiro ciclo", valor: VALORES_FILTRO_OBRA.PRIMEIRO },
      { rotulo: "Menos de 10 ciclos", valor: VALORES_FILTRO_OBRA.MENOS_10 },
      { rotulo: "Mais de 10 ciclos", valor: VALORES_FILTRO_OBRA.MAIS_10 },
    ],
  },
];

export default function FiltroObra({
  visible,
  onClose,
  filtrosAtuais = FILTROS_OBRA_INICIAIS,
  onApply,
  onClear,
}) {
  const [selecao, setSelecao] = useState({ ...filtrosAtuais });
  const [dropdownAberto, setDropdownAberto] = useState(null);

  useEffect(() => {
    if (visible) {
      setSelecao({ ...FILTROS_OBRA_INICIAIS, ...filtrosAtuais });
      setDropdownAberto(null);
    }
  }, [visible, filtrosAtuais]);

  const selecionarOpcao = (chave, valor) => {
    setSelecao((atual) => ({
      ...atual,
      [chave]: atual[chave] === valor ? null : valor,
    }));
    setDropdownAberto(null);
  };

  const limparFiltros = () => {
    setSelecao({ ...FILTROS_OBRA_INICIAIS });
    setDropdownAberto(null);
    onClear?.();
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalFundo}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (dropdownAberto) {
              setDropdownAberto(null);
            } else {
              onClose();
            }
          }}
          accessibilityLabel="Fechar filtros"
        />
        <View style={styles.modalCard}>
          <Text style={styles.titulo}>Filtros</Text>

          {CONFIGURACAO_FILTROS_OBRA.map((filtro) => {
            const aberto = dropdownAberto === filtro.chave;
            const valorSelecionado = selecao[filtro.chave];
            const opcaoSelecionada = filtro.opcoes.find(
              (opcao) => opcao.valor === valorSelecionado,
            );

            return (
              <View
                key={filtro.chave}
                style={[
                  styles.campoContainer,
                  aberto && styles.campoContainerAberto,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.campo,
                    valorSelecionado !== null && styles.campoSelecionado,
                    aberto && styles.campoAberto,
                  ]}
                  onPress={() =>
                    setDropdownAberto(aberto ? null : filtro.chave)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: aberto }}
                >
                  <Text style={styles.campoTexto} numberOfLines={1}>
                    {opcaoSelecionada
                      ? `${filtro.rotulo}: ${opcaoSelecionada.rotulo}`
                      : filtro.rotulo}
                  </Text>
                  <Ionicons
                    name={aberto ? "chevron-up" : "chevron-down"}
                    size={moderateScale(20)}
                    color="#0F5F6E"
                  />
                </TouchableOpacity>

                {aberto && (
                  <View style={styles.listaOpcoes}>
                    {filtro.opcoes.map((opcao, indice) => (
                      <TouchableOpacity
                        key={opcao.valor}
                        style={[
                          styles.opcao,
                          indice < filtro.opcoes.length - 1 &&
                            styles.opcaoComDivisor,
                          valorSelecionado === opcao.valor &&
                            styles.opcaoSelecionada,
                        ]}
                        onPress={() =>
                          selecionarOpcao(filtro.chave, opcao.valor)
                        }
                        activeOpacity={0.75}
                      >
                        <Text style={styles.opcaoTexto}>{opcao.rotulo}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.rodape}>
            <TouchableOpacity
              style={[styles.botaoRodape, styles.botaoLimpar]}
              onPress={limparFiltros}
              activeOpacity={0.85}
            >
              <Text style={styles.botaoTexto}>Limpar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botaoRodape, styles.botaoAplicar]}
              onPress={() => {
                onApply({ ...selecao });
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.botaoTexto}>Aplicar filtro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFundo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(25),
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    paddingVertical: moderateScale(30),
    paddingHorizontal: moderateScale(28),
    borderRadius: moderateScale(24),
    backgroundColor: "#F5F3EF",
    ...shadows.padrao,
    elevation: 8,
  },
  titulo: {
    paddingLeft: moderateScale(6),
    marginBottom: moderateScale(10),
    color: "#1E3A5F",
    fontFamily: fontes.negrito,
    fontSize: rem(1.25),
  },
  campoContainer: {
    position: "relative",
    zIndex: 1,
    marginBottom: moderateScale(6),
  },
  campoContainerAberto: {
    zIndex: 50,
    elevation: 50,
  },
  campo: {
    minHeight: moderateScale(48),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(14),
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: moderateScale(16),
    backgroundColor: "#F9F8F5",
    ...shadows.padrao,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  campoSelecionado: {
    borderWidth: 2,
    borderColor: "#4DD6A8",
    backgroundColor: "#DCF5EC",
  },
  campoAberto: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    elevation: 5,
  },
  campoTexto: {
    flex: 1,
    marginRight: moderateScale(8),
    color: "#0F5F6E",
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.85),
  },
  listaOpcoes: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 51,
    borderBottomLeftRadius: moderateScale(16),
    borderBottomRightRadius: moderateScale(16),
    backgroundColor: "#F6F4F0",
    ...shadows.padrao,
    elevation: 20,
  },
  opcao: {
    minHeight: moderateScale(50),
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
  },
  opcaoComDivisor: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D8DEDA",
  },
  opcaoSelecionada: {
    backgroundColor: "#DCF5EC",
  },
  opcaoTexto: {
    color: "#0F5F6E",
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.85),
  },
  rodape: {
    flexDirection: "row",
    gap: moderateScale(8),
    marginTop: moderateScale(15),
  },
  botaoRodape: {
    minHeight: moderateScale(48),
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(10),
    borderRadius: moderateScale(16),
  },
  botaoAplicar: {
    backgroundColor: "#1A8E9A",
  },
  botaoLimpar: {
    backgroundColor: "#0D6070",
  },
  botaoTexto: {
    color: "#FFFFFF",
    fontFamily: fontes.negrito,
    fontSize: rem(0.85),
    textAlign: "center",
  },
});
