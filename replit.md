# Quanta Flow - Venda no automático

## Overview
Quanta Flow é uma plataforma completa de gestão de leads, CRM e automação de marketing. O sistema oferece uma experiência integrada para consumidores, agentes de fidelização e lojistas.

### Identidade Visual
- **Cor Primária**: Verde Quanta (#00A86B / HSL 157 100% 33%)
- **Cor Secundária**: Azul Navy (#1B3A57 / HSL 210 52% 22%)
- **Slogan**: "Venda no automático."

## Project Architecture

### Stack Tecnológico
- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express.js
- **Banco de Dados**: PostgreSQL (Drizzle ORM)
- **Autenticação**: JWT (JSON Web Tokens)
- **Styling**: Tailwind CSS + Shadcn UI

### Structure
```
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   │   ├── ui/            # Shadcn UI components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── lib/
│   │   │   ├── auth.tsx       # Context de autenticação
│   │   │   └── queryClient.ts
│   │   ├── pages/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── dashboard.tsx
│   │   └── App.tsx
├── server/                    # Backend Express
│   ├── db.ts                  # Conexão PostgreSQL
│   ├── routes.ts              # Rotas da API
│   └── storage.ts             # Interface de storage
└── shared/
    └── schema.ts              # Schemas Drizzle + Zod
```

### Database Schema
- **users**: Usuários do sistema (consumidor, agente_fidelizacao, lojista)
- **leads**: Leads/contatos associados a usuários
- **api_configs**: Configurações de APIs externas (Evolution, OpenAI, Meta)

### Authentication
- JWT com expiração de 24h
- Senhas hasheadas com bcrypt
- Token armazenado no localStorage
- Token versioning para invalidação imediata de sessões
- Status do usuário: active, inactive, suspended
- Troca de senha obrigatória (mustChangePassword flag)

### API Endpoints
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário autenticado
- `GET /api/leads` - Listar leads do usuário
- `POST /api/leads` - Criar lead
- `PATCH /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

## Modules
1. **Inbox** - Central de mensagens unificada (WhatsApp via Z-API)
   - Conexão WhatsApp via Z-API (instância pré-conectada)
   - Configuração automática de webhooks via API
   - Visualização de conversas em tempo real
   - Envio e recebimento de mensagens
   - Socket.io para atualizações em tempo real
2. **Settings** - Sistema de gerenciamento de configurações dinâmicas
   - Criptografia AES-256-CBC para credenciais sensíveis
   - Cache em memória com TTL de 5 minutos
   - Audit logging para todas as alterações
   - Admin CRUD com role-based authorization
   - Validação de credenciais
   - Categorias: whatsapp, ai, integrations, general
   - Tipos: api_key, url, token, id, secret
3. **CRM** - Gestão de relacionamento com clientes (Em breve)
4. **Automação** - Fluxos automatizados (Em breve)
5. **Social/Ads** - Marketing e anúncios (Em breve)
6. **IA Brain** - Inteligência artificial (Em breve)
7. **Tribos** - Comunidades e grupos (Em breve)

## Database Schema
- **users**: Usuários do sistema (consumidor, agente_fidelizacao, lojista, admin)
- **leads**: Leads/contatos associados a usuários
- **api_configs**: Configurações de APIs externas (Evolution, OpenAI, Meta)
- **evolution_configs**: Configuração da Evolution API por usuário
- **conversations**: Conversas WhatsApp por usuário
- **messages**: Mensagens das conversas
- **settings**: Configurações dinâmicas do sistema (criptografadas)
- **settings_audit**: Histórico de alterações nas configurações
- **roles**: Roles do sistema (super_admin, admin, user)
- **permissions**: Permissões granulares (18 permissões across 7 recursos)
- **role_permissions**: Associação entre roles e permissões
- **user_roles**: Associação entre usuários e roles
- **audit_logs**: Logs de auditoria de todas as ações administrativas

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login (valida status do usuário)
- `GET /api/auth/me` - Dados do usuário autenticado
- `POST /api/auth/change-password` - Alterar senha (incrementa tokenVersion)

### Leads
- `GET /api/leads` - Listar leads do usuário
- `POST /api/leads` - Criar lead
- `PATCH /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

### Z-API (WhatsApp)
- `POST /api/zapi/connect` - Conectar Z-API (configura webhooks automaticamente)
- `GET /api/zapi/status` - Status da conexão
- `POST /api/zapi/disconnect` - Desconectar Z-API
- `POST /api/zapi/refresh-webhooks` - Atualizar URLs dos webhooks na Z-API

### Evolution API (WhatsApp - Legacy)
- `POST /api/evolution/connect` - Conectar WhatsApp (gera QR Code)
- `GET /api/evolution/status` - Status da conexão
- `GET /api/evolution/qrcode` - Obter QR Code atualizado
- `POST /api/evolution/disconnect` - Desconectar WhatsApp

### Conversas e Mensagens
- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id/messages` - Mensagens de uma conversa
- `POST /api/conversations/:id/messages` - Enviar mensagem (suporta Z-API e Evolution)

### Webhook
- `POST /webhooks/evolution` - Webhook para receber mensagens (Z-API e Evolution API)

### Admin Settings (Requer permissão view_settings/edit_settings/delete_settings)
- `GET /api/admin/settings` - Listar todas as configurações
- `GET /api/admin/settings/:key/value` - Obter valor decriptado
- `POST /api/admin/settings` - Criar nova configuração
- `PUT /api/admin/settings/:key` - Atualizar configuração
- `DELETE /api/admin/settings/:key` - Deletar configuração
- `POST /api/admin/settings/refresh` - Forçar refresh do cache
- `POST /api/admin/settings/:key/validate` - Validar credencial

### Admin Users (Requer permissão view_users/edit_users)
- `GET /api/admin/users` - Listar todos os usuários com roles
- `PATCH /api/admin/users/:id` - Atualizar status, tipo, role do usuário

### Admin Roles (Requer permissão manage_roles)
- `GET /api/admin/roles` - Listar roles com permissões

### Admin Audit Logs (Requer permissão view_audit_logs)
- `GET /api/admin/audit-logs` - Listar logs de auditoria (paginado)

## Socket.io Events
- Namespace: `/inbox`
- Eventos emitidos:
  - `message:received` - Nova mensagem recebida
  - `message:sent` - Mensagem enviada
  - `instance:connected` - WhatsApp conectado
  - `settings:refresh` - Cache de configurações atualizado

## RBAC (Role-Based Access Control)

### Roles
- **super_admin**: Acesso total ao sistema (18 permissões)
- **admin**: Gerente com acesso limitado (9 permissões)
- **user**: Atendente com acesso básico (5 permissões)

### Permissões (18 totais)
- settings: view_settings, edit_settings, delete_settings
- users: view_users, create_users, edit_users, delete_users
- audit_logs: view_audit_logs, export_audit_logs
- inbox: view_inbox, edit_inbox
- leads: view_leads, create_leads, edit_leads
- api_configs: view_api_configs, edit_api_configs
- roles: manage_roles, assign_roles

### Middleware RBAC
- `checkPermission(permission)` - Verifica permissão granular
- `checkRole(role)` - Verifica role do usuário
- `getUserRolesAndPermissions(userId)` - Retorna roles e permissões do usuário

### Admin Credentials
- Email: admin@quantaflow.com
- Role: super_admin (todas as permissões)
- Seed: `npx tsx scripts/seed-rbac.ts`

### AI Intent Detection
- `POST /api/ai/detect-intent` - Detectar intenção de mensagem via OpenAI (com ou sem contactId)

## AI Services

### Intent Detection (server/services/intentService.ts)
- Usa OpenAI (gpt-4o-mini via Replit AI Integrations) para classificar mensagens
- Intents: compra_quente, duvida, reclamacao, suporte, elogio, indefinido
- Temperaturas: frio, morno, quente
- Auto-scoring: -10 a +20 pontos por mensagem
- Auto-pipeline: "compra_quente" com alta confiança move de "novo" → "qualificado"
- Integrado no webhook Z-API: cada mensagem recebida é classificada automaticamente
- Contatos CRM são auto-criados quando nova mensagem WhatsApp chega
- Env vars: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL

## Recent Changes
- Estrutura base do projeto criada
- Autenticação JWT implementada
- Dashboard inicial com sidebar
- Banco de dados PostgreSQL configurado
- Módulo Inbox implementado com Evolution API v2
- Socket.io configurado para mensagens em tempo real
- Módulo Settings implementado com criptografia e audit logging
- Admin panel para gerenciamento de configurações
- Sistema de segurança aprimorado com token versioning
- Gerenciamento de status de usuário (active/inactive/suspended)
- Fluxo de troca de senha obrigatória
- Script de seed para usuário admin (scripts/seed-admin.ts)
- Integração Z-API implementada como alternativa à Evolution API
- Configuração automática de webhooks via API da Z-API
- Envio de mensagens suporta Z-API e Evolution API
- RBAC Enterprise implementado com 5 tabelas (roles, permissions, role_permissions, user_roles, audit_logs)
- Middleware RBAC com checkPermission e checkRole
- JWT atualizado para incluir roles e permissions no payload
- Sidebar dinâmica baseada em permissões do usuário
- Página de Gestão de Usuários (/admin/users) com edição de status e roles
- Página de Audit Logs (/admin/audit-logs) com paginação
- Endpoints admin protegidos com RBAC granular
- Seção "Administração" no sidebar visível apenas para usuários com permissões adequadas
- Campo contactPhone expandido para varchar(50) para suportar IDs de grupo WhatsApp
- Filtros de webhook: ignora mensagens de grupo (isGroup) e webhooks de notificação
- Auto-refresh de webhooks Z-API na inicialização do servidor (força atualização sempre)
- getWebhookUrl() corrigido: usa WEBHOOK_BASE_URL (prioridade), REPLIT_DEPLOYMENT para detectar produção, REPLIT_DEV_DOMAIN para desenvolvimento
- WEBHOOK_BASE_URL configurado em produção: https://code-companion-31maurosergio.replit.app
- NOTA: REPLIT_DEPLOYMENT_URL não existe no Replit; REPLIT_DEV_DOMAIN não disponível em deployments; usar WEBHOOK_BASE_URL para produção
- AI Intent Detection implementado com OpenAI (gpt-4o-mini) via Replit AI Integrations
- Webhook Z-API integrado com CRM: auto-cria contatos e classifica intenções em tempo real
- Endpoint /api/ai/detect-intent para classificação manual de mensagens
- LSP errors corrigidos em routes.ts (req.params.id type casting)
- Dashboard reescrito com métricas CRM reais: temperatura, pipeline, score médio, intenções IA, leads quentes, contatos recentes
- Endpoint GET /api/crm/dashboard para estatísticas do dashboard
- CRM Kanban melhorado: busca por nome/email/telefone, filtros por temperatura e intenção, indicadores visuais de intenção IA nos cards, pontuação total por coluna
- Página de perfil de contato (/crm/contact/:id): timeline de mensagens omnichannel, resumo de intenções IA, gerenciamento de canais, edição de stage/temperatura/notas
- Rota /crm/contact/:id adicionada ao App.tsx
