import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import Botao from "./Botao";
import {
  cores,
  fontes,
  bordas,
  dimensoes,
  shadows,
  moderateScale,
  rem,
} from "../styles/theme";

export const OPCOES_ORDENACAO = [
  { chave: "progresso_desc", label: "Maior progresso" },
  { chave: "progresso_asc", label: "Menor progresso" },
  { chave: "medicao_recente", label: "Medidas recentemente" },
  { chave: "medicao_antiga", label: "Medidas há mais tempo" },
  { chave: "ciclos_desc", label: "Mais ciclos" },
  { chave: "ciclos_asc", label: "Menos ciclos" },
];

export default function OrdenacaoModal({
  visible,
  onClose,
  ordenacaoAtual = null,
  onAplicar,
}) {
  const [selecionada, setSelecionada] = useState(ordenacaoAtual);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [posicaoCampo, setPosicaoCampo] = useState(null);
  const campoRef = useRef(null);
  const animacao = useRef(new Animated.Value(0)).current;

  const opcaoSelecionada = OPCOES_ORDENACAO.find(
    (opcao) => opcao.chave === selecionada
  );

  useEffect(() => {
    if (visible) {
      setSelecionada(ordenacaoAtual || null);
      setDropdownAberto(false);
      animacao.setValue(0);
    }
  }, [visible, ordenacaoAtual, animacao]);

  useEffect(() => {
    if (dropdownAberto) {
      animacao.setValue(0);
      Animated.timing(animacao, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [dropdownAberto, animacao]);

  const abrirDropdown = () => {
    campoRef.current?.measureInWindow((x, y, largura, altura) => {
      setPosicaoCampo({ x, y, largura, altura });
      setDropdownAberto(true);
    });
  };

  const fecharDropdown = () => {
    Animated.timing(animacao, {
      toValue: 0,
      duration: 120,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setDropdownAberto(false));
  };

  const alternarDropdown = () => {
    if (dropdownAberto) fecharDropdown();
    else abrirDropdown();
  };

  const aoTocarFora = () => {
    if (dropdownAberto) fecharDropdown();
    else onClose?.();
  };

  const aplicar = () => {
    onAplicar?.(selecionada || null);
    onClose?.();
  };

  const limpar = () => {
    setSelecionada(null);
    onAplicar?.(null);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={aoTocarFora}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titulo}>Ordenar por</Text>

          <View ref={campoRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.campo, opcaoSelecionada && styles.campoSelecionado]}
              onPress={alternarDropdown}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Escolha uma ordenação"
            >
              <Text
                style={[
                  styles.campoTexto,
                  !opcaoSelecionada && styles.campoPlaceholder,
                  opcaoSelecionada && styles.campoTextoSelecionado,
                ]}
                numberOfLines={1}
              >
                {opcaoSelecionada
                  ? opcaoSelecionada.label
                  : "Escolha uma ordenação"}
              </Text>
              {dropdownAberto ? (
                <ChevronUp size={moderateScale(18)} color={cores.principal} />
              ) : (
                <ChevronDown size={moderateScale(18)} color={cores.principal} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.botoes}>
            <Botao
              titulo="Aplicar"
              onPress={aplicar}
              style={styles.botaoAplicar}
            />
            <Botao
              titulo="Limpar"
              onPress={limpar}
              style={styles.botaoLimpar}
            />
          </View>
        </Pressable>

        {dropdownAberto && posicaoCampo && (
          <Animated.View
            style={[
              styles.lista,
              {
                top: posicaoCampo.y + posicaoCampo.altura / 2,
                left: posicaoCampo.x,
                width: posicaoCampo.largura,
                opacity: animacao,
                transform: [
                  {
                    translateY: animacao.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-moderateScale(12), 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {OPCOES_ORDENACAO.map((opcao, indice) => {
                const ativo = opcao.chave === selecionada;
                const ultimo = indice === OPCOES_ORDENACAO.length - 1;
                return (
                  <TouchableOpacity
                    key={opcao.chave}
                    style={[
                      styles.item,
                      indice === 0 && {
                        paddingTop: posicaoCampo.altura / 2 + moderateScale(12),
                      },
                      ultimo && styles.itemUltimo,
                      ativo && styles.itemSelecionado,
                    ]}
                    onPress={() => {
                      setSelecionada(opcao.chave);
                      fecharDropdown();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.itemTexto}>{opcao.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {dropdownAberto && posicaoCampo && (
          <TouchableOpacity
            style={[
              styles.campo,
              styles.campoFlutuante,
              opcaoSelecionada && styles.campoSelecionado,
              {
                top: posicaoCampo.y,
                left: posicaoCampo.x,
                width: posicaoCampo.largura,
              },
            ]}
            onPress={fecharDropdown}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Fechar lista de ordenação"
          >
            <Text
              style={[
                styles.campoTexto,
                opcaoSelecionada && styles.campoTextoSelecionado,
              ]}
              numberOfLines={1}
            >
              {opcaoSelecionada
                ? opcaoSelecionada.label
                : "Escolha uma ordenação"}
            </Text>
            <ChevronUp size={moderateScale(18)} color={cores.principal} />
          </TouchableOpacity>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
  },
  card: {
    width: "100%",
    maxWidth: moderateScale(360),
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.cardObras,
    padding: moderateScale(20),
    ...shadows.padrao,
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.15),
    color: cores.titulo,
    marginBottom: moderateScale(16),
  },
  campo: {
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoCard,
    borderRadius: bordas.input,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.padrao,
  },
  campoSelecionado: {
    backgroundColor: cores.fundoBanner,
    borderColor: cores.verdeAgua,
  },
  campoTexto: {
    flex: 1,
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.9),
    color: cores.principal,
    marginRight: moderateScale(8),
  },
  campoPlaceholder: {
    color: cores.principal,
  },
  campoTextoSelecionado: {
    color: cores.principal,
  },
  campoFlutuante: {
    position: "absolute",
    zIndex: 20,
    elevation: 12,
  },
  lista: {
    position: "absolute",
    maxHeight: moderateScale(280),
    backgroundColor: cores.fundoCard,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: bordas.input,
    borderBottomRightRadius: bordas.input,
    overflow: "hidden",
    zIndex: 10,
    ...shadows.padrao,
    elevation: 8,
  },
  item: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: cores.fundoInput,
  },
  itemUltimo: {
    borderBottomWidth: 0,
  },
  itemSelecionado: {
    backgroundColor: cores.fundoBanner,
  },
  itemTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(0.9),
    color: cores.principal,
  },
  botoes: {
    flexDirection: "row",
    gap: moderateScale(10),
    marginTop: moderateScale(16),
  },
  botaoAplicar: {
    flex: 1,
    width: "48%",
    marginTop: 0,
    backgroundColor: cores.azulEsverdeado,
  },
  botaoLimpar: {
    flex: 1,
    width: "48%",
    marginTop: 0,
    backgroundColor: cores.azulPetroleo,
  },
});