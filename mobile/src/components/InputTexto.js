import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { cores, bordas, dimensoes, fontes, rem, moderateScale } from "../styles/theme";

export default function InputTexto({
  rotulo,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = "none",
  keyboardType = "default",
  placeholder = "",
  accessibilityLabel,
  accessibilityHint,
  style,
  onFocus,
  onBlur,
  ...propsAdicionais
}) {
  const [focado, setFocado] = useState(false);
  const [senhaOculta, setSenhaOculta] = useState(secureTextEntry);
  const rotuloA11y = accessibilityLabel || rotulo || placeholder;

  const ehCampoSenha = secureTextEntry;
  const IconeOlho = senhaOculta ? EyeOff : Eye;

  return (
    <View style={[styles.container, style]}>
      {!!rotulo && <Text style={styles.rotulo}>{rotulo}</Text>}
      <View
        style={[
          styles.inputContainer,
          focado && styles.inputContainerFocado,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={ehCampoSenha ? senhaOculta : false}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          selectionColor={cores.azulPetroleo}
          onFocus={(e) => {
            setFocado(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            if (onBlur) onBlur(e);
          }}
          accessible={true}
          accessibilityLabel={rotuloA11y}
          accessibilityHint={accessibilityHint}
          {...propsAdicionais}
        />
        {ehCampoSenha && (
          <TouchableOpacity
            style={styles.botaoOlho}
            onPress={() => setSenhaOculta(!senhaOculta)}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={senhaOculta ? "Mostrar senha" : "Ocultar senha"}
            accessibilityHint="Alterna a visibilidade da senha"
          >
            <IconeOlho
              size={moderateScale(20)}
              color={cores.azulPetroleo}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: moderateScale(16),
  },
  rotulo: {
    fontFamily: fontes.media,
    fontSize: rem(0.875),
    color: cores.rotulo,
    marginBottom: moderateScale(8),
  },
  inputContainer: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(bordas.input),
    paddingLeft: moderateScale(16),
    paddingRight: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputContainerFocado: {
    borderColor: cores.azulPetroleo,
    backgroundColor: "#EDEDED",
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontFamily: fontes.regular,
    fontSize: rem(0.875),
    color: cores.textoEscuro,
    outlineStyle: "none",
    paddingVertical: 0,
    paddingRight: moderateScale(8),
  },
  botaoOlho: {
    width: moderateScale(32),
    height: moderateScale(32),
    justifyContent: "center",
    alignItems: "center",
  },
});

