import React, { useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { gradienteCores, useKeyboardPadding } from "../styles/theme";
import { ScrollContext } from "../context/ScrollContext";

export default function FundoGradiente({ children }) {
  const keyboardPadding = useKeyboardPadding(36, 24);
  const scrollViewRef = useRef(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  const scrollTo = (y) => {
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };

  const scrollToEnd = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = () => {
      setTecladoAberto(true);
      // Rola automaticamente para cima para dar visibilidade aos campos e botões
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 140, animated: true });
      }, 100);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 140, animated: true });
      }, 250);
    };

    const onHide = () => {
      setTecladoAberto(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, []);

  return (
    <LinearGradient
      colors={gradienteCores}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradiente}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              tecladoAberto && styles.scrollContentTecladoAberto,
              { paddingBottom: keyboardPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ScrollContext.Provider value={{ scrollTo, scrollToEnd }}>
              {children}
            </ScrollContext.Provider>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradiente: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  scrollContentTecladoAberto: {
    justifyContent: "flex-start",
    paddingTop: 16,
  },
});
