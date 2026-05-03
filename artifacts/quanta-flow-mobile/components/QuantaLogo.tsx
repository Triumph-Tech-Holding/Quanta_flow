import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: number;
  showWordmark?: boolean;
  tone?: "light" | "dark";
};

export function QuantaLogo({ size = 36, showWordmark = true, tone = "light" }: Props) {
  const colors = useColors();
  const wordmarkColor = tone === "dark" ? "#FFFFFF" : colors.secondary;
  return (
    <View style={styles.row}>
      <Image
        source={require("@/assets/images/quanta-logo.png")}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
      {showWordmark && (
        <Text style={[styles.wordmark, { color: wordmarkColor }]}>
          Quanta<Text style={{ color: colors.primary }}>Flow</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 0.2 },
});
