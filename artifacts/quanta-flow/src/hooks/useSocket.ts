import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface BrainNewInsightEvent {
  id: string;
  contactId: string;
  contactName: string;
  severity: "alta" | "media" | "baixa";
  title: string;
  description: string;
  score: number;
  hoursSinceLastContact: number | null;
  generatedAt: string;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !token) return;

    const socket = io("/inbox", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("Socket connected to inbox namespace");
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected from inbox namespace");
    });

    socket.on("message:received", (data) => {
      console.log("Message received:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (data.conversation?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", data.conversation.id, "messages"],
        });
      }
    });

    socket.on("message:sent", (data) => {
      console.log("Message sent:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    });

    socket.on("instance:connected", (data) => {
      console.log("Instance connected:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/status"] });
    });

    socket.on("brain:new-insight", (data: BrainNewInsightEvent) => {
      console.log("[brain] new critical insight:", data);
      const hoursTxt = data.hoursSinceLastContact ? `${data.hoursSinceLastContact}h sem contato · ` : "";
      toast({
        title: `🚨 ${data.title}`,
        description: `${data.contactName} (${data.score} pts) — ${hoursTxt}${data.description}`,
        duration: 10000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brain/insights"] });
    });

    socket.on("brain:scan-complete", (data: { newCriticals: number; totalInsights: number }) => {
      console.log("[brain] scan complete:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/brain/insights"] });
    });

    socket.on("message:status", (data: { messageId: string; status: string; conversationId?: string }) => {
      if (data.conversationId) {
        queryClient.setQueryData<any[]>(
          ["/api/conversations", data.conversationId, "messages"],
          (prev) => {
            if (!prev) return prev;
            return prev.map((msg: any) =>
              msg.messageId === data.messageId ? { ...msg, status: data.status } : msg
            );
          }
        );
      }
    });

    socket.on("campaign:notification", (data: { campaignId: string; campaignName: string; type: string; message: string }) => {
      const isError = data.type === "error";
      toast({
        title: `Campanha: ${data.campaignName}`,
        description: data.message,
        variant: isError ? "destructive" : "default",
        duration: 8000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, token, queryClient]);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    if (socketRef.current) {
      socketRef.current.emit("message:send", { conversationId, content });
    }
  }, []);

  return { socket: socketRef.current, sendMessage };
}
