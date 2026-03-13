# Quanta Flow - Venda no automático

## Overview
Quanta Flow is a comprehensive lead management, CRM, and marketing automation platform designed to provide an integrated experience for consumers, loyalty agents, and shopkeepers. Its core purpose is to automate sales processes and streamline customer interactions. The platform aims to revolutionize how businesses manage their leads and engage with customers through intelligent automation and communication tools.

## User Preferences
Not specified.

## System Architecture

### UI/UX
- **Primary Color**: Quanta Green (#00A86B)
- **Secondary Color**: Navy Blue (#1B3A57)
- **Slogan**: "Venda no automático."
- **Design System**: Tailwind CSS + Shadcn UI for consistent and modern UI components.
- **Branding**: Dynamic branding configuration allows customization of company name, primary/secondary colors, logo URL, and favicon URL.

### Technical Implementation
- **Frontend**: React, Vite, TypeScript for a modern and performant user interface.
- **Backend**: Node.js with Express.js for a scalable and efficient API layer.
- **Database**: PostgreSQL with Drizzle ORM for robust data management.
- **Authentication**: JWT (JSON Web Tokens) with bcrypt for password hashing, 24-hour expiration, and token versioning for immediate session invalidation. Includes user status management (active, inactive, suspended) and mandatory password change flags.
- **Real-time Communication**: Socket.io for real-time updates, particularly for message reception and instance status changes in the Inbox module.
- **Configuration Management**: Dynamic settings system with AES-256-CBC encryption for sensitive credentials, in-memory caching, and audit logging for all changes.
- **Role-Based Access Control (RBAC)**: Granular permission system with roles (super_admin, admin, user) and 18 distinct permissions across 7 resources, enforced by middleware.
- **AI Integration**: OpenAI (gpt-4o-mini via Replit AI Integrations) for AI Intent Detection, classifying messages, auto-scoring leads, and automatically moving leads through pipelines based on intent.

### Feature Specifications
- **Inbox Module**: Unified messaging center supporting WhatsApp integration via Z-API and Baileys (Evolution API for legacy). Features include real-time conversation viewing, sending/receiving messages, automatic webhook configuration, and Fila de Atendimento with SLA timer.
- **Settings Module**: Secure management of system configurations, including API keys and service URLs, with encryption, caching, and audit trails.
- **CRM Module**: Comprehensive customer relationship management, including lead management (create, update, delete), contact profiles with omnichannel message timelines, AI intent summaries, and agent assignment (manual and round-robin auto-assignment). Kanban board view with search, filters (temperature, intention), and visual AI indicators.
- **Automation Module**: Multi-step flows with 9 sections including conditional exits, SLA support, queue entry, and microlearning triggers. **Visual Flow Builder** with React Flow canvas, 10 block types (text, audio_tts, image_ai, delay, condition, ai_agent, webhook, queue_entry, resolve, update_lead), AI-powered flow generation via GPT-4o-mini, 5 built-in templates, export/import JSON, variable interpolation ({nome}, {telefone}, {email}), cycle detection (max 50 steps), root-node auto-detection, and condition branching with SIM/NÃO labeled edges.
- **Branding Module**: Customizable branding settings including defaultSlaMinutes for SLA control.
- **Queue Module**: Lead queue management with queueStatus (waiting/assigned/resolved), SLA deadlines, and agent assignment.
- **Learning Tracks (Microlearning)**: Automated content delivery triggered by lead stage/intent, with delivery tracking.
- **Outbound Webhooks**: Configurable webhooks to notify external systems (Zapier, HubSpot, etc.) on events: lead.created, lead.qualified, flow.success, flow.interrupt, conversation.closed. With HMAC-SHA256 signing.
- **Google Sheets Integration**: Automatic row append on lead events with configurable column mapping and OAuth2 authentication.
- **Multi-channel Support**: Unified processIncomingMessage() supports WhatsApp, Telegram, Instagram, and Email channels. Dedicated service files for each.
- **CI/CD**: GitHub Actions workflows for deploy (on push to main) and PR checks.
- **Health Check**: GET /api/health endpoint with DB connectivity status.
- **AI Agent Factory (Fábrica de Agentes IA)**: Create and manage AI expert agents with configurable model, temperature, tone, specialty, systemPrompt, TTS voice, and max tokens. Chat preview for testing agents. Integration with automation flows via `agentId` field — when a flow has an agent, incoming messages generate AI-powered responses instead of template responses. Endpoints: GET/POST/PUT/DELETE `/api/admin/agents`, POST `/api/admin/agents/:id/chat`, POST `/api/admin/agents/:id/tts`, POST `/api/admin/agents/generate-avatar`.
- **Campaigns & Sequences (Campanhas Omnichannel)**: Mass messaging campaigns with segment-based targeting (temperature, stage, channel), drip sequences with configurable delays, AI copy generation via GPT-4o-mini, rate limiting, allowed hours control. 4-step wizard for campaign creation. Campaign metrics dashboard with send/delivery/reply/conversion rates. Message template library with categories. CampaignWorker background process (60s interval) processes pending deliveries. Reply tracking in messageProcessor auto-updates campaign metrics. Endpoints: CRUD `/api/admin/campaigns`, POST `start/pause`, GET `metrics`, POST `preview-segment`, POST `generate-copy`, CRUD `/api/admin/templates`.
- **Lab / Testing Module**: Admin-only testing environment with chat simulator for WhatsApp/Instagram. Test AI agents before deployment without affecting production. Live chat interface with channel selection (WhatsApp/Instagram), agent selection, message sending, and real-time AI responses. Endpoints: POST `/api/admin/lab/simulate-chat`.
- **User Manual (PDF Download)**: Comprehensive didactic user manual in Portuguese (MANUAL_DE_USO.md) covering all features with practical examples and scenarios. PDF generation via pdfkit on-demand. Available in Documentation area with one-click download. Endpoint: GET `/api/documentation/manual-pdf`.

### System Design Choices
- **Modular Structure**: Clear separation of client, server, and shared codebases.
- **Database Schema**: Dedicated tables for users, leads, API configurations, conversations (with channel field), messages, settings, roles, permissions, audit logs, unified_contacts (with queueStatus/SLA/activeFlowId), agent_assignments, learning_tracks, learning_deliveries, outbound_webhooks, sheet_integrations, email_configs, ai_agents, documentation_versions, campaigns, campaign_deliveries, message_templates. The `automation_flows` table includes an `agent_id` column referencing `ai_agents`.
- **API Endpoints**: Structured API for authentication, lead management, WhatsApp integration, admin settings, user management, role management, audit logs, AI services, queue management, learning tracks, outbound webhooks, sheet integrations, email config, Telegram/Instagram webhooks, health check.
- **WhatsApp Provider Management**: Flexible system to switch between different WhatsApp providers (Z-API, Baileys, Evolution).
- **Agent Assignment**: Functionality for listing agents, assigning contacts, and automated round-robin assignment.
- **Real-time Data Sync**: Socket.io for instant updates on new messages, instance connections, and configuration changes.
- **JobQueue**: In-memory job queue processing send_message, check_inactivity, and check_sla jobs every 5 seconds.
- **LearningWorker**: Background worker processing microlearning delivery every 5 minutes.
- **CampaignWorker**: Background worker processing campaign deliveries every 60 seconds, respecting rate limits and allowed hours.
- **WebhookDispatcher**: Async webhook dispatcher with HMAC signing and 5s timeout per call.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Z-API**: WhatsApp integration service for messaging and webhooks.
- **Evolution API (Legacy)**: Older WhatsApp integration service.
- **OpenAI (gpt-4o-mini)**: AI service for intent detection and message classification, accessed via Replit AI Integrations.
- **Socket.io**: Real-time bidirectional event-based communication.
- **@whiskeysockets/baileys**: Node.js library for WhatsApp Web.
- **Multer**: Node.js middleware for handling `multipart/form-data`, used for file uploads.
- **Nodemailer**: Node.js library for SMTP email sending.
- **Telegram Bot API**: Direct HTTP integration for bot messaging.
- **Meta Graph API**: Direct HTTP integration for Instagram messaging.
- **Google Sheets API v4**: Direct HTTP integration for spreadsheet row appending.