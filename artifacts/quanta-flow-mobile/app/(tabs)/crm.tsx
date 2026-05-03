import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { apiFetch } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Contact = {
  id: string;
  name?: string;
  fullName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  stage?: string;
  temperature?: string;
};

const STAGES: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "novo", label: "Novos" },
  { key: "qualificado", label: "Qualif." },
  { key: "negociacao", label: "Negoc." },
  { key: "ganho", label: "Ganhos" },
];

export default function CrmScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, workspaceId } = useAuth();
  const [stage, setStage] = useState<string>("all");
  const [search, setSearch] = useState("");

  const q = useQuery<Contact[]>({
    queryKey: ["crm-contacts", workspaceId],
    queryFn: async () => {
      const res = await apiFetch<Contact[] | { contacts?: Contact[] }>("/api/crm/contacts");
      if (Array.isArray(res)) return res;
      return res?.contacts ?? [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const all = q.data ?? [];
    return all.filter((c) => {
      if (stage !== "all" && (c.stage ?? "").toLowerCase() !== stage) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = (c.name ?? c.fullName ?? "").toLowerCase();
        const phone = (c.primaryPhone ?? "").toLowerCase();
        if (!name.includes(s) && !phone.includes(s)) return false;
      }
      return true;
    });
  }, [q.data, stage, search]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader title="CRM" subtitle={`${filtered.length} contatos`} />
      <View style={styles.controls}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou telefone"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
        <FlatList
          data={STAGES}
          keyExtractor={(s) => s.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 8 }}
          renderItem={({ item }) => {
            const active = stage === item.key;
            return (
              <Pressable
                onPress={() => setStage(item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {q.isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Feather name="users" size={22} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                Nenhum contato neste filtro.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.name ?? item.fullName ?? item.primaryPhone ?? "Contato";
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(`/contact/${item.id}`)}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold" }}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                    {item.primaryPhone ?? item.primaryEmail ?? "—"}
                  </Text>
                </View>
                {!!item.stage && (
                  <View
                    style={[
                      styles.stageTag,
                      { backgroundColor: colors.accent, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ color: colors.secondary, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                      {item.stage}
                    </Text>
                  </View>
                )}
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 0 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  emptyWrap: { padding: 16, flexGrow: 1, justifyContent: "center" },
  emptyBox: { alignItems: "center", padding: 32, borderWidth: 1, borderRadius: 12, borderStyle: "dashed" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  stageTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
});
