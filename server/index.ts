import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initializeSocket } from "./socket";
import { db } from "./db";
import { users, roles, permissions, rolePermissions, userRoles, flowTemplates, documentationVersions, projectStatusItems } from "@shared/schema";
import { eq, gte, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jobQueue } from "./jobQueue";
import { startLearningWorker } from "./learningWorker";
import { startCampaignWorker } from "./campaignWorker";

const RBAC_SEED = {
  roles: [
    { name: "super_admin", description: "Acesso total ao sistema" },
    { name: "admin", description: "Gerente com acesso limitado" },
    { name: "user", description: "Atendente com acesso básico" },
  ],
  permissions: [
    { name: "view_settings", resource: "settings", action: "view", description: "Visualizar configurações" },
    { name: "edit_settings", resource: "settings", action: "edit", description: "Editar configurações" },
    { name: "delete_settings", resource: "settings", action: "delete", description: "Deletar configurações" },
    { name: "view_users", resource: "users", action: "view", description: "Visualizar usuários" },
    { name: "create_users", resource: "users", action: "create", description: "Criar usuários" },
    { name: "edit_users", resource: "users", action: "edit", description: "Editar usuários" },
    { name: "delete_users", resource: "users", action: "delete", description: "Deletar usuários" },
    { name: "view_audit_logs", resource: "audit_logs", action: "view", description: "Visualizar logs" },
    { name: "export_audit_logs", resource: "audit_logs", action: "export", description: "Exportar logs" },
    { name: "view_inbox", resource: "inbox", action: "view", description: "Visualizar inbox" },
    { name: "edit_inbox", resource: "inbox", action: "edit", description: "Editar inbox" },
    { name: "view_leads", resource: "leads", action: "view", description: "Visualizar leads" },
    { name: "create_leads", resource: "leads", action: "create", description: "Criar leads" },
    { name: "edit_leads", resource: "leads", action: "edit", description: "Editar leads" },
    { name: "view_api_configs", resource: "api_configs", action: "view", description: "Visualizar APIs" },
    { name: "edit_api_configs", resource: "api_configs", action: "edit", description: "Editar APIs" },
    { name: "manage_roles", resource: "roles", action: "manage", description: "Gerenciar roles" },
    { name: "assign_roles", resource: "roles", action: "assign", description: "Atribuir roles" },
  ],
  rolePermissions: {
    super_admin: "all",
    admin: [
      "view_settings", "edit_settings",
      "view_users", "create_users", "edit_users",
      "view_audit_logs",
      "view_inbox", "edit_inbox",
      "view_leads", "create_leads", "edit_leads",
    ],
    user: [
      "view_inbox", "edit_inbox",
      "view_leads", "create_leads", "edit_leads",
    ],
  } as Record<string, string | string[]>,
};

async function ensureRBAC() {
  try {
    const existingRoles = await db.select({ name: roles.name }).from(roles);
    if (existingRoles.length >= 3) {
      log(`RBAC seed OK (${existingRoles.length} roles)`, "seed");
      return;
    }

    for (const r of RBAC_SEED.roles) {
      const exists = existingRoles.find((er) => er.name === r.name);
      if (!exists) {
        await db.insert(roles).values(r);
      }
    }

    const existingPerms = await db.select({ name: permissions.name }).from(permissions);
    for (const p of RBAC_SEED.permissions) {
      const exists = existingPerms.find((ep) => ep.name === p.name);
      if (!exists) {
        await db.insert(permissions).values(p);
      }
    }

    const allRoles = await db.select().from(roles);
    const allPerms = await db.select().from(permissions);
    const existingRP = await db.select().from(rolePermissions);

    for (const [roleName, permList] of Object.entries(RBAC_SEED.rolePermissions)) {
      const role = allRoles.find((r) => r.name === roleName);
      if (!role) continue;

      const assignPerms = permList === "all" ? allPerms : allPerms.filter((p) => (permList as string[]).includes(p.name));
      for (const perm of assignPerms) {
        const exists = existingRP.find((rp) => rp.roleId === role.id && rp.permissionId === perm.id);
        if (!exists) {
          await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id });
        }
      }
    }

    log(`RBAC seed completed (${RBAC_SEED.roles.length} roles, ${RBAC_SEED.permissions.length} permissions)`, "seed");
  } catch (err) {
    console.error("Error seeding RBAC:", err);
  }
}

