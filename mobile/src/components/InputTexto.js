import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { cores, bordas, dimensoes, fontes } from "../styles/theme";

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
  const rotuloA11y = accessibilityLabel || rotulo || placeholder;

  return (
    <View style={[styles.container, style]}>
      {!!rotulo && <Text style={styles.rotulo}>{rotulo}</Text>}
      <TextInput
        style={[
          styles.input,
          focado && styles.inputFocado,
        ]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 20,
  },
  rotulo: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.rotulo,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoInput,
    borderRadius: bordas.input,
    paddingHorizontal: 16,
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    borderWidth: 1.5,
    borderColor: "transparent",
    outlineStyle: "none",
  },
  inputFocado: {
    borderColor: cores.azulPetroleo,
    backgroundColor: "#EDEDED",
  },
});
