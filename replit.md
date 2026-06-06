# Quanta Flow — pnpm Monorepo Workspace

## Overview

Quanta Flow is an omnichannel automation, CRM, microlearning, and gamification platform integrating WhatsApp, Telegram, and Instagram. It supports multi-tenancy with a complete Role-Based Access Control (RBAC) system. The platform aims to streamline customer interactions, automate marketing campaigns, and enhance user engagement through AI-powered features and gamification.

## User Preferences

I prefer to work iteratively, focusing on one module or feature at a time. Before making any significant architectural changes or introducing new dependencies, please ask for my approval. I appreciate clear, concise explanations of the proposed changes and their impact. I also prefer the use of functional programming paradigms where appropriate, and I value clean, well-documented code. Please ensure all changes are type-checked and pass existing tests.

**Obrigatório ao final de TODA sessão de trabalho direto (main agent):** rodar o comando de sync abaixo antes de encerrar. Isso atualiza a documentação técnica com IA e envia o código para o GitHub. Nunca encerrar sem rodar:
```
pnpm --filter @workspace/scripts run sync
```

## System Architecture

The project is structured as a pnpm monorepo using TypeScript, targeting Node.js 24.

**Technical Stack:**
- **Backend:** Express 5 API bundled with esbuild.
- **Database:** PostgreSQL with Drizzle ORM for type-safe schema management.
- **Frontend:** React 18 with Vite, styled using Tailwind CSS v3 and Shadcn UI, and routed with Wouter.
- **Real-time Communication:** Socket.io for live updates in the inbox.
- **Authentication:** JWT (24h validity) combined with bcrypt and a `tokenVersion` for immediate invalidation upon password changes.
- **AI Integration:** OpenAI, ElevenLabs (TTS), and HeyGen (Avatar generation) are integrated for various AI-powered features.
- **Build Tools:** esbuild for the server and Vite for the client.

**Monorepo Structure & Shared Libraries:**
The monorepo includes several artifacts (`api-server`, `quanta-flow`, `quanta-flow-mobile`, `mockup-sandbox`) and shared libraries:
- `@workspace/db`: Drizzle ORM schema for PostgreSQL.
- `@workspace/api-spec`: OpenAPI specification.
- `@workspace/api-zod`: Generated Zod schemas for validation.
- `@workspace/api-client-react`: Generated React Query hooks.

**Key Architectural Patterns & Features:**
- **Multi-tenancy:** Implemented with `workspaces` and full RBAC. `workspaceId` resolution prioritizes `x-workspace-id` header, then JWT claim, then user's `currentWorkspaceId`.
- **CRM:** Manages contacts with pipeline stages, temperature, assignment, and message history.
- **Omnichannel Inbox:** Real-time messaging for WhatsApp, Telegram, and Instagram, with switchable providers for WhatsApp (Evolution API, Z-API, Meta Cloud API).
- **Automation:**
    - **Flows:** Visual flow builder with blocks like message, condition, wait, AI-reply, TTS, and image generation. Supports import/export and AI-generated flows.
    - **Campaigns:** Multi-step sequences with AI-generated message copy and sequence generation.
    - **AI Agents:** Configurable personas, models, and instructions with TTS and HeyGen avatar generation.
- **Landing Pages:** Drag-and-drop builder with 16 block types, versioning, submissions tracking, and metrics. Publicly accessible via `/p/:slug`.
- **Score Engine & Gamification:** Rules-based scoring with configurable points, thresholds, cooldowns, and badges. Tracks contact interactions and learning completions.
- **Microlearning:** Learning tracks with content delivery, completion tracking, and badge awarding.
- **Social/Ads Content Studio:** Project and asset management with AI-powered text/image generation, TTS, ElevenLabs voice cloning, HeyGen video, and UTM generation.
- **AI Brain:** Provides insights on contacts and autonomous actions like moving pipeline stages or assigning agents.
- **Background Workers:** Dedicated workers for `jobQueue`, `campaignWorker`, `learningWorker`, and `brainWorker` to handle asynchronous tasks.
- **UI/UX:** Utilizes Tailwind CSS and Shadcn UI for a consistent and modern design. Frontend route aliases like `@/` (src), `@shared/` (db schema), and `@assets/` (attached_assets) are used for better organization.
- **API Design:** Features a comprehensive set of RESTful API routes covering all modules, including public endpoints for landing pages, flows, and campaigns.
- **Testing:** Vitest and supertest are used for API server testing, ensuring 20/20 green tests.
- **Logging:** Emphasizes `req.log` in routes and a singleton `logger` elsewhere, strictly avoiding `console.log` in server code.

