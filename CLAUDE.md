# CLAUDE.md — Quanta Flow
> Arquivo de contexto técnico para IAs e desenvolvedores (FLOW DEVELOPMENT SYSTEMS Standard)

---

## Stack Tecnológica

| Camada | Tecnologia | Versão / Notas |
|--------|-----------|---------------|
| Frontend | React + Vite + TypeScript | JSX transformer automático — NÃO importar React explicitamente |
| UI | Tailwind CSS + Shadcn UI | Componentes em `client/src/components/ui/` |
| Roteamento | Wouter | `useLocation`, `Link` — não usar `window.location` |
| Formulários | react-hook-form + zodResolver | Sempre usar `useForm` com `defaultValues` |
| Estado assíncrono | TanStack Query v5 | Apenas sintaxe objeto: `useQuery({ queryKey: [...] })` |
| Backend | Node.js + Express.js + TypeScript | |
| ORM | Drizzle ORM | Schema em `shared/schema.ts` |
| Banco | PostgreSQL | `DATABASE_URL` env var |
| Auth | JWT 24h + bcrypt + tokenVersion | `req.user.userId` (não `.id`) |
| Real-time | Socket.io | Namespace `/inbox` |
| IA | OpenAI gpt-4o-mini | Via Replit AI Integrations |
| Criptografia | AES-256-CBC | Settings sensíveis via `configService` |

---

## Padrões de Nomenclatura

### Banco de Dados (snake_case)
- Tabelas: `unified_contacts`, `automation_flows`, `content_assets`
- Colunas: `user_id`, `created_at`, `is_active`, `pipeline_stage`
- PKs: `id varchar(36)` com `gen_random_uuid()` padrão
- FKs: `<tabela_singular>_id` (ex: `user_id`, `contact_id`)

### TypeScript / JavaScript (camelCase)
- Variáveis/funções: `userId`, `createdAt`, `isActive`
- Tipos Drizzle: `typeof tabela.$inferSelect`
- Insert types: `z.infer<typeof insertXxxSchema>`

### Arquivos
- Páginas frontend: `client/src/pages/admin-lab.tsx` (kebab-case)
- Componentes: `client/src/components/app-sidebar.tsx` (kebab-case)
- Services backend: `server/services/configService.ts` (camelCase)
- Routes: tudo em `server/routes.ts`

### API Endpoints
- REST padrão: `GET/POST/PUT/DELETE /api/admin/<recurso>`
- Auth obrigatória: middleware `authenticateToken` + `checkRole`
- Prefixo admin: `/api/admin/` para operações privilegiadas

---

## Regras de Negócio Invioláveis

### Autenticação & Sessão
- Token JWT com campo `userId`, `email`, `tokenVersion`
- `tokenVersion` increments on password change → invalida todas as sessões ativas imediatamente
- Token armazenado em `localStorage` com chave `"token"`
- Middleware: `authenticateToken` → popula `req.user`
- `req.user!.userId` (nunca `req.user!.id`)

### RBAC (Role-Based Access Control)
- 3 roles: `super_admin` (acesso total), `admin` (limitado), `user` (atendente)
- 18 permissões em 7 recursos
- Rotas admin protegidas por `checkRole(["super_admin", "admin"])`
- Nunca expor endpoints admin sem checagem de role

### Criptografia de Settings
- Credenciais sensíveis (API keys, tokens) armazenadas criptografadas na tabela `settings`
- AES-256-CBC via `configService.getSetting(key)` retorna valor decriptado
- Nunca retornar valores brutos de `settings` em GET responses

### Credenciais Externas (ElevenLabs, HeyGen)
- Armazenadas em `social_projects.brand.cloningIds` (JSONB criptografado)
- Nunca retornar `cloningIds` em respostas GET — substituir por `hasElevenLabs`/`hasHeyGen` (booleans)

### SelectItem (Shadcn)
- **NUNCA** usar `value=""` — usar sentinel `"_none_"` para opção vazia
- Obrigatório `value` prop em todo `<SelectItem>`

### Arrays no Drizzle Schema
- `.array()` como método: `text().array()` — NUNCA `array(text())`

---

## Estrutura de Diretórios

```
/
├── client/src/
│   ├── pages/          # Uma página por rota (admin-*, inbox, crm, etc.)
│   ├── components/     # Componentes reutilizáveis
│   │   └── ui/        # Shadcn components
│   ├── hooks/          # Custom hooks (use-toast, use-mobile)
│   └── lib/            # queryClient, utils
├── server/
│   ├── routes.ts       # Todos os endpoints API
│   ├── storage.ts      # Interface IStorage + implementação
│   ├── index.ts        # Bootstrap, seeds, workers
│   ├── services/       # configService, messageProcessor, etc.
│   ├── providers/      # WhatsApp providers (zapi, baileys, meta)
│   └── workers/        # jobQueue, learningWorker, campaignWorker
├── shared/
│   └── schema.ts       # Drizzle schema + Zod schemas + Types
└── uploads/            # Arquivos gerados (TTS audio, imagens)
```

---

## Workers em Background

| Worker | Intervalo | Função |
|--------|-----------|--------|
| `jobQueue` | 5s | send_message, check_inactivity, check_sla |
| `learningWorker` | 5min | Entrega de trilhas de microlearning |
| `campaignWorker` | 60s | Processamento de campanhas/drip sequences |
| `brainWorker` | 5min | Varredura de insights críticos da IA Brain + Socket.io push |

---

## Guia de Onboarding para Dev/IA

### 1. Adicionar nova tabela
1. Definir tabela em `shared/schema.ts` (com `pgTable`, PK uuid, timestamps)
2. Criar `insertXxxSchema` e `updateXxxSchema` com Zod
3. Exportar tipos `Xxx`, `InsertXxx`
4. Adicionar métodos em `IStorage` interface (`server/storage.ts`)
5. Implementar métodos em `DatabaseStorage`
6. Adicionar endpoints em `server/routes.ts`
7. (Opcional) Seed automático em `server/index.ts`

### 2. Adicionar nova página frontend
1. Criar arquivo em `client/src/pages/`
2. Registrar rota em `client/src/App.tsx`
3. Adicionar item no sidebar em `client/src/components/app-sidebar.tsx`

### 3. Adicionar nova aba em página existente
1. Adicionar `TabsTrigger` em `TabsList` (atualizar `grid-cols-N`)
2. Adicionar `TabsContent` correspondente
3. Adicionar estado e queries necessários

### 4. Consultar settings criptografadas
```typescript
import { configService } from "./services/configService";
const value = await configService.getSetting("minha_chave");
```

---

## Credenciais de Desenvolvimento

- Admin: `admin@quantaflow.com` / `Admin@123`
- DB: variável `DATABASE_URL`
- JWT Secret: variável `SESSION_SECRET`
- OpenAI: via Replit AI Integrations (não precisa de API key manual)

---

## Padrões de Erro

| Padrão | Causa Comum | Solução |
|--------|-------------|---------|
| `req.user!.id undefined` | Usar `.id` em vez de `.userId` | Usar `req.user!.userId` |
| `SelectItem value=""` | Valor vazio em SelectItem | Usar `value="_none_"` |
| `array(text())` | Sintaxe errada de array no schema | Usar `text().array()` |
| `useQuery(['key'])` | Sintaxe v4 do TanStack | Usar `useQuery({ queryKey: ['key'] })` |
| CORS/proxy 404 | Vite proxy não configurado | Não modificar vite.config.ts |
| JWT 401 após troca de senha | tokenVersion desatualizado | Re-login obrigatório |
