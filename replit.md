# Quanta Flow — pnpm Monorepo Workspace

## Overview

Quanta Flow is an omnichannel automation, CRM, microlearning, and gamification platform integrating WhatsApp, Telegram, and Instagram. It supports multi-tenancy with a complete Role-Based Access Control (RBAC) system. The platform aims to streamline customer interactions, automate marketing campaigns, and enhance user engagement through AI-powered features and gamification.

## User Preferences

I prefer to work iteratively, focusing on one module or feature at a time. Before making any significant architectural changes or introducing new dependencies, please ask for my approval. I appreciate clear, concise explanations of the proposed changes and their impact. I also prefer the use of functional programming paradigms where appropriate, and I value clean, well-documented code. Please ensure all changes are type-checked and pass existing tests.

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