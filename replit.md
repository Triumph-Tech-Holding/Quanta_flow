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

- The server uses `registerRoutes(httpServer, app)` pattern (not Router-based) because it hosts Socket.io on the same server
- Workers: jobQueue (5s), learningWorker (5min), campaignWorker (60s), brainWorker (5min)
- SESSION_SECRET env var is required for JWT
- Frontend imports from `@shared/schema` resolve via Vite alias to `lib/db/src/schema`
- `attached_assets/` is accessible from the frontend via `@assets/` alias (fs.strict: false)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
