# Quanta Flow — Dicionário de Dados

> Mapeado do schema Drizzle ORM (`shared/schema.ts`). Cada tabela lista colunas-chave, tipos e relacionamentos principais.

## Convenções

- IDs novos usam **UUID** (`varchar(36)` + `gen_random_uuid()`).
- Timestamps em UTC. `created_at` / `updated_at` quando aplicável.
- JSONB usado para conteúdos flexíveis (brand, formats, metadata).
- Encryption: campos sensíveis em `settings` são criptografados em AES-256-CBC.

---

## Autenticação & RBAC

### users
Usuários do sistema.
- `id` UUID PK · `name` · `email` UNIQUE · `password` (bcrypt) · `status` (active/inactive/suspended)
- `mustChangePassword` BOOLEAN · `tokenVersion` INT (invalidação de sessão)
- `createdAt`

### roles
- `id` · `name` UNIQUE (super_admin, admin, user) · `description`

### permissions
- `id` · `resource` · `action` · `name` (`{resource}:{action}`)
- 18 permissions × 7 resources

### role_permissions
- N:N entre roles e permissions

### user_roles
- `userId` → users · `roleId` → roles

### audit_logs
Log de ações administrativas.
- `id` · `userId` · `action` · `resource` · `details` JSONB · `createdAt`

---

## CRM & Inbox

### leads
Leads legados.
- `id` · `userId` (dono) · `name` · `phone` · `email` · `source` · `status`

### unified_contacts
Contatos omnichannel.
- `id` UUID PK · `userId` · `name` · `temperature` (cold/warm/hot)
- `intent` · `stageId` → pipeline_stages · `agentId` → users (atendente)
- **`queueStatus`** (waiting/assigned/resolved) · **`slaDeadline`** TIMESTAMP
- `activeFlowId` → automation_flows · `aiSummary` TEXT

### contact_identifiers
Identificadores multi-canal (jid WhatsApp, username Telegram, etc.).
- `contactId` → unified_contacts · `channel` · `identifier` · UNIQUE(channel, identifier)

### omnichannel_messages
Mensagens de todos os canais.
- `id` · `contactId` · `channel` · `direction` (in/out) · `body` · `mediaUrl` · `metadata` JSONB

### conversations / messages (legado)
Conversas e mensagens originais (Inbox antigo).

### channels
Canais configurados por usuário.
- `id` · `userId` · `type` (whatsapp/telegram/instagram/email) · `provider` · `config` JSONB

### pipeline_stages
Estágios customizáveis por usuário.
- `id` · `userId` · `name` · `color` · `order`

### agent_assignments
Atribuição de contatos a agentes humanos.
- `id` · `contactId` · `agentId` · `assignedAt`

### quick_replies
Respostas rápidas com atalho.
- `id` · `userId` · `shortcut` · `body`

---

## Automação

### automation_flows
Fluxos de automação visuais.
- `id` · `userId` · `name` · `trigger` · `nodes` JSONB · `edges` JSONB
- **`agentId`** → ai_agents (opcional)

### flow_templates
Templates built-in.
- `id` · `name` · `description` · `nodes` JSONB · `edges` JSONB

---

## IA

### ai_agents
Agentes IA configuráveis.
- `id` · `userId` · `name` · `model` · `temperature` · `tone` · `specialty`
- `systemPrompt` · `ttsVoice` · `maxTokens` · `avatarUrl`

---

## Campanhas

### campaigns
Campanhas omnichannel.
- `id` · `userId` · `name` · `type` (broadcast/drip)
- `status` (draft/scheduled/running/paused/completed) · `segment` JSONB
- `messages` JSONB · `rateLimit` · `allowedHours` JSONB

### campaign_deliveries
Entregas individuais.
- `id` · `campaignId` · `contactId` · `messageIndex` · `status` · `sentAt` · `repliedAt`

### message_templates
Templates reutilizáveis.
- `id` · `userId` · `category` · `name` · `body`

---

## Microlearning

### learning_tracks
Trilhas educacionais.
- `id` · `userId` · `name` · `triggerStage` · `triggerIntent` · `steps` JSONB

### learning_deliveries
Tracking de entregas.
- `id` · `trackId` · `contactId` · `stepIndex` · `deliveredAt`

---

## Integrações

### outbound_webhooks
Webhooks outbound com HMAC.
- `id` · `userId` · `name` · `url` · `events` (text array) · `secret` · `isActive`

### sheet_integrations
Google Sheets via OAuth2.
- `id` · `userId` · `spreadsheetId` · `eventTrigger` · `columnMapping` JSONB

### email_configs
SMTP/IMAP por usuário.
- `id` · `userId` · `host` · `port` · `username` · `passwordEnc` · `fromAddress`

---

## Settings & Branding

### settings
Configurações criptografadas globais.
- `key` · `valueEnc` · `updatedBy` · `updatedAt`

### settings_audit
Histórico de alterações.
- `id` · `key` · `oldValue` · `newValue` · `changedBy` · `changedAt`

### branding_config
Branding white-label por usuário.
- `id` · `userId` · `companyName` · `primaryColor` · `secondaryColor` · `logoUrl` · `faviconUrl`
- `defaultSlaMinutes` INT · `slogan`

---

## Estúdio Social / Ads

### social_projects
Projetos de marca.
- `id` UUID PK · `userId` · `name` · `description` · `brand` JSONB
- brand contém: cores, cloningIds (elevenLabs/HeyGen — nunca expostos em GET)

### content_assets
Assets gerados.
- `id` UUID PK · `projectId` · `userId` (NOT NULL) · `channel` · `format`
- `formats` JSONB (headlines, caption, hooks, audioUrl, elevenLabsAudioUrl, heygenVideoId/Url/Status)
- `utmLink` · `audioUrl` · `prompt` · `aiModel`

### publication_schedules
Agendamentos de publicação.
- `id` UUID PK · `assetId` · `userId` · `channel` · `scheduledAt` · `status`

---

## Documentação & Governança

### documentation_versions
Versões da documentação técnica.
- `id` · `version` · `title` · `content` · `releasedAt`

### IA Brain — Insights (sem tabela própria)
Insights são **gerados em runtime** pelo `IABrainService` (server/services/iaBrainService.ts) consultando `unified_contacts` (filtro por `lastContactAt < now - 48h` AND (`temperature='quente'` OR `score>=70`)). Cache de fingerprints de críticos vive em memória no `BrainWorker` (`Map<userId, Set<fingerprint>>`) — não persistido em DB.

**Ações executáveis** mutam tabelas existentes:
- `mover_pipeline` → atualiza `unified_contacts.pipelineStage`
- `atribuir_agente` (round-robin) → atualiza `unified_contacts.assignedToUserId` via `autoAssignContact`
- `disparar_microlearning` → cria linha em `learning_deliveries` (step 1, pending)
- `enviar_mensagem` → navega para `/inbox?contact={id}` (sem mutação backend)

---

### project_status_items
Painel de status do FLOW Standard.
- `id` UUID PK · `featureId` (F01..) · `featureName` · `category`
- `priority` (alta/media/baixa) · `status` (concluido/em_curso/pendente/pausado) · `progress` 0-100
- `notes` · `sortOrder`

---

## Resumo Quantitativo

| Domínio | Tabelas |
|---|---|
| Auth/RBAC | 6 |
| CRM/Inbox | 11 |
| Automação | 2 |
| IA | 1 |
| Campanhas | 3 |
| Microlearning | 2 |
| Integrações | 3 |
| Settings/Branding | 3 |
| Social/Ads | 3 |
| Governança | 2 |
| **Total** | **~37** |
