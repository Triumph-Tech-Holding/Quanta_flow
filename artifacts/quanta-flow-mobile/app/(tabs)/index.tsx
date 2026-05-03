import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { apiFetch } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type DashboardMetrics = {
  totalLeads?: number;
  leadsHoje?: number;
  emAtendimento?: number;
  conversao?: number;
  novos?: number;
  qualificados?: number;
  ganhos?: number;
};

type BrainInsight = {
  id?: string;
  contactId?: string;
  contactName?: string;
  type?: string;
  title?: string;
  message?: string;
  description?: string;
  priority?: string;
  suggestedAction?: string;
};

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, workspaceId } = useAuth();

  const metricsQ = useQuery<DashboardMetrics>({
    queryKey: ["crm-dashboard", workspaceId],
    queryFn: () => apiFetch<DashboardMetrics>("/api/crm/dashboard"),
    enabled: !!user,
  });

  const insightsQ = useQuery<BrainInsight[]>({
    queryKey: ["brain-insights", workspaceId],
    queryFn: async () => {
      const res = await apiFetch<BrainInsight[] | { insights?: BrainInsight[] }>(
        "/api/brain/insights"
      );
      if (Array.isArray(res)) return res;
      return res?.insights ?? [];
    },
    enabled: !!user,
  });

  const m = metricsQ.data ?? {};
  const insights = insightsQ.data ?? [];
  const refreshing = metricsQ.isFetching || insightsQ.isFetching;

  const cards: { label: string; value: number | string; icon: keyof typeof Feather.glyphMap; tint: string }[] = [
    { label: "Leads totais", value: m.totalLeads ?? 0, icon: "users", tint: colors.secondary },
    { label: "Leads hoje", value: m.leadsHoje ?? m.novos ?? 0, icon: "user-plus", tint: colors.primary },
    { label: "Em atendimento", value: m.emAtendimento ?? m.qualificados ?? 0, icon: "message-square", tint: "#E0A02C" },
    {
      label: "Conversão",
      value: m.conversao != null ? `${Math.round(Number(m.conversao))}%` : "—",
      icon: "trending-up",
      tint: colors.primary,
    },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader title={`Olá, ${user?.nome ?? "Quanta"}`} subtitle="Resumo de hoje" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              metricsQ.refetch();
              insightsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.grid}>
          {cards.map((c) => (
            <View
              key={c.label}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.accent }]}>
                <Feather name={c.icon} size={16} color={c.tint} />
              </View>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
              <Text style={[styles.cardValue, { color: colors.foreground }]}>{c.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Feather name="cpu" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>IA Brain — Insights</Text>
        </View>

        {insightsQ.isLoading && (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!insightsQ.isLoading && insights.length === 0 && (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Feather name="inbox" size={20} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 6 }}>
              Sem insights no momento.
            </Text>
          </View>
        )}

        {insights.slice(0, 8).map((ins, idx) => {
          const id = ins.id ?? `${ins.contactId ?? "ins"}-${idx}`;
          const title = ins.title ?? ins.type ?? "Insight";
          const body = ins.message ?? ins.description ?? ins.suggestedAction ?? "";
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.85}
              onPress={() => {
                if (ins.contactId) router.push(`/contact/${ins.contactId}`);
              }}
              style={[
                styles.insight,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.priorityDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.insightTitle, { color: colors.foreground }]}>{title}</Text>
                {!!ins.contactName && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {ins.contactName}
                  </Text>
                )}
                {!!body && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
                    {body}
                  </Text>
                )}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  cardValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  insight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyBox: { alignItems: "center", padding: 24, borderWidth: 1, borderRadius: 12, borderStyle: "dashed" },
  loaderBox: { padding: 24, alignItems: "center" },
});
