import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertUserSchema, loginUserSchema, insertLeadSchema, updateLeadSchema, insertApiConfigSchema, connectEvolutionSchema, connectZApiSchema, insertSettingSchema, updateSettingSchema, insertUnifiedContactSchema, updateUnifiedContactSchema, insertContactIdentifierSchema, insertQuickReplySchema, updateQuickReplySchema, insertAutomationFlowSchema, updateAutomationFlowSchema, updateBrandingConfigSchema } from "@shared/schema";
import { z } from "zod";
import { createEvolutionService } from "./services/evolutionService";
import { emitMessageReceived, emitInstanceConnected, emitSettingsRefresh } from "./socket";
import { configService } from "./services/configService";
import { checkPermission, checkRole, getUserRolesAndPermissions } from "./middleware/rbacMiddleware";
import { log } from "./index";
import { db } from "./db";
import { users as usersTable, auditLogs, roles, userRoles, rolePermissions, permissions } from "@shared/schema";
import { eq, desc, and, sql as sqlExpr } from "drizzle-orm";
import { detectIntent, processMessageIntent } from "./services/intentService";

const JWT_SECRET: string = process.env.SESSION_SECRET!;
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for JWT authentication");
}
const JWT_EXPIRATION = "24h";

interface JwtPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

interface AuthRequest extends Request {
  user?: JwtPayload;
}

async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token de acesso não fornecido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
    
    if (user.status !== "active") {
      return res.status(403).json({ message: "Usuário inativo ou suspenso" });
    }
    
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Sessão invalidada. Faça login novamente." });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token inválido ou expirado" });
  }
}

function getWebhookUrl(provider: "zapi" | "evolution" = "zapi"): string {
  const endpoint = provider === "zapi" ? "/api/webhooks/zapi" : "/webhooks/evolution";
  if (process.env.WEBHOOK_BASE_URL) {
    const base = process.env.WEBHOOK_BASE_URL.replace(/\/$/, '');
    return `${base}${endpoint}`;
  }
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    console.warn('[webhook] WARNING: Running in production but WEBHOOK_BASE_URL is not set. Webhooks will not work correctly.');
    return `https://localhost${endpoint}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}${endpoint}`;
  }
  return `http://localhost:5000${endpoint}`;
}

