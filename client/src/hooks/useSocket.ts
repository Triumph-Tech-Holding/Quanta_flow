import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

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
