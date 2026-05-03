import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuantaLogo } from "@/components/QuantaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("admin@quantaflow.com");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!email || !password) {
      setErr("Informe email e senha.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao entrar";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <View style={styles.heroWrap}>
        <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
          <QuantaLogo size={48} showWordmark tone="dark" />
          <Text style={styles.heroTitle}>CRM Omnichannel com IA</Text>
          <Text style={styles.heroSubtitle}>
            Inbox, leads e insights da sua equipe — agora no bolso.
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="voce@empresa.com"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card },
          ]}
        />

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 12 }]}>Senha</Text>
        <View style={styles.pwdWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card, paddingRight: 44 },
            ]}
          />
          <Pressable onPress={() => setShowPwd((v) => !v)} style={styles.eye} hitSlop={8}>
            <Feather
              name={showPwd ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        {err && (
          <View style={[styles.errBox, { borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={{ color: colors.destructive, flex: 1 }}>{err}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={onSubmit}
          disabled={loading}
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Padrão: admin@quantaflow.com / Admin@123
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroWrap: { paddingHorizontal: 16, paddingTop: 24 },
  hero: {
    borderRadius: 18,
    padding: 24,
    gap: 8,
  },
  heroTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 12 },
  heroSubtitle: { color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", fontSize: 14 },
  form: { padding: 16, marginTop: 8 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  pwdWrap: { position: "relative" },
  eye: { position: "absolute", right: 12, top: 14 },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  button: {
    marginTop: 18,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 },
  hint: { textAlign: "center", marginTop: 16, fontSize: 12 },
});