async function ensureAdminUser() {
  try {
    const existing = await db
      .select({ id: users.id, tipoAtor: users.tipoAtor })
      .from(users)
      .where(eq(users.email, "admin@quantaflow.com"))
      .limit(1);

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await db.insert(users).values({
        email: "admin@quantaflow.com",
        password: hashedPassword,
        nome: "Admin",
        tipoAtor: "admin",
        status: "active",
        tokenVersion: 0,
        mustChangePassword: true,
      });
      log("Admin user created: admin@quantaflow.com", "seed");
    } else {
      log(`Admin user exists (id: ${existing[0].id})`, "seed");
    }
  } catch (err) {
    console.error("Error ensuring admin user:", err);
  }
}

const FLOW_TEMPLATE_SEEDS = [
  {
    id: "tpl_welcome",
    name: "Boas-vindas",
    description: "Fluxo de boas-vindas para novos contatos",
    category: "onboarding",
    blocks: [
      { id: "b1", type: "text", label: "Saudação", config: { message: "Olá {nome}! 👋 Seja bem-vindo(a)! Como posso te ajudar hoje?" }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "delay", label: "Aguardar resposta", config: { delaySeconds: 60, delayUnit: "seconds" }, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "text", label: "Follow-up", config: { message: "Estou aqui se precisar de algo! 😊" }, position: { x: 250, y: 350 }, nextBlockId: null },
    ],
  },
  {
    id: "tpl_qualification",
    name: "Qualificação de Vendas",
    description: "Qualifica leads automaticamente e encaminha quentes para humano",
    category: "vendas",
    blocks: [
      { id: "b1", type: "text", label: "Pergunta inicial", config: { message: "Olá {nome}! Obrigado pelo interesse. Pode me contar mais sobre o que você precisa?" }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "ai_agent", label: "IA Qualifica", config: {}, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "condition", label: "Lead Quente?", config: { conditionType: "temperature", conditionValue: "quente" }, position: { x: 250, y: 350 }, conditionTrueId: "b4", conditionFalseId: "b5" },
      { id: "b4", type: "queue_entry", label: "Fila VIP", config: { slaMinutes: 15 }, position: { x: 500, y: 500 }, nextBlockId: null },
      { id: "b5", type: "update_lead", label: "Marcar Morno", config: { leadTemperature: "morno" }, position: { x: 0, y: 500 }, nextBlockId: "b6" },
      { id: "b6", type: "text", label: "Nutrição", config: { message: "Vou te enviar mais informações sobre nossos serviços! 📋" }, position: { x: 0, y: 650 }, nextBlockId: null },
    ],
  },
  {
    id: "tpl_support",
    name: "Suporte Técnico",
    description: "Atendimento de suporte com IA e escalação para humano",
    category: "suporte",
    blocks: [
      { id: "b1", type: "text", label: "Início", config: { message: "Olá! Sou o assistente de suporte. Descreva sua dúvida e vou te ajudar." }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "ai_agent", label: "IA Resolve", config: {}, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "condition", label: "Resolvido?", config: { conditionType: "keyword", conditionValue: "obrigado,resolvido,entendi" }, position: { x: 250, y: 350 }, conditionTrueId: "b4", conditionFalseId: "b5" },
      { id: "b4", type: "resolve", label: "Finalizar", config: {}, position: { x: 500, y: 500 }, nextBlockId: null },
      { id: "b5", type: "queue_entry", label: "Escalar Humano", config: { slaMinutes: 30 }, position: { x: 0, y: 500 }, nextBlockId: null },
    ],
  },
  {
    id: "tpl_billing",
    name: "Cobrança",
    description: "Fluxo de cobrança com lembrete e escalação",
    category: "financeiro",
    blocks: [
      { id: "b1", type: "text", label: "Lembrete", config: { message: "Olá {nome}, identificamos uma pendência em sua conta. Pode verificar?" }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "delay", label: "Aguardar 24h", config: { delaySeconds: 86400, delayUnit: "seconds" }, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "condition", label: "Respondeu?", config: { conditionType: "keyword", conditionValue: "paguei,vou pagar,já resolvi" }, position: { x: 250, y: 350 }, conditionTrueId: "b4", conditionFalseId: "b5" },
      { id: "b4", type: "resolve", label: "Resolver", config: {}, position: { x: 500, y: 500 }, nextBlockId: null },
      { id: "b5", type: "text", label: "2º Lembrete", config: { message: "Olá {nome}, gostaríamos de resolver sua pendência. Entre em contato conosco." }, position: { x: 0, y: 500 }, nextBlockId: "b6" },
      { id: "b6", type: "queue_entry", label: "Atendimento", config: { slaMinutes: 60 }, position: { x: 0, y: 650 }, nextBlockId: null },
    ],
  },
  {
    id: "tpl_onboarding",
    name: "Onboarding",
    description: "Fluxo de onboarding para novos clientes",
    category: "onboarding",
    blocks: [
      { id: "b1", type: "text", label: "Boas-vindas", config: { message: "Bem-vindo(a) {nome}! 🎉 Vamos configurar tudo para você aproveitar ao máximo." }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "delay", label: "5 min", config: { delaySeconds: 300, delayUnit: "seconds" }, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "text", label: "Dica 1", config: { message: "💡 Dica: Comece explorando o painel principal. Lá você encontra tudo que precisa!" }, position: { x: 250, y: 350 }, nextBlockId: "b4" },
      { id: "b4", type: "delay", label: "1 hora", config: { delaySeconds: 3600, delayUnit: "seconds" }, position: { x: 250, y: 500 }, nextBlockId: "b5" },
      { id: "b5", type: "text", label: "Dica 2", config: { message: "📊 Sabia que você pode personalizar seus relatórios? Acesse Configurações > Relatórios." }, position: { x: 250, y: 650 }, nextBlockId: "b6" },
      { id: "b6", type: "update_lead", label: "Onboarded", config: { leadStage: "qualificado", leadTag: "onboarded" }, position: { x: 250, y: 800 }, nextBlockId: null },
    ],
  },
];

