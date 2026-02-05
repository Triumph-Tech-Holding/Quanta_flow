import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { log } from "./index";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("SESSION_SECRET environment variable is required for JWT authentication");
}

interface AuthenticatedSocket {
  userId: string;
}

let io: SocketServer | null = null;

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  const inboxNamespace = io.of("/inbox");

  inboxNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      log("Socket connection rejected: No token provided", "socket");
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token as string, JWT_SECRET!) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch (error) {
      log(`Socket authentication failed: ${error}`, "socket");
      return next(new Error("Invalid token"));
    }
  });

  inboxNamespace.on("connection", (socket) => {
    const userId = (socket as any).userId;
    log(`User ${userId} connected to inbox`, "socket");

    socket.join(`user:${userId}`);

    socket.on("message:send", async (data) => {
      log(`Message send request from user ${userId}`, "socket");
    });

    socket.on("disconnect", () => {
      log(`User ${userId} disconnected from inbox`, "socket");
    });
  });

  log("Socket.io initialized on /inbox namespace", "socket");
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.of("/inbox").to(`user:${userId}`).emit(event, data);
    log(`Emitted ${event} to user ${userId}`, "socket");
  }
}

export function emitMessageReceived(userId: string, message: unknown): void {
  emitToUser(userId, "message:received", message);
}

export function emitMessageSent(userId: string, message: unknown): void {
  emitToUser(userId, "message:sent", message);
}

export function emitInstanceConnected(userId: string, data: unknown): void {
  emitToUser(userId, "instance:connected", data);
}

export function emitSettingsRefresh(): void {
  if (io) {
    io.of("/inbox").emit("settings:refresh", { timestamp: Date.now() });
    log("Emitted settings:refresh to all users", "socket");
  }
}
