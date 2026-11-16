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

function rotuloCiclo(numero) {
  return `Ciclo ${String(numero).padStart(2, "0")}`;
}

export default function ModalFiltroCiclo({
  visivel,
  ciclos,
  cicloSelecionadoId,
  onAplicar,
  onLimpar,
  onFechar,
}) {
  const [cicloRascunhoId, setCicloRascunhoId] = useState(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [posicaoCampo, setPosicaoCampo] = useState(null);
  const campoRef = useRef(null);
  const animacao = useRef(new Animated.Value(0)).current;

  const lista = Array.isArray(ciclos) ? ciclos : [];
  const semCiclos = lista.length === 0;
  const cicloRascunho = lista.find(
    (ciclo) => String(ciclo.id) === String(cicloRascunhoId)
  );

  useEffect(() => {
    if (visivel) {
      setCicloRascunhoId(cicloSelecionadoId || null);
      setDropdownAberto(false);
      animacao.setValue(0);
    }
  }, [visivel, cicloSelecionadoId, animacao]);

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
    else onFechar();
  };

  const aplicar = () => {
    if (semCiclos) return;
    onAplicar(cicloRascunhoId || null);
  };

  return (
    <Modal
      visible={visivel}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <Pressable style={styles.overlay} onPress={aoTocarFora}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titulo}>Filtro por Ciclo</Text>

          <View ref={campoRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.campo, cicloRascunho && styles.campoSelecionado,]}
              onPress={alternarDropdown}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Escolha um ciclo"
            >
              <Text
                style={[
                  styles.campoTexto,
                  !cicloRascunho && styles.campoPlaceholder,
                  cicloRascunho && styles.campoTextoSelecionado,
                ]}
                numberOfLines={1}
              >
                {cicloRascunho
                  ? rotuloCiclo(cicloRascunho.numero_ciclo)
                  : "Escolha um ciclo"}
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
              titulo="Aplicar filtro"
              onPress={aplicar}
              style={styles.botaoAplicar}
            />
            <Botao
              titulo="Limpar filtros"
              onPress={onLimpar}
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
            {semCiclos ? (
              <Text style={styles.aviso}>
                Ciclos indisponíveis. Conecte-se uma vez para carregá-los.
              </Text>
            ) : (
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {lista.map((ciclo, indice) => {
                  const selecionado =
                    String(ciclo.id) === String(cicloRascunhoId);
                  const ultimo = indice === lista.length - 1;
                  return (
                    <TouchableOpacity
                      key={ciclo.id}
                      style={[
                        styles.item,
                        indice === 0 && { paddingTop: posicaoCampo.altura / 2 + moderateScale(12) },
                        ultimo && styles.itemUltimo,
                        selecionado && styles.itemSelecionado,
                      ]}
                      onPress={() => {
                        setCicloRascunhoId(ciclo.id);
                        fecharDropdown();
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.itemTexto}>
                        {rotuloCiclo(ciclo.numero_ciclo)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {dropdownAberto && posicaoCampo && (
          <TouchableOpacity
            style={[
              styles.campo,
              styles.campoFlutuante,
              cicloRascunho && styles.campoSelecionado,
              {
                top: posicaoCampo.y,
                left: posicaoCampo.x,
                width: posicaoCampo.largura,
              },
            ]}
            onPress={fecharDropdown}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Fechar lista de ciclos"
          >
            <Text
              style={[
                styles.campoTexto,
                cicloRascunho && styles.campoTextoSelecionado,
              ]}
              numberOfLines={1}
            >
              {cicloRascunho
                ? rotuloCiclo(cicloRascunho.numero_ciclo)
                : "Escolha um ciclo"}
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
  aviso: {
    fontFamily: fontes.regular,
    fontSize: rem(0.85),
    color: cores.textoSecundario,
    textAlign: "center",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(14),
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