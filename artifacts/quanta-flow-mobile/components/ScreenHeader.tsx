import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuantaLogo } from "@/components/QuantaLogo";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Props = {
  title?: string;
  subtitle?: string;
};

export function ScreenHeader({ title, subtitle }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <QuantaLogo size={28} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <WorkspaceSwitcher />
          <TouchableOpacity
            onPress={logout}
            style={[styles.iconBtn, { borderColor: colors.border }]}
            accessibilityLabel="Sair"
          >
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
      {(title || subtitle) && (
        <View style={styles.titleBlock}>
          {title && (
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: { gap: 2, marginTop: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
