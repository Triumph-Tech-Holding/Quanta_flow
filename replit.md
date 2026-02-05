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

### API Endpoints
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário autenticado
- `GET /api/leads` - Listar leads do usuário
- `POST /api/leads` - Criar lead
- `PATCH /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

## Modules
1. **Inbox** - Central de mensagens unificada (WhatsApp via Evolution API v2)
   - Conexão WhatsApp via QR Code
   - Visualização de conversas em tempo real
   - Envio e recebimento de mensagens
   - Socket.io para atualizações em tempo real
2. **CRM** - Gestão de relacionamento com clientes (Em breve)
3. **Automação** - Fluxos automatizados (Em breve)
4. **Social/Ads** - Marketing e anúncios (Em breve)
5. **IA Brain** - Inteligência artificial (Em breve)
6. **Tribos** - Comunidades e grupos (Em breve)

## Database Schema
- **users**: Usuários do sistema (consumidor, agente_fidelizacao, lojista)
- **leads**: Leads/contatos associados a usuários
- **api_configs**: Configurações de APIs externas (Evolution, OpenAI, Meta)
- **evolution_configs**: Configuração da Evolution API por usuário
- **conversations**: Conversas WhatsApp por usuário
- **messages**: Mensagens das conversas

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário autenticado

### Leads
- `GET /api/leads` - Listar leads do usuário
- `POST /api/leads` - Criar lead
- `PATCH /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

### Evolution API (WhatsApp)
- `POST /api/evolution/connect` - Conectar WhatsApp (gera QR Code)
- `GET /api/evolution/status` - Status da conexão
- `GET /api/evolution/qrcode` - Obter QR Code atualizado
- `POST /api/evolution/disconnect` - Desconectar WhatsApp

### Conversas e Mensagens
- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id/messages` - Mensagens de uma conversa
- `POST /api/conversations/:id/messages` - Enviar mensagem

### Webhook
- `POST /webhooks/evolution` - Webhook para receber mensagens da Evolution API

## Socket.io Events
- Namespace: `/inbox`
- Eventos emitidos:
  - `message:received` - Nova mensagem recebida
  - `message:sent` - Mensagem enviada
  - `instance:connected` - WhatsApp conectado

## Recent Changes
- Estrutura base do projeto criada
- Autenticação JWT implementada
- Dashboard inicial com sidebar
- Banco de dados PostgreSQL configurado
- Módulo Inbox implementado com Evolution API v2
- Socket.io configurado para mensagens em tempo real
