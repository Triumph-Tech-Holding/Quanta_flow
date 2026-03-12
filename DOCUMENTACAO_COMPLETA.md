# QUANTA FLOW - DOCUMENTAÇÃO TÉCNICA COMPLETA

**Plataforma Omnichannel de CRM, Automação de Vendas e IA**  
_Versão: 5.0.0 | Status: Produção | Data: Março 2026_

---

## 📑 ÍNDICE

1. [Visão Geral Executiva](#visão-geral-executiva)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Fluxos de Dados](#fluxos-de-dados)
7. [Módulos & Funcionalidades](#módulos--funcionalidades)
8. [Configuração & Setup](#configuração--setup)
9. [Deploy & Ci/Cd](#deploy--cicd)
10. [Guia de Desenvolvimento](#guia-de-desenvolvimento)

---

## VISÃO GERAL EXECUTIVA

### O Que é Quanta Flow?

**Quanta Flow** é uma plataforma SaaS de automação de vendas que:
- ✅ Centraliza comunicação de múltiplos canais (WhatsApp, Telegram, Instagram, E-mail)
- ✅ Detecta intenção de compra via IA (OpenAI GPT-4)
- ✅ Automatiza respostas e fluxos de vendas
- ✅ Gerencia fila de atendimento com SLA em tempo real
- ✅ Integra com sistemas externos (Google Sheets, Zapier, webhooks customizados)
- ✅ Oferece análise completa de performance
- ✅ Suporta múltiplos usuários com RBAC granular

### Números do Projeto

| Métrica | Valor |
|---------|-------|
| Total de módulos implementados | 17 |
| Sprints completados | 5 |
| Endpoints API | 80+ |
| Tabelas de banco | 20+ |
| Canais suportados | 4 |
| Linhas de código (backend) | ~3500 |
| Linhas de código (frontend) | ~4200 |
| Testes automatizados | Planejado Sprint 6 |

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Shadcn UI |
| Backend | Node.js + Express.js + TypeScript |
| Banco de Dados | PostgreSQL + Drizzle ORM |
| Autenticação | JWT + bcrypt |
| Real-time | Socket.io WebSocket |
| IA | OpenAI API (gpt-4o-mini) |
| CI/CD | GitHub Actions |
| Hosting | Replit |
| Email | Nodemailer (SMTP) |

---

## ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (FRONTEND)                   │
│  React + Vite + TypeScript | Shadcn UI + Tailwind CSS  │
└─────────────────────────────────────────────────────────┘
                              ↕
           ┌────────────────────────────────────┐
           │  REST API + WebSocket (Socket.io)  │
           │      Express.js + Middleware       │
           └────────────────────────────────────┘
                              ↕
    ┌──────────────────────────────────────────────────┐
    │            BACKEND SERVICES                      │
    ├──────────────────────────────────────────────────┤
    │ • Authentication (JWT + bcrypt)                  │
    │ • Message Processing (WhatsApp, Telegram, etc)  │
    │ • Intent Detection (OpenAI)                      │
    │ • Automation Engine (Flows, Conditions)          │
    │ • Queue Management (SLA Tracking)                │
    │ • Learning Worker (Microlearning Delivery)       │
    │ • Job Queue (Async Tasks - 5s interval)         │
    │ • Webhook Dispatcher (External notifications)   │
    │ • Google Sheets Sync (OAuth2)                    │
    │ • RBAC (Role-Based Access Control)               │
    └──────────────────────────────────────────────────┘
                              ↕
    ┌──────────────────────────────────────────────────┐
    │          POSTGRESQL DATABASE                     │
    │  (Users, Leads, Messages, Conversations, etc)    │
    └──────────────────────────────────────────────────┘
                              ↕
    ┌──────────────────────────────────────────────────┐
    │          EXTERNAL INTEGRATIONS                   │
    ├──────────────────────────────────────────────────┤
    │ • Z-API (WhatsApp)                               │
    │ • Telegram Bot API                               │
    │ • Meta Graph API (Instagram)                     │
    │ • Google Sheets API v4                           │
    │ • OpenAI API                                      │
    │ • SMTP (E-mail)                                   │
    │ • Webhooks HTTP                                  │
    └──────────────────────────────────────────────────┘
```

---

## ESTRUTURA DE ARQUIVOS

```
quanta-flow/
├── 📁 client/                          # Frontend React
│   ├── src/
│   │   ├── pages/                      # Páginas/rotas
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── inbox.tsx               # Chat + Fila
│   │   │   ├── crm.tsx                 # Kanban CRM
│   │   │   ├── automation.tsx           # Fluxos (9 seções)
│   │   │   ├── learning-tracks.tsx      # Microlearning CRUD
│   │   │   ├── settings-webhooks.tsx    # Webhooks outbound
│   │   │   ├── settings-integrations.tsx # Google Sheets
│   │   │   ├── settings-channels.tsx    # Telegram, Instagram, Email
│   │   │   ├── contact-profile.tsx
│   │   │   ├── admin-users.tsx
│   │   │   ├── admin-audit-logs.tsx
│   │   │   ├── admin-branding.tsx
│   │   │   └── [8+ other pages]
│   │   │
│   │   ├── components/                 # Reusable UI components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── ui/                     # Shadcn components
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── input.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── select.tsx
│   │   │       ├── table.tsx
│   │   │       ├── badge.tsx
│   │   │       ├── form.tsx
│   │   │       └── [10+ more]
│   │   │
│   │   ├── lib/
│   │   │   ├── queryClient.ts          # React Query setup
│   │   │   ├── auth.tsx                # Auth context
│   │   │   └── socket.ts               # Socket.io client
│   │   │
│   │   ├── hooks/
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── App.tsx                     # Router principal
│   │   └── index.css                   # Tailwind + CSS vars
│   │
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── 📁 server/                          # Backend Node.js
│   ├── index.ts                        # Entry point
│   ├── routes.ts                       # 80+ endpoints
│   ├── storage.ts                      # Database operations
│   ├── db.ts                           # Drizzle connection
│   ├── socket.ts                       # Socket.io setup
│   ├── jobQueue.ts                     # Async jobs (5s interval)
│   ├── learningWorker.ts               # Microlearning (5min interval)
│   │
│   ├── middleware/
│   │   ├── rbacMiddleware.ts           # Role-based access
│   │   └── authMiddleware.ts
│   │
│   ├── services/
│   │   ├── messageProcessor.ts         # Multi-channel message processing
│   │   ├── intentService.ts            # OpenAI intent detection
│   │   ├── whatsappProvider.ts         # Z-API + Baileys
│   │   ├── evolutionService.ts         # Evolution API (legacy)
│   │   ├── telegramService.ts          # Telegram Bot API
│   │   ├── instagramService.ts         # Meta Graph API
│   │   ├── emailService.ts             # SMTP + Nodemailer
│   │   ├── googleSheetsService.ts      # Google Sheets OAuth2 + append
│   │   ├── webhookDispatcher.ts        # HMAC-SHA256 signed webhooks
│   │   └── configService.ts            # Dynamic config management
│   │
│   └── [other support files]
│
├── 📁 shared/                          # Shared types & schemas
│   └── schema.ts                       # Drizzle schema + Zod validation
│
├── 📁 .github/
│   └── workflows/
│       ├── deploy.yml                  # Auto-deploy on push main
│       └── pr-check.yml                # PR validation
│
├── 📁 drizzle/                         # Database migrations
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_add_queue.sql
│   │   ├── 0003_add_learning.sql
│   │   └── [etc]
│   └── meta/
│
├── .env.example                        # Environment variables template
├── package.json                        # Dependencies
├── tsconfig.json
├── drizzle.config.ts
├── vite.config.ts
├── replit.md                           # Project documentation
└── README.md

```

---

## DATABASE SCHEMA

### Tabelas Principais (20+)

#### 1. **users**
```sql
users {
  id: UUID (PK)
  email: VARCHAR(255) UNIQUE
  password: TEXT (hashed bcrypt)
  tipoAtor: ENUM ['consumidor', 'agente_fidelizacao', 'lojista', 'admin']
  nome: VARCHAR(255)
  telefone: VARCHAR(20)
  status: ENUM ['active', 'inactive', 'suspended']
  mustChangePassword: BOOLEAN
  tokenVersion: INTEGER
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 2. **unified_contacts** (CRM central)
```sql
unified_contacts {
  id: UUID (PK)
  userId: UUID (FK → users)
  nome: VARCHAR(255)
  email: VARCHAR(255)
  telefone: VARCHAR(20)
  avatarUrl: TEXT
  pipelineStage: ENUM ['novo', 'contatado', 'qualificado', 'convertido']
  temperature: ENUM ['frio', 'morno', 'quente']
  lastIntent: VARCHAR (detectado via IA)
  score: INTEGER
  notes: TEXT
  tags: JSONB ARRAY
  lastContactAt: TIMESTAMP
  assignedToUserId: UUID (FK → users)
  
  -- Sprint 4: Queue & SLA
  queueStatus: ENUM ['waiting', 'assigned', 'resolved']
  queueEnteredAt: TIMESTAMP
  slaDeadline: TIMESTAMP
  slaBreached: BOOLEAN
  activeFlowId: UUID (FK → automation_flows) -- fluxo ativo
  
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 3. **conversations** (Chats por canal)
```sql
conversations {
  id: UUID (PK)
  userId: UUID (FK → users)
  leadId: UUID (FK → leads) -- legacy
  remoteJid: VARCHAR(100) -- ID remoto (WhatsApp, Telegram, etc)
  contactName: VARCHAR(255)
  contactPhone: VARCHAR(50)
  lastMessage: TEXT
  lastMessageAt: TIMESTAMP
  unreadCount: VARCHAR(10)
  channel: VARCHAR(20) DEFAULT 'whatsapp' -- novo Sprint 5
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 4. **messages** (Histórico de chat)
```sql
messages {
  id: UUID (PK)
  conversationId: UUID (FK → conversations)
  userId: UUID (FK → users)
  messageId: VARCHAR(100) -- ID externo (Z-API, Telegram, etc)
  direction: ENUM ['incoming', 'outgoing']
  content: TEXT
  mediaType: VARCHAR(50) -- 'image', 'video', 'document'
  mediaUrl: TEXT
  timestamp: TIMESTAMP
  createdAt: TIMESTAMP
}
```

#### 5. **automation_flows** (Fluxos automáticos)
```sql
automation_flows {
  id: UUID (PK)
  userId: UUID (FK → users)
  name: VARCHAR(255)
  isActive: BOOLEAN DEFAULT true
  triggerKeywords: TEXT -- comma-separated
  
  -- Seção 1: Resposta básica
  responseTemplate: TEXT
  responseDelay: INTEGER -- segundos
  
  -- Seção 2: Sistema IA
  systemPrompt: TEXT
  temperature: FLOAT [0-1]
  
  -- Seção 3: Inicial
  initialMessage: TEXT
  
  -- Seção 4: Inatividade
  inactivityTimeout: INTEGER -- minutos
  
  -- Seção 5: Condições
  successCondition: TEXT -- keyword/intenção para resolver
  interruptCondition: TEXT -- keyword para entrar na fila
  
  -- Seção 6: Resumo
  summaryEnabled: BOOLEAN
  summaryFields: TEXT
  
  -- Seção 7: Multi-step
  steps: JSONB ARRAY [
    { order: 1, message: "...", delaySeconds: 10 },
    { order: 2, message: "...", delaySeconds: 20 }
  ]
  
  -- Seção 8: Saídas condicionais
  conditionalExits: JSONB ARRAY [
    {
      condition: "...",
      label: "Suporte",
      targetFlowId: "...",
      triggerKeywords: ["suporte", "ajuda"]
    }
  ]
  
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 6. **omnichannelMessages** (IA Intent tracking)
```sql
omnichannelMessages {
  id: UUID (PK)
  unifiedContactId: UUID (FK → unified_contacts)
  channelType: VARCHAR(50) -- 'whatsapp', 'telegram', etc
  direction: ENUM ['incoming', 'outgoing']
  content: TEXT
  externalMessageId: VARCHAR(100)
  detectedIntent: VARCHAR(100) -- intent IA
  intentConfidence: VARCHAR(10) -- 0-1
  userId: UUID (FK → users)
  timestamp: TIMESTAMP
  createdAt: TIMESTAMP
}
```

#### 7. **outbound_webhooks** (Sprint 5)
```sql
outbound_webhooks {
  id: UUID (PK)
  userId: UUID (FK → users)
  name: TEXT
  url: TEXT
  events: JSONB ARRAY ['lead.created', 'lead.qualified', 'flow.success', ...]
  isActive: BOOLEAN DEFAULT true
  secret: TEXT -- HMAC secret
  lastStatus: TEXT -- 'success' ou 'error:msg'
  lastTriggeredAt: TIMESTAMP
  createdAt: TIMESTAMP
}
```

#### 8. **sheet_integrations** (Sprint 5)
```sql
sheet_integrations {
  id: UUID (PK)
  userId: UUID (FK → users)
  name: TEXT
  spreadsheetId: TEXT
  sheetName: TEXT DEFAULT 'Leads'
  triggerEvent: TEXT -- 'lead.created', 'lead.qualified', etc
  columnMapping: JSONB { "name": "A", "phone": "B", ... }
  isActive: BOOLEAN DEFAULT true
  googleToken: TEXT -- encrypted OAuth2 token
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 9. **email_configs** (Sprint 5)
```sql
email_configs {
  id: UUID (PK)
  userId: UUID (FK → users)
  smtpHost: TEXT
  smtpPort: INTEGER DEFAULT 587
  smtpUser: TEXT
  smtpPass: TEXT -- encrypted
  imapHost: TEXT
  imapPort: INTEGER
  isActive: BOOLEAN DEFAULT false
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 10. **learning_tracks** (Microlearning)
```sql
learning_tracks {
  id: UUID (PK)
  userId: UUID (FK → users)
  name: TEXT
  stageOrIntent: TEXT -- 'qualificado' ou 'compra_quente'
  stepOrder: INTEGER
  delayHours: FLOAT
  contentType: ENUM ['texto', 'video', 'link']
  content: TEXT
  isActive: BOOLEAN DEFAULT true
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### 11. **agent_assignments** (Atribuição a agentes)
```sql
agent_assignments {
  id: UUID (PK)
  contactId: UUID (FK → unified_contacts)
  agentId: UUID (FK → users)
  assignedAt: TIMESTAMP
}
```

#### 12. **roles & permissions** (RBAC)
```sql
roles {
  id: INTEGER (PK)
  name: VARCHAR(100) -- 'super_admin', 'admin', 'user'
}

permissions {
  id: INTEGER (PK)
  name: VARCHAR(100) -- 'view_leads', 'edit_leads', etc
}

user_roles {
  userId: UUID (FK)
  roleId: INTEGER (FK)
}

role_permissions {
  roleId: INTEGER (FK)
  permissionId: INTEGER (FK)
}
```

#### 13. **audit_logs** (Rastreamento)
```sql
audit_logs {
  id: UUID (PK)
  userId: UUID (FK → users)
  action: VARCHAR(100) -- 'create', 'update', 'delete'
  resource: VARCHAR(100) -- 'lead', 'flow', 'user'
  resourceId: VARCHAR(100)
  changes: JSONB -- antes/depois
  timestamp: TIMESTAMP
}
```

**Outras tabelas:** leads, api_configs, evolution_configs, quick_replies, branding_config, contact_identifiers, learning_deliveries, pipeline_stages, channels, settings, user_roles, etc.

---

## API ENDPOINTS

### Authentication (5 endpoints)
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/refresh
POST   /api/auth/logout
```

### CRM Leads (8 endpoints)
```
GET    /api/crm/dashboard
GET    /api/crm/contacts
POST   /api/crm/contacts
GET    /api/crm/contacts/:id
PATCH  /api/crm/contacts/:id
DELETE /api/crm/contacts/:id
GET    /api/crm/contacts/:id/profile
PATCH  /api/crm/contacts/:id/stage
```

### Inbox (8 endpoints)
```
GET    /api/conversations
GET    /api/conversations/:id
POST   /api/conversations/:id/messages
GET    /api/messages?conversationId=...
POST   /api/messages/:id/read
GET    /api/quick-replies
POST   /api/quick-replies
PUT    /api/quick-replies/:id
DELETE /api/quick-replies/:id
```

### Queue (4 endpoints)
```
GET    /api/queue
POST   /api/queue/:contactId/assign
POST   /api/queue/:contactId/resolve
GET    /api/queue/:contactId/sla
```

### Automation (6 endpoints)
```
GET    /api/automation-flows
POST   /api/automation-flows
GET    /api/automation-flows/:id
PUT    /api/automation-flows/:id
DELETE /api/automation-flows/:id
POST   /api/automation-flows/:id/test
```

### Learning Tracks (4 endpoints)
```
GET    /api/learning-tracks
POST   /api/learning-tracks
PUT    /api/learning-tracks/:id
DELETE /api/learning-tracks/:id
```

### Webhooks Outbound (5 endpoints) - Sprint 5
```
GET    /api/webhooks/outbound
POST   /api/webhooks/outbound
PUT    /api/webhooks/outbound/:id
DELETE /api/webhooks/outbound/:id
POST   /api/webhooks/outbound/:id/test
```

### Google Sheets (6 endpoints) - Sprint 5
```
GET    /api/integrations/sheets
POST   /api/integrations/sheets
PUT    /api/integrations/sheets/:id
DELETE /api/integrations/sheets/:id
GET    /api/integrations/sheets/auth
GET    /api/integrations/sheets/callback
```

### Email (3 endpoints) - Sprint 5
```
GET    /api/settings/email
POST   /api/settings/email
POST   /api/settings/email/test
```

### Webhooks Entrada - Sprint 5
```
POST   /api/webhooks/telegram
POST   /api/webhooks/instagram
GET    /api/webhooks/instagram
POST   /api/settings/telegram/connect
POST   /api/settings/instagram/connect
```

### WhatsApp (10+ endpoints)
```
POST   /api/whatsapp/webhook
GET    /api/whatsapp/status
POST   /api/whatsapp/send
POST   /api/whatsapp/connect-zapi
POST   /api/whatsapp/connect-evolution
POST   /api/whatsapp/disconnect
POST   /api/whatsapp/refresh-webhooks
[etc]
```

### Configurações (8 endpoints)
```
GET    /api/settings
POST   /api/settings
PUT    /api/settings/:id
GET    /api/branding
PUT    /api/branding
GET    /api/api-configs
POST   /api/api-configs
[etc]
```

### Admin (8 endpoints)
```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/admin/audit-logs
GET    /api/audit-logs
[etc]
```

### Health (1 endpoint)
```
GET    /api/health
```

**Total: 80+ endpoints**

---

## FLUXOS DE DADOS

### Fluxo 1: Mensagem WhatsApp → Automação → Resposta

```
1. Z-API/Baileys recebe msg no WhatsApp
   ↓
2. Webhook POST para /api/whatsapp/webhook
   ↓
3. processIncomingMessage() processa a msg
   - Salva em conversations + messages
   - Cria/atualiza unified_contact
   - Emite via Socket.io para UI (real-time)
   ↓
4. processMessageIntent() chama OpenAI
   - Detecta intenção: "compra_quente", "duvida", etc
   - Score de confiança
   - Salva em omnichannelMessages
   ↓
5. messageProcessor() busca automationFlow
   - Por keyword trigger ou activeFlowId
   - Valida condições (success, interrupt, conditional exits)
   ↓
6. Se interruptCondition match → Entra na fila
   - Cria job check_sla
   - SLA deadline = now + defaultSlaMinutes
   ↓
7. Se successCondition match → Resolve
   - updateUnifiedContact(queueStatus='resolved')
   - Dispara webhook 'flow.success'
   ↓
8. Se há steps → Agenda envios
   - JobQueue.add({ type: 'send_message', ... })
   - Executa a cada 5s
   ↓
9. JobQueue processa job
   - Envia via sendChannelMessage()
   - Z-API/Telegram/Email/Instagram
   ↓
10. Mensagem enviada!
```

### Fluxo 2: Lead entra na fila → SLA tracking

```
1. interruptCondition acionada
   ↓
2. storage.enterQueue(contactId, slaMinutes)
   - queueStatus = 'waiting'
   - queueEnteredAt = now
   - slaDeadline = now + (slaMinutes * 60)
   ↓
3. JobQueue.add({ type: 'check_sla', ... })
   - Agendado para slaDeadline
   ↓
4. JobQueue executa check_sla
   - Se deadline passou: slaBreached = true
   - Emite para UI via Socket.io
   ↓
5. Frontend mostra timer regressivo
   - Atualiza a cada 1s
   - Muda cor se vencido
   ↓
6. Agent clica "Assumir"
   - PATCH /api/queue/:id/assign
   - queueStatus = 'assigned'
   - assignedToUserId = agentId
   ↓
7. Agent clica "Resolver"
   - POST /api/queue/:id/resolve
   - queueStatus = 'resolved'
   - removeFrom queue view
```

### Fluxo 3: Lead qualificado → Google Sheets append

```
1. Lead pipeline stage muda para 'qualificado'
   ↓
2. dispatchEvent('lead.qualified', contact, userId)
   ↓
3. webhookDispatcher() processa
   - Busca sheet_integrations ativas com triggerEvent='lead.qualified'
   ↓
4. Para cada integração:
   - mapContactToRow(contact, columnMapping)
   - appendRow(spreadsheetId, sheetName, values, accessToken)
   ↓
5. Google Sheets API v4
   - POST https://sheets.googleapis.com/v4/spreadsheets/.../values/...:append
   - Insere nova linha
   ↓
6. Planilha atualizada!
```

### Fluxo 4: Telegram recebe mensagem

```
1. Telegram Bot recebe update
   ↓
2. POST /api/webhooks/telegram
   ↓
3. Extrai: chat.id, from.first_name, message.text
   ↓
4. processIncomingMessage({
     userId: firstUser,
     phone: chatId,
     contactName: name,
     messageContent: text,
     channel: 'telegram',
     provider: 'telegram'
   })
   ↓
5. Cria conversation com channel='telegram'
   ↓
6. Resto é idêntico ao fluxo WhatsApp
   (intent detection, automation, etc)
```

---

## MÓDULOS & FUNCIONALIDADES

### ✅ IMPLEMENTADOS

#### 1. Dashboard
- KPI overview (total contatos, distribuição)
- Hot leads (score > 15, temperatura='quente')
- Recent contacts
- Pipeline distribution
- Intent distribution

#### 2. Inbox
- Chat unificado (WhatsApp, Telegram, Instagram, Email)
- Real-time via Socket.io
- Fila de Atendimento com SLA timer
- Respostas Rápidas (CRUD)
- Refresh automático (30s)

#### 3. CRM
- Kanban visual por pipeline stage
- Busca + filtros (temperatura, intenção)
- Perfil detalhado do contato
- Omnichannel message timeline
- IA intent summary
- Agent assignment (manual + round-robin)
- CRUD leads

#### 4. Automação
- 9 seções (básico, resposta, sistema, avançado, inatividade, condições, multi-step, resumo, saídas)
- Fluxos por keyword trigger
- Response templates com delay
- IA intent detection
- Success/interrupt conditions
- Conditional exits (transferência entre fluxos)
- Multi-step sequences

#### 5. Microlearning
- Conteúdo automático por stage/intenção
- Delay configurável (horas)
- Content types: texto, vídeo, link
- Delivery tracking (enviado, visualizado)
- LearningWorker background (5min)

#### 6. Webhooks Outbound
- HMAC-SHA256 signed
- 5 event types
- Test endpoint
- Status tracking (último disparo)
- CRUD

#### 7. Google Sheets
- OAuth2 authentication
- Auto-append on lead events
- Column mapping customizável
- CRUD

#### 8. Telegram
- Bot integration
- Message receive/send
- Automação completa

#### 9. Instagram
- Meta Messaging API
- Message receive/send
- Automação completa

#### 10. Email
- SMTP configuration
- Auto-send respostas
- Test connection

#### 11. Configurações
- API settings (Z-API, Evolution, Baileys)
- Branding (cores, logo, SLA padrão)
- Email SMTP
- Webhooks
- Canais
- Integrações

#### 12. Admin
- User management (CRUD)
- Audit logs
- Branding
- Roles & permissions
- Settings

#### 13. Autenticação
- Register/Login
- JWT (24h expiration)
- Bcrypt password hashing
- Token versioning
- Forgot password
- Mandatory password change

#### 14. Health Check
- GET /api/health
- DB connectivity status
- Version + uptime

#### 15. CI/CD
- GitHub Actions deploy
- PR checks (TypeScript, build)
- Auto-deploy on push main

### 🚀 PLANEJADOS (Future)

#### 1. Social / Ads
- Facebook Ads integration
- LinkedIn Ads
- Google Ads
- TikTok Ads
- ROI calculator
- Lead attribution
- Retargeting automático

#### 2. IA Brain
- Análise preditiva
- NLP avançado (sentimento, urgência)
- Recomendação de ações
- Scoring dinâmico
- Pattern recognition

#### 3. Tribos
- Team management
- Leaderboard
- Gamification (badges, pontos)
- Commission engine
- Knowledge base
- Internal chat

---

## CONFIGURAÇÃO & SETUP

### Pré-requisitos
- Node.js 18+
- PostgreSQL 13+
- npm ou yarn
- Git

### Variáveis de Ambiente (.env)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/quanta_flow

# Auth
SESSION_SECRET=seu_jwt_secret_aqui_32_chars_min

# WhatsApp
ZAPI_API_KEY=sk_...
EVOLUTION_URL=https://api.evolution.ai
EVOLUTION_TOKEN=...

# OpenAI
OPENAI_API_KEY=sk-...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=app_password

# Google Sheets
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Telegram
TELEGRAM_BOT_TOKEN=...

# Instagram
INSTAGRAM_VERIFY_TOKEN=quanta_flow_ig

# Webhooks
WEBHOOK_BASE_URL=https://seu-dominio.replit.dev
```

### Setup Local

```bash
# 1. Clone repo
git clone https://github.com/seu-repo/quanta-flow.git
cd quanta-flow

# 2. Install dependencies
npm install

# 3. Setup database
npx drizzle-kit push

# 4. Start dev server
npm run dev

# 5. Acesse
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
# API: http://localhost:5000/api
```

### Seed Data

Admin user padrão:
```
Email: admin@quantaflow.com
Password: Admin@123
Role: super_admin
```

---

## DEPLOY & CI/CD

### Deployment no Replit

```bash
# 1. Push para main branch
git push origin main

# 2. GitHub Actions dispara automaticamente
# - Checkout código
# - npm install
# - TypeScript check
# - npm run build
# - Deploy no Replit

# 3. Verificar saúde
curl https://seu-replit-domain.replit.dev/api/health
```

### Health Check
```json
{
  "status": "ok",
  "version": "5.0.0",
  "uptime": 1234,
  "dbConnected": true,
  "timestamp": "2026-03-12T00:00:30.178Z"
}
```

---

## GUIA DE DESENVOLVIMENTO

### Adicionar Novo Endpoint

1. **Definir schema** (shared/schema.ts)
```typescript
export const myNewTable = pgTable("my_new_table", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

2. **Adicionar storage methods** (server/storage.ts)
```typescript
async getMyData(userId: string) {
  return db.select().from(myNewTable)
    .where(eq(myNewTable.userId, userId));
}
```

3. **Adicionar endpoint** (server/routes.ts)
```typescript
app.get("/api/my-endpoint", authenticateToken, async (req, res) => {
  try {
    const data = await storage.getMyData(req.userId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
});
```

4. **Usar no frontend** (client/src/pages/mypage.tsx)
```typescript
const { data } = useQuery({
  queryKey: ['/api/my-endpoint'],
});
```

### Adicionar Novo Canal de Mensagem

1. **Criar service** (server/services/mynewchannel.ts)
```typescript
export async function sendMyChannelMessage(id, message) {
  // Implementar
}
```

2. **Actualizar messageProcessor.ts**
```typescript
else if (channel === 'mynewchannel') {
  await sendMyChannelMessage(phone, message);
}
```

3. **Criar endpoint webhook** (server/routes.ts)
```typescript
app.post('/api/webhooks/mynewchannel', async (req, res) => {
  // Processa msg e chama processIncomingMessage()
});
```

### Adicionando Novo Event de Webhook

1. **Adicionar em webhookDispatcher.ts**
```typescript
const SUPPORTED_EVENTS = [
  ...,
  "mynew.event"
];
```

2. **Disparar evento**
```typescript
dispatchEvent("mynew.event", payload, userId);
```

3. **Será automaticamente enviado** para webhooks configurados

---

## PERFORMANCE & ESCALABILIDADE

### Otimizações Implementadas
- ✅ React Query caching
- ✅ Debounced searches
- ✅ Pagination no CRM Kanban
- ✅ Socket.io eficiente (apenas deltas)
- ✅ JobQueue async (5s interval)
- ✅ LearningWorker background (5min)
- ✅ Database indexing via Drizzle

### Limites Atuais
- Max 10k contatos/usuário (antes de indexação)
- Max 100 messages/conversation carregadas
- Max 50 webhooks/usuário
- Max 30 active jobs/usuário

### Escalabilidade Futura
- [ ] Redis para cache distribuído
- [ ] Bull queue para jobs distribuídos
- [ ] Elasticsearch para busca rápida
- [ ] CDN para assets
- [ ] Database replication (master-slave)

---

## SEGURANÇA

✅ **Implementado:**
- JWT com 24h expiration
- bcrypt password hashing (10 salt rounds)
- HMAC-SHA256 webhook signing
- AES-256-CBC credential encryption
- RBAC (3 roles, 18 permissions)
- SQL injection prevention (Drizzle ORM)
- XSS prevention (React + TypeScript)
- CORS enabled
- Rate limiting (planejado)
- Input validation (Zod schemas)

⚠️ **Recomendações Produção:**
- [ ] HTTPS only (TLS certificate)
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection
- [ ] Database encryption at rest
- [ ] API key rotation
- [ ] Two-factor authentication
- [ ] Session timeout
- [ ] IP whitelist

---

## TESTING

### Atualmente
- Manual testing na UI
- Curl/Postman para API

### Planejado Sprint 6
- [ ] Jest unit tests (backend)
- [ ] React Testing Library (frontend)
- [ ] E2E tests (Cypress)
- [ ] Coverage mínimo: 80%

---

## SUPORTE & TROUBLESHOOTING

### Health Check não passa
```bash
curl http://localhost:5000/api/health
# Se dbConnected: false → verificar DATABASE_URL
```

### Workflow falhando
```bash
npm run db:push  # Aplicar migrations
npm run build    # Verificar build errors
npm run dev      # Restartar dev server
```

### Mensagens não chegam
- Verificar se Z-API/Telegram token está correto
- Verificar se WEBHOOK_BASE_URL está configurado
- Checar logs do servidor: `npm run dev 2>&1 | tee app.log`

---

## ROADMAP FUTURO

| Sprint | Funcionalidade | Status |
|--------|---|---|
| 1-5 | Core CRM + Automação | ✅ Completo |
| 6 | Social Ads | 🚀 Next |
| 7 | IA Brain avançada | 📅 Planejado |
| 8 | Tribos | 📅 Planejado |
| 9 | Mobile app (React Native) | 📅 Planejado |
| 10 | Self-hosted (Docker) | 📅 Planejado |

---

## CRÉDITOS & DEPENDÊNCIAS

### Principais Dependências
- React 18, Vite, TypeScript, Tailwind CSS, Shadcn UI
- Express, Drizzle ORM, PostgreSQL
- Socket.io, OpenAI API, Nodemailer
- Zod, React Query, React Hook Form

### Contribuidores
- AI Architecture & Development: Replit Agent
- Product Design: Quanta Flow Team

---

**Documento gerado: Março 2026**  
**Versão: 5.0.0 | Status: Produção**  
**Última atualização: Sprint 5 Completo**