async function seedFlowTemplates() {
  try {
    const existing = await db.select({ id: flowTemplates.id }).from(flowTemplates);
    const existingIds = new Set(existing.map((t) => t.id));

    for (const tpl of FLOW_TEMPLATE_SEEDS) {
      if (!existingIds.has(tpl.id)) {
        await db.insert(flowTemplates).values(tpl);
      }
    }
    log(`Flow templates seed OK (${FLOW_TEMPLATE_SEEDS.length} templates)`, "seed");
  } catch (err) {
    console.error("Error seeding flow templates:", err);
  }
}

async function seedDocumentationVersions() {
  try {
    const adminUser = await db.select({ id: users.id }).from(users).where(eq(users.email, "admin@quantaflow.com")).limit(1);
    if (adminUser.length === 0) return;
    const adminId = adminUser[0].id;

    await db.delete(documentationVersions).where(eq(documentationVersions.version, "1.0.0"));

    const v7exists = await db.select({ id: documentationVersions.id }).from(documentationVersions).where(gte(documentationVersions.version, "7.0.0")).limit(1);
    if (v7exists.length === 0) {
      await db.insert(documentationVersions).values({
        userId: adminId,
        version: "7.0.0",
        title: "Quanta Flow — Documentação Técnica Completa v7.0.0",
        description: "Versão completa com todos os módulos: Inbox Omnichannel, CRM/Kanban, Automação + Builder Visual + Simulador de Conversa, Fábrica de Agentes IA, Campanhas Omnichannel + Drip, Fila de Atendimento + SLA, Microlearning, Webhooks Outbound + HMAC, Google Sheets OAuth2, Lab (5 abas), Branding White-label, RBAC (18 permissões), Estúdio de Conteúdo Omnichannel com IA (Social/Ads), Chat Wizard MFORTE, Clonagem de Voz e Avatar (ElevenLabs + HeyGen), Manual Completo com visualizador inline.",
        content: `# Quanta Flow v7.0.0 — Documentação Técnica

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + Shadcn UI
- Backend: Node.js + Express.js + TypeScript
- Banco: PostgreSQL + Drizzle ORM
- Auth: JWT (24h) + bcrypt + tokenVersion
- Real-time: Socket.io (/inbox namespace)
- IA: OpenAI gpt-4o-mini via Replit AI Integrations

## Módulos

### Inbox Omnichannel
- Canais: WhatsApp (Z-API / Baileys), Telegram, Instagram, Email
- Real-time: Socket.io emite message_received, instance_connected
- Fila de Atendimento: queueStatus (waiting/assigned/resolved), SLA timer
- Timestamp completo nas mensagens (dd/MM HH:mm)

### CRM / Pipeline Kanban
- Leads criados automaticamente na 1ª mensagem recebida
- Score 0-20 calculado por IA (OpenAI)
- Temperatura: cold/warm/hot | Intenção: compra_quente/duvida/reclamacao/indefinido
- Kanban drag-and-drop com filtros por temperatura, intenção, agente

### Automação — Builder Visual
- React Flow canvas com 10 tipos de blocos: text, audio_tts, image_ai, delay, condition, ai_agent, webhook, queue_entry, resolve, update_lead
- Variáveis: {nome}, {telefone}, {email}
- Detecção de ciclos (máx 50 passos), root-node auto-detection
- 5 templates built-in | Export/Import JSON
- Geração de fluxo via GPT-4o-mini

### Simulador de Conversa Interativo
- Endpoint: POST /api/admin/lab/simulate-flow-chat
- Executa blocos reais do fluxo: ai_agent chama OpenAI com systemPrompt real
- Condições avaliadas em tempo real | Estado mantido no frontend (stateless backend)

### Fábrica de Agentes IA
- CRUD: GET/POST/PUT/DELETE /api/admin/agents
- Campos: model, temperature, tone, specialty, systemPrompt, ttsVoice, maxTokens
- Chat preview: POST /api/admin/agents/:id/chat
- TTS: POST /api/admin/agents/:id/tts
- Avatar IA: POST /api/admin/agents/generate-avatar

### Campanhas Omnichannel
- Tipos: broadcast e drip sequence
- Segmentação: temperatura, estágio, canal
- Geração de copy: POST /api/admin/campaigns/generate-copy
- Prévia de segmento: POST /api/admin/campaigns/preview-segment
- CampaignWorker: executa a cada 60s, respeita rate limits e allowed hours
- Métricas: sent/delivered/read/replied/converted
- Templates: CRUD /api/admin/templates

### Fila de Atendimento
- queueStatus: waiting → assigned → resolved
- SLA deadline configurável (Branding.defaultSlaMinutes)
- Timer vermelho no Inbox quando SLA ultrapassado

### Microlearning
- Trilhas com gatilho por estágio do lead
- LearningWorker: executa a cada 5min
- Rastreamento de entrega por lead

### Webhooks Outbound
- Eventos: lead.created, lead.qualified, flow.success, flow.interrupt, conversation.closed
- HMAC-SHA256 no header X-Quanta-Signature
- Timeout 5s por chamada | WebhookDispatcher assíncrono

### Google Sheets
- OAuth2 com Google | Append de linha por evento
- Mapeamento configurável de colunas

### Lab (5 abas)
- Flow Sim: simulador de conversa interativo
- TTS: teste de voz dos agentes
- Imagem IA: geração e preview de imagens
- Webhooks: teste de disparo de webhooks
- WhatsApp: teste de envio de mensagem real

### Branding White-label
- companyName, primaryColor, secondaryColor, logoUrl, faviconUrl, defaultSlaMinutes

### RBAC
- Roles: super_admin, admin, user
- 18 permissões em 7 recursos: settings, users, audit_logs, inbox, leads, automation, campaigns
- Middleware: checkRole([...roles])

### Estúdio de Conteúdo Omnichannel (Social/Ads)
- Projetos de marca com tom, nicho, cores, estilo de liderança (UUID PK, userId-scoped)
- Geração de conteúdo: POST /api/admin/social/generate — 6 formatos via gpt-4o-mini (headlines, caption, hooks, socialAds, email, blogPost)
- TTS de áudio: POST /api/admin/social/assets/:id/tts — voz OpenAI (nova/alloy/echo/onyx/shimmer)
- Construtor UTM: POST /api/admin/social/assets/:id/generate-utm
- Biblioteca filtrável: GET /api/admin/social/assets (filtros: status, canal, projectId)
- Calendário: GET /api/admin/social/calendar?month=YYYY-MM (agrupado por data/canal)
- Agendamentos: CRUD /api/admin/social/assets/:id/schedules
- Dashboard: GET /api/admin/social/stats
- Chat Wizard MFORTE: POST /api/admin/social/wizard/start — enriquece ideia com área, fontes e 3 headlines via GPT-4o-mini

### Clonagem de Voz e Avatar (ElevenLabs + HeyGen)
- Credenciais armazenadas em brand.cloningIds (JSONB criptografado) — jamais retornadas em GET
- GET /api/admin/social/projects retorna hasElevenLabs e hasHeyGen (booleans) em vez das credenciais
- ElevenLabs TTS: POST /api/admin/social/assets/:id/elevenlabs-tts — modelo eleven_multilingual_v2, armazena elevenLabsAudioUrl em formats JSONB
- HeyGen Vídeo: POST /api/admin/social/assets/:id/heygen-video — usa roteiro (reelScript/liveScript), armazena heygenVideoId/Status/Url em formats JSONB
- Polling de status: GET /api/admin/social/assets/:id/heygen-status — verifica /v2/video_status.get
- UI: botão de geração com feedback de status (processando/concluído/falhou), player de áudio, player de vídeo, download e cópia de URL

### Documentação
- Manual de uso: MANUAL_DE_USO.md (19 seções + subseções, v7.0.0)
- GET /api/documentation/manual-md — serve markdown para visualizador inline
- GET /api/documentation/manual-pdf — gera PDF via pdfkit
- Visualizador inline sem bibliotecas externas (renderMarkdown custom)

## Tabelas Principais
users, leads, conversations, messages, unified_contacts, agent_assignments,
automation_flows, ai_agents, campaigns, campaign_deliveries, message_templates,
learning_tracks, learning_deliveries, outbound_webhooks, sheet_integrations,
email_configs, api_configs, settings, roles, permissions, role_permissions,
user_roles, audit_logs, documentation_versions,
social_projects (UUID PK, brand JSONB c/ cloningIds),
content_assets (UUID PK, formats JSONB c/ elevenLabsAudioUrl/heygenVideoId/Status/Url),
publication_schedules (UUID PK)

## JobQueue (5s interval)
- send_message, check_inactivity, check_sla

## Endpoints principais
- POST /api/auth/login | GET /api/auth/me
- GET/POST/PUT/DELETE /api/leads
- GET/POST /api/messages/:conversationId
- GET/POST/PUT/DELETE /api/admin/automation-flows
- POST /api/admin/automation-flows/:id/execute
- GET/POST/PUT/DELETE /api/admin/agents
- GET/POST/PUT/DELETE /api/admin/campaigns
- POST /api/admin/campaigns/:id/start | /pause
- GET /api/admin/campaigns/:id/metrics
- GET/POST/PUT/DELETE /api/admin/users
- GET /api/admin/audit-logs
- GET/POST /api/admin/settings
- GET /api/health
- GET/POST/PATCH/DELETE /api/admin/social/projects
- GET/POST/DELETE /api/admin/social/assets
- POST /api/admin/social/generate
- POST /api/admin/social/wizard/start
- GET /api/admin/social/calendar
- GET /api/admin/social/stats
- POST /api/admin/social/assets/:id/tts
- POST /api/admin/social/assets/:id/elevenlabs-tts
- POST /api/admin/social/assets/:id/heygen-video
- GET /api/admin/social/assets/:id/heygen-status
- POST /api/admin/social/assets/:id/generate-utm
`,
        format: "markdown",
      });
    }
    log("Documentation versions seed OK (v7.0.0)", "seed");
  } catch (err) {
    console.error("Error seeding documentation versions:", err);
  }
}

