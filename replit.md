# Quanta Flow - Venda no automático

## Overview
Quanta Flow is a comprehensive lead management, CRM, and marketing automation platform designed to automate sales processes and streamline customer interactions. It provides an integrated experience for consumers, loyalty agents, and shopkeepers, aiming to revolutionize lead management and customer engagement through intelligent automation and communication tools.

## User Preferences
Not specified.

## System Architecture

### UI/UX
- **Branding**: Customizable company name, primary/secondary colors (Quanta Green #00A86B, Navy Blue #1B3A57), logo URL, and favicon URL. Slogan: "Venda no automático."
- **Design System**: Tailwind CSS + Shadcn UI for a consistent and modern interface.

### Technical Implementation
- **Frontend**: React, Vite, TypeScript.
- **Backend**: Node.js with Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: JWT with bcrypt, 24-hour expiration, token versioning, user status management (active, inactive, suspended), and mandatory password change flags.
- **Real-time Communication**: Socket.io for immediate updates in Inbox and instance status changes.
- **Configuration Management**: Dynamic settings system with AES-256-CBC encryption, in-memory caching, and audit logging.
- **Role-Based Access Control (RBAC)**: Granular permissions (super_admin, admin, user) with 18 distinct permissions across 7 resources.
- **AI Integration**: OpenAI (gpt-4o-mini via Replit AI Integrations) for intent detection, lead scoring, and automated pipeline movement.
- **CI/CD**: GitHub Actions for deployment and PR checks.

### Feature Specifications
- **Inbox Module**: Unified messaging center with WhatsApp integration (Z-API, Baileys, Meta Oficial), real-time conversations, Fila de Atendimento with SLA timer.
- **Settings Module**: Secure management of API keys and service URLs.
- **CRM Module**: Lead management (CRUD), contact profiles with omnichannel timelines, AI intent summaries, agent assignment (manual and round-robin), Kanban board with search/filters/AI indicators.
- **Automation Module**: Multi-step visual flow builder (React Flow canvas) with 10 block types, conditional exits, SLA support, queue entry, microlearning triggers, AI-powered flow generation, 5 templates, variable interpolation, and condition branching. `automation_flows` table includes `agent_id` for AI agent integration.
- **Branding Module**: Customization of branding settings, including default SLA minutes.
- **Queue Module**: Lead queue management with status, SLA deadlines, and agent assignment.
- **Learning Tracks (Microlearning)**: Automated content delivery based on lead stage/intent.
- **Outbound Webhooks**: Configurable webhooks (Zapier, HubSpot) with HMAC-SHA256 signing for events like `lead.created`, `lead.qualified`, `flow.success`, `flow.interrupt`, `conversation.closed`.
- **Google Sheets Integration**: Automatic row append on lead events with configurable column mapping and OAuth2.
- **Multi-channel Support**: Unified `processIncomingMessage()` for WhatsApp, Telegram, Instagram, and Email.
- **Health Check**: `/api/health` endpoint with DB connectivity status.
- **AI Agent Factory**: Create and manage AI expert agents with configurable model, temperature, tone, specialty, systemPrompt, TTS voice, and max tokens. Includes chat preview.
- **Campaigns & Sequences (Campanhas Omnichannel)**: Mass messaging campaigns with segment-based targeting, drip sequences, AI copy generation, rate limiting, and allowed hours control. Features a 4-step wizard, metrics dashboard, and message template library.
- **Lab / Testing Module**: Admin-only internal technical cockpit. Includes:
    - **Progresso**: Editable feature matrix with status and progress bars.
    - **Protocolos**: Smoke Tests for critical endpoints, Definition of Done criteria, and Common Errors.
    - **Docs**: Viewer for all technical documentation (CLAUDE.md, CHANGELOG.md, FEATURES.md, STORIES.md, DICTIONARY.md, VISUAL_FLOW.md, TESTING.md, DEPLOY_GUIDE.md) with PDF download.
- **IA Brain — Insights & Ações Executáveis**: Dashboard card displaying AI-generated insights (stagnant leads, conversion prediction) with executable 1-click actions (move pipeline, assign agent, dispatch microlearning, send message). Background worker `BrainWorker` for proactive insight generation.
- **Social/Ads — Estúdio de Conteúdo Omnichannel**: Content creation studio for social media and ads with project CRUD, AI content generation (headlines, captions, ads, emails, blog posts), TTS audio generation, UTM link builder, filterable content library, calendar view, publication schedules, and dashboard metrics. Includes Chat Wizard MFORTE for idea enrichment and Voice/Avatar Cloning (ElevenLabs, HeyGen).

### System Design Choices
- **Modular Structure**: Separation of client, server, and shared code.
- **Database Schema**: Dedicated tables for users, leads, configurations, conversations, messages, settings, roles, permissions, audit logs, unified contacts, agent assignments, learning tracks, webhooks, sheet integrations, email configs, AI agents, documentation, campaigns, templates, social projects, content assets, publication schedules, and project status items. `automation_flows` and social tables use UUID primary keys.
- **API Endpoints**: Structured API for all functionalities.
- **WhatsApp Provider Management**: Flexible system to switch between Z-API, Baileys, and Meta Oficial (Cloud API).
- **Agent Assignment**: Manual and automated round-robin assignment.
- **Real-time Data Sync**: Socket.io for instant updates.
- **Background Workers**: `JobQueue` (send_message, inactivity, SLA every 5s), `LearningWorker` (microlearning every 5min), `CampaignWorker` (campaign deliveries every 60s), `BrainWorker` (insights every 5min), `WebhookDispatcher` (async, HMAC, 5s timeout).

## External Dependencies
- **PostgreSQL**: Primary database.
- **Z-API**: WhatsApp integration.
- **OpenAI (gpt-4o-mini)**: AI services via Replit AI Integrations.
- **Socket.io**: Real-time communication.
- **@whiskeysockets/baileys**: WhatsApp Web library.
- **Multer**: `multipart/form-data` handling for file uploads.
- **Nodemailer**: SMTP email sending.
- **Telegram Bot API**: Telegram messaging.
- **Meta Graph API**: Instagram messaging.
- **Google Sheets API v4**: Spreadsheet integration.
- **ElevenLabs**: Voice cloning and TTS.
- **HeyGen**: Avatar video generation.