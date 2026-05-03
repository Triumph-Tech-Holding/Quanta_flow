import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertUserSchema, loginUserSchema, insertLeadSchema, updateLeadSchema, insertApiConfigSchema, connectEvolutionSchema, connectZApiSchema, insertSettingSchema, updateSettingSchema, insertUnifiedContactSchema, updateUnifiedContactSchema, insertContactIdentifierSchema, insertQuickReplySchema, updateQuickReplySchema, insertAutomationFlowSchema, updateAutomationFlowSchema, updateBrandingConfigSchema, insertLearningTrackSchema, updateLearningTrackSchema, insertOutboundWebhookSchema, updateOutboundWebhookSchema, insertSheetIntegrationSchema, updateSheetIntegrationSchema, insertEmailConfigSchema, insertAiAgentSchema, updateAiAgentSchema, insertCampaignSchema, updateCampaignSchema, insertMessageTemplateSchema, updateMessageTemplateSchema, unifiedContacts } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";
import { createEvolutionService } from "./services/evolutionService";
import { emitMessageReceived, emitInstanceConnected, emitSettingsRefresh } from "./socket";
import { configService } from "./services/configService";
import { checkPermission, checkRole, getUserRolesAndPermissions } from "./middleware/rbacMiddleware";
import { log } from "./index";
import { db } from "./db";
import { users as usersTable, auditLogs, roles, userRoles, rolePermissions, permissions, flowTemplates, campaigns as campaignsTable } from "@shared/schema";
import { eq, desc, and, sql as sqlExpr } from "drizzle-orm";
import { detectIntent, processMessageIntent } from "./services/intentService";
import { getWhatsAppProvider, BaileysProvider, getBaileysInstance } from "./services/whatsappProvider";
import { processIncomingWhatsAppMessage, processIncomingMessage } from "./services/messageProcessor";
import { dispatchEvent } from "./services/webhookDispatcher";
import { sendTelegramMessage, registerTelegramWebhook, getTelegramBotInfo } from "./services/telegramService";
import { verifyInstagramWebhook } from "./services/instagramService";
import { testSmtpConnection } from "./services/emailService";
import { appendRow, mapContactToRow } from "./services/googleSheetsService";
import os from "os";

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

const BLOCK_COLORS: Record<string, string> = {
  text: "#3b82f6", audio_tts: "#8b5cf6", image_ai: "#ec4899", delay: "#f59e0b",
  condition: "#10b981", ai_agent: "#6366f1", webhook: "#64748b", queue_entry: "#ef4444",
  resolve: "#22c55e", update_lead: "#0ea5e9",
};
const BLOCK_EMOJI: Record<string, string> = {
  text: "💬", audio_tts: "🎵", image_ai: "🖼️", delay: "⏱️", condition: "🔀",
  ai_agent: "🤖", webhook: "🔗", queue_entry: "🚦", resolve: "✅", update_lead: "📊",
};
const VALID_BLOCK_TYPES = Object.keys(BLOCK_COLORS);

function generateFlowThumbnail(blocks: Array<{ type: string; label?: string }>): string {
  const nodeHeight = 32;
  const nodeWidth = 140;
  const gap = 12;
  const padding = 16;
  const totalH = blocks.length * (nodeHeight + gap) - gap + padding * 2;
  const svgW = nodeWidth + padding * 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}">`;
  svg += `<rect width="${svgW}" height="${totalH}" fill="#1e1e2e" rx="8"/>`;

  blocks.forEach((block, i) => {
    const y = padding + i * (nodeHeight + gap);
    const color = BLOCK_COLORS[block.type] || "#64748b";
    const emoji = BLOCK_EMOJI[block.type] || "📦";
    const lbl = (block.label || block.type).slice(0, 16);
    svg += `<rect x="${padding}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${color}" rx="6" opacity="0.9"/>`;
    svg += `<text x="${padding + 8}" y="${y + 21}" fill="white" font-size="11" font-family="sans-serif">${emoji} ${lbl}</text>`;
    if (i < blocks.length - 1) {
      const lineX = padding + nodeWidth / 2;
      svg += `<line x1="${lineX}" y1="${y + nodeHeight}" x2="${lineX}" y2="${y + nodeHeight + gap}" stroke="#555" stroke-width="2"/>`;
    }
  });

  svg += `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
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

  // ==================== PUBLIC ROUTES (no auth) ====================

  app.get("/api/public/flow/:token", async (req: Request, res: Response) => {
    try {
      const flow = await storage.getFlowByShareToken(req.params.token);
      if (!flow) return res.status(404).json({ message: "Fluxo não encontrado" });
      res.json({ id: flow.id, name: flow.name, description: flow.initialMessage || "", isActive: flow.isActive });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar fluxo" });
    }
  });

  app.post("/api/public/flow/:token/enroll", async (req: Request, res: Response) => {
    try {
      const flow = await storage.getFlowByShareToken(req.params.token);
      if (!flow) return res.status(404).json({ message: "Fluxo não encontrado" });
      if (!flow.isActive) return res.status(400).json({ message: "Fluxo inativo" });
      const { name, phone } = req.body;
      if (!phone) return res.status(400).json({ message: "Telefone é obrigatório" });
      let contact = await storage.findUnifiedContactByPhoneOrEmail(flow.userId, phone);
      if (!contact) {
        contact = await storage.createUnifiedContact({
          userId: flow.userId,
          nome: name || phone,
          telefone: phone,
          channel: "whatsapp",
          activeFlowId: flow.id,
        });
      } else {
        await storage.updateUnifiedContact(contact.id, { activeFlowId: flow.id });
      }
      res.json({ success: true, message: "Inscrito com sucesso" });
    } catch (error) {
      console.error("Error enrolling in flow:", error);
      res.status(500).json({ message: "Erro ao inscrever no fluxo" });
    }
  });

  app.get("/api/public/campaign/:token", async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getCampaignByShareToken(req.params.token);
      if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
      res.json({ id: campaign.id, name: campaign.name, description: campaign.description || "", status: campaign.status });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar campanha" });
    }
  });

  app.post("/api/public/campaign/:token/enroll", async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getCampaignByShareToken(req.params.token);
      if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
      if (campaign.status === "completed") return res.status(400).json({ message: "Campanha encerrada" });
      const { name, phone } = req.body;
      if (!phone) return res.status(400).json({ message: "Telefone é obrigatório" });
      let contact = await storage.findUnifiedContactByPhoneOrEmail(campaign.userId, phone);
      if (!contact) {
        contact = await storage.createUnifiedContact({
          userId: campaign.userId,
          nome: name || phone,
          telefone: phone,
          channel: "whatsapp",
        });
      }
      const { db } = await import("./db");
      const { campaignDeliveries } = await import("@shared/schema");
      const { v4: uuidv4 } = await import("uuid");
      await db.insert(campaignDeliveries).values({
        id: uuidv4(),
        campaignId: campaign.id,
        contactId: contact.id,
        channel: "whatsapp",
        status: "pending",
        messageIndex: 0,
      }).onConflictDoNothing();
      res.json({ success: true, message: "Inscrito na campanha com sucesso" });
    } catch (error) {
      console.error("Error enrolling in campaign:", error);
      res.status(500).json({ message: "Erro ao inscrever na campanha" });
    }
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

  // ─── WhatsApp Provider Management ─────────────────────────────────────────

  app.get("/api/whatsapp-provider", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = await storage.getEvolutionConfig(userId);
      const activeProvider = config?.activeProvider || "none";
      let connected = config?.status === "connected";
      if (activeProvider === "baileys") {
        const baileysInst = getBaileysInstance(userId);
        connected = baileysInst?.connected === true;
      }
      res.json({ activeProvider, connected });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.post("/api/whatsapp-provider/switch", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { provider } = req.body as { provider: "zapi" | "baileys" | "evolution" | "meta" | "none" };
      if (!["zapi", "baileys", "evolution", "meta", "none"].includes(provider)) {
        return res.status(400).json({ message: "Provider inválido" });
      }
      await storage.updateEvolutionConfig(userId, {
        activeProvider: provider as any,
        status: provider === "none" ? "disconnected" : undefined,
      });
      log(`Provider switched to ${provider} for user ${userId}`, "provider");
      res.json({ activeProvider: provider });
    } catch (error) {
      console.error("Switch provider error:", error);
      res.status(500).json({ message: "Erro ao trocar provedor" });
    }
  });

  // ─── Baileys (WhatsApp Local) Management ───────────────────────────────────

  app.post("/api/whatsapp-local/connect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      let config = await storage.getEvolutionConfig(userId);

      if (!config) {
        config = await storage.createEvolutionConfig({
          userId,
          evolutionUrl: "local://baileys",
          globalToken: "baileys",
          instanceName: `baileys_${userId.substring(0, 8)}`,
          activeProvider: "baileys",
        } as any);
      } else {
        await storage.updateEvolutionConfig(userId, { activeProvider: "baileys" as any });
      }

      const baileysProvider = new BaileysProvider(userId);
      baileysProvider.connect().catch((err: unknown) => log(`Baileys bg connect error: ${err}`, "baileys"));

      res.json({ message: "Baileys iniciando — aguarde o QR Code", provider: "baileys" });
    } catch (error) {
      console.error("Baileys connect error:", error);
      res.status(500).json({ message: "Erro ao conectar WhatsApp Local" });
    }
  });

  app.post("/api/whatsapp-local/disconnect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const baileysProvider = new BaileysProvider(userId);
      await baileysProvider.disconnect();
      res.json({ message: "WhatsApp Local desconectado" });
    } catch (error) {
      console.error("Baileys disconnect error:", error);
      res.status(500).json({ message: "Erro ao desconectar" });
    }
  });

  app.get("/api/whatsapp-local/qrcode", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const instance = getBaileysInstance(userId);
      if (!instance) {
        return res.json({ qrCode: null, connected: false, message: "Baileys não iniciado" });
      }
      res.json({
        qrCode: instance.qrCode,
        connected: instance.connected,
        phoneNumber: instance.phoneNumber || null,
        message: instance.connected ? "Conectado" : instance.qrCode ? "Aguardando scan" : "Inicializando",
      });
    } catch (error) {
      console.error("Get QR code error:", error);
      res.status(500).json({ message: "Erro ao buscar QR Code" });
    }
  });

  // ─── Agent Assignment ──────────────────────────────────────────────────────

  app.get("/api/users/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const agents = await storage.getActiveAgents();
      res.json(agents.map(a => ({ id: a.id, nome: a.nome, email: a.email, tipoAtor: a.tipoAtor })));
    } catch (error) {
      console.error("Get agents error:", error);
      res.status(500).json({ message: "Erro ao buscar agentes" });
    }
  });

  app.patch("/api/crm/contacts/:id/assign", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contactId = req.params.id as string;
      const { assignedToUserId } = req.body as { assignedToUserId: string | null };
      const contact = await storage.getUnifiedContact(contactId);
      if (!contact || contact.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      const updated = await storage.assignContactToUser(contactId, assignedToUserId || null);
      res.json(updated);
    } catch (error) {
      console.error("Assign contact error:", error);
      res.status(500).json({ message: "Erro ao atribuir contato" });
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
      if (!config) {
        return res.status(400).json({ message: "WhatsApp não configurado" });
      }
      const baileysInst = getBaileysInstance(userId);
      const baileysOk = baileysInst?.connected === true;
      if (config.status !== "connected" && !baileysOk) {
        return res.status(400).json({ message: "WhatsApp não conectado" });
      }

      let messageId = `msg_${Date.now()}`;

      try {
        const provider = await getWhatsAppProvider(userId);
        const phone = conversation.contactPhone?.replace(/\D/g, "") || conversation.remoteJid.replace("@s.whatsapp.net", "");
        const result = await provider.sendMessage(phone, content);
        messageId = result.messageId;
        log(`Message sent to ${phone} via active provider: ${messageId}`, "provider");
      } catch (sendErr) {
        log(`Provider send failed, falling back: ${sendErr}`, "provider");
        if (config.evolutionUrl.includes("z-api.io")) {
          const phone = conversation.contactPhone?.replace(/\D/g, "") || conversation.remoteJid.replace("@s.whatsapp.net", "");
          const sendUrl = `${config.evolutionUrl}/send-text`;
          const response = await fetch(sendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": config.globalToken },
            body: JSON.stringify({ phone, message: content }),
          });
          if (!response.ok) throw new Error("Erro ao enviar mensagem via Z-API");
          const result = await response.json() as { messageId?: string };
          messageId = result.messageId || messageId;
        } else {
          const service = createEvolutionService(config.evolutionUrl, config.globalToken);
          const result = await service.sendMessage(config.instanceName, conversation.remoteJid, content);
          messageId = result.key.id;
        }
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

  app.post("/api/crm/contacts/:id/trigger-flow", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contact = await storage.getUnifiedContact(req.params.id as string);
      if (!contact || contact.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      const { flowId } = req.body;
      if (!flowId) return res.status(400).json({ message: "flowId é obrigatório" });
      const flow = await storage.getAutomationFlow(flowId);
      if (!flow || flow.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Fluxo não encontrado" });
      }
      if (!flow.isActive) return res.status(400).json({ message: "Fluxo inativo" });
      await storage.updateUnifiedContact(contact.id, { activeFlowId: flow.id });
      res.json({ success: true, message: `Fluxo "${flow.name}" enviado para ${contact.nome}` });
    } catch (error) {
      console.error("Error triggering flow:", error);
      res.status(500).json({ message: "Erro ao enviar fluxo" });
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

  // ==================== FLOW BUILDER ENDPOINTS ====================

  const FLOW_BLOCK_TYPES_DESCRIPTION = `