async function configureZApiWebhooks(
  instanceId: string, 
  token: string, 
  clientToken: string, 
  webhookUrl: string
): Promise<{ results: { name: string; success: boolean }[]; failedCount: number }> {
  const webhookTypes = [
    { path: "update-webhook-received", name: "Ao receber" },
    { path: "update-webhook-delivery", name: "Ao enviar" },
    { path: "update-webhook-connected", name: "Ao conectar" },
    { path: "update-webhook-disconnected", name: "Ao desconectar" },
    { path: "update-webhook-message-status", name: "Receber status da mensagem" },
    { path: "update-webhook-chat-presence", name: "Presença do chat" },
  ];

  const results: { name: string; success: boolean }[] = [];

  for (const webhook of webhookTypes) {
    try {
      const configUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/${webhook.path}`;
      const webhookResponse = await fetch(configUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify({ value: webhookUrl }),
      });

      const success = webhookResponse.ok;
      results.push({ name: webhook.name, success });

      if (success) {
        log(`Z-API webhook ${webhook.name} configured: ${webhookUrl}`, "zapi");
      } else {
        log(`Z-API webhook ${webhook.name} failed: ${webhookResponse.status}`, "zapi");
      }
    } catch (err) {
      results.push({ name: webhook.name, success: false });
      console.error(`Failed to configure webhook ${webhook.name}:`, err);
    }
  }

  return { results, failedCount: results.filter(w => !w.success).length };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Anti-cache middleware for all API routes - prevents 304 Not Modified responses
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    res.removeHeader('ETag');
    next();
  });

  // Anti-cache middleware for webhooks
  app.use("/webhooks", (req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  });

  // Test endpoint to verify anti-cache is working
  app.get("/api/test-cache", (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    res.json({
      status: 'ok',
      timestamp,
      message: 'Se o timestamp muda a cada requisição, cache está desabilitado',
      headers: {
        'Cache-Control': res.get('Cache-Control'),
        'Pragma': res.get('Pragma'),
        'Expires': res.get('Expires'),
        'Surrogate-Control': res.get('Surrogate-Control'),
      }
    });
  });

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
        { userId: user.id, email: user.email, tokenVersion: user.tokenVersion },
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

      if (user.status !== "active") {
        return res.status(403).json({ message: "Usuário inativo ou suspenso" });
      }

      const rbac = await getUserRolesAndPermissions(user.id);

      const token = jwt.sign(
        { userId: user.id, email: user.email, tokenVersion: user.tokenVersion },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      const { password, ...userWithoutPassword } = user;

      res.json({
        token,
        user: { ...userWithoutPassword, roles: rbac.roles, permissions: rbac.permissions },
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

      const rbac = await getUserRolesAndPermissions(user.id);
      const { password, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, roles: rbac.roles, permissions: rbac.permissions });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
      }
      
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.mustChangePassword && !currentPassword) {
        return res.status(400).json({ message: "Senha atual é obrigatória" });
      }

      if (currentPassword) {
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Senha atual incorreta" });
        }
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const updatedUser = await storage.updateUser(user.id, {
        password: hashedPassword,
        mustChangePassword: false,
        tokenVersion: user.tokenVersion + 1,
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Erro ao atualizar senha" });
      }

      const token = jwt.sign(
        { userId: updatedUser.id, email: updatedUser.email, tokenVersion: updatedUser.tokenVersion },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      const { password, ...userWithoutPassword } = updatedUser;

      res.json({
        token,
        user: userWithoutPassword,
        message: "Senha alterada com sucesso",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Erro ao alterar senha" });
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

      const webhookUrl = getWebhookUrl("evolution");

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

  // ==================== Z-API Routes ====================
  
  app.post("/api/zapi/connect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = connectZApiSchema.parse(req.body);
      const userId = req.user!.userId;

      // Test Z-API connection
      const zapiUrl = `https://api.z-api.io/instances/${validatedData.instanceId}/token/${validatedData.token}/status`;
      log(`Z-API testing connection: ${zapiUrl}`, "zapi");
      
      const response = await fetch(zapiUrl, {
        headers: { "Client-Token": validatedData.clientToken },
      });
      const responseText = await response.text();
      
      log(`Z-API response status: ${response.status}`, "zapi");
      log(`Z-API response body: ${responseText}`, "zapi");
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          message: `${response.status}: ${responseText}` 
        });
      }

      const statusData = JSON.parse(responseText);
      log(`Z-API status check: ${JSON.stringify(statusData)}`, "zapi");

      // Delete existing config if any
      const existingConfig = await storage.getEvolutionConfig(userId);
      if (existingConfig) {
        await storage.deleteEvolutionConfig(userId);
      }

      const webhookUrl = getWebhookUrl();
      log(`Using webhook URL: ${webhookUrl}`, "zapi");

      const { results: webhookResults, failedCount } = await configureZApiWebhooks(
        validatedData.instanceId,
        validatedData.token,
        validatedData.clientToken,
        webhookUrl
      );

      if (failedCount > 0) {
        log(`Warning: ${failedCount} webhooks failed to configure`, "zapi");
      }

      // Store config using existing evolution_configs table
      // For Z-API: evolutionUrl contains instance URL, globalToken stores clientToken for authentication
      const instanceName = `zapi_${userId.substring(0, 8)}_${Date.now()}`;
      await storage.createEvolutionConfig({
        userId,
        evolutionUrl: `https://api.z-api.io/instances/${validatedData.instanceId}/token/${validatedData.token}`,
        globalToken: validatedData.clientToken,
        instanceName,
      });

      await storage.updateEvolutionConfig(userId, {
        instanceId: validatedData.instanceId,
        webhookUrl,
        status: statusData.connected ? "connected" : "disconnected",
      });

      log(`Z-API connected for user ${userId}. Webhook URL: ${webhookUrl}`, "zapi");

      res.json({
        status: statusData.connected ? "connected" : "disconnected",
        instanceName,
        webhookUrl,
      });
    } catch (error) {
      console.error("Z-API connect error:", error);
      res.status(500).json({ message: "Erro ao conectar Z-API" });
    }
  });

  app.get("/api/zapi/status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (!config) {
        return res.json({ status: "not_configured" });
      }

      // Check if it's a Z-API config (URL starts with z-api)
      if (!config.evolutionUrl.includes("z-api.io")) {
        return res.json({ status: "not_configured" });
      }

      // Check Z-API status - globalToken contains Client-Token
      const statusUrl = `${config.evolutionUrl}/status`;
      const response = await fetch(statusUrl, {
        headers: { "Client-Token": config.globalToken },
      });
      
      if (!response.ok) {
        return res.json({ status: "disconnected", instanceName: config.instanceName });
      }

      const statusData = await response.json();
      const status = statusData.connected ? "connected" : "disconnected";

      if (config.status !== status) {
        await storage.updateEvolutionConfig(userId, { status: status as any });
      }

      res.json({
        status,
        instanceName: config.instanceName,
        webhookUrl: config.webhookUrl,
      });
    } catch (error) {
      console.error("Z-API status error:", error);
      res.json({ status: "disconnected" });
    }
  });

  app.post("/api/zapi/disconnect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (config && config.evolutionUrl.includes("z-api.io")) {
        await storage.deleteEvolutionConfig(userId);
      }

      res.json({ message: "Desconectado com sucesso" });
    } catch (error) {
      console.error("Z-API disconnect error:", error);
      res.status(500).json({ message: "Erro ao desconectar" });
    }
  });

  app.post("/api/zapi/refresh-webhooks", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);

      if (!config || !config.evolutionUrl.includes("z-api.io")) {
        return res.status(400).json({ message: "Z-API não configurada" });
      }

      const urlParts = config.evolutionUrl.replace("https://api.z-api.io/instances/", "").split("/token/");
      const instanceId = urlParts[0];
      const token = urlParts[1];
      const clientToken = config.globalToken;

      const webhookUrl = getWebhookUrl();
      log(`Refreshing Z-API webhooks to: ${webhookUrl}`, "zapi");

      const { results, failedCount } = await configureZApiWebhooks(instanceId, token, clientToken, webhookUrl);

      await storage.updateEvolutionConfig(userId, { webhookUrl });

      res.json({
        message: "Webhooks atualizados",
        webhookUrl,
        webhooks: results,
        failedCount,
      });
    } catch (error) {
      console.error("Z-API refresh webhooks error:", error);
      res.status(500).json({ message: "Erro ao atualizar webhooks" });
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

      let messageId = `msg_${Date.now()}`;

      // Check if it's Z-API or Evolution API
      if (config.evolutionUrl.includes("z-api.io")) {
        // Z-API send message - globalToken contains the Client-Token for authentication
        const phone = conversation.contactPhone?.replace(/\D/g, "") || conversation.remoteJid.replace("@s.whatsapp.net", "");
        const sendUrl = `${config.evolutionUrl}/send-text`;
        
        const response = await fetch(sendUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Client-Token": config.globalToken,
          },
          body: JSON.stringify({
            phone: phone,
            message: content,
          }),
        });

        if (!response.ok) {
          throw new Error("Erro ao enviar mensagem via Z-API");
        }

        const result = await response.json();
        messageId = result.messageId || messageId;
        log(`Z-API message sent to ${phone}: ${messageId}`, "zapi");
      } else {
        // Evolution API send message
        const service = createEvolutionService(config.evolutionUrl, config.globalToken);
        const result = await service.sendMessage(config.instanceName, conversation.remoteJid, content);
        messageId = result.key.id;
      }

      const message = await storage.createMessage({
        conversationId: conversationId,
        userId: userId,
        messageId: messageId,
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

  app.get("/api/admin/settings", authenticateToken, checkPermission("view_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const settings = await configService.getAllSettingsForAdmin();
      res.json(settings);
    } catch (error) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.get("/api/admin/settings/:key/value", authenticateToken, checkPermission("view_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const key = req.params.key as string;
      const value = await configService.getSetting(key);
      if (value === null) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }
      res.json({ key, value });
    } catch (error) {
      console.error("Get setting value error:", error);
      res.status(500).json({ message: "Erro ao buscar valor" });
    }
  });

  app.post("/api/admin/settings", authenticateToken, checkPermission("edit_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const { key, value, type, category, description, isActive, isEncrypted } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ message: "Key e value são obrigatórios" });
      }

      const existing = await configService.getSettingByKey(key);
      if (existing) {
        return res.status(400).json({ message: "Configuração já existe" });
      }

      const setting = await configService.createSetting(
        { key, value, type, category, description, isActive, isEncrypted },
        req.user!.userId
      );

      if (!setting) {
        return res.status(500).json({ message: "Erro ao criar configuração" });
      }

      emitSettingsRefresh();
      res.status(201).json({ ...setting, maskedValue: configService.maskValue(value) });
    } catch (error) {
      console.error("Create setting error:", error);
      res.status(500).json({ message: "Erro ao criar configuração" });
    }
  });

  app.put("/api/admin/settings/:key", authenticateToken, checkPermission("edit_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const key = req.params.key as string;
      const { value, type, category, description, isActive } = req.body;

      const existing = await configService.getSettingByKey(key);
      if (!existing) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }

      const setting = await configService.updateSetting(
        key,
        { value, type, category, description, isActive },
        req.user!.userId
      );

      if (!setting) {
        return res.status(500).json({ message: "Erro ao atualizar configuração" });
      }

      emitSettingsRefresh();
      res.json({ ...setting, maskedValue: value ? configService.maskValue(value) : undefined });
    } catch (error) {
      console.error("Update setting error:", error);
      res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  app.delete("/api/admin/settings/:key", authenticateToken, checkPermission("delete_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const key = req.params.key as string;

      const existing = await configService.getSettingByKey(key);
      if (!existing) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }

      const success = await configService.deleteSetting(key, req.user!.userId);
      if (!success) {
        return res.status(500).json({ message: "Erro ao deletar configuração" });
      }

      emitSettingsRefresh();
      res.json({ message: "Configuração deletada com sucesso" });
    } catch (error) {
      console.error("Delete setting error:", error);
      res.status(500).json({ message: "Erro ao deletar configuração" });
    }
  });

  app.post("/api/admin/settings/refresh", authenticateToken, checkPermission("edit_settings"), async (req: AuthRequest, res: Response) => {
    try {
      await configService.refreshCache();
      emitSettingsRefresh();
      res.json({ message: "Cache atualizado com sucesso" });
    } catch (error) {
      console.error("Refresh cache error:", error);
      res.status(500).json({ message: "Erro ao atualizar cache" });
    }
  });

  app.post("/api/admin/settings/:key/validate", authenticateToken, checkPermission("edit_settings"), async (req: AuthRequest, res: Response) => {
    try {
      const key = req.params.key as string;
      const { value } = req.body;

      const existing = await configService.getSettingByKey(key);
      const type = existing?.type || "api_key";

      const result = await configService.validateCredential(type, key, value);
      res.json(result);
    } catch (error) {
      console.error("Validate setting error:", error);
      res.status(500).json({ message: "Erro ao validar configuração" });
    }
  });

  app.get("/api/admin/settings/audit", authenticateToken, checkPermission("view_audit_logs"), async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.query;
      const audit = await configService.getSettingsAudit(key as string | undefined);
      res.json(audit);
    } catch (error) {
      console.error("Get audit error:", error);
      res.status(500).json({ message: "Erro ao buscar auditoria" });
    }
  });

  app.get("/api/admin/users", authenticateToken, checkPermission("view_users"), async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        nome: usersTable.nome,
        tipoAtor: usersTable.tipoAtor,
        telefone: usersTable.telefone,
        status: usersTable.status,
        mustChangePassword: usersTable.mustChangePassword,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      }).from(usersTable).orderBy(desc(usersTable.createdAt));

      const usersWithRoles = await Promise.all(
        allUsers.map(async (u) => {
          const rbac = await getUserRolesAndPermissions(u.id);
          return { ...u, roles: rbac.roles, permissions: rbac.permissions };
        })
      );

      res.json(usersWithRoles);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.patch("/api/admin/users/:id", authenticateToken, checkPermission("edit_users"), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.id as string;
      const { status, tipoAtor, mustChangePassword, roleId } = req.body;

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = status;
      if (tipoAtor !== undefined) updateData.tipoAtor = tipoAtor;
      if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;

      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(userId, updateData);
      }

      if (roleId !== undefined) {
        await db.delete(userRoles).where(eq(userRoles.userId, userId));
        if (roleId) {
          await db.insert(userRoles).values({
            userId: userId,
            roleId: roleId,
            assignedBy: req.user!.userId,
          });
        }
      }

      await db.insert(auditLogs).values({
        userId: req.user!.userId,
        action: "update_user",
        resource: "users",
        resourceId: userId,
        oldValue: JSON.stringify({ status: targetUser.status, tipoAtor: targetUser.tipoAtor }),
        newValue: JSON.stringify(updateData),
        ipAddress: (req.ip || req.socket.remoteAddress || "unknown") as string,
        userAgent: (req.headers["user-agent"] || "unknown") as string,
      });

      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      const rbac = await getUserRolesAndPermissions(userId);
      const { password, ...safeUser } = updatedUser;
      res.json({ ...safeUser, roles: rbac.roles, permissions: rbac.permissions });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", authenticateToken, checkPermission("edit_users"), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.id as string;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, {
        password: hashedPassword,
        mustChangePassword: true,
        tokenVersion: targetUser.tokenVersion + 1,
      });

      await db.insert(auditLogs).values({
        userId: req.user!.userId,
        action: "reset_password",
        resource: "users",
        resourceId: userId,
        newValue: JSON.stringify({ mustChangePassword: true }),
        ipAddress: (req.ip || req.socket.remoteAddress || "unknown") as string,
        userAgent: (req.headers["user-agent"] || "unknown") as string,
      });

      res.json({ message: "Senha resetada com sucesso. O usuário precisará trocar a senha no próximo login." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erro ao resetar senha" });
    }
  });

  app.post("/api/admin/users", authenticateToken, checkPermission("create_users"), async (req: AuthRequest, res: Response) => {
    try {
      const { nome, email, password, roleId } = req.body;

      if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
        return res.status(400).json({ message: "Nome deve ter pelo menos 2 caracteres" });
      }
      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Email inválido" });
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }
      if (!roleId || typeof roleId !== "string") {
        return res.status(400).json({ message: "Nível de acesso é obrigatório" });
      }

      const [validRole] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
      if (!validRole) {
        return res.status(400).json({ message: "Nível de acesso inválido" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await storage.createUser({
        nome: nome.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        tipoAtor: "agente_fidelizacao",
        mustChangePassword: true,
        status: "active",
      });

      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId: validRole.id,
        assignedBy: req.user!.userId,
      });

      await db.insert(auditLogs).values({
        userId: req.user!.userId,
        action: "create_user",
        resource: "users",
        resourceId: newUser.id,
        newValue: JSON.stringify({ nome: nome.trim(), email: normalizedEmail, role: validRole.name, roleId }),
        ipAddress: (req.ip || req.socket.remoteAddress || "unknown") as string,
        userAgent: (req.headers["user-agent"] || "unknown") as string,
      });

      const rbac = await getUserRolesAndPermissions(newUser.id);
      const { password: _, ...safeUser } = newUser;
      res.status(201).json({ ...safeUser, roles: rbac.roles, permissions: rbac.permissions });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.get("/api/admin/audit-logs", authenticateToken, checkPermission("view_audit_logs"), async (req: AuthRequest, res: Response) => {
    try {
      const { page = "1", limit = "50", resource, action } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;

      let query = db.select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        userName: usersTable.nome,
        userEmail: usersTable.email,
      }).from(auditLogs)
        .leftJoin(usersTable, eq(auditLogs.userId, usersTable.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitNum)
        .offset(offset);

      const logs = await query;

      const countResult = await db.select({
        count: sqlExpr`count(*)::int`,
      }).from(auditLogs);

      res.json({
        logs,
        total: countResult[0]?.count || 0,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ message: "Erro ao buscar logs de auditoria" });
    }
  });

  app.get("/api/admin/roles", authenticateToken, checkPermission("manage_roles"), async (req: AuthRequest, res: Response) => {
    try {
      const allRoles = await db.select().from(roles).orderBy(roles.name);

      const rolesWithPermissions = await Promise.all(
        allRoles.map(async (role) => {
          const perms = await db
            .select({ name: permissions.name, description: permissions.description })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, role.id));
          return { ...role, permissions: perms };
        })
      );

      res.json(rolesWithPermissions);
    } catch (error) {
      console.error("Get roles error:", error);
      res.status(500).json({ message: "Erro ao buscar roles" });
    }
  });

  // ==================== CRM PIPELINE ROUTES ====================

  app.get("/api/crm/contacts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { stage } = req.query;
      let contacts;
      if (stage && typeof stage === "string") {
        contacts = await storage.getUnifiedContactsByStage(req.user!.userId, stage);
      } else {
        contacts = await storage.getUnifiedContactsByUser(req.user!.userId);
      }
      const contactsWithIdentifiers = await Promise.all(
        contacts.map(async (contact) => {
          const identifiers = await storage.getContactIdentifiers(contact.id);
          return { ...contact, identifiers };
        })
      );
      res.json(contactsWithIdentifiers);
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ message: "Erro ao buscar contatos" });
    }
  });

  app.get("/api/crm/contacts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contactId = req.params.id as string;
      const contact = await storage.getUnifiedContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      const identifiers = await storage.getContactIdentifiers(contact.id);
      const recentMessages = await storage.getOmnichannelMessages(contact.id, 20);
      res.json({ ...contact, identifiers, recentMessages });
    } catch (error) {
      console.error("Get contact error:", error);
      res.status(500).json({ message: "Erro ao buscar contato" });
    }
  });

  app.post("/api/crm/contacts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertUnifiedContactSchema.parse({
        ...req.body,
        userId: req.user!.userId,
      });
      const existing = await storage.findUnifiedContactByPhoneOrEmail(
        req.user!.userId,
        data.telefone || undefined,
        data.email || undefined
      );
      if (existing) {
        return res.status(409).json({ message: "Contato com este telefone ou email já existe", existing });
      }
      const contact = await storage.createUnifiedContact(data);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Create contact error:", error);
      res.status(500).json({ message: "Erro ao criar contato" });
    }
  });

  app.patch("/api/crm/contacts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = updateUnifiedContactSchema.parse(req.body);
      const updated = await storage.updateUnifiedContact(req.params.id as string, data);
      if (!updated) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Update contact error:", error);
      res.status(500).json({ message: "Erro ao atualizar contato" });
    }
  });

  app.patch("/api/crm/contacts/:id/stage", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { stage } = req.body;
      if (!stage) {
        return res.status(400).json({ message: "Stage é obrigatório" });
      }
      const updated = await storage.updateUnifiedContact(req.params.id as string, { pipelineStage: stage });
      if (!updated) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update stage error:", error);
      res.status(500).json({ message: "Erro ao atualizar estágio" });
    }
  });

  app.patch("/api/crm/contacts/:id/temperature", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { temperature } = req.body;
      if (!temperature) {
        return res.status(400).json({ message: "Temperature é obrigatório" });
      }
      const updated = await storage.updateUnifiedContact(req.params.id as string, { temperature });
      if (!updated) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update temperature error:", error);
      res.status(500).json({ message: "Erro ao atualizar temperatura" });
    }
  });

  app.delete("/api/crm/contacts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteUnifiedContact(req.params.id as string);
      if (!deleted) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      res.json({ message: "Contato removido" });
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ message: "Erro ao remover contato" });
    }
  });

  app.post("/api/crm/contacts/:id/identifiers", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertContactIdentifierSchema.parse({
        ...req.body,
        unifiedContactId: req.params.id,
      });
      const identifier = await storage.createContactIdentifier(data);
      res.status(201).json(identifier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Create identifier error:", error);
      res.status(500).json({ message: "Erro ao criar identificador" });
    }
  });

  app.get("/api/crm/dashboard", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const stats = await storage.getDashboardStats(req.user!.userId);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  app.get("/api/crm/pipeline/summary", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const summary = await storage.getPipelineSummary(req.user!.userId);
      res.json(summary);
    } catch (error) {
      console.error("Pipeline summary error:", error);
      res.status(500).json({ message: "Erro ao buscar resumo do pipeline" });
    }
  });

  app.get("/api/crm/contacts/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const messagesResult = await storage.getOmnichannelMessages(req.params.id as string, limit);
      res.json(messagesResult);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  // ==================== AI INTENT DETECTION ====================

  app.post("/api/ai/detect-intent", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { message, contactId } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Mensagem é obrigatória" });
      }

      if (contactId) {
        const result = await processMessageIntent(
          message,
          contactId,
          req.user!.userId,
          storage
        );
        return res.json(result);
      }

      const result = await detectIntent(message);
      res.json(result);
    } catch (error) {
      console.error("Intent detection error:", error);
      res.status(500).json({ message: "Erro na detecção de intenção" });
    }
  });

  // ==================== QUICK REPLIES ====================

  app.get("/api/quick-replies", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const replies = await storage.getQuickRepliesByUser(req.user!.userId);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching quick replies:", error);
      res.status(500).json({ message: "Erro ao buscar respostas rápidas" });
    }
  });

  app.post("/api/quick-replies", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertQuickReplySchema.parse({ ...req.body, userId: req.user!.userId });
      const reply = await storage.createQuickReply(data);
      res.status(201).json(reply);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating quick reply:", error);
      res.status(500).json({ message: "Erro ao criar resposta rápida" });
    }
  });

  app.put("/api/quick-replies/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getQuickReply(id);
      if (!existing || existing.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Resposta rápida não encontrada" });
      }
      const data = updateQuickReplySchema.parse(req.body);
      const updated = await storage.updateQuickReply(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating quick reply:", error);
      res.status(500).json({ message: "Erro ao atualizar resposta rápida" });
    }
  });

  app.delete("/api/quick-replies/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getQuickReply(id);
      if (!existing || existing.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Resposta rápida não encontrada" });
      }
      await storage.deleteQuickReply(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting quick reply:", error);
      res.status(500).json({ message: "Erro ao excluir resposta rápida" });
    }
  });

  // ==================== AUTOMATION FLOWS ====================

  app.get("/api/automation-flows", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const flows = await storage.getAutomationFlowsByUser(req.user!.userId);
      res.json(flows);
    } catch (error) {
      console.error("Error fetching automation flows:", error);
      res.status(500).json({ message: "Erro ao buscar fluxos de automação" });
    }
  });

  app.post("/api/automation-flows", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertAutomationFlowSchema.parse({ ...req.body, userId: req.user!.userId });
      const flow = await storage.createAutomationFlow(data);
      res.status(201).json(flow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating automation flow:", error);
      res.status(500).json({ message: "Erro ao criar fluxo de automação" });
    }
  });

  app.put("/api/automation-flows/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getAutomationFlow(id);
      if (!existing || existing.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Fluxo de automação não encontrado" });
      }
      const data = updateAutomationFlowSchema.parse(req.body);
      const updated = await storage.updateAutomationFlow(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating automation flow:", error);
      res.status(500).json({ message: "Erro ao atualizar fluxo de automação" });
    }
  });

  app.delete("/api/automation-flows/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getAutomationFlow(id);
      if (!existing || existing.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Fluxo de automação não encontrado" });
      }
      await storage.deleteAutomationFlow(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting automation flow:", error);
      res.status(500).json({ message: "Erro ao excluir fluxo de automação" });
    }
  });

  // ==================== BRANDING CONFIG ====================

  app.get("/api/branding", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getBrandingConfig(req.user!.userId);
      res.json(config || { companyName: null, primaryColor: "#00A86B", secondaryColor: "#1B3A57", logoUrl: null, faviconUrl: null });
    } catch (error) {
      console.error("Error fetching branding config:", error);
      res.status(500).json({ message: "Erro ao buscar configuração de branding" });
    }
  });

  app.put("/api/branding", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const data = updateBrandingConfigSchema.parse(req.body);
      const config = await storage.upsertBrandingConfig(req.user!.userId, data);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating branding config:", error);
      res.status(500).json({ message: "Erro ao atualizar branding" });
    }
  });

  // ==================== FILE UPLOAD ====================

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use("/uploads", express.static(uploadsDir));

  const uploadStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  });

  const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Tipo de arquivo não permitido. Use PNG, JPG, GIF ou WebP."));
      }
    },
  });

  app.post("/api/upload", authenticateToken, (req: AuthRequest, res: Response, next: Function) => {
    upload.single("file")(req as any, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "Arquivo muito grande. Limite: 5MB." });
        }
        return res.status(400).json({ message: err.message || "Erro no upload" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, filename: req.file.filename });
    });
  });

  // ==================== WEBHOOK ROUTES ====================

  // ---- Z-API Dedicated Webhook ----
  app.options("/api/webhooks/zapi", (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.status(200).end();
  });

  app.post("/api/webhooks/zapi", async (req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");

    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        log("Z-API webhook received with empty body", "zapi-webhook");
        return res.status(200).json({ received: true, message: "Empty body" });
      }

      const { phone, type, text, messageId, senderName, chatName, fromMe, isGroup } = req.body;

      log(`Z-API Webhook: type=${type} phone=${phone || "N/A"}`, "zapi-webhook");

      if (isGroup) {
        log(`Skipping group message from ${phone}`, "zapi-webhook");
        return res.status(200).json({ received: true, message: "Group message skipped" });
      }

      if (req.body.notification) {
        log(`Skipping notification: ${req.body.notification}`, "zapi-webhook");
        return res.status(200).json({ received: true, message: "Notification skipped" });
      }

      if (type === "ReceivedCallback" && !fromMe && phone) {
        let messageContent = "[Mensagem]";
        if (text?.message) {
          messageContent = text.message;
        } else if (req.body.image?.caption) {
          messageContent = req.body.image.caption;
        } else if (req.body.image) {
          messageContent = "[Imagem]";
        } else if (req.body.audio) {
          messageContent = "[Áudio]";
        } else if (req.body.video) {
          messageContent = req.body.video.caption || "[Vídeo]";
        } else if (req.body.document) {
          messageContent = "[Documento]";
        } else if (req.body.sticker) {
          messageContent = "[Sticker]";
        } else if (req.body.contact) {
          messageContent = "[Contato]";
        } else if (req.body.location) {
          messageContent = "[Localização]";
        }

        const remoteJid = `${phone}@s.whatsapp.net`;
        const contactName = senderName || chatName || phone;

        const adminUser = await storage.getUserByEmail("admin@quantaflow.com");
        const userId = adminUser?.id;

        if (userId) {
          let conversation = await storage.getConversationByRemoteJid(userId, remoteJid);

          if (!conversation) {
            conversation = await storage.createConversation({
              userId,
              remoteJid,
              contactName,
              contactPhone: phone,
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
              contactName: contactName || conversation.contactName,
            });
          }

          const newMessage = await storage.createMessage({
            conversationId: conversation.id,
            userId,
            messageId: messageId || `zapi_${Date.now()}`,
            direction: "incoming",
            content: messageContent,
            timestamp: new Date(),
          });

          log(`Z-API message saved: ${newMessage.id} from ${phone}`, "zapi-webhook");

          emitMessageReceived(userId, {
            message: newMessage,
            conversation: await storage.getConversation(conversation.id),
          });

          if (messageContent && !["[Mensagem]", "[Imagem]", "[Sticker]", "[Contato]", "[Localização]"].includes(messageContent)) {
            try {
              let crmContact = await storage.findUnifiedContactByIdentifier(userId, "whatsapp", phone);
              if (!crmContact) {
                crmContact = await storage.findUnifiedContactByPhoneOrEmail(userId, phone);
              }

              if (!crmContact) {
                crmContact = await storage.createUnifiedContact({
                  userId,
                  nome: contactName || phone,
                  telefone: phone,
                  pipelineStage: "novo",
                  temperature: "frio",
                  lastIntent: "indefinido",
                });
                await storage.createContactIdentifier({
                  unifiedContactId: crmContact.id,
                  channelType: "whatsapp",
                  identifier: phone,
                  displayName: contactName || phone,
                });
                log(`CRM: Auto-created contact ${crmContact.id} for ${phone}`, "zapi-webhook");
              }

              const intentResult = await processMessageIntent(
                messageContent,
                crmContact.id,
                userId,
                storage
              );

              if (intentResult) {
                await storage.createOmnichannelMessage({
                  unifiedContactId: crmContact.id,
                  channelType: "whatsapp",
                  direction: "incoming",
                  content: messageContent,
                  externalMessageId: messageId || `zapi_${Date.now()}`,
                  detectedIntent: intentResult.intent,
                  intentConfidence: String(intentResult.confidence),
                  userId,
                  timestamp: new Date(),
                });
                log(`CRM Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(0)}%) - ${intentResult.reasoning}`, "zapi-webhook");
              }
            } catch (intentError) {
              console.error("CRM/Intent processing error (non-blocking):", intentError);
            }
          }
        }
      }

      if (type === "SentCallback" && fromMe && phone) {
        log(`Z-API sent confirmation for ${phone}`, "zapi-webhook");
      }

      if (type === "MessageStatusCallback") {
        const status = req.body.status;
        log(`Z-API message status: ${status} for messageId=${messageId}`, "zapi-webhook");
      }

      if (type === "ConnectedCallback") {
        log(`Z-API instance connected`, "zapi-webhook");
        const adminUser2 = await storage.getUserByEmail("admin@quantaflow.com");
        if (adminUser2) {
          emitInstanceConnected(adminUser2.id, { status: "connected" });
        }
      }

      if (type === "DisconnectedCallback") {
        log(`Z-API instance disconnected: ${req.body.reason || "unknown"}`, "zapi-webhook");
      }

      if (type === "PresenceChatCallback") {
        log(`Z-API presence: ${req.body.presence} for ${phone}`, "zapi-webhook");
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Z-API webhook error:", error);
      return res.status(200).json({ received: true, error: "Processing error" });
    }
  });

  // ---- Evolution API Webhook (legacy) ----
  app.options("/webhooks/evolution", (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.status(200).end();
  });

  app.post("/webhooks/evolution", async (req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");

    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        log("Evolution webhook received with empty body", "webhook");
        return res.status(200).json({ received: true, message: "Empty body" });
      }

      // Evolution API webhook format
      const body = req.body.data ? req.body.data : req.body;
      const event = body.event || req.body.event;
      const data = body.data || body;
      const instance = body.instance || req.body.instance || body.instanceName;
      
      log(`Evolution Webhook received: ${event} for instance ${instance}`, "webhook");
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

  // Auto-refresh Z-API webhook URLs ONLY in production (when WEBHOOK_BASE_URL is set)
  // In development, use the "Refresh Webhooks" button manually to avoid
  // stealing webhooks from production when both servers start simultaneously
  if (process.env.WEBHOOK_BASE_URL) {
    setTimeout(async () => {
      try {
        const configs = await getAllEvolutionConfigs();
        const currentWebhookUrl = getWebhookUrl();
        log(`Auto-refresh (production): Webhook URL: ${currentWebhookUrl}`, "zapi");

        for (const config of configs) {
          if (
            config.status === "connected" &&
            config.evolutionUrl?.includes("z-api.io")
          ) {
            log(`Auto-refresh: Configuring Z-API webhooks to ${currentWebhookUrl} for user ${config.userId}`, "zapi");

            const urlParts = config.evolutionUrl.match(/instances\/([^/]+)\/token\/([^/]+)/);
            if (urlParts) {
              const [, instanceId, token] = urlParts;
              const { failedCount } = await configureZApiWebhooks(instanceId, token, config.globalToken, currentWebhookUrl);

              if (failedCount === 0) {
                if (config.webhookUrl !== currentWebhookUrl) {
                  await storage.updateEvolutionConfig(config.userId, { webhookUrl: currentWebhookUrl });
                }
                log(`Auto-refresh: Webhooks configured successfully for user ${config.userId}`, "zapi");
              } else {
                log(`Auto-refresh: ${failedCount} webhooks failed for user ${config.userId}`, "zapi");
              }
            } else {
              log(`Auto-refresh: Could not parse instanceId/token from ${config.evolutionUrl}`, "zapi");
            }
          }
        }
      } catch (error) {
        console.error("Auto-refresh webhooks error:", error);
      }
    }, 5000);
  } else {
    log("Auto-refresh skipped: WEBHOOK_BASE_URL not set (development mode). Use 'Refresh Webhooks' button to update manually.", "zapi");
  }

  return httpServer;
}

async function getAllEvolutionConfigs() {
  const { db } = await import("./db");
  const { evolutionConfigs } = await import("@shared/schema");
  return db.select().from(evolutionConfigs);
}
