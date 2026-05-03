import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/constants/api";
import { useColors } from "@/hooks/useColors";

type Message = {
  id: string;
  body?: string;
  text?: string;
  content?: string;
  direction?: "inbound" | "outbound" | string;
  fromMe?: boolean;
  createdAt?: string;
  timestamp?: string;
};

function isOutbound(m: Message) {
  if (typeof m.fromMe === "boolean") return m.fromMe;
  return m.direction === "outbound";
}

function getText(m: Message) {
  return m.body ?? m.text ?? m.content ?? "";
}

export default function ConversationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const q = useQuery<Message[]>({
    queryKey: ["conv-messages", id],
    queryFn: async () => {
      const res = await apiFetch<Message[] | { messages?: Message[] }>(
        `/api/conversations/${id}/messages`
      );
      if (Array.isArray(res)) return res;
      return res?.messages ?? [];
    },
    enabled: !!id,
    refetchInterval: 8000,
  });

  const messages = (q.data ?? []).slice().reverse();

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text, body: text, content: text }),
      });
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["conv-messages", id] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // error surfaced via query state
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={56}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      {q.isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) => {
            const out = isOutbound(item);
            return (
              <View
                style={[
                  styles.bubble,
                  {
                    alignSelf: out ? "flex-end" : "flex-start",
                    backgroundColor: out ? colors.primary : colors.card,
                    borderColor: out ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: out ? "#fff" : colors.foreground, fontSize: 14 }}>
                  {getText(item)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground }}>Sem mensagens ainda.</Text>
            </View>
          }
        />
      )}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Mensagem..."
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          multiline
        />
        <TouchableOpacity
          onPress={send}
          disabled={!draft.trim() || sending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.primary,
              opacity: !draft.trim() || sending ? 0.5 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Feather name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
