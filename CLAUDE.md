# CLAUDE.md — Contexto Técnico e Diretrizes do Quanta Flow

## Visão Geral

Quanta Flow é uma plataforma omnichannel de automação, CRM, microlearning e gamificação.
Integra WhatsApp, Telegram e Instagram com suporte a multi-tenancy e RBAC completo.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 24 + Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 18 + Vite + Tailwind CSS v3 + Shadcn UI |
| Roteamento | Wouter (frontend) |
| Real-time | Socket.io (/inbox namespace) |
| Auth | JWT (24h) + bcrypt + tokenVersion |
| Build | esbuild (server) + Vite (client) |
| Testes | Vitest + supertest (20/20 green) |

## Estrutura do Monorepo

```
artifacts/
  api-server/         — Backend Express (porta via $PORT)
  quanta-flow/        — Frontend React/Vite
  quanta-flow-mobile/ — Expo React Native
  mockup-sandbox/     — Componentes Vite isolados
lib/
  db/                 — @workspace/db: schema Drizzle
  api-spec/           — @workspace/api-spec: OpenAPI + codegen
  api-zod/            — @workspace/api-zod: schemas Zod gerados
  api-client-react/   — @workspace/api-client-react: React Query hooks
```

## Padrões de Código

### Backend
- **NUNCA** usar `console.log` no código do servidor
- Usar `req.log` dentro de rotas e `logger` (singleton) fora de rotas
- Todas as rotas ficam em `artifacts/api-server/src/routes/routes.ts`
- Autenticação via `authenticateToken` middleware
- RBAC via `checkRole(["super_admin", "admin"])` middleware
- `workspaceId` resolvido por: header `x-workspace-id` → claim JWT → `currentWorkspaceId` do usuário

### Frontend
- Aliases: `@/` = src, `@shared/` = schema db, `@assets/` = attached_assets
- Componentes Shadcn UI em `src/components/ui/`
- React Query para todas as chamadas de API
- Wouter para roteamento client-side

## Módulos da Plataforma

1. **Dashboard** — KPIs em tempo real, gráficos de atividade
2. **Inbox Omnichannel** — WhatsApp, Telegram, Instagram com Socket.io
3. **CRM/Kanban** — Pipeline de contatos com temperatura, SLA e agentes
4. **Automação (Flows)** — Builder visual com blocos: mensagem, condição, espera, IA, TTS
5. **Agentes IA** — Personas configuráveis com GPT-4o-mini, TTS e avatar HeyGen
6. **Campanhas** — Sequências multi-etapa broadcast e drip
7. **Score Engine** — Pontuação por regras com badges e gamificação
8. **Microlearning** — Trilhas de conteúdo com entrega automatizada
9. **Webhooks** — Outbound com eventos e HMAC-SHA256
10. **Google Sheets** — Integração via OAuth2
11. **Lab** — Projetos de conteúdo social, assets IA, UTM
12. **Configurações** — SMTP, canais, branding white-label, RBAC

## Workers em Background

| Worker | Intervalo | Função |
|--------|-----------|--------|
| jobQueue | 5s | Processa fila de jobs pendentes |
| learningWorker | 5min | Entrega conteúdo de microlearning |
| campaignWorker | 60s | Dispara campanhas agendadas |
| brainWorker | 300s | Insights e ações autônomas da IA |

## URLs Públicas (sem autenticação)

- `GET /p/:slug` — Landing pages públicas
- `POST /api/public/flows/:flowId/trigger` — Disparo de fluxos externos
- `POST /api/public/campaigns/:campaignId/subscribe` — Inscrição em campanhas

## Regras Invioláveis

1. Nunca expor senhas, tokens ou chaves em logs
2. Nunca usar `console.log` no servidor — sempre `req.log` ou `logger`
3. Rotas novas devem ter `authenticateToken` como mínimo
4. Campos sensíveis nas `settings` usam AES-256-CBC
5. `tokenVersion` deve ser incrementado ao trocar senha
6. Migrações Drizzle via `pnpm --filter @workspace/db run migrate`
7. Typecheck completo: `pnpm run typecheck` deve passar com 0 erros

## Tabelas do Banco de Dados

users, leads, api_configs, evolution_configs, conversations, messages, settings,
settings_audit, roles, permissions, role_permissions, user_roles, audit_logs,
channels, unified_contacts, contact_identifiers, omnichannel_messages,
pipeline_stages, agent_assignments, quick_replies, automation_flows,
flow_templates, branding_config, learning_tracks, learning_deliveries,
outbound_webhooks, sheet_integrations, email_configs, ai_agents,
documentation_versions, campaigns, campaign_deliveries, message_templates,
social_projects, content_assets, publication_schedules, project_status_items

## Provedores WhatsApp

| Provider | Env Var | Observação |
|----------|---------|-----------|
| Evolution API | EVOLUTION_API_URL + EVOLUTION_API_KEY | Padrão |
| Z-API | ZAPI_INSTANCE_ID + ZAPI_TOKEN | Alternativo |
| Meta Cloud API | META_PHONE_ID + META_TOKEN | Oficial Meta |

## Testes

```bash
TEST_DB_ALLOW_ANY=1 pnpm --filter @workspace/api-server run test
```

Resultado esperado: 20/20 green

## Variáveis de Ambiente Obrigatórias

- `DATABASE_URL` — Conexão PostgreSQL
- `JWT_SECRET` — Chave de assinatura JWT
- `SESSION_SECRET` — Chave de sessão
- `PORT` — Porta do servidor (definida pelo Replit por artifact)