Block types:
- text: { message: string, variables?: string[] } — Send text message with optional variable interpolation
- audio_tts: { message: string, voice?: string } — Generate and send TTS audio
- image_ai: { prompt: string } — Generate and send DALL-E image
- delay: { delaySeconds: number } — Wait before next block
- condition: { conditionType: "keyword"|"intent"|"temperature"|"score", conditionValue: string } — Branch flow (conditionTrueId/conditionFalseId)
- ai_agent: { agentId?: string } — Generate dynamic AI response
- webhook: { webhookUrl: string, webhookMethod: "GET"|"POST" } — Call external webhook
- queue_entry: { slaMinutes?: number } — Enter human queue with SLA
- resolve: {} — Mark contact as resolved
- update_lead: { leadStage?, leadTemperature?, leadTag?, leadScore? } — Update lead data`;

  app.post("/api/admin/flows/generate", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { description, agentId } = req.body;
      if (!description || typeof description !== "string") {
        return res.status(400).json({ message: "Descrição é obrigatória" });
      }

      let agentContext = "";
      if (agentId) {
        const agent = await storage.getAiAgent(agentId);
        if (agent && agent.userId === req.user.userId) {
          agentContext = `\nInclude an ai_agent block with agentId "${agentId}" (agent name: "${agent.name}", specialty: "${agent.specialty || "general"}") where the flow needs AI-powered responses.`;
        }
      }

      const genOpenai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await genOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a flow builder assistant. Given a description of a business automation flow, generate a JSON array of flow blocks.
Each block has: { id: string (use "block_1", "block_2", etc.), type: string, label: string, config: object, position: { x: number, y: number }, nextBlockId: string|null, conditionTrueId?: string|null, conditionFalseId?: string|null }
${FLOW_BLOCK_TYPES_DESCRIPTION}
Position blocks in a vertical layout, starting at x:250, y:50 with 150px vertical spacing. For conditions, branch right (x+250) for true and left (x-250) for false.${agentContext}
Return ONLY the JSON array, no markdown.`,
          },
          { role: "user", content: description },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "[]";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let blocks: Array<{ id: string; type: string; label?: string; config: Record<string, unknown>; position?: { x: number; y: number }; nextBlockId?: string | null; conditionTrueId?: string | null; conditionFalseId?: string | null }>;
      try {
        blocks = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({ message: "IA gerou resposta inválida. Tente reformular." });
      }
      if (!Array.isArray(blocks)) {
        return res.status(422).json({ message: "IA não retornou um array de blocos." });
      }
      blocks = blocks.filter((b) => b && typeof b.id === "string" && VALID_BLOCK_TYPES.includes(b.type)).map((b) => ({
        id: b.id,
        type: b.type,
        label: b.label || b.type,
        config: b.config || {},
        position: b.position || { x: 250, y: 50 },
        nextBlockId: b.nextBlockId || null,
        conditionTrueId: b.conditionTrueId || null,
        conditionFalseId: b.conditionFalseId || null,
      }));
      if (blocks.length === 0) {
        return res.status(422).json({ message: "Nenhum bloco válido gerado. Tente uma descrição mais detalhada." });
      }
      res.json({ blocks });
    } catch (err) {
      console.error("[POST /api/admin/flows/generate]", err);
      res.status(500).json({ message: "Erro ao gerar fluxo com IA" });
    }
  });

  app.post("/api/flows/tts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { text, voice, format } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Campo 'text' é obrigatório" });
      }
      const { generateFlowTts } = await import("./services/ttsService");
      const buffer = await generateFlowTts(text, voice || "nova");

      if (format === "url") {
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const filename = `tts_${Date.now()}.mp3`;
        const filePath = path.default.join(os.default.tmpdir(), filename);
        fs.default.writeFileSync(filePath, buffer);
        const baseUrl = req.protocol + "://" + req.get("host");
        res.json({ audioUrl: `${baseUrl}/api/flows/tts/file/${filename}`, duration: Math.ceil(buffer.length / 16000) });
        setTimeout(() => { try { fs.default.unlinkSync(filePath); } catch {} }, 300000);
      } else {
        res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length.toString() });
        res.send(buffer);
      }
    } catch (err) {
      console.error("[POST /api/flows/tts]", err);
      res.status(500).json({ message: "Erro ao gerar áudio TTS" });
    }
  });

  app.get("/api/flows/tts/file/:filename", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const basename = path.default.basename(req.params.filename);
      if (!/^tts_\d+\.mp3$/.test(basename)) {
        return res.status(400).json({ message: "Nome de arquivo inválido" });
      }
      const filePath = path.default.join(os.default.tmpdir(), basename);
      if (!fs.default.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
      res.set({ "Content-Type": "audio/mpeg" });
      res.sendFile(filePath);
    } catch {
      res.status(500).json({ message: "Erro ao servir áudio" });
    }
  });

  app.post("/api/flows/image-gen", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ message: "Campo 'prompt' é obrigatório" });
      }
      const imgOpenai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const imageResponse = await imgOpenai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 1000),
        n: 1,
        size: "1024x1024",
      });
      const imageUrl = imageResponse.data[0]?.url || null;
      res.json({ imageUrl });
    } catch (err) {
      console.error("[POST /api/flows/image-gen]", err);
      res.status(500).json({ message: "Erro ao gerar imagem" });
    }
  });

  app.get("/api/admin/flows/templates", authenticateToken, checkRole(["super_admin", "admin"]), async (_req: AuthRequest, res: Response) => {
    try {
      const templates = await db.select().from(flowTemplates).orderBy(flowTemplates.name);
      res.json(templates);
    } catch (err) {
      console.error("[GET /api/admin/flows/templates]", err);
      res.status(500).json({ message: "Erro ao buscar templates" });
    }
  });

  app.post("/api/automation-flows/:id/export", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const flow = await storage.getAutomationFlow(req.params.id);
      if (!flow || flow.userId !== req.user.userId) {
        return res.status(404).json({ message: "Fluxo não encontrado" });
      }
      const { id, userId, createdAt, updatedAt, ...exportData } = flow;
      res.json(exportData);
    } catch (err) {
      res.status(500).json({ message: "Erro ao exportar fluxo" });
    }
  });

  app.post("/api/automation-flows/import", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { name, triggerKeywords, responseTemplate, blocks, ...rest } = req.body;
      if (!name) return res.status(400).json({ message: "Nome é obrigatório" });
      const data = insertAutomationFlowSchema.parse({
        name,
        triggerKeywords: triggerKeywords || "",
        responseTemplate: responseTemplate || " ",
        blocks: blocks || null,
        userId: req.user.userId,
        ...rest,
      });
      const flow = await storage.createAutomationFlow(data);
      res.status(201).json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: err.errors });
      }
      res.status(500).json({ message: "Erro ao importar fluxo" });
    }
  });

  // ==================== AUTOMATION FLOWS (LEGACY + NEW) ====================

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
      if (data.agentId) {
        const agent = await storage.getAiAgent(data.agentId);
        if (!agent || agent.userId !== req.user!.userId) {
          return res.status(400).json({ message: "Agente IA não encontrado ou não pertence a este usuário" });
        }
      }
      if (data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0) {
        const blockArr = data.blocks as Array<{ type: string; label?: string; config?: Record<string, unknown> }>;
        for (const block of blockArr) {
          if (block.type === "ai_agent" && block.config?.agentId) {
            const blockAgent = await storage.getAiAgent(block.config.agentId as string);
            if (!blockAgent || blockAgent.userId !== req.user!.userId) {
              return res.status(400).json({ message: `Agente IA "${block.config.agentId}" no bloco "${block.label}" não encontrado ou não pertence a este usuário` });
            }
          }
        }
        if (!data.thumbnail) {
          (data as Record<string, unknown>).thumbnail = generateFlowThumbnail(blockArr);
        }
      }
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
      if (data.agentId) {
        const agent = await storage.getAiAgent(data.agentId);
        if (!agent || agent.userId !== req.user!.userId) {
          return res.status(400).json({ message: "Agente IA não encontrado ou não pertence a este usuário" });
        }
      }
      if (data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0) {
        const blockArr = data.blocks as Array<{ type: string; label?: string; config?: Record<string, unknown> }>;
        for (const block of blockArr) {
          if (block.type === "ai_agent" && block.config?.agentId) {
            const blockAgent = await storage.getAiAgent(block.config.agentId as string);
            if (!blockAgent || blockAgent.userId !== req.user!.userId) {
              return res.status(400).json({ message: `Agente IA "${block.config.agentId}" no bloco "${block.label}" não encontrado ou não pertence a este usuário` });
            }
          }
        }
        if (!data.thumbnail) {
          data.thumbnail = generateFlowThumbnail(blockArr);
        }
      }
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

        const contactName = senderName || chatName || phone;

        const adminUser = await storage.getUserByEmail("admin@quantaflow.com");
        const userId = adminUser?.id;

        if (userId) {
          await processIncomingWhatsAppMessage({
            userId,
            phone,
            contactName,
            messageContent,
            messageId: messageId,
            provider: "zapi",
          });
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

  // ==================== Queue Endpoints ====================

  app.get("/api/queue", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const contacts = await storage.getQueueContacts(req.user!.userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar fila" });
    }
  });

  app.post("/api/queue/:contactId/assign", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { contactId } = req.params;
      const { agentId } = req.body;
      const targetAgent = agentId || req.user!.userId;
      const contact = await storage.assignContactToAgent(contactId, targetAgent);
      if (!contact) return res.status(404).json({ message: "Contato não encontrado" });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atribuir agente" });
    }
  });

  app.post("/api/queue/:contactId/resolve", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { contactId } = req.params;
      const contact = await storage.resolveContact(contactId, req.user!.userId);
      if (!contact) return res.status(404).json({ message: "Contato não encontrado" });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Erro ao resolver atendimento" });
    }
  });

  // ==================== Learning Tracks Endpoints ====================

  app.get("/api/learning-tracks", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const tracks = await storage.getLearningTracksByUser(req.user!.userId);
      res.json(tracks);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar trilhas" });
    }
  });

  app.post("/api/learning-tracks", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertLearningTrackSchema.safeParse({ ...req.body, userId: req.user!.userId });
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const track = await storage.createLearningTrack(parsed.data);
      res.status(201).json(track);
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar trilha" });
    }
  });

  app.put("/api/learning-tracks/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = updateLearningTrackSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const track = await storage.updateLearningTrack(req.params.id, parsed.data);
      if (!track) return res.status(404).json({ message: "Trilha não encontrada" });
      res.json(track);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar trilha" });
    }
  });

  app.delete("/api/learning-tracks/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteLearningTrack(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Trilha não encontrada" });
      res.json({ message: "Trilha removida" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover trilha" });
    }
  });

  // ─── Health Check ──────────────────────────────────────────────────────────

  app.get("/api/health", async (_req: Request, res: Response) => {
    let dbConnected = false;
    try {
      await db.execute(sqlExpr`SELECT 1`);
      dbConnected = true;
    } catch {}
    res.json({
      status: "ok",
      version: "5.0.0",
      uptime: Math.floor(process.uptime()),
      dbConnected,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Outbound Webhooks ─────────────────────────────────────────────────────

  app.get("/api/webhooks/outbound", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const webhooks = await storage.getOutboundWebhooks(req.user!.userId);
      res.json(webhooks);
    } catch { res.status(500).json({ message: "Erro ao listar webhooks" }); }
  });

  app.post("/api/webhooks/outbound", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertOutboundWebhookSchema.safeParse({ ...req.body, userId: req.user!.userId });
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const wh = await storage.createOutboundWebhook(parsed.data);
      res.status(201).json(wh);
    } catch { res.status(500).json({ message: "Erro ao criar webhook" }); }
  });

  app.put("/api/webhooks/outbound/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = updateOutboundWebhookSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const wh = await storage.updateOutboundWebhook(req.params.id, parsed.data);
      if (!wh) return res.status(404).json({ message: "Webhook não encontrado" });
      res.json(wh);
    } catch { res.status(500).json({ message: "Erro ao atualizar webhook" }); }
  });

  app.delete("/api/webhooks/outbound/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteOutboundWebhook(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Webhook não encontrado" });
      res.json({ message: "Webhook removido" });
    } catch { res.status(500).json({ message: "Erro ao remover webhook" }); }
  });

  app.post("/api/webhooks/outbound/:id/test", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const wh = await storage.getOutboundWebhook(req.params.id);
      if (!wh) return res.status(404).json({ message: "Webhook não encontrado" });
      const payload = JSON.stringify({
        event: "test",
        payload: { message: "Teste do Quanta Flow", timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Quanta-Event": "test" };
      if (wh.secret) {
        const crypto = await import("crypto");
        headers["X-Quanta-Signature"] = `sha256=${crypto.createHmac("sha256", wh.secret).update(payload).digest("hex")}`;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(wh.url, { method: "POST", headers, body: payload, signal: controller.signal });
        clearTimeout(timeout);
        let responseBody = "";
        try { responseBody = await response.text(); } catch { responseBody = ""; }
        await storage.updateOutboundWebhookStatus(wh.id, response.ok ? "success" : `error:${response.status}`);
        res.json({ ok: response.ok, status: response.status, responseBody: responseBody.slice(0, 500) });
      } catch (fetchErr) {
        clearTimeout(timeout);
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        await storage.updateOutboundWebhookStatus(wh.id, `error:${msg}`.slice(0, 100));
        res.status(502).json({ ok: false, message: msg });
      }
    } catch { res.status(500).json({ message: "Erro ao testar webhook" }); }
  });

  // ─── Google Sheets Integrations ────────────────────────────────────────────

  app.get("/api/integrations/sheets", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const integrations = await storage.getSheetIntegrations(req.user!.userId);
      res.json(integrations.map(i => ({ ...i, googleToken: i.googleToken ? "configured" : null })));
    } catch { res.status(500).json({ message: "Erro ao listar integrações" }); }
  });

  app.post("/api/integrations/sheets", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertSheetIntegrationSchema.safeParse({ ...req.body, userId: req.user!.userId });
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const si = await storage.createSheetIntegration(parsed.data);
      res.status(201).json(si);
    } catch { res.status(500).json({ message: "Erro ao criar integração" }); }
  });

  app.put("/api/integrations/sheets/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = updateSheetIntegrationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const si = await storage.updateSheetIntegration(req.params.id, parsed.data);
      if (!si) return res.status(404).json({ message: "Integração não encontrada" });
      res.json(si);
    } catch { res.status(500).json({ message: "Erro ao atualizar integração" }); }
  });

  app.delete("/api/integrations/sheets/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteSheetIntegration(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Integração não encontrada" });
      res.json({ message: "Integração removida" });
    } catch { res.status(500).json({ message: "Erro ao remover integração" }); }
  });

  app.get("/api/integrations/sheets/auth", authenticateToken, async (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) return res.status(400).json({ message: "GOOGLE_CLIENT_ID não configurado" });
    const { getAuthUrl } = await import("./services/googleSheetsService");
    const redirectUri = `${process.env.WEBHOOK_BASE_URL || "http://localhost:5000"}/api/integrations/sheets/callback`;
    res.json({ authUrl: getAuthUrl(clientId, redirectUri) });
  });

  app.get("/api/integrations/sheets/callback", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { code } = req.query;
    if (!code || typeof code !== "string") return res.status(400).json({ message: "Código inválido" });
    const { exchangeCodeForToken } = await import("./services/googleSheetsService");
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = `${process.env.WEBHOOK_BASE_URL || "http://localhost:5000"}/api/integrations/sheets/callback`;
    const tokens = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
    if (!tokens) return res.status(400).json({ message: "Falha ao trocar código por token" });
    res.json({ message: "Autenticação realizada com sucesso", token: tokens.access_token });
  });

  // ─── Email Config ──────────────────────────────────────────────────────────

  app.get("/api/settings/email", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const cfg = await storage.getEmailConfig(req.user!.userId);
      if (!cfg) return res.json(null);
      res.json({ ...cfg, smtpPass: cfg.smtpPass ? "••••••••" : "" });
    } catch { res.status(500).json({ message: "Erro ao buscar config de e-mail" }); }
  });

  app.post("/api/settings/email", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertEmailConfigSchema.safeParse({ ...req.body, userId: req.user!.userId });
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.errors });
      const cfg = await storage.upsertEmailConfig(req.user!.userId, parsed.data);
      res.json({ ...cfg, smtpPass: "••••••••" });
    } catch { res.status(500).json({ message: "Erro ao salvar config de e-mail" }); }
  });

  app.post("/api/settings/email/test", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
      if (!smtpHost || !smtpUser || !smtpPass) return res.status(400).json({ message: "Dados incompletos" });
      const ok = await testSmtpConnection({ smtpHost, smtpPort: Number(smtpPort) || 587, smtpUser, smtpPass });
      res.json({ ok, message: ok ? "Conexão estabelecida com sucesso" : "Falha na conexão SMTP" });
    } catch { res.status(500).json({ message: "Erro ao testar conexão" }); }
  });

  // ─── Telegram Webhook ──────────────────────────────────────────────────────

  app.post("/api/webhooks/telegram", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true });
      const update = req.body;
      const message = update?.message;
      if (!message || !message.text) return;

      const chatId = String(message.chat?.id || message.from?.id);
      const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || chatId;
      const text = message.text;

      const allUsers = await db.execute(sqlExpr`SELECT id FROM users LIMIT 1`);
      const firstUserId = (allUsers.rows[0] as { id: string })?.id;
      if (!firstUserId) return;

      await processIncomingMessage({
        userId: firstUserId,
        phone: chatId,
        contactName: name,
        messageContent: text,
        channel: "telegram",
        provider: "telegram",
      });
    } catch (err) {
      console.error("[telegram webhook]", err);
    }
  });

  app.post("/api/settings/telegram/connect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { botToken } = req.body;
      if (!botToken) return res.status(400).json({ message: "botToken é obrigatório" });
      const botInfo = await getTelegramBotInfo(botToken);
      if (!botInfo.ok) return res.status(400).json({ message: "Token inválido" });
      const baseUrl = process.env.WEBHOOK_BASE_URL;
      if (!baseUrl) return res.status(400).json({ message: "WEBHOOK_BASE_URL não configurado — configure nas Configurações" });
      const result = await registerTelegramWebhook(botToken, `${baseUrl}/api/webhooks/telegram`);
      res.json({ ok: result.ok, botName: botInfo.result?.username, description: result.description });
    } catch { res.status(500).json({ message: "Erro ao conectar Telegram" }); }
  });

  // ─── Instagram Webhook ────────────────────────────────────────────────────

  app.get("/api/webhooks/instagram", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;
    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || "quanta_flow_ig";
    const result = verifyInstagramWebhook(mode, token, challenge, verifyToken);
    if (result) return res.status(200).send(result);
    res.status(403).send("Forbidden");
  });

  app.post("/api/webhooks/instagram", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true });
      const entry = req.body?.entry?.[0];
      const messaging = entry?.messaging?.[0];
      if (!messaging?.message?.text) return;

      const senderId = String(messaging.sender?.id);
      const text = messaging.message.text;

      const allUsers = await db.execute(sqlExpr`SELECT id FROM users LIMIT 1`);
      const firstUserId = (allUsers.rows[0] as { id: string })?.id;
      if (!firstUserId) return;

      await processIncomingMessage({
        userId: firstUserId,
        phone: senderId,
        contactName: senderId,
        messageContent: text,
        channel: "instagram",
        provider: "instagram",
      });
    } catch (err) {
      console.error("[instagram webhook]", err);
    }
  });

  app.post("/api/settings/instagram/connect", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) return res.status(400).json({ message: "accessToken é obrigatório" });
      const verifyRes = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
      if (!verifyRes.ok) return res.status(400).json({ message: "Token inválido" });
      const info = await verifyRes.json() as { name?: string; id?: string };
      res.json({ ok: true, name: info.name, id: info.id });
    } catch { res.status(500).json({ message: "Erro ao verificar token do Instagram" }); }
  });

  // ─── Meta (WhatsApp Cloud API) Webhook ──────────────────────────────────────

  app.get("/api/webhooks/meta", async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (mode === "subscribe") {
      const verifyToken = await configService.getSetting("meta_verify_token") || "quanta_flow_meta";
      if (token === verifyToken) {
        log(`Meta webhook verified successfully`, "meta-webhook");
        return res.status(200).send(challenge);
      }
    }
    log(`Meta webhook verification failed`, "meta-webhook");
    res.status(403).send("Forbidden");
  });

  app.post("/api/webhooks/meta", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true });

      const entries = req.body?.entry;
      if (!Array.isArray(entries)) return;

      for (const entry of entries) {
        const changes = entry.changes;
        if (!Array.isArray(changes)) continue;

        for (const change of changes) {
          const value = change.value;
          if (!value || value.messaging_product !== "whatsapp") continue;

          const messages = value.messages;
          if (!Array.isArray(messages)) continue;

          for (const msg of messages) {
            if (msg.type !== "text" || !msg.text?.body) continue;

            const phone = msg.from;
            const text = msg.text.body;
            const contactName = value.contacts?.[0]?.profile?.name || phone;

            const allUsers = await db.execute(sqlExpr`SELECT id FROM users LIMIT 1`);
            const firstUserId = (allUsers.rows[0] as { id: string })?.id;
            if (!firstUserId) continue;

            log(`Meta webhook: message from ${phone}: ${text.substring(0, 50)}`, "meta-webhook");

            await processIncomingMessage({
              userId: firstUserId,
              phone,
              contactName,
              messageContent: text,
              channel: "whatsapp",
              provider: "meta",
            });
          }
        }
      }
    } catch (err) {
      console.error("[meta webhook]", err);
    }
  });

  // ─── Documentation Versions ────────────────────────────────────────────────────

  app.get("/api/documentation/versions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const versions = await storage.getDocumentationVersions(req.user.userId);
      res.json(versions);
    } catch (err) {
      console.error("[GET /api/documentation/versions]", err);
      res.status(500).json({ message: "Erro ao buscar versões" });
    }
  });

  app.get("/api/documentation/versions/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const version = await storage.getDocumentationVersion(id);
      if (!version) return res.status(404).json({ message: "Versão não encontrada" });
      res.json(version);
    } catch (err) {
      console.error("[GET /api/documentation/versions/:id]", err);
      res.status(500).json({ message: "Erro ao buscar versão" });
    }
  });

  app.post("/api/documentation/versions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const schema = insertDocumentationVersionSchema.parse(req.body);
      const doc = await storage.createDocumentationVersion({
        ...schema,
        userId: req.user.userId,
      });
      await logAudit(req.user.userId, "CREATE", "documentation_versions", doc.id, null, JSON.stringify(doc));
      res.json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
      console.error("[POST /api/documentation/versions]", err);
      res.status(500).json({ message: "Erro ao criar documentação" });
    }
  });

  app.delete("/api/documentation/versions/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { id } = req.params;
      const doc = await storage.getDocumentationVersion(id);
      if (!doc) return res.status(404).json({ message: "Versão não encontrada" });
      if (doc.userId !== req.user.userId && !["super_admin", "admin"].includes(req.user.tipoAtor)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      const deleted = await storage.deleteDocumentationVersion(id);
      if (!deleted) return res.status(404).json({ message: "Falha ao deletar" });
      await logAudit(req.user.userId, "DELETE", "documentation_versions", id, JSON.stringify(doc), null);
      res.json({ ok: true });
    } catch (err) {
      console.error("[DELETE /api/documentation/versions/:id]", err);
      res.status(500).json({ message: "Erro ao deletar documentação" });
    }
  });

  // ==================== AI Agents ====================

  const agentOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  app.get("/api/admin/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const agents = await storage.getAiAgentsByUser(req.user.userId);
      res.json(agents);
    } catch (err) {
      console.error("[GET /api/admin/agents]", err);
      res.status(500).json({ message: "Erro ao buscar agentes" });
    }
  });

  app.get("/api/admin/agents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const agent = await storage.getAiAgent(req.params.id);
      if (!agent || agent.userId !== req.user.userId) return res.status(404).json({ message: "Agente não encontrado" });
      res.json(agent);
    } catch (err) {
      console.error("[GET /api/admin/agents/:id]", err);
      res.status(500).json({ message: "Erro ao buscar agente" });
    }
  });

  app.post("/api/admin/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const data = insertAiAgentSchema.parse({ ...req.body, userId: req.user.userId });
      const agent = await storage.createAiAgent(data);
      res.status(201).json(agent);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
      console.error("[POST /api/admin/agents]", err);
      res.status(500).json({ message: "Erro ao criar agente" });
    }
  });

  app.put("/api/admin/agents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getAiAgent(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Agente não encontrado" });
      const data = updateAiAgentSchema.parse(req.body);
      const agent = await storage.updateAiAgent(req.params.id, data);
      res.json(agent);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
      console.error("[PUT /api/admin/agents/:id]", err);
      res.status(500).json({ message: "Erro ao atualizar agente" });
    }
  });

  app.delete("/api/admin/agents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getAiAgent(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Agente não encontrado" });
      const deleted = await storage.deleteAiAgent(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Falha ao deletar" });
      res.json({ ok: true });
    } catch (err) {
      console.error("[DELETE /api/admin/agents/:id]", err);
      res.status(500).json({ message: "Erro ao deletar agente" });
    }
  });

  app.post("/api/admin/agents/:id/chat", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const agent = await storage.getAiAgent(req.params.id);
      if (!agent || agent.userId !== req.user.userId) return res.status(404).json({ message: "Agente não encontrado" });

      const { message, history } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Campo 'message' é obrigatório" });
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: agent.systemPrompt },
      ];

      if (Array.isArray(history)) {
        for (const h of history.slice(-10)) {
          if (h.role === "user" || h.role === "assistant") {
            messages.push({ role: h.role, content: String(h.content) });
          }
        }
      }

      messages.push({ role: "user", content: message });

      const response = await agentOpenai.chat.completions.create({
        model: agent.model || "gpt-4o-mini",
        messages,
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.maxTokens ?? 500,
      });

      const reply = response.choices[0]?.message?.content || "";
      res.json({ reply, usage: response.usage });
    } catch (err) {
      console.error("[POST /api/admin/agents/:id/chat]", err);
      res.status(500).json({ message: "Erro no chat do agente" });
    }
  });

  const ttsHandler = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const agent = await storage.getAiAgent(req.params.id);
      if (!agent || agent.userId !== req.user.userId) return res.status(404).json({ message: "Agente não encontrado" });

      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Campo 'text' é obrigatório" });
      }

      const { generateAgentTts } = await import("./services/ttsService");
      const buffer = await generateAgentTts(agent.id, text);
      if (!buffer) return res.status(500).json({ message: "Falha ao gerar áudio TTS" });

      res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length.toString() });
      res.send(buffer);
    } catch (err) {
      console.error("[POST /api/agents/:id/tts]", err);
      res.status(500).json({ message: "Erro ao gerar áudio TTS" });
    }
  };
  app.post("/api/admin/agents/:id/tts", authenticateToken, ttsHandler);
  app.post("/api/agents/:id/tts", authenticateToken, ttsHandler);

  app.post("/api/admin/agents/generate-avatar", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { name, specialty, tone } = req.body;
      const prompt = `Professional AI assistant avatar icon, clean minimalist design, solid color background, friendly robot face or abstract AI symbol representing a ${specialty || "generic"} specialist with ${tone || "friendly"} personality named "${name || "AI Agent"}". Modern flat design style, suitable for business use.`;

      const imageResponse = await agentOpenai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const url = imageResponse.data?.[0]?.url;
      if (!url) return res.status(500).json({ message: "Falha ao gerar avatar" });
      res.json({ url });
    } catch (err) {
      console.error("[POST /api/admin/agents/generate-avatar]", err);
      res.status(500).json({ message: "Erro ao gerar avatar" });
    }
  });

  // ==================== Campaigns ====================

  app.get("/api/admin/campaigns", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const list = await storage.getCampaignsByUser(req.user.userId);
      res.json(list);
    } catch (err) {
      console.error("[GET /api/admin/campaigns]", err);
      res.status(500).json({ message: "Erro ao listar campanhas" });
    }
  });

  app.get("/api/admin/campaigns/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      res.json(campaign);
    } catch (err) {
      console.error("[GET /api/admin/campaigns/:id]", err);
      res.status(500).json({ message: "Erro ao buscar campanha" });
    }
  });

  app.post("/api/admin/campaigns", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const parsed = insertCampaignSchema.parse({ ...req.body, userId: req.user.userId });
      const campaign = await storage.createCampaign(parsed);
      res.status(201).json(campaign);
    } catch (err) {
      console.error("[POST /api/admin/campaigns]", err);
      res.status(400).json({ message: "Erro ao criar campanha", error: err instanceof Error ? err.message : err });
    }
  });

  app.patch("/api/admin/campaigns/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getCampaign(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      const parsed = updateCampaignSchema.parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, parsed);
      res.json(campaign);
    } catch (err) {
      console.error("[PATCH /api/admin/campaigns/:id]", err);
      res.status(400).json({ message: "Erro ao atualizar campanha", error: err instanceof Error ? err.message : err });
    }
  });

  app.delete("/api/admin/campaigns/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getCampaign(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campanha excluída" });
    } catch (err) {
      console.error("[DELETE /api/admin/campaigns/:id]", err);
      res.status(500).json({ message: "Erro ao excluir campanha" });
    }
  });

  app.post("/api/admin/campaigns/:id/start", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
        return res.status(400).json({ message: `Campanha com status '${campaign.status}' não pode ser iniciada` });
      }

      const existingDeliveries = await storage.getCampaignDeliveries(campaign.id);
      const existingContactIds = new Set(existingDeliveries.map(d => d.contactId));

      let contacts = await storage.getUnifiedContactsByUser(req.user.userId);
      if (campaign.segmentFilter) {
        const filter = campaign.segmentFilter as { type: string; value?: string };
        if (filter.type === "temperature" && filter.value) {
          contacts = contacts.filter(c => c.temperature === filter.value);
        } else if (filter.type === "stage" && filter.value) {
          contacts = contacts.filter(c => c.pipelineStage === filter.value);
        } else if (filter.type === "tag" && filter.value) {
          contacts = contacts.filter(c => c.tags && c.tags.toLowerCase().includes(filter.value!.toLowerCase()));
        }
      }

      const channels = (campaign.channels && campaign.channels.length > 0) ? campaign.channels : ["whatsapp"];
      let newDeliveries = 0;
      for (const contact of contacts) {
        for (const channel of channels) {
          const existing = existingDeliveries.find(d => d.contactId === contact.id && d.channel === channel);
          if (existing) continue;
          await storage.createCampaignDelivery({ campaignId: campaign.id, contactId: contact.id, channel });
          newDeliveries++;
        }
      }

      const totalContacts = existingDeliveries.length + newDeliveries;
      await db.update(campaignsTable)
        .set({ status: "running", totalContacts, startedAt: new Date(), updatedAt: new Date() })
        .where(eq(campaignsTable.id, campaign.id));

      res.json({ ...(await storage.getCampaign(campaign.id)), totalContacts });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/:id/start]", err);
      res.status(500).json({ message: "Erro ao iniciar campanha" });
    }
  });

  app.post("/api/admin/campaigns/:id/pause", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      if (campaign.status !== "running") return res.status(400).json({ message: "Campanha não está em execução" });
      const updated = await storage.updateCampaign(campaign.id, { status: "paused" });
      res.json(updated);
    } catch (err) {
      console.error("[POST /api/admin/campaigns/:id/pause]", err);
      res.status(500).json({ message: "Erro ao pausar campanha" });
    }
  });

  app.get("/api/admin/campaigns/:id/metrics", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign || campaign.userId !== req.user.userId) return res.status(404).json({ message: "Campanha não encontrada" });
      const metrics = await storage.getCampaignMetrics(campaign.id);
      res.json({ campaign, metrics });
    } catch (err) {
      console.error("[GET /api/admin/campaigns/:id/metrics]", err);
      res.status(500).json({ message: "Erro ao buscar métricas" });
    }
  });

  app.post("/api/admin/campaigns/preview-segment", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { segmentFilter } = req.body;
      let contacts = await storage.getUnifiedContactsByUser(req.user.userId);
      if (segmentFilter) {
        if (segmentFilter.type === "temperature" && segmentFilter.value) {
          contacts = contacts.filter(c => c.temperature === segmentFilter.value);
        } else if (segmentFilter.type === "stage" && segmentFilter.value) {
          contacts = contacts.filter(c => c.pipelineStage === segmentFilter.value);
        } else if (segmentFilter.type === "tag" && segmentFilter.value) {
          contacts = contacts.filter(c => c.tags && c.tags.toLowerCase().includes(segmentFilter.value.toLowerCase()));
        }
      }
      res.json({ count: contacts.length, sample: contacts.slice(0, 5).map(c => ({ id: c.id, name: c.nome, phone: c.telefone })) });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/preview-segment]", err);
      res.status(500).json({ message: "Erro ao pré-visualizar segmento" });
    }
  });

  app.post("/api/admin/campaigns/generate-copy", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { objective, tone, channel, productInfo } = req.body;
      const prompt = `Você é um copywriter profissional brasileiro. Gere 3 variações de mensagem de campanha de marketing para ${channel || "WhatsApp"}.

Objetivo: ${objective || "Venda"}
Tom: ${tone || "amigável"}
${productInfo ? `Informações do produto/serviço: ${productInfo}` : ""}

Use variáveis {nome} para personalização. Mantenha cada mensagem com no máximo 300 caracteres. Retorne como JSON array: [{"content": "mensagem 1"}, {"content": "mensagem 2"}, {"content": "mensagem 3"}]`;

      const completion = await agentOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const text = completion.choices[0]?.message?.content || "[]";
      let suggestions;
      try {
        const parsed = JSON.parse(text);
        suggestions = parsed.suggestions || parsed.messages || parsed;
        if (!Array.isArray(suggestions)) suggestions = [suggestions];
      } catch {
        suggestions = [{ content: text }];
      }
      res.json({ suggestions });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/generate-copy]", err);
      res.status(500).json({ message: "Erro ao gerar copy" });
    }
  });

  app.post("/api/admin/campaigns/generate-sequence", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { objective, tone, channel, steps, productInfo } = req.body;
      const numSteps = steps || 3;
      const prompt = `Você é um copywriter profissional brasileiro especializado em sequências de nutrição (drip campaigns). Gere uma sequência de ${numSteps} mensagens para ${channel || "WhatsApp"}.

Objetivo: ${objective || "Nutrição de lead"}
Tom: ${tone || "amigável"}
${productInfo ? `Informações do produto/serviço: ${productInfo}` : ""}

Cada mensagem deve ser progressiva:
1. Primeira mensagem: apresentação e valor
2. Mensagens intermediárias: educação e engajamento
3. Última mensagem: call-to-action forte

Use variáveis {nome} para personalização. Mantenha cada mensagem com no máximo 300 caracteres.
Retorne como JSON: {"messages": [{"content": "mensagem", "delayMinutes": 0}, {"content": "mensagem 2", "delayMinutes": 1440}]}
delayMinutes indica o intervalo desde a mensagem anterior (0 para a primeira, depois em minutos).`;

      const completion = await agentOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const text = completion.choices[0]?.message?.content || "{}";
      let messages: Array<{ content: string; delayMinutes: number }>;
      try {
        const parsed = JSON.parse(text);
        messages = parsed.messages || parsed.sequence || [];
        if (!Array.isArray(messages)) messages = [];
      } catch {
        messages = [];
      }
      res.json({ messages: messages.map((m: { content: string; delayMinutes: number }, i: number) => ({ order: i, content: m.content, delayMinutes: m.delayMinutes || 0 })) });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/generate-sequence]", err);
      res.status(500).json({ message: "Erro ao gerar sequência" });
    }
  });

  // ==================== Documentation ====================

  app.get("/api/documentation/manual-md", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const manualPath = path.join(process.cwd(), "MANUAL_DE_USO.md");
      if (!fs.existsSync(manualPath)) {
        return res.status(404).json({ message: "Manual não encontrado" });
      }
      const content = fs.readFileSync(manualPath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(content);
    } catch (err) {
      console.error("[GET /api/documentation/manual-md]", err);
      res.status(500).json({ message: "Erro ao carregar manual" });
    }
  });

  app.get("/api/documentation/claude-md", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const filePath = path.join(process.cwd(), "CLAUDE.md");
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
      const content = fs.readFileSync(filePath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(content);
    } catch (err) {
      console.error("[GET /api/documentation/claude-md]", err);
      res.status(500).json({ message: "Erro ao carregar CLAUDE.md" });
    }
  });

  app.get("/api/documentation/changelog", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const filePath = path.join(process.cwd(), "CHANGELOG.md");
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
      const content = fs.readFileSync(filePath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(content);
    } catch (err) {
      console.error("[GET /api/documentation/changelog]", err);
      res.status(500).json({ message: "Erro ao carregar CHANGELOG.md" });
    }
  });

  // Project Status Items CRUD
  app.get("/api/admin/project-status", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const items = await storage.getProjectStatusItems();
      res.json(items);
    } catch (err) {
      console.error("[GET /api/admin/project-status]", err);
      res.status(500).json({ message: "Erro ao buscar status" });
    }
  });

  app.post("/api/admin/project-status", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { insertProjectStatusItemSchema } = await import("@shared/schema");
      const parsed = insertProjectStatusItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const item = await storage.createProjectStatusItem(parsed.data);
      res.status(201).json(item);
    } catch (err) {
      console.error("[POST /api/admin/project-status]", err);
      res.status(500).json({ message: "Erro ao criar item" });
    }
  });

  app.put("/api/admin/project-status/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { updateProjectStatusItemSchema } = await import("@shared/schema");
      const parsed = updateProjectStatusItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const item = await storage.updateProjectStatusItem(req.params.id, parsed.data);
      if (!item) return res.status(404).json({ message: "Item não encontrado" });
      res.json(item);
    } catch (err) {
      console.error("[PUT /api/admin/project-status/:id]", err);
      res.status(500).json({ message: "Erro ao atualizar item" });
    }
  });

  app.delete("/api/admin/project-status/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const ok = await storage.deleteProjectStatusItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Item não encontrado" });
      res.json({ ok: true });
    } catch (err) {
      console.error("[DELETE /api/admin/project-status/:id]", err);
      res.status(500).json({ message: "Erro ao deletar item" });
    }
  });

  app.get("/api/documentation/manual-pdf", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const PDFDocument = require("pdfkit");
      const fs = require("fs");
      const path = require("path");

      const manualPath = path.join(process.cwd(), "MANUAL_DE_USO.md");
      if (!fs.existsSync(manualPath)) {
        return res.status(404).json({ message: "Manual não encontrado" });
      }

      const manualContent = fs.readFileSync(manualPath, "utf-8");

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        font: "Courier",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="QUANTA_FLOW_Manual_Completo.pdf"');

      doc.pipe(res);

      doc.font("Courier", 16).text("QUANTA FLOW - Manual de Uso", { align: "center" });
      doc.moveDown(0.5);
      doc.font("Courier", 10).text("Guia Didático Completo", { align: "center" });
      doc.moveDown(1);

      const lines = manualContent.split("\n");
      let currentFontSize = 10;

      for (const line of lines) {
        if (line.startsWith("# ")) {
          doc.font("Courier", 14).text(line.replace("# ", ""));
          doc.moveDown(0.3);
        } else if (line.startsWith("## ")) {
          doc.font("Courier", 12).text(line.replace("## ", ""));
          doc.moveDown(0.2);
        } else if (line.startsWith("### ")) {
          doc.font("Courier", 11).text(line.replace("### ", ""));
          doc.moveDown(0.2);
        } else if (line.trim() === "") {
          doc.moveDown(0.2);
        } else {
          doc.font("Courier", 9).text(line, { align: "left", width: 500 });
        }

        if (doc.y > 750) {
          doc.addPage();
        }
      }

      doc.end();
    } catch (err) {
      console.error("[GET /api/documentation/manual-pdf]", err);
      res.status(500).json({ message: "Erro ao gerar PDF" });
    }
  });

  // ==================== Presentation PPTX ====================

  app.get("/api/documentation/presentation-pptx", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { generatePresentation } = await import("./generatePpt");
      const buffer = await generatePresentation();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", 'attachment; filename="quanta-flow-apresentacao.pptx"');
      res.send(buffer);
    } catch (err) {
      console.error("[GET /api/documentation/presentation-pptx]", err);
      res.status(500).json({ message: "Erro ao gerar apresentação" });
    }
  });

  // ==================== Lab / Testing ====================

  app.post("/api/admin/lab/simulate-chat", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { agentId, userMessage, channel } = req.body;
      if (!agentId || !userMessage) return res.status(400).json({ message: "agentId e userMessage são obrigatórios" });

      const agent = await storage.getAiAgent(agentId);
      if (!agent) return res.status(404).json({ message: "Agente não encontrado" });
      if (agent.userId !== req.user.userId) return res.status(403).json({ message: "Acesso negado" });

      const completion = await agentOpenai.chat.completions.create({
        model: agent.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: agent.systemPrompt || "You are a helpful assistant." },
          { role: "user", content: userMessage },
        ],
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.maxTokens ?? 500,
      });

      const reply = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
      res.json({ reply });
    } catch (err) {
      console.error("[POST /api/admin/lab/simulate-chat]", err);
      res.status(500).json({ message: "Erro ao processar mensagem" });
    }
  });

  app.post("/api/admin/lab/simulate-flow-chat", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { flowId, currentBlockId, userMessage, vars: incomingVars } = req.body;
      if (!flowId) return res.status(400).json({ message: "flowId é obrigatório" });

      const flow = await storage.getAutomationFlow(flowId);
      if (!flow || flow.userId !== req.user.userId) return res.status(403).json({ message: "Acesso negado" });
      if (!flow.isActive) return res.status(400).json({ message: "Fluxo inativo — ative-o antes de simular" });

      type FlowBlock = { id: string; type: string; config: Record<string, string | number | boolean | undefined>; nextBlockId?: string; conditionTrueId?: string; conditionFalseId?: string };
      const blocks: FlowBlock[] = Array.isArray(flow.blocks) ? (flow.blocks as FlowBlock[]) : [];
      if (blocks.length === 0) return res.json({ outboundMessages: [], nextBlockId: null, awaitingReply: false, done: true });

      const blockMap = new Map(blocks.map((b) => [b.id, b]));
      const targetIds = new Set<string>();
      for (const b of blocks) {
        if (b.nextBlockId) targetIds.add(b.nextBlockId);
        if (b.conditionTrueId) targetIds.add(b.conditionTrueId);
        if (b.conditionFalseId) targetIds.add(b.conditionFalseId);
      }
      const rootBlock = blocks.find((b) => !targetIds.has(b.id)) || blocks[0];
      const startBlockId = currentBlockId || rootBlock.id;

      const vars = incomingVars || { nome: "Teste", telefone: "11999999999", email: "teste@example.com", mensagem: userMessage || "" };
      if (userMessage) vars.mensagem = userMessage;
      const interpolate = (text: string) => text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);

      const outboundMessages: Array<{ role: "bot"; type: string; content: string }> = [];
      let blockId: string | null = startBlockId;
      const visited = new Set<string>();
      const MAX_STEPS = 50;
      let steps = 0;
      const msgLow = (vars.mensagem || "").toLowerCase();

      while (blockId && steps++ < MAX_STEPS) {
        if (visited.has(blockId)) break;
        visited.add(blockId);

        const block = blockMap.get(blockId);
        if (!block) break;
        const cfg = block.config || {};

        switch (block.type) {
          case "text": {
            const msg = interpolate(String(cfg.message || ""));
            outboundMessages.push({ role: "bot", type: "text", content: msg });
            blockId = block.nextBlockId || null;
            break;
          }
          case "ai_agent": {
            const agentId = String(cfg.agentId || "");
            const agent = agentId ? await storage.getAiAgent(agentId) : null;
            if (agent && agent.userId === req.user.userId) {
              try {
                const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const completion = await aiClient.chat.completions.create({
                  model: agent.model || "gpt-4o-mini",
                  messages: [
                    { role: "system", content: agent.systemPrompt || "You are a helpful assistant." },
                    { role: "user", content: vars.mensagem || "Olá" },
                  ],
                  temperature: agent.temperature ?? 0.7,
                  max_tokens: agent.maxTokens ?? 500,
                });
                const reply = completion.choices[0]?.message?.content || "Desculpe, não consegui processar.";
                outboundMessages.push({ role: "bot", type: "ai_agent", content: reply });
              } catch (aiErr) {
                outboundMessages.push({ role: "bot", type: "ai_agent", content: "[Erro ao chamar IA]" });
              }
            } else {
              outboundMessages.push({ role: "bot", type: "ai_agent", content: "[Agente não configurado]" });
            }
            return res.json({ outboundMessages, nextBlockId: block.nextBlockId || null, awaitingReply: false, done: true });
          }
          case "condition": {
            const condType = String(cfg.conditionType || "keyword");
            const condVal = String(cfg.conditionValue || "").toLowerCase();
            let conditionMet = false;
            if (condType === "keyword") {
              const keywords = condVal.split(",").map((k) => k.trim()).filter(Boolean);
              conditionMet = keywords.some((kw) => msgLow.includes(kw));
            }
            blockId = conditionMet ? (block.conditionTrueId || null) : (block.conditionFalseId || null);
            outboundMessages.push({ role: "bot", type: "condition", content: `[Condição: ${conditionMet ? "SIM" : "NÃO"}]` });
            break;
          }
          case "delay": {
            blockId = block.nextBlockId || null;
            break;
          }
          case "queue_entry":
          case "resolve": {
            outboundMessages.push({ role: "bot", type: block.type, content: `[${block.type === "resolve" ? "Fluxo finalizado" : "Contato adicionado à fila"}]` });
            blockId = null;
            break;
          }
          case "update_lead":
          case "webhook":
          case "audio_tts":
          case "image_ai": {
            blockId = block.nextBlockId || null;
            break;
          }
          default:
            blockId = block.nextBlockId || null;
        }
      }

      res.json({ outboundMessages, nextBlockId: blockId, awaitingReply: blockId ? true : false, done: !blockId });
    } catch (err: unknown) {
      console.error("[POST /api/admin/lab/simulate-flow-chat]", err);
      res.status(500).json({ message: "Erro ao processar conversa" });
    }
  });

  app.post("/api/admin/lab/simulate-flow", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { flowId, contactName, contactPhone, triggerMessage } = req.body;
      if (!flowId) return res.status(400).json({ message: "flowId é obrigatório" });

      const flow = await storage.getAutomationFlow(flowId);
      if (!flow || flow.userId !== req.user.userId) return res.status(403).json({ message: "Acesso negado" });
      if (!flow.isActive) return res.status(400).json({ message: "Fluxo inativo — ative-o antes de simular" });

      const vars: Record<string, string> = {
        nome: contactName || "Contato Teste",
        telefone: contactPhone || "11999999999",
        email: "teste@example.com",
        mensagem: triggerMessage || "Mensagem de teste",
      };

      const interpolate = (text: string) =>
        text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);

      type FlowBlock = {
        id: string;
        type: string;
        config: Record<string, string | number | boolean | undefined>;
        nextBlockId?: string;
        conditionTrueId?: string;
        conditionFalseId?: string;
      };
      const blocks: FlowBlock[] = Array.isArray(flow.blocks) ? (flow.blocks as FlowBlock[]) : [];

      type TraceEntry = { blockId: string; blockType: string; status: string; result: string; wouldSend?: string; timestamp: string };
      const trace: TraceEntry[] = [];

      if (blocks.length === 0) {
        trace.push({ blockId: "empty", blockType: "info", status: "ok", result: "Fluxo não possui blocos configurados", timestamp: new Date().toISOString() });
        return res.json({ trace });
      }

      // Graph traversal: find root block (not pointed to by any other block)
      const blockMap = new Map(blocks.map((b) => [b.id, b]));
      const targetIds = new Set<string>();
      for (const b of blocks) {
        if (b.nextBlockId) targetIds.add(b.nextBlockId);
        if (b.conditionTrueId) targetIds.add(b.conditionTrueId);
        if (b.conditionFalseId) targetIds.add(b.conditionFalseId);
      }
      const rootBlock = blocks.find((b) => !targetIds.has(b.id)) || blocks[0];

      let currentBlockId: string | null = rootBlock.id;
      const visited = new Set<string>();
      const MAX_STEPS = 50;
      let steps = 0;
      const msgLow = vars.mensagem.toLowerCase();

      while (currentBlockId) {
        if (steps++ >= MAX_STEPS) {
          trace.push({ blockId: "limit", blockType: "limit", status: "skipped", result: "Limite de 50 blocos atingido", timestamp: new Date().toISOString() });
          break;
        }
        if (visited.has(currentBlockId)) {
          trace.push({ blockId: currentBlockId, blockType: "cycle", status: "skipped", result: "Ciclo detectado — execução interrompida", timestamp: new Date().toISOString() });
          break;
        }
        visited.add(currentBlockId);

        const block = blockMap.get(currentBlockId);
        if (!block) break;
        const cfg = block.config || {};
        const ts = new Date().toISOString();

        switch (block.type) {
          case "text": {
            const msg = interpolate(String(cfg.message || ""));
            trace.push({ blockId: block.id, blockType: "text", status: "would_send", result: "Enviaria mensagem de texto", wouldSend: msg, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "audio_tts": {
            const ttsText = interpolate(String(cfg.message || ""));
            const ttsVoice = String(cfg.voice || "nova");
            trace.push({ blockId: block.id, blockType: "audio_tts", status: "would_send", result: `Enviaria áudio TTS (voz: ${ttsVoice})`, wouldSend: ttsText, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "image_ai": {
            const prompt = interpolate(String(cfg.prompt || "abstract art"));
            trace.push({ blockId: block.id, blockType: "image_ai", status: "would_send", result: "Enviaria imagem gerada por IA", wouldSend: `Prompt: ${prompt}`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "delay": {
            const delaySec = Number(cfg.delaySeconds || 30);
            const unit = String(cfg.delayUnit || "seconds");
            trace.push({ blockId: block.id, blockType: "delay", status: "skipped", result: `Delay ignorado em dry-run (${delaySec} ${unit})`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "condition": {
            const condType = String(cfg.conditionType || "keyword");
            const condVal = String(cfg.conditionValue || "").toLowerCase();
            let conditionMet = false;
            let evalDesc = "";
            if (condType === "keyword") {
              const keywords = condVal.split(",").map((k) => k.trim()).filter(Boolean);
              conditionMet = keywords.some((kw) => msgLow.includes(kw));
              evalDesc = `keyword [${condVal}] ${conditionMet ? "encontrado" : "não encontrado"} em "${vars.mensagem}"`;
            } else if (condType === "intent") {
              conditionMet = false; // intent not yet resolved in dry-run
              evalDesc = `intent = "${condVal}" (não resolvido em dry-run → NÃO)`;
            } else if (condType === "temperature") {
              conditionMet = false;
              evalDesc = `temperature = "${condVal}" (contato simulado sem temperatura → NÃO)`;
            } else if (condType === "score") {
              conditionMet = false;
              evalDesc = `score >= ${condVal} (contato simulado com score 0 → NÃO)`;
            } else {
              conditionMet = false;
              evalDesc = `condição "${condType}" não reconhecida → NÃO`;
            }
            trace.push({
              blockId: block.id,
              blockType: "condition",
              status: conditionMet ? "condition_true" : "condition_false",
              result: `Condição avaliada: ${evalDesc} → ${conditionMet ? "SIM (branch true)" : "NÃO (branch false)"}`,
              timestamp: ts,
            });
            currentBlockId = conditionMet ? (block.conditionTrueId || null) : (block.conditionFalseId || null);
            break;
          }
          case "ai_agent": {
            const agentId = String(cfg.agentId || "?");
            trace.push({ blockId: block.id, blockType: "ai_agent", status: "would_send", result: `Agente IA (id: ${agentId}) geraria resposta para: "${vars.mensagem}"`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "webhook": {
            const url = String(cfg.webhookUrl || cfg.url || "URL não definida");
            trace.push({ blockId: block.id, blockType: "webhook", status: "skipped", result: `Webhook ignorado em dry-run (${url})`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          case "queue_entry": {
            const slaMin = Number(cfg.slaMinutes || 60);
            trace.push({ blockId: block.id, blockType: "queue_entry", status: "ok", result: `Contato "${vars.nome}" seria adicionado à fila (SLA: ${slaMin}min)`, timestamp: ts });
            currentBlockId = null;
            break;
          }
          case "resolve": {
            trace.push({ blockId: block.id, blockType: "resolve", status: "ok", result: "Fluxo resolvido/finalizado com sucesso", timestamp: ts });
            currentBlockId = null;
            break;
          }
          case "update_lead": {
            const parts: string[] = [];
            if (cfg.leadStage) parts.push(`estágio="${cfg.leadStage}"`);
            if (cfg.leadTemperature) parts.push(`temperatura="${cfg.leadTemperature}"`);
            if (cfg.leadTag) parts.push(`tag="${cfg.leadTag}"`);
            if (cfg.leadScore !== undefined) parts.push(`score=${cfg.leadScore}`);
            trace.push({ blockId: block.id, blockType: "update_lead", status: "ok", result: `Lead seria atualizado: ${parts.join(", ") || "(nenhum campo configurado)"}`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
            break;
          }
          default:
            trace.push({ blockId: block.id, blockType: block.type, status: "ok", result: `Bloco tipo "${block.type}" executado`, timestamp: ts });
            currentBlockId = block.nextBlockId || null;
        }
      }

      res.json({ trace });
    } catch (err) {
      console.error("[POST /api/admin/lab/simulate-flow]", err);
      res.status(500).json({ message: "Erro ao simular fluxo" });
    }
  });

  app.post("/api/admin/lab/generate-tts", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { text, voice } = req.body;
      if (!text) return res.status(400).json({ message: "text é obrigatório" });

      type TtsVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
      const validVoices: TtsVoice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const selectedVoice: TtsVoice = validVoices.includes(voice as TtsVoice) ? (voice as TtsVoice) : "alloy";

      const mp3 = await agentOpenai.audio.speech.create({
        model: "tts-1",
        voice: selectedVoice,
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", "inline; filename=audio.mp3");
      res.send(buffer);
    } catch (err) {
      console.error("[POST /api/admin/lab/generate-tts]", err);
      res.status(500).json({ message: "Erro ao gerar TTS" });
    }
  });

  app.post("/api/admin/lab/generate-image", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ message: "prompt é obrigatório" });

      const imageResponse = await agentOpenai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = imageResponse.data[0]?.url || null;
      if (!imageUrl) return res.status(500).json({ message: "Falha ao gerar imagem" });

      res.json({ imageUrl });
    } catch (err) {
      console.error("[POST /api/admin/lab/generate-image]", err);
      res.status(500).json({ message: "Erro ao gerar imagem" });
    }
  });

  app.post("/api/admin/lab/test-whatsapp", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const { phone, message } = req.body;
      if (!phone || !message) return res.status(400).json({ message: "phone e message são obrigatórios" });

      const userId = req.user.userId;
      const waCfg = await storage.getEvolutionConfig(userId);
      if (!waCfg) {
        return res.json({ success: false, message: "WhatsApp não configurado. Vá em Configurações → WhatsApp." });
      }

      const provider = await getWhatsAppProvider(userId);

      if (waCfg.activeProvider === "baileys") {
        const baileysInst = getBaileysInstance(userId);
        if (!baileysInst?.connected) {
          return res.json({
            success: false,
            message: "Baileys não está conectado. Vá em Configurações → WhatsApp → Conectar e escaneie o QR Code.",
          });
        }
      }

      const result = await provider.sendMessage(phone, message);
      res.json({ success: true, message: `Mensagem enviada para ${phone} com sucesso! (ID: ${result.messageId})` });
    } catch (err: unknown) {
      console.error("[POST /api/admin/lab/test-whatsapp]", err);
      const errMsg = err instanceof Error ? err.message : "Verifique a integração WhatsApp em Configurações.";
      res.json({ success: false, message: `Erro: ${errMsg}` });
    }
  });

  // ==================== Message Templates ====================

  app.get("/api/admin/templates", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const list = await storage.getMessageTemplatesByUser(req.user.userId);
      res.json(list);
    } catch (err) {
      console.error("[GET /api/admin/templates]", err);
      res.status(500).json({ message: "Erro ao listar templates" });
    }
  });

  app.post("/api/admin/templates", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const parsed = insertMessageTemplateSchema.parse({ ...req.body, userId: req.user.userId });
      const template = await storage.createMessageTemplate(parsed);
      res.status(201).json(template);
    } catch (err) {
      console.error("[POST /api/admin/templates]", err);
      res.status(400).json({ message: "Erro ao criar template", error: err instanceof Error ? err.message : err });
    }
  });

  app.patch("/api/admin/templates/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getMessageTemplate(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Template não encontrado" });
      const parsed = updateMessageTemplateSchema.parse(req.body);
      const template = await storage.updateMessageTemplate(req.params.id, parsed);
      res.json(template);
    } catch (err) {
      console.error("[PATCH /api/admin/templates/:id]", err);
      res.status(400).json({ message: "Erro ao atualizar template", error: err instanceof Error ? err.message : err });
    }
  });

  app.delete("/api/admin/templates/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getMessageTemplate(req.params.id);
      if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ message: "Template não encontrado" });
      await storage.deleteMessageTemplate(req.params.id);
      res.json({ message: "Template excluído" });
    } catch (err) {
      console.error("[DELETE /api/admin/templates/:id]", err);
      res.status(500).json({ message: "Erro ao excluir template" });
    }
  });

  // ==================== Social/Ads Routes ====================

  app.get("/api/admin/social/projects", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const projects = await storage.getSocialProjects(userId);
      const counts = await storage.countAssetsPerProject(userId);
      const countMap = Object.fromEntries(counts.map(c => [c.projectId, c.count]));
      res.json(projects.map(p => sanitizeSocialProject(p as unknown as { brand?: Record<string, unknown> | null; [key: string]: unknown }, countMap[p.id] || 0)));
    } catch (err) {
      console.error("[GET /api/admin/social/projects]", err);
      res.status(500).json({ message: "Erro ao listar projetos" });
    }
  });

  function sanitizeSocialProject(p: { brand?: Record<string, unknown> | null; [key: string]: unknown }, assetCount?: number) {
    const { cloningIds, ...brandWithoutCreds } = (p.brand as { cloningIds?: { elevenLabsApiKey?: string; elevenLabsVoiceId?: string; heygenApiKey?: string; heygenAvatarId?: string }; [k: string]: unknown }) || {};
    return {
      ...p,
      brand: {
        ...brandWithoutCreds,
        hasElevenLabs: !!(cloningIds?.elevenLabsApiKey && cloningIds?.elevenLabsVoiceId),
        hasHeyGen: !!(cloningIds?.heygenApiKey && cloningIds?.heygenAvatarId),
      },
      ...(assetCount !== undefined ? { assetCount } : {}),
    };
  }

  app.post("/api/admin/social/projects", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { insertSocialProjectSchema } = await import("@shared/schema");
      const parsed = insertSocialProjectSchema.parse({ ...req.body, userId: req.user!.userId });
      const project = await storage.createSocialProject(parsed);
      res.status(201).json(sanitizeSocialProject(project as unknown as { brand?: Record<string, unknown> | null; [key: string]: unknown }));
    } catch (err) {
      console.error("[POST /api/admin/social/projects]", err);
      res.status(400).json({ message: "Erro ao criar projeto", error: err instanceof Error ? err.message : err });
    }
  });

  app.patch("/api/admin/social/projects/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { updateSocialProjectSchema } = await import("@shared/schema");
      const parsed = updateSocialProjectSchema.parse(req.body);

      // Preserve existing cloningIds — only overwrite fields that were explicitly provided
      if (parsed.brand !== undefined && parsed.brand !== null) {
        const existing = await storage.getSocialProject(req.params.id, req.user!.userId);
        if (!existing) return res.status(404).json({ message: "Projeto não encontrado" });
        const existingCloning = existing.brand?.cloningIds;
        const newCloning = parsed.brand.cloningIds;
        parsed.brand.cloningIds = {
          elevenLabsApiKey: newCloning?.elevenLabsApiKey || existingCloning?.elevenLabsApiKey,
          elevenLabsVoiceId: newCloning?.elevenLabsVoiceId || existingCloning?.elevenLabsVoiceId,
          heygenApiKey: newCloning?.heygenApiKey || existingCloning?.heygenApiKey,
          heygenAvatarId: newCloning?.heygenAvatarId || existingCloning?.heygenAvatarId,
        };
      }

      const project = await storage.updateSocialProject(req.params.id, req.user!.userId, parsed);
      if (!project) return res.status(404).json({ message: "Projeto não encontrado" });
      res.json(sanitizeSocialProject(project as unknown as { brand?: Record<string, unknown> | null; [key: string]: unknown }));
    } catch (err) {
      console.error("[PATCH /api/admin/social/projects/:id]", err);
      res.status(400).json({ message: "Erro ao atualizar projeto" });
    }
  });

  app.delete("/api/admin/social/projects/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteSocialProject(req.params.id, req.user!.userId);
      res.json({ message: "Projeto excluído" });
    } catch (err) {
      console.error("[DELETE /api/admin/social/projects/:id]", err);
      res.status(500).json({ message: "Erro ao excluir projeto" });
    }
  });

  app.get("/api/admin/social/assets", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const filters: { userId: string; projectId?: string; status?: string; channel?: string; limit?: number } = { userId };
      if (req.query.projectId) filters.projectId = req.query.projectId as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.channel) filters.channel = req.query.channel as string;
      if (req.query.limit) { const l = parseInt(req.query.limit as string, 10); if (!isNaN(l) && l > 0) filters.limit = l; }
      const assets = await storage.getContentAssets(filters);
      res.json(assets);
    } catch (err) {
      console.error("[GET /api/admin/social/assets]", err);
      res.status(500).json({ message: "Erro ao listar ativos" });
    }
  });

  app.get("/api/admin/social/assets/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      res.json(asset);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar ativo" });
    }
  });

  app.post("/api/admin/social/assets", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      if (req.body.projectId) {
        const ownerProject = await storage.getSocialProject(req.body.projectId, userId);
        if (!ownerProject) return res.status(403).json({ message: "Projeto não encontrado ou acesso negado" });
      }
      const { insertContentAssetSchema } = await import("@shared/schema");
      const parsed = insertContentAssetSchema.parse({ ...req.body, userId });
      const asset = await storage.createContentAsset(parsed);
      res.status(201).json(asset);
    } catch (err) {
      console.error("[POST /api/admin/social/assets]", err);
      res.status(400).json({ message: "Erro ao criar ativo" });
    }
  });

  app.patch("/api/admin/social/assets/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getContentAsset(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ativo não encontrado" });
      if (existing.userId && existing.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      const { updateContentAssetSchema } = await import("@shared/schema");
      const parsed = updateContentAssetSchema.parse(req.body);
      const asset = await storage.updateContentAsset(req.params.id, parsed);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      res.json(asset);
    } catch (err) {
      console.error("[PATCH /api/admin/social/assets/:id]", err);
      res.status(400).json({ message: "Erro ao atualizar ativo" });
    }
  });

  app.delete("/api/admin/social/assets/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getContentAsset(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ativo não encontrado" });
      if (existing.userId && existing.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      await storage.deleteContentAsset(req.params.id);
      res.json({ message: "Ativo excluído" });
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir ativo" });
    }
  });

  app.get("/api/admin/social/calendar", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const assets = await storage.getCalendarAssets(month, req.user!.userId);
      // Group by date (YYYY-MM-DD) then by channel per spec
      const grouped: Record<string, Record<string, typeof assets>> = {};
      for (const asset of assets) {
        const dateKey = (asset.scheduledAt as Date).toISOString().slice(0, 10);
        if (!grouped[dateKey]) grouped[dateKey] = {};
        if (!grouped[dateKey][asset.channel]) grouped[dateKey][asset.channel] = [];
        grouped[dateKey][asset.channel].push(asset);
      }
      res.json(grouped);
    } catch (err) {
      res.status(500).json({ message: "Erro ao carregar calendário" });
    }
  });

  app.get("/api/admin/social/stats", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const stats = await storage.getSocialStats(req.user!.userId);
      res.json(stats);
    } catch (err) {
      console.error("[GET /api/admin/social/stats]", err);
      res.status(500).json({ message: "Erro ao obter estatísticas" });
    }
  });

  // ==================== SOCIAL WIZARD (Chat Wizard MFORTE) ====================
  app.post("/api/admin/social/wizard/start", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { idea, projectId } = req.body;
      if (!idea || !idea.trim()) return res.status(400).json({ message: "Ideia é obrigatória" });

      const userId = req.user!.userId;
      let leadershipStyle = "";
      let projectTone = "";
      if (projectId) {
        const project = await storage.getSocialProject(projectId, userId);
        if (project?.brand?.leadershipStyle) {
          const styleMap: Record<string, string> = {
            hormozi: "Alex Hormozi (ofertas irresistíveis, resultados mensuráveis, linguagem direta)",
            priestley: "Daniel Priestley (autoridade, ecossistemas de conteúdo, Key Person of Influence)",
            garyvee: "Gary Vaynerchuk (documentação da jornada, autenticidade radical, volume orgânico)",
          };
          leadershipStyle = styleMap[project.brand.leadershipStyle] || project.brand.leadershipStyle;
        }
        if (project?.brand?.tone) projectTone = project.brand.tone;
      }

      const openai = new OpenAI();
      const systemPrompt = `Você é um estrategista de conteúdo especializado em marketing de autoridade e construção de audiência.${leadershipStyle ? `\nFramework de referência: ${leadershipStyle}.` : ""}${projectTone ? `\nTom de voz: ${projectTone}.` : ""}
Responda SOMENTE em JSON válido, sem markdown, sem texto fora do JSON.`;

      const userPrompt = `Analise esta ideia e retorne exatamente este JSON:
{
  "ideaArea": "área do conhecimento (ex: Filosofia - Estoicismo, Neurociência, Liderança Estratégica)",
  "ideaSources": "2-3 autores ou referências que validam a ideia (ex: Viktor Frankl, Angela Duckworth, Simon Sinek)",
  "headlines": [
    "headline com gancho emocional forte",
    "headline com dado ou curiosidade surpreendente",
    "headline com promessa de transformação clara"
  ]
}

Ideia: "${idea.trim()}"`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "{}";
      const schema = z.object({
        ideaArea: z.string().default(""),
        ideaSources: z.string().default(""),
        headlines: z.array(z.string()).default([]),
      });

      let result: z.infer<typeof schema>;
      try {
        result = schema.parse(JSON.parse(content));
      } catch {
        return res.status(500).json({ message: "Erro ao processar resposta da IA" });
      }

      res.json(result);
    } catch (err) {
      console.error("[POST /api/admin/social/wizard/start]", err);
      res.status(500).json({ message: "Erro ao analisar ideia", error: err instanceof Error ? err.message : err });
    }
  });

  app.post("/api/admin/social/generate", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, idea, channel, tone, ideaArea: prefilledIdeaArea, ideaSources: prefilledIdeaSources } = req.body;
      if (!idea) return res.status(400).json({ message: "Ideia é obrigatória" });

      // Load project brand/leadership style if provided
      const userId = req.user!.userId;
      let leadershipStyle = "";
      if (projectId) {
        const project = await storage.getSocialProject(projectId, userId);
        if (!project) return res.status(403).json({ message: "Projeto não encontrado ou acesso negado" });
        if (project?.brand?.leadershipStyle) {
          const styleMap: Record<string, string> = {
            hormozi: "Alex Hormozi (foco em ofertas irresistíveis, resultados mensuráveis e linguagem direta e provocativa)",
            priestley: "Daniel Priestley (foco em construção de autoridade, ecossistemas de conteúdo e posicionamento como KPI — Key Person of Influence)",
            garyvee: "Gary Vaynerchuk (foco em documentação da jornada, autenticidade radical e volume de conteúdo orgânico)",
          };
          leadershipStyle = styleMap[project.brand.leadershipStyle] || project.brand.leadershipStyle;
        }
      }

      const openai = new OpenAI();
      const systemPrompt = `Você é um estrategista de conteúdo especializado em marketing digital e construção de autoridade.
Tom de voz: ${tone || "inspirador e profissional"}.
Canal principal: ${channel || "instagram"}.${leadershipStyle ? `\nFramework de liderança: ${leadershipStyle}.` : ""}
Responda SOMENTE em JSON válido, sem markdown, sem texto fora do JSON.`;

      const userPrompt = `Ideia central: "${idea}"

Gere um pacote completo de conteúdo em JSON com exatamente esta estrutura:
{
  "ideaArea": "área do conhecimento identificada (ex: Filosofia - Estoicismo, Neurociência, Liderança)",
  "ideaSources": "2-3 autores ou referências científicas/filosóficas que validam esta ideia (ex: Marcus Aurelius, Andrew Huberman, Viktor Frankl)",
  "headlines": ["headline 1 com gancho emocional", "headline 2 com dados/curiosidade", "headline 3 com promessa de transformação", "headline 4 com pergunta provocativa", "headline 5 com autoridade"],
  "article": "artigo completo para blog/LinkedIn com 500-700 palavras, focado em SEO, autoridade B2B e exemplos práticos",
  "podcastScript": "roteiro de podcast 15-30min: ABERTURA (gancho + apresentação do tema + o que o ouvinte vai aprender), BLOCO 1 (primeiro ponto principal com exemplo real), BLOCO 2 (segundo ponto com história ou dado), BLOCO 3 (terceiro ponto com insight transformador), CONCLUSÃO (síntese + CTA para próximo episódio ou ação)",
  "reelScript": "roteiro de Reels/TikTok 30-60s: GANCHO (primeiros 3s explosivos para parar o scroll), DESENVOLVIMENTO (valor rápido e concreto em 3 bullets), CTA (ação clara e urgente)",
  "liveScript": "roadmap de Live: ABERTURA (apresentação + expectativas + enquete inicial), BLOCO 1 (conteúdo principal com interação), BLOCO 2 (aprofundamento + Q&A), BLOCO 3 (case prático), ENCERRAMENTO (resumo + oferta/CTA + próxima live)",
  "socialAds": "copy completo de anúncio para captar Agentes de Fidelização: HEADLINE PODEROSA (1 linha), CORPO DO ANÚNCIO (problema → agitação → solução, 3-4 parágrafos curtos), CTA DIRETO (1 linha de ação), VARIAÇÃO A/B (versão alternativa mais curta para teste)"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "{}";
      const generatedSchema = z.object({
        ideaArea: z.string().optional(),
        ideaSources: z.string().optional(),
        headlines: z.array(z.string()).optional(),
        article: z.string().optional(),
        podcastScript: z.string().optional(),
        reelScript: z.string().optional(),
        liveScript: z.string().optional(),
        socialAds: z.string().optional(),
      });
      let generated: z.infer<typeof generatedSchema>;
      try {
        generated = generatedSchema.parse(JSON.parse(content));
      } catch {
        return res.status(500).json({ message: "Erro ao processar resposta da IA" });
      }

      const asset = await storage.createContentAsset({
        userId,
        projectId: projectId || null,
        sourceIdea: idea,
        ideaArea: prefilledIdeaArea || generated.ideaArea || null,
        ideaSources: prefilledIdeaSources || generated.ideaSources || null,
        formats: {
          headlines: generated.headlines || [],
          article: generated.article || "",
          podcastScript: generated.podcastScript || "",
          reelScript: generated.reelScript || "",
          liveScript: generated.liveScript || "",
          socialAds: generated.socialAds || "",
        },
        usedPrompt: userPrompt,
        channel: (["instagram", "tiktok", "youtube", "linkedin", "blog", "whatsapp"].includes(channel) ? channel : "instagram") as "instagram" | "tiktok" | "youtube" | "linkedin" | "blog" | "whatsapp",
        status: "draft" as const,
      });

      res.status(201).json(asset);
    } catch (err) {
      console.error("[POST /api/admin/social/generate]", err);
      res.status(500).json({ message: "Erro ao gerar conteúdo", error: err instanceof Error ? err.message : err });
    }
  });

  app.post("/api/admin/social/assets/:id/tts", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });

      const text = asset.formats?.podcastScript || asset.sourceIdea;
      if (!text) return res.status(400).json({ message: "Nenhum roteiro disponível para TTS" });

      const allowedVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
      type TtsVoice = typeof allowedVoices[number];
      const voiceInput = (req.body.voice as string) || "nova";
      const voice: TtsVoice = allowedVoices.includes(voiceInput as TtsVoice) ? (voiceInput as TtsVoice) : "nova";
      const openai = new OpenAI();
      const audioResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice,
        input: text.slice(0, 4096),
      });

      const audioDir = path.join(process.cwd(), "uploads", "social-audio");
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

      const filename = `tts-${asset.id}-${Date.now()}.mp3`;
      const filepath = path.join(audioDir, filename);
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      fs.writeFileSync(filepath, buffer);

      const audioUrl = `/uploads/social-audio/${filename}`;
      const updatedAsset = await storage.updateContentAsset(asset.id, {
        formats: { ...asset.formats, audioUrl },
      });

      res.json({ audioUrl, asset: updatedAsset });
    } catch (err) {
      console.error("[POST /api/admin/social/assets/:id/tts]", err);
      res.status(500).json({ message: "Erro ao gerar áudio TTS", error: err instanceof Error ? err.message : err });
    }
  });

  app.post("/api/admin/social/assets/:id/elevenlabs-tts", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });

      if (!asset.projectId) return res.status(400).json({ message: "Ativo não pertence a um projeto" });
      const project = await storage.getSocialProject(asset.projectId, req.user!.userId);
      if (!project) return res.status(404).json({ message: "Projeto não encontrado" });

      const cloningIds = project.brand?.cloningIds;
      if (!cloningIds?.elevenLabsApiKey || !cloningIds?.elevenLabsVoiceId) {
        return res.status(400).json({ message: "Credenciais ElevenLabs não configuradas neste projeto. Configure a API Key e Voice ID nas configurações do projeto." });
      }

      const scriptText = asset.formats?.podcastScript || asset.formats?.reelScript || asset.formats?.liveScript || asset.sourceIdea;
      if (!scriptText) return res.status(400).json({ message: "Nenhum roteiro disponível para clonar voz" });

      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cloningIds.elevenLabsVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": cloningIds.elevenLabsApiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: scriptText.slice(0, 5000),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!elRes.ok) {
        const errBody = await elRes.text();
        console.error("[ElevenLabs TTS]", elRes.status, errBody);
        return res.status(502).json({ message: `Erro na API ElevenLabs: ${elRes.status}`, detail: errBody });
      }

      const audioDir = path.join(process.cwd(), "uploads", "social-audio");
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

      const filename = `elevenlabs-${asset.id}-${Date.now()}.mp3`;
      const filepath = path.join(audioDir, filename);
      const buffer = Buffer.from(await elRes.arrayBuffer());
      fs.writeFileSync(filepath, buffer);

      const elevenLabsAudioUrl = `/uploads/social-audio/${filename}`;
      const updatedAsset = await storage.updateContentAsset(asset.id, {
        formats: { ...asset.formats, elevenLabsAudioUrl },
      });

      res.json({ elevenLabsAudioUrl, asset: updatedAsset });
    } catch (err) {
      console.error("[POST /api/admin/social/assets/:id/elevenlabs-tts]", err);
      res.status(500).json({ message: "Erro ao gerar áudio ElevenLabs", error: err instanceof Error ? err.message : err });
    }
  });

  app.post("/api/admin/social/assets/:id/heygen-video", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });

      if (!asset.projectId) return res.status(400).json({ message: "Ativo não pertence a um projeto" });
      const project = await storage.getSocialProject(asset.projectId, req.user!.userId);
      if (!project) return res.status(404).json({ message: "Projeto não encontrado" });

      const cloningIds = project.brand?.cloningIds;
      if (!cloningIds?.heygenApiKey || !cloningIds?.heygenAvatarId) {
        return res.status(400).json({ message: "Credenciais HeyGen não configuradas neste projeto. Configure a API Key e Avatar ID nas configurações do projeto." });
      }

      const scriptType = (req.body.scriptType as string) || "reelScript";
      const scriptText = scriptType === "liveScript"
        ? (asset.formats?.liveScript || asset.formats?.reelScript || asset.sourceIdea)
        : (asset.formats?.reelScript || asset.formats?.liveScript || asset.sourceIdea);

      if (!scriptText) return res.status(400).json({ message: "Nenhum roteiro disponível para gerar vídeo" });

      const heygenPayload = {
        video_inputs: [{
          character: { type: "avatar", avatar_id: cloningIds.heygenAvatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: scriptText.slice(0, 1500), speed: 1.0 },
          background: { type: "color", value: "#ffffff" },
        }],
        dimension: { width: 1280, height: 720 },
        test: false,
        caption: false,
      };

      const heyRes = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": cloningIds.heygenApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(heygenPayload),
      });

      if (!heyRes.ok) {
        const errBody = await heyRes.text();
        console.error("[HeyGen]", heyRes.status, errBody);
        return res.status(502).json({ message: `Erro na API HeyGen: ${heyRes.status}`, detail: errBody });
      }

      const heyData = await heyRes.json() as { data?: { video_id?: string }; video_id?: string };
      const heygenVideoId = heyData?.data?.video_id || heyData?.video_id;
      if (!heygenVideoId) return res.status(502).json({ message: "HeyGen não retornou video_id" });

      const updatedAsset = await storage.updateContentAsset(asset.id, {
        formats: { ...asset.formats, heygenVideoId, heygenVideoStatus: "processing", heygenVideoUrl: undefined },
      });

      res.json({ heygenVideoId, heygenVideoStatus: "processing", asset: updatedAsset });
    } catch (err) {
      console.error("[POST /api/admin/social/assets/:id/heygen-video]", err);
      res.status(500).json({ message: "Erro ao gerar vídeo HeyGen", error: err instanceof Error ? err.message : err });
    }
  });

  app.get("/api/admin/social/assets/:id/heygen-status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });

      const heygenVideoId = asset.formats?.heygenVideoId;
      if (!heygenVideoId) return res.status(400).json({ message: "Nenhum vídeo HeyGen em processamento" });

      if (!asset.projectId) return res.status(400).json({ message: "Ativo não pertence a um projeto" });
      const project = await storage.getSocialProject(asset.projectId, req.user!.userId);
      const cloningIds = project?.brand?.cloningIds;
      if (!cloningIds?.heygenApiKey) return res.status(400).json({ message: "Credenciais HeyGen não configuradas" });

      const statusRes = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`, {
        headers: { "X-Api-Key": cloningIds.heygenApiKey },
      });

      if (!statusRes.ok) {
        return res.status(502).json({ message: `Erro ao verificar status HeyGen: ${statusRes.status}` });
      }

      const statusData = await statusRes.json() as { data?: { status?: string; video_url?: string; video_url_caption?: string } };
      const videoStatus = statusData?.data?.status;
      const videoUrl = statusData?.data?.video_url;

      let updatedAsset = asset;
      if (videoStatus === "completed" && videoUrl) {
        updatedAsset = (await storage.updateContentAsset(asset.id, {
          formats: { ...asset.formats, heygenVideoUrl: videoUrl, heygenVideoStatus: "completed" },
        })) || asset;
      } else if (videoStatus === "failed") {
        updatedAsset = (await storage.updateContentAsset(asset.id, {
          formats: { ...asset.formats, heygenVideoStatus: "failed" },
        })) || asset;
      }

      res.json({ heygenVideoId, heygenVideoStatus: videoStatus || asset.formats?.heygenVideoStatus, heygenVideoUrl: videoUrl || asset.formats?.heygenVideoUrl, asset: updatedAsset });
    } catch (err) {
      console.error("[GET /api/admin/social/assets/:id/heygen-status]", err);
      res.status(500).json({ message: "Erro ao verificar status HeyGen" });
    }
  });

  app.post("/api/admin/social/assets/:id/generate-utm", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });

      const { baseUrl, campaignSource, campaignMedium, campaignName } = req.body;
      if (!baseUrl) return res.status(400).json({ message: "baseUrl é obrigatória" });

      const url = new URL(baseUrl);
      url.searchParams.set("utm_source", campaignSource || asset.channel);
      url.searchParams.set("utm_medium", campaignMedium || "social");
      url.searchParams.set("utm_campaign", campaignName || asset.sourceIdea.slice(0, 30).replace(/\s+/g, "_").toLowerCase());
      url.searchParams.set("utm_content", asset.id);

      const utmLink = url.toString();
      const updatedAsset = await storage.updateContentAsset(asset.id, { utmLink });
      res.json({ utmLink, asset: updatedAsset });
    } catch (err) {
      console.error("[POST /api/admin/social/assets/:id/generate-utm]", err);
      res.status(500).json({ message: "Erro ao gerar link UTM" });
    }
  });

  // Publication schedules
  app.get("/api/admin/social/assets/:id/schedules", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const asset = await storage.getContentAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (!asset.userId || asset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      const schedules = await storage.getPublicationSchedulesByAsset(req.params.id);
      res.json(schedules);
    } catch (err) {
      console.error("[GET /api/admin/social/assets/:id/schedules]", err);
      res.status(500).json({ message: "Erro ao listar agendamentos" });
    }
  });

  app.post("/api/admin/social/assets/:id/schedules", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const ownerAsset = await storage.getContentAsset(req.params.id);
      if (!ownerAsset) return res.status(404).json({ message: "Ativo não encontrado" });
      if (ownerAsset.userId && ownerAsset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      const { platform, scheduledTime, notes } = req.body;
      if (!platform || !scheduledTime) return res.status(400).json({ message: "Platform e scheduledTime são obrigatórios" });
      const schedule = await storage.createPublicationSchedule({
        assetId: req.params.id,
        platform,
        scheduledTime: new Date(scheduledTime),
        status: "planned",
        notes: notes || null,
      });
      res.status(201).json(schedule);
    } catch (err) {
      console.error("[POST /api/admin/social/assets/:id/schedules]", err);
      res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });

  app.patch("/api/admin/social/schedules/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const existingSched = await storage.getPublicationSchedule(req.params.id);
      if (!existingSched) return res.status(404).json({ message: "Agendamento não encontrado" });
      const schedAsset = await storage.getContentAsset(existingSched.assetId);
      if (schedAsset && schedAsset.userId && schedAsset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      const allowedScheduleStatuses = ["planned", "sent", "manual"] as const;
      type ScheduleStatus = typeof allowedScheduleStatuses[number];
      const rawStatus = req.body.status as string;
      if (!allowedScheduleStatuses.includes(rawStatus as ScheduleStatus)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      const status = rawStatus as ScheduleStatus;
      const schedule = await storage.updatePublicationSchedule(req.params.id, status);
      if (!schedule) return res.status(404).json({ message: "Agendamento não encontrado" });
      res.json(schedule);
    } catch (err) {
      console.error("[PATCH /api/admin/social/schedules/:id]", err);
      res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  app.delete("/api/admin/social/schedules/:id", authenticateToken, checkRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const existingSched = await storage.getPublicationSchedule(req.params.id);
      if (!existingSched) return res.status(404).json({ message: "Agendamento não encontrado" });
      const schedAsset = await storage.getContentAsset(existingSched.assetId);
      if (schedAsset && schedAsset.userId && schedAsset.userId !== req.user!.userId) return res.status(403).json({ message: "Acesso negado" });
      await storage.deletePublicationSchedule(req.params.id);
      res.status(204).end();
    } catch (err) {
      console.error("[DELETE /api/admin/social/schedules/:id]", err);
      res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });

  return httpServer;
}

async function getAllEvolutionConfigs() {
  const { db } = await import("./db");
  const { evolutionConfigs } = await import("@shared/schema");
  return db.select().from(evolutionConfigs);
}
