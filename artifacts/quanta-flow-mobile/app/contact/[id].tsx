import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/constants/api";
import { useColors } from "@/hooks/useColors";

type Contact = {
  id: string;
  name?: string;
  fullName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  stage?: string;
  temperature?: string;
  notes?: string;
  identifiers?: { type: string; value: string }[];
};

type Message = {
  id: string;
  body?: string;
  text?: string;
  content?: string;
  channel?: string;
  createdAt?: string;
};

export default function ContactScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const contactQ = useQuery<Contact>({
    queryKey: ["contact", id],
    queryFn: () => apiFetch<Contact>(`/api/crm/contacts/${id}`),
    enabled: !!id,
  });

  const msgsQ = useQuery<Message[]>({
    queryKey: ["contact-messages", id],
    queryFn: async () => {
      const res = await apiFetch<Message[] | { messages?: Message[] }>(
        `/api/crm/contacts/${id}/messages`
      );
      if (Array.isArray(res)) return res;
      return res?.messages ?? [];
    },
    enabled: !!id,
  });

  if (contactQ.isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const c = contactQ.data;
  const name = c?.name ?? c?.fullName ?? c?.primaryPhone ?? "Contato";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.headerCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.avatarLg}>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 24 }}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.heroName}>{name}</Text>
        <View style={styles.heroMeta}>
          {!!c?.stage && (
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>Estágio: {c.stage}</Text>
            </View>
          )}
          {!!c?.temperature && (
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>{c.temperature}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.foreground }]}>Contato</Text>
        <Row icon="phone" label="Telefone" value={c?.primaryPhone ?? "—"} colors={colors} />
        <Row icon="mail" label="Email" value={c?.primaryEmail ?? "—"} colors={colors} />
        {c?.identifiers?.map((i) => (
          <Row key={`${i.type}-${i.value}`} icon="hash" label={i.type} value={i.value} colors={colors} />
        ))}
      </View>

      {!!c?.notes && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.section, { color: colors.foreground }]}>Notas</Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>{c.notes}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.foreground }]}>Timeline</Text>
        {msgsQ.isLoading && <ActivityIndicator color={colors.primary} />}
        {!msgsQ.isLoading && (msgsQ.data?.length ?? 0) === 0 && (
          <Text style={{ color: colors.mutedForeground }}>Sem interações registradas.</Text>
        )}
        {(msgsQ.data ?? []).slice(0, 25).map((m) => (
          <View key={m.id} style={[styles.timelineItem, { borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13 }} numberOfLines={3}>
                {m.body ?? m.text ?? m.content ?? ""}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                {m.channel ?? "msg"} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={14} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12, width: 80 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  avatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  heroTag: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroTagText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  section: { fontFamily: "Inter_700Bold", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineItem: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
