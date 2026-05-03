# Quanta Flow — pnpm Monorepo Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the Quanta Flow WhatsApp/omnichannel automation platform ported from a single-app structure into a multi-artifact workspace to support future mobile app (F40).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Frontend**: React 18 + Vite + Tailwind CSS v3 + Shadcn UI + Wouter
- **Real-time**: Socket.io (/inbox namespace)
- **Auth**: JWT (24h) + bcrypt + tokenVersion
- **AI**: OpenAI via Replit AI Integrations
- **Build**: esbuild (ESM bundle for server, Vite for client)

## Artifacts

- `artifacts/api-server/` — Express backend (`@workspace/api-server`), served at `/api`
- `artifacts/quanta-flow/` — React frontend (`@workspace/quanta-flow`), served at `/`
- `artifacts/quanta-flow-mobile/` — Expo React Native mobile app (`@workspace/quanta-flow-mobile`), served at `/mobile/`
- `artifacts/mockup-sandbox/` — Design sandbox (internal use)

## Shared Libraries

- `lib/db/` — PostgreSQL schema (`@workspace/db`) via Drizzle ORM
- `lib/api-spec/` — OpenAPI spec (`@workspace/api-spec`)
- `lib/api-zod/` — Generated Zod schemas (`@workspace/api-zod`)
- `lib/api-client-react/` — Generated React Query hooks (`@workspace/api-client-react`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/quanta-flow run dev` — run frontend locally

## Default Credentials

- Admin: `admin@quantaflow.com` / `Admin@123` (must change on first login)

## Route Aliases (frontend)

- `@/` → `src/`
- `@shared/` → `lib/db/src/schema/` (for schema types shared with backend)
- `@assets/` → `attached_assets/`

## Important Notes

- **`pnpm run typecheck` is a hard gate** — must finalize with 0 errors before any PR/merge. Codemods em `scripts/src/fix-handler-returns.ts` e `scripts/src/fix-string-coercions.ts` automatizam fixes recorrentes.
- The server uses `registerRoutes(httpServer, app)` pattern (not Router-based) because it hosts Socket.io on the same server
- Workers: jobQueue (5s), learningWorker (5min), campaignWorker (60s), brainWorker (5min)
- SESSION_SECRET env var is required for JWT
- Frontend imports from `@shared/schema` resolve via Vite alias to `lib/db/src/schema`
- `attached_assets/` is accessible from the frontend via `@assets/` alias (fs.strict: false)
- Workspace traz campos completos de empresa: `companyName, primaryColor, secondaryColor, logoUrl, faviconUrl, timezone, locale, defaultSlaMinutes` (table `workspaces`). Branding por workspace: `GET/PUT /api/branding` priorizam `req.workspaceId`. Página `/settings/company` (Geral / Branding / Plano / Membros) gerencia tudo. Endpoints de membros: `GET/PATCH/DELETE /api/workspaces/:id/members[/:userId]` (PATCH role: owner-only; DELETE: owner/admin, owner protegido). PATCH `/api/workspaces/:id` valida slug único e formato.
- **Testes automatizados — Fase 1 (#54)**: Vitest 2 + supertest 7 no `@workspace/api-server`. Configuração em `vitest.config.ts` (singleFork, NODE_ENV=test). Helpers em `tests/helpers/` (setup.ts força env + guard `TEST_DB_ALLOW_ANY` para evitar rodar contra DB não-test, factory.ts cria workspace+admin+contato+learning track com bcrypt/jwt e cleanup, app.ts cacheia `createApp()`). Suítes: `tests/unit/scoreEngine.test.ts` (seed 11 regras, idempotência, recompute, clamp 0-100, transições frio→morno→quente), `tests/integration/scoreRoutes.test.ts` (10 casos: 401, GET/PATCH score-rules, score/manual ±range, timeline, learning/complete com fixture real, leaderboard, ops/summary, 7-11-4), `tests/integration/auth.test.ts` (healthz + login OK/wrong) e `tests/integration/landingScoreHook.test.ts` (POST submit público → contato + score 15). Comando: `pnpm --filter @workspace/api-server run test` (também `test:watch` e `typecheck:tests`). `src/index.ts` agora gateia o IIFE de boot em `NODE_ENV !== "test"` para permitir importação do `createApp()` nos testes. Resultado: **20/20 verde**. Playwright (e2e) e GitHub Actions ficaram como follow-up.
- **Premium: Score Engine + Gamificação + Operação (#53)**: tabelas `contact_score_events` (enum `score_event_type` com 11 tipos), `score_rules` (uniq por workspace+event), `learning_points`, `learning_badges`, `learning_completions`. Motor em `artifacts/api-server/src/services/scoreEngine.ts`: `ensureDefaultScoreRules` (seed: form_submitted=15, link_clicked=4, cta_clicked=3, learning_completed=10, deal_won=50, deal_lost=-20; hot=80, warm=40, cooldown=14d), `recomputeContactScore` (soma pontos na janela cooldown, clamp 0-100, atualiza `unified_contacts.score+temperature`), `awardScoreEvent`. Rotas em `artifacts/api-server/src/routes/scoreAndGamification.ts`: `GET/PATCH /api/score-rules[/:id]`, `GET /api/contacts/:id/score-events|timeline|learning-stats|seven-eleven-four`, `POST /api/contacts/:id/score/recompute|manual`, `POST /api/learning/complete` (insere completion + badge auto first_step/5/25/100 + +10pt + score event), `GET /api/leaderboard?days=`, `GET /api/ops/summary?days=` (SLA + temperatura + learning RPM + score events). Hooks: `landingPages.ts` POST submit → `form_submitted` (15pt); POST event `cta_click|page_view` → `cta_clicked|page_viewed` se body.contactId presente; `learningWorker.ts` após delivery sent → `learning_points` (reason=delivered, +2pt) + `awardScoreEvent learning_delivered`. Frontend: `/admin/score-rules` (tabela editável de regras com Switch ativo + Save por linha) e `/ranking` (cards SLA/Pílulas/Minutos/Score events + ranking top consumidores com avatar, badges, RPM). Sidebar: novo item "Ranking" no módulo 8 e "Motor de Score" em Automação.
- **Construtor de Landing Pages (#52)**: tabelas `landing_pages, landing_page_versions, landing_page_submissions, landing_page_events`. Blocos validados via Zod discriminated union em `artifacts/api-server/src/lib/landingBlocks.ts` (16 tipos: header/hero/benefits/testimonials/faq/video/gallery/countdown/socialProof/pricing/richText/cta/form/calendarEmbed/rawEmbed/footer). Rotas em `artifacts/api-server/src/routes/landingPages.ts`: admin CRUD `/api/landing-pages`, publish, versions, submissions, metrics; públicas `/api/public/landing/:slug` (GET render, POST /submit, POST /event). Submit cria/atualiza `unifiedContacts` no workspace, define `activeFlowId` (do form ou da página) e enfileira `campaignDeliveries` quando há campaignId. Frontend: `/admin/landing-pages` (lista + criar com 6 templates), `/admin/landing-pages/:id` (editor 3 colunas com @dnd-kit/sortable, biblioteca de blocos, inspector por bloco, preview desktop/tablet/mobile), `/admin/landing-pages/:id/metrics` (cards + funil + tabela). Renderer público em `/p/:slug` registra `page_view`, `scroll_25/50/75/100`, `form_view`, `cta_click`, `form_submit`, captura UTM. HTML do `richText`/`rawEmbed` é sanitizado via DOMPurify. A/B testing e exportação CSV ficaram como follow-up.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
