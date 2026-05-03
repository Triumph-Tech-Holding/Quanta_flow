import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { apiFetch } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Conversation = {
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  channel?: string;
  lastMessage?: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function InboxScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, workspaceId } = useAuth();

  const q = useQuery<Conversation[]>({
    queryKey: ["conversations", workspaceId],
    queryFn: async () => {
      const res = await apiFetch<Conversation[] | { conversations?: Conversation[] }>(
        "/api/conversations"
      );
      if (Array.isArray(res)) return res;
      return res?.conversations ?? [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const data = q.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Inbox" subtitle={`${data.length} conversas`} />
      {q.isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={data.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Feather name="message-circle" size={22} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                Nenhuma conversa ainda.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/conversation/${item.id}`)}
              style={[
                styles.row,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold" }}>
                  {(item.contactName ?? item.contactPhone ?? "?").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: colors.foreground }]}
                  >
                    {item.contactName ?? item.contactPhone ?? "Contato"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    {timeAgo(item.lastMessageAt)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.mutedForeground, flex: 1, fontSize: 13 }}
                  >
                    {item.lastMessage ?? ""}
                  </Text>
                  {!!item.unreadCount && item.unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
});