## External Dependencies

- **Database:** PostgreSQL
- **AI/ML:**
    - OpenAI API (via Replit AI Integrations)
    - ElevenLabs (Text-to-Speech)
    - HeyGen (Avatar Video Generation)
- **Real-time:** Socket.io
- **Messaging Providers:**
    - Evolution API (WhatsApp)
    - Z-API (WhatsApp)
    - Meta Cloud API (WhatsApp, Instagram)
    - Telegram API
- **Authentication:** JWT, bcrypt
- **UI Libraries:** Tailwind CSS, Shadcn UI
- **Frontend Frameworks:** React, Vite, Wouter
- **Utility Libraries:** Zod, Drizzle ORM
- **Integrations:**
    - Google Sheets (for outbound webhooks)
    - SMTP (for email settings)

## API Externa B2B — Envio de Mensagens WhatsApp

Endpoint dedicado para sistemas externos da holding (ex.: TTHM) dispararem alertas WhatsApp usando a sessão configurada no Quanta Flow. Provider-agnóstico: funciona com Baileys, Z-API ou Meta Cloud API conforme configurado.

### Variáveis de Ambiente Obrigatórias

| Variável | Descrição |
|---|---|
| `QF_SEND_API_KEY` | Chave secreta compartilhada com o sistema externo. Mínimo 32 caracteres aleatórios. |
| `QF_SYSTEM_USER_ID` | UUID do usuário Quanta Flow dono da sessão WhatsApp de alertas. Usado quando `userId` não vem no corpo. |

### Rota

```
POST /api/messages/send
```

### Autenticação

Header obrigatório:
```
x-api-key: <valor de QF_SEND_API_KEY>
```
Comparação timing-safe (resistente a timing attacks). Sem chave válida → `401`.

### Corpo (JSON)

```json
{
  "to":      "5511999999999",
  "message": "Alerta: operação XYZ concluída.",
  "userId":  "uuid-opcional"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `to` | string | Sim | Número E.164 sem `+` (somente dígitos, 10–15 chars) |
| `message` | string | Sim | Texto da mensagem (não vazio) |
| `userId` | string | Não | UUID do usuário Quanta Flow. Padrão: `QF_SYSTEM_USER_ID` |

### Respostas

| Status | Corpo | Quando |
|---|---|---|
| `200` | `{ "ok": true, "messageId": "..." }` | Enviado com sucesso |
| `401` | `{ "ok": false, "error": "unauthorized" }` | Chave ausente ou inválida |
| `422` | `{ "ok": false, "error": "validation_error", "fields": [...] }` | `to` ou `message` inválidos |
| `429` | `{ "ok": false, "error": "rate_limit_exceeded" }` | Mais de 20 req/min por IP |
| `503` | `{ "ok": false, "error": "whatsapp_indisponivel" }` | Sessão WA desconectada — usar fallback de e-mail |
| `500` | `{ "ok": false, "error": "internal_error" }` | Erro interno |

### Exemplo cURL (TTHM)

```bash
curl -X POST https://<dominio-quanta-flow>/api/messages/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: $QF_SEND_API_KEY" \
  -d '{ "to": "5511999999999", "message": "Alerta TTHM: relatório gerado." }'
```

### Código-fonte

`artifacts/api-server/src/routes/externalMessages.ts` — registrado em `app.ts` via `registerExternalRoutes(app)`.