import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [senhaOculta, setSenhaOculta] = useState(secureTextEntry);
  const rotuloA11y = accessibilityLabel || rotulo || placeholder;

  const ehCampoSenha = secureTextEntry;

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
            <Ionicons
              name={senhaOculta ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={cores.azulPetroleo}
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
    marginBottom: 20,
  },
  rotulo: {
    fontFamily: fontes.media,
    fontSize: 14,
    color: cores.rotulo,
    marginBottom: 10,
  },
  inputContainer: {
    width: "100%",
    height: dimensoes.alturaInput,
    backgroundColor: cores.fundoInput,
    borderRadius: bordas.input,
    paddingHorizontal: 16,
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
    height: "100%",
    fontFamily: fontes.regular,
    fontSize: 14,
    color: cores.textoEscuro,
    outlineStyle: "none",
    paddingVertical: 0,
  },
  botaoOlho: {
    paddingLeft: 8,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
