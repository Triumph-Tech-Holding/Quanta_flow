import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export function WorkspaceSwitcher() {
  const colors = useColors();
  const { workspaces, workspaceId, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const active = workspaces.find((w) => w.id === workspaceId);
  const label = active?.name ?? "Workspace";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: colors.accent,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather name="briefcase" size={14} color={colors.secondary} />
        <Text
          numberOfLines={1}
          style={[styles.chipText, { color: colors.secondary }]}
        >
          {label}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.secondary} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Workspaces</Text>
            {workspaces.length === 0 && (
              <Text style={{ color: colors.mutedForeground, paddingVertical: 12 }}>
                Nenhum workspace disponível.
              </Text>
            )}
            {workspaces.map((ws) => {
              const isActive = ws.id === workspaceId;
              return (
                <TouchableOpacity
                  key={ws.id}
                  onPress={async () => {
                    if (!isActive) await switchWorkspace(ws.id);
                    setOpen(false);
                  }}
                  style={[
                    styles.row,
                    {
                      backgroundColor: isActive ? colors.accent : "transparent",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={isActive ? "check-circle" : "circle"}
                    size={18}
                    color={isActive ? colors.primary : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                      {ws.name}
                    </Text>
                    {ws.plan && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        Plano {ws.plan}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 20,
    gap: 8,
    paddingBottom: 36,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
