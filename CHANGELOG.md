# Changelog — Quanta Flow
> Histórico semântico de versões seguindo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)

---

## [7.0.0] — 2026-04-30

### Adicionado
- **Manual de Uso completo** (MANUAL_DE_USO.md): 19 seções com cenários práticos reais
- Seções 17 (Estúdio de Conteúdo), 17.1 (Chat Wizard MFORTE), 17.2 (ElevenLabs + HeyGen)
- Passo 6 atualizado na Seção 15 (Lab)
- Endpoint `GET /api/documentation/manual-md` para visualizador inline
- Endpoint `GET /api/documentation/manual-pdf` para geração de PDF via pdfkit
- Visualizador inline no Admin/Documentação com `renderMarkdown` customizado
- **Apresentação Comercial** (.pptx) gerada via `pptxgenjs`
- Endpoint `GET /api/documentation/presentation-pptx`

### Corrigido
- Typo "Biblioteca filtrávelI" → "Biblioteca filtrável" no manual
- Reordenação de seções (16 antes de 17)
- Seed da documentação atualizado de v6.0.0 para v7.0.0

---

## [6.0.0] — 2026-04-15

### Adicionado
- **Clonagem de Voz e Avatar (Task #22)**: integração ElevenLabs + HeyGen
- `cloningIds` em `social_projects.brand` JSONB (credenciais criptografadas)
- Endpoints: `elevenlabs-tts`, `heygen-video`, `heygen-status`
- Player de áudio ElevenLabs e player de vídeo HeyGen no Estúdio de Conteúdo
- Booleans `hasElevenLabs`/`hasHeyGen` em GET de projetos (credenciais nunca expostas)
- Polling assíncrono de status HeyGen (`/v2/video_status.get`)

### Segurança
- `cloningIds` removido de todas as respostas GET de projetos sociais

---

## [5.0.0] — 2026-03-28

### Adicionado
- **Estúdio de Conteúdo Omnichannel** (Social/Ads) completo
- `social_projects` e `content_assets` com UUID PKs
- 6 formatos de geração: headlines, caption, hooks, socialAds, email, blogPost
- TTS de áudio via OpenAI (nova/alloy/echo/onyx/shimmer)
- Construtor UTM integrado
- Biblioteca de assets filtrável
- Calendário agrupado por data/canal
- Dashboard de métricas sociais
- **Chat Wizard MFORTE**: enriquecimento de ideia via GPT-4o-mini (área, fontes, 3 headlines)
- `publication_schedules` com UUID PK

### Adicionado (Infra)
- `CampaignWorker` background (60s interval) para campanhas/drip
- Sistema de reply tracking para métricas de campanha

---

## [4.0.0] — 2026-03-10

### Adicionado
- **Campanhas Omnichannel** (Task #18)
- Wizard 4 etapas: nome/canal, segmentação, mensagem, agendamento
- Tipos: Broadcast e Drip Sequence
- Segmentação por temperatura, estágio, canal
- Geração de copy via GPT-4o-mini (`POST /api/admin/campaigns/generate-copy`)
- Prévia de segmento antes do envio
- Métricas: sent/delivered/read/replied/converted
- **Biblioteca de Templates** de mensagem com categorias
- Rate limiting e controle de horários permitidos

---

## [3.0.0] — 2026-02-20

### Adicionado
- **Fábrica de Agentes IA** (Task #12)
- CRUD completo: GET/POST/PUT/DELETE `/api/admin/agents`
- Campos: model, temperature, tone, specialty, systemPrompt, ttsVoice, maxTokens
- Chat preview de agente: `POST /api/admin/agents/:id/chat`
- TTS de agente: `POST /api/admin/agents/:id/tts`
- Geração de avatar IA: `POST /api/admin/agents/generate-avatar`
- **Simulador de Conversa Interativo** (Flow Sim) no Lab
- Endpoint: `POST /api/admin/lab/simulate-flow-chat`
- Execução real de blocos `ai_agent`, avaliação de condições, state stateless
- **Builder Visual de Fluxos** com React Flow
- 10 tipos de blocos: text, audio_tts, image_ai, delay, condition, ai_agent, webhook, queue_entry, resolve, update_lead
- Export/Import JSON de fluxos
- Geração de fluxo via GPT-4o-mini
- 5 templates built-in
- **Lab** com 5 abas: Flow Sim, TTS, Imagem IA, Webhooks, WhatsApp

---

## [2.0.0] — 2026-01-30

### Adicionado
- **CRM / Pipeline Kanban** omnichannel
- `unified_contacts` com pipeline_stage, temperature, last_intent, score
- Drag-and-drop entre colunas do Kanban
- AI intent detection via OpenAI (scoring 0-20)
- `contact_identifiers` para mapeamento multi-canal
- `omnichannel_messages` com histórico unificado
- **Fila de Atendimento** com SLA
- `queueStatus`: waiting → assigned → resolved
- Timer SLA no Inbox (vermelho quando ultrapassado)
- `agent_assignments` com round-robin automático
- **Webhooks Outbound** com HMAC-SHA256
- Eventos: lead.created, lead.qualified, flow.success, flow.interrupt, conversation.closed
- `WebhookDispatcher` assíncrono com timeout 5s
- **Google Sheets Integration** via OAuth2
- Append de linha por evento configurável
- **Microlearning** (Learning Tracks)
- `learning_tracks` + `learning_deliveries`
- `LearningWorker` (5min interval)
- **Inbox Omnichannel**
- Canais: WhatsApp (Z-API/Baileys/Meta), Telegram, Instagram, Email
- Real-time via Socket.io namespace `/inbox`
- Timestamp completo `dd/MM HH:mm`

---

## [1.0.0] — 2026-01-05

### Adicionado
- **Autenticação JWT** com bcrypt
- `tokenVersion` para invalidação imediata de sessões
- `mustChangePassword` flag
- Status de usuário: active, inactive, suspended
- **RBAC** (Role-Based Access Control)
- 3 roles: super_admin, admin, user
- 18 permissões em 7 recursos
- Middleware `checkRole` e `authenticateToken`
- Seed automático de roles/permissions no startup
- **Configurações criptografadas** (AES-256-CBC)
- `configService` com cache em memória e audit log
- **Branding White-label**
- companyName, primaryColor, secondaryColor, logoUrl, faviconUrl, defaultSlaMinutes
- **Health Check** endpoint: `GET /api/health`
- **Audit Logs** de todas as ações administrativas
- Admin padrão: `admin@quantaflow.com` / `Admin@123` (mustChangePassword: true)