async function migrateProjectStatusItems() {
  try {
    await db.execute(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_priority') THEN
          CREATE TYPE project_status_priority AS ENUM ('alta', 'media', 'baixa');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status_status') THEN
          CREATE TYPE project_status_status AS ENUM ('concluido', 'em_curso', 'pendente', 'pausado');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS project_status_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id VARCHAR(20) NOT NULL,
        feature_name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'geral',
        priority project_status_priority NOT NULL DEFAULT 'media',
        status project_status_status NOT NULL DEFAULT 'pendente',
        progress INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    log("Project status items migration OK", "seed");
  } catch (err) {
    console.error("Error migrating project status items:", err);
  }
}

async function seedProjectStatusItems() {
  try {
    const existing = await db.select({ id: projectStatusItems.id }).from(projectStatusItems).limit(1);
    if (existing.length > 0) {
      log("Project status items seed OK (already seeded)", "seed");
      return;
    }

    const items = [
      { featureId: "F01", featureName: "Autenticação JWT + tokenVersion", category: "Auth & Segurança", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 1 },
      { featureId: "F02", featureName: "RBAC — 18 permissões / 3 roles", category: "Auth & Segurança", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 2 },
      { featureId: "F03", featureName: "Criptografia AES-256-CBC de settings", category: "Auth & Segurança", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 3 },
      { featureId: "F04", featureName: "Inbox Omnichannel (WhatsApp/Telegram/Instagram/Email)", category: "Comunicação", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 4 },
      { featureId: "F05", featureName: "Real-time Socket.io (/inbox namespace)", category: "Comunicação", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 5 },
      { featureId: "F06", featureName: "CRM / Pipeline Kanban", category: "CRM", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 6 },
      { featureId: "F07", featureName: "AI Intent Detection (score 0-20, temperatura)", category: "CRM", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 7 },
      { featureId: "F08", featureName: "Fila de Atendimento + SLA Timer", category: "CRM", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 8 },
      { featureId: "F09", featureName: "Builder Visual de Fluxos (React Flow + 10 blocos)", category: "Automação", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 9 },
      { featureId: "F10", featureName: "Simulador de Conversa Interativo (Lab → Flow Sim)", category: "Automação", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 10 },
      { featureId: "F11", featureName: "Fábrica de Agentes IA (CRUD + chat preview + TTS)", category: "IA", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 11 },
      { featureId: "F12", featureName: "Campanhas Omnichannel (Broadcast + Drip)", category: "Marketing", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 12 },
      { featureId: "F13", featureName: "Biblioteca de Templates de Mensagem", category: "Marketing", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 13 },
      { featureId: "F14", featureName: "Microlearning (Trilhas + LearningWorker)", category: "Conteúdo", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 14 },
      { featureId: "F15", featureName: "Webhooks Outbound + HMAC-SHA256", category: "Integrações", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 15 },
      { featureId: "F16", featureName: "Google Sheets OAuth2 Integration", category: "Integrações", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 16 },
      { featureId: "F17", featureName: "Branding White-label (companyName, cores, logo)", category: "Config", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 17 },
      { featureId: "F18", featureName: "Estúdio de Conteúdo Omnichannel (Social/Ads)", category: "Social", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 18 },
      { featureId: "F19", featureName: "Chat Wizard MFORTE (enriquecimento de ideia)", category: "Social", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 19 },
      { featureId: "F20", featureName: "Clonagem de Voz (ElevenLabs) + Avatar (HeyGen)", category: "Social", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 20 },
      { featureId: "F21", featureName: "Lab (5 abas: Flow Sim, TTS, Imagem IA, Webhooks, WhatsApp)", category: "Dev/Testes", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 21 },
      { featureId: "F22", featureName: "Manual de Uso (PDF + visualizador inline)", category: "Documentação", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 22 },
      { featureId: "F23", featureName: "Apresentação Comercial (.pptx)", category: "Documentação", priority: "baixa" as const, status: "concluido" as const, progress: 100, sortOrder: 23 },
      { featureId: "F24", featureName: "FLOW Standard: CLAUDE.md, CHANGELOG, Dicionário, Status", category: "Dev/Testes", priority: "alta" as const, status: "concluido" as const, progress: 100, sortOrder: 24 },
      { featureId: "F25", featureName: "Lab → Aba Protocolos (Smoke Tests + DoD)", category: "Dev/Testes", priority: "media" as const, status: "concluido" as const, progress: 100, sortOrder: 25 },
    ];

    for (const item of items) {
      await db.insert(projectStatusItems).values(item);
    }
    log(`Project status items seeded (${items.length} features)`, "seed");
  } catch (err) {
    console.error("Error seeding project status items:", err);
  }
}

const app = express();
const httpServer = createServer(app);

initializeSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const sensitiveRoutes = ["/api/auth/login", "/api/auth/register", "/api/auth/me"];
        if (sensitiveRoutes.some(r => path.startsWith(r))) {
          logLine += ` :: {redacted}`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureRBAC();
  await ensureAdminUser();
  await seedFlowTemplates();
  await seedDocumentationVersions();
  await migrateProjectStatusItems();
  await seedProjectStatusItems();
  jobQueue.start();
  startLearningWorker();
  startCampaignWorker();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
