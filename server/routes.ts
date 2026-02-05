import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { insertUserSchema, loginUserSchema, insertLeadSchema, updateLeadSchema, insertApiConfigSchema, connectEvolutionSchema } from "@shared/schema";
import { z } from "zod";
import { createEvolutionService } from "./services/evolutionService";
import { emitMessageReceived, emitInstanceConnected } from "./socket";
import { log } from "./index";

const JWT_SECRET: string = process.env.SESSION_SECRET!;
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for JWT authentication");
}
const JWT_EXPIRATION = "24h";

interface JwtPayload {
  userId: string;
  email: string;
}

interface AuthRequest extends Request {
  user?: JwtPayload;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token de acesso não fornecido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token inválido ou expirado" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      const { password, ...userWithoutPassword } = user;

      res.status(201).json({
        token,
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validatedData = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      const { password, ...userWithoutPassword } = user;

      res.json({
        token,
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/leads", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const leads = await storage.getLeadsByOwner(req.user!.userId);
      res.json(leads);
    } catch (error) {
      console.error("Get leads error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/leads", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        donoId: req.user!.userId,
      });

      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }
      console.error("Create lead error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.patch("/api/leads/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const validatedData = updateLeadSchema.parse(req.body);
      
      const existingLead = await storage.getLead(id);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead não encontrado" });
      }
      
      if (existingLead.donoId !== req.user!.userId) {
        return res.status(403).json({ message: "Sem permissão para editar este lead" });
      }

      const updated = await storage.updateLead(id, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }
      console.error("Update lead error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/leads/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      
      const existingLead = await storage.getLead(id);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead não encontrado" });
      }
      
      if (existingLead.donoId !== req.user!.userId) {
        return res.status(403).json({ message: "Sem permissão para deletar este lead" });
      }

      await storage.deleteLead(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete lead error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/api-configs", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const configs = await storage.getApiConfigsByUser(req.user!.userId);
      const safeConfigs = configs.map(config => ({
        ...config,
        apiKey: config.apiKey.substring(0, 8) + "..." + config.apiKey.substring(config.apiKey.length - 4),
      }));
      res.json(safeConfigs);
    } catch (error) {
      console.error("Get api configs error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/api-configs", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertApiConfigSchema.parse({
        ...req.body,
        userId: req.user!.userId,
      });

      const config = await storage.createApiConfig(validatedData);
      const safeConfig = {
        ...config,
        apiKey: config.apiKey.substring(0, 8) + "..." + config.apiKey.substring(config.apiKey.length - 4),
      };
      res.status(201).json(safeConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dados inválidos" });
      }
      console.error("Create api config error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/api-configs/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      
      const configs = await storage.getApiConfigsByUser(req.user!.userId);
      const config = configs.find(c => c.id === id);
      
      if (!config) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }

      await storage.deleteApiConfig(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete api config error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/evolution/connect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = connectEvolutionSchema.parse(req.body);
      const userId = req.user!.userId;

      const existingConfig = await storage.getEvolutionConfig(userId);
      if (existingConfig) {
        const service = createEvolutionService(existingConfig.evolutionUrl, existingConfig.globalToken);
        await service.deleteInstance(existingConfig.instanceName);
        await storage.deleteEvolutionConfig(userId);
      }

      const service = createEvolutionService(validatedData.evolutionUrl, validatedData.globalToken);
      
      const isValid = await service.validateToken();
      if (!isValid) {
        return res.status(401).json({ message: "Token da Evolution API inválido" });
      }

      const instanceName = `quanta_${userId.substring(0, 8)}_${Date.now()}`;
      const result = await service.createInstance(instanceName);

      const webhookUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/webhooks/evolution`
        : `${process.env.BASE_URL || 'http://localhost:5000'}/webhooks/evolution`;

      await storage.createEvolutionConfig({
        userId,
        evolutionUrl: validatedData.evolutionUrl,
        globalToken: validatedData.globalToken,
        instanceName,
      });

      await storage.updateEvolutionConfig(userId, {
        instanceId: result.instance.instanceId,
        webhookUrl,
        status: "connecting",
      });

      log(`Webhook URL: ${webhookUrl}`, "evolution");

      const qrCode = await service.getQRCode(instanceName);

      res.json({
        instanceName,
        qrCode: qrCode?.base64 || result.qrcode?.base64,
        status: "connecting",
      });
    } catch (error) {
      console.error("Evolution connect error:", error);
      res.status(500).json({ message: "Erro ao conectar Evolution API" });
    }
  });

  app.get("/api/evolution/status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (!config) {
        return res.json({ status: "not_configured" });
      }

      const service = createEvolutionService(config.evolutionUrl, config.globalToken);
      const state = await service.getConnectionStatus(config.instanceName);

      const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
      
      if (config.status !== status) {
        await storage.updateEvolutionConfig(userId, { status: status as any });
      }

      res.json({
        status,
        instanceName: config.instanceName,
      });
    } catch (error) {
      console.error("Evolution status error:", error);
      res.status(500).json({ message: "Erro ao verificar status" });
    }
  });

  app.get("/api/evolution/qrcode", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (!config) {
        return res.status(404).json({ message: "Evolution não configurado" });
      }

      const service = createEvolutionService(config.evolutionUrl, config.globalToken);
      const qrCode = await service.getQRCode(config.instanceName);

      if (!qrCode) {
        return res.status(404).json({ message: "QR Code não disponível" });
      }

      res.json({ qrCode: qrCode.base64 });
    } catch (error) {
      console.error("Evolution QR code error:", error);
      res.status(500).json({ message: "Erro ao obter QR Code" });
    }
  });

  app.post("/api/evolution/disconnect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (config) {
        const service = createEvolutionService(config.evolutionUrl, config.globalToken);
        await service.deleteInstance(config.instanceName);
        await storage.deleteEvolutionConfig(userId);
      }

      res.json({ message: "Desconectado com sucesso" });
    } catch (error) {
      console.error("Evolution disconnect error:", error);
      res.status(500).json({ message: "Erro ao desconectar" });
    }
  });

  app.get("/api/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const conversations = await storage.getConversationsByUser(req.user!.userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const conversationId = req.params.id as string;
      const conversation = await storage.getConversation(conversationId);

      if (!conversation || conversation.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Conversa não encontrada" });
      }

      const messages = await storage.getMessagesByConversation(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const conversationId = req.params.id as string;
      const { content } = req.body;
      const userId = req.user!.userId;

      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversa não encontrada" });
      }

      const config = await storage.getEvolutionConfig(userId);
      if (!config || config.status !== "connected") {
        return res.status(400).json({ message: "WhatsApp não conectado" });
      }

      const service = createEvolutionService(config.evolutionUrl, config.globalToken);
      const result = await service.sendMessage(config.instanceName, conversation.remoteJid, content);

      const message = await storage.createMessage({
        conversationId: conversationId,
        userId: userId,
        messageId: result.key.id,
        direction: "outgoing",
        content: content,
        timestamp: new Date(),
      });

      await storage.updateConversation(conversationId, {
        lastMessage: content,
        lastMessageAt: new Date(),
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  app.post("/webhooks/evolution", async (req: Request, res: Response) => {
    try {
      console.log("Webhook raw body:", JSON.stringify(req.body, null, 2));
      
      if (!req.body || Object.keys(req.body).length === 0) {
        log("Webhook received with empty body", "webhook");
        return res.status(200).json({ received: true, message: "Empty body" });
      }

      const body = req.body.data ? req.body.data : req.body;
      const event = body.event || req.body.event;
      const data = body.data || body;
      const instance = body.instance || req.body.instance || body.instanceName;
      
      log(`Webhook received: ${event} for instance ${instance}`, "webhook");
      console.log("Parsed webhook data:", { event, instance, hasData: !!data });

      if (event === "messages.upsert" && data?.key && data?.message) {
        const { key, message, pushName } = data;
        
        if (key.fromMe) {
          return res.status(200).json({ received: true });
        }

        const remoteJid = key.remoteJid;
        const messageContent = message.conversation || 
          message.extendedTextMessage?.text || 
          message.imageMessage?.caption ||
          "[Mídia]";

        const instanceName = instance;
        const configs = await storage.getApiConfigsByUser("*");
        
        const allUsers = await getAllEvolutionConfigs();
        const config = allUsers.find(c => c.instanceName === instanceName);

        if (config) {
          let conversation = await storage.getConversationByRemoteJid(config.userId, remoteJid);

          if (!conversation) {
            const phoneNumber = remoteJid.split("@")[0];
            conversation = await storage.createConversation({
              userId: config.userId,
              remoteJid,
              contactName: pushName || phoneNumber,
              contactPhone: phoneNumber,
              lastMessage: messageContent,
              lastMessageAt: new Date(),
              unreadCount: "1",
            });
          } else {
            const currentUnread = parseInt(conversation.unreadCount || "0");
            await storage.updateConversation(conversation.id, {
              lastMessage: messageContent,
              lastMessageAt: new Date(),
              unreadCount: String(currentUnread + 1),
              contactName: pushName || conversation.contactName,
            });
          }

          const newMessage = await storage.createMessage({
            conversationId: conversation.id,
            userId: config.userId,
            messageId: key.id,
            direction: "incoming",
            content: messageContent,
            timestamp: new Date(),
          });

          emitMessageReceived(config.userId, {
            message: newMessage,
            conversation: await storage.getConversation(conversation.id),
          });
        }
      }

      if (event === "connection.update") {
        const { state, instance: instanceName } = data || {};
        
        if (state === "open") {
          const allUsers = await getAllEvolutionConfigs();
          const config = allUsers.find(c => c.instanceName === instanceName);
          
          if (config) {
            await storage.updateEvolutionConfig(config.userId, { status: "connected" });
            emitInstanceConnected(config.userId, { status: "connected" });
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook error" });
    }
  });

  return httpServer;
}

async function getAllEvolutionConfigs() {
  const { db } = await import("./db");
  const { evolutionConfigs } = await import("@shared/schema");
  return db.select().from(evolutionConfigs);
}
