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
- **Inbox Module**: Unified messaging center supporting WhatsApp integration via Z-API and Baileys (Evolution API for legacy). Features include real-time conversation viewing, sending/receiving messages, and automatic webhook configuration.
- **Settings Module**: Secure management of system configurations, including API keys and service URLs, with encryption, caching, and audit trails.
- **CRM Module**: Comprehensive customer relationship management, including lead management (create, update, delete), contact profiles with omnichannel message timelines, AI intent summaries, and agent assignment (manual and round-robin auto-assignment). Kanban board view with search, filters (temperature, intention), and visual AI indicators.
- **Automation Module**: Management of automated flows based on keywords and response templates.
- **Branding Module**: Customizable branding settings for the platform's appearance.
- **File Uploads**: API endpoint for image uploads (PNG, JPG, GIF, WebP) with size limits.

### System Design Choices
- **Modular Structure**: Clear separation of client, server, and shared codebases.
- **Database Schema**: Dedicated tables for users, leads, API configurations, conversations, messages, settings, roles, permissions, and audit logs.
- **API Endpoints**: Structured API for authentication, lead management, WhatsApp integration, admin settings, user management, role management, audit logs, and AI services.
- **WhatsApp Provider Management**: Flexible system to switch between different WhatsApp providers (Z-API, Baileys, Evolution).
- **Agent Assignment**: Functionality for listing agents, assigning contacts, and automated round-robin assignment.
- **Real-time Data Sync**: Socket.io for instant updates on new messages, instance connections, and configuration changes.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Z-API**: WhatsApp integration service for messaging and webhooks.
- **Evolution API (Legacy)**: Older WhatsApp integration service.
- **OpenAI (gpt-4o-mini)**: AI service for intent detection and message classification, accessed via Replit AI Integrations.
- **Socket.io**: Real-time bidirectional event-based communication.
- **@whiskeysockets/baileys**: Node.js library for WhatsApp Web.
- **Multer**: Node.js middleware for handling `multipart/form-data`, used for file uploads.