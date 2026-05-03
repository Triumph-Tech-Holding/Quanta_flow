# Quanta Flow — Estratégia de Testes

> Documento técnico de qualidade. Define matriz E2E, smoke tests críticos, Definition of Done e padrões de erro.

## 1. Pirâmide de Testes

```
              ┌──────────────┐
              │   E2E (5%)   │   Lab > Protocolos > Smoke Tests
              ├──────────────┤
              │  Integração  │   Webhooks, providers, AI
              │    (15%)     │
              ├──────────────┤
              │   Unitário   │   schema validation, helpers
              │    (80%)     │
              └──────────────┘
```

## 2. Smoke Tests (executar antes de cada deploy)

> Disponível na aba **Lab > Protocolos > Smoke Tests** com botão "Executar Todos".

| # | Endpoint | Método | OK = | Cobertura |
|---|---|---|---|---|
| 1 | `/api/health` | GET | 200 | DB connectivity |
| 2 | `/api/auth/me` | GET | 200/401 | JWT funcional |
| 3 | `/api/crm/contacts` | GET | 200 | listing CRM |
| 4 | `/api/admin/agents` | GET | 200 | agentes IA |
| 5 | `/api/admin/campaigns` | GET | 200 | campanhas |
| 6 | `/api/admin/project-status` | GET | 200 | painel status |
| 7 | `/api/workspaces` | GET | 200 (lista + currentWorkspaceId) | F39 multi-tenant |
| 8 | `/api/workspaces/current` | GET | 200 | workspace ativo do usuário |
| 9 | `/api/documentation/claude-md` | GET | 200 | docs técnicas |
| 10 | `/api/admin/social/projects` | GET | 200 | estúdio social |
| 11 | `/api/inbox/conversations` | GET | 200 | inbox |
| 12 | `/api/branding` | GET | 200 | branding |
| 11 | `/api/brain/insights` | GET | 200 | IA Brain Insights |

**Regra**: somente **2xx/3xx** contam como OK. 4xx/5xx falham o smoke.

## 3. Matriz E2E por Módulo

### 3.1 Autenticação

| Cenário | Pré | Ação | Resultado esperado |
|---|---|---|---|
| Login válido | usuário ativo | POST /auth/login | 200 + JWT + role |
| Login inválido | senha errada | POST /auth/login | 401 |
| Token expirado | JWT > 24h | qualquer req | 401 |
| Token versão antiga | tokenVersion bumped | qualquer req | 401 |
| Forgot password | email válido | POST /auth/forgot-password | 200 + email enviado |
| Mudança obrigatória | mustChangePassword=true | login | redirect /change-password |

### 3.2 Inbox

| Cenário | Resultado |
|---|---|
| Receber WhatsApp via Z-API webhook | mensagem aparece em real-time no inbox |
| Receber WhatsApp via Meta Cloud | idem + verify token validado |
| Enviar mensagem | provider responde 2xx + msg salva |
| SLA expira | webhook `conversation.sla_expired` disparado |

### 3.3 CRM/Pipeline

| Cenário | Resultado |
|---|---|
| Mover contato no Kanban | stage atualizado + webhook |
| Criar pipeline customizado | persistido em pipeline_stages |
| Round-robin assignment | distribuição balanceada |
| AI summary atualizado | summary preenchido após N mensagens |

### 3.4 Automação

| Cenário | Resultado |
|---|---|
| Fluxo com 10 blocos | executa < 5s, sem ciclo |
| Ciclo > 50 steps | abort + log warning |
| Variável {nome} | interpolada com nome do contato |
| Condition true/false | branch correto seguido |
| Agent IA dentro de fluxo | resposta gerada por gpt-4o-mini |

### 3.5 Campanhas

| Cenário | Resultado |
|---|---|
| Broadcast para 100 contatos | 100 deliveries em pending → enviadas em ≤ 60s |
| Drip 3 passos | step 2 enviado após delay configurado |
| Horário fora de allowedHours | delivery aguarda janela permitida |
| Resposta do contato | métrica replyRate atualizada |

### 3.6 IA Brain (Insights & Ações)

| Cenário | Pré | Ação | Resultado esperado |
|---|---|---|---|
| Listar insights | usuário com lead estagnado >48h | GET /api/brain/insights | 200 + array de insights com `suggestedActions` |
| Predição on-demand | contactId válido | GET /api/brain/insights/:id/prediction | 200 + `{probability, reasoning}` |
| Scan manual emite socket | conectado em /inbox | POST /api/brain/scan-now | event `brain:scan-complete` recebido |
| Worker detecta novo crítico | lead acabou de virar quente | aguardar até 5min | event `brain:new-insight` + toast no front |
| **Mover pipeline (ação)** | lead em "qualificado" | POST /api/brain/actions/move-pipeline `{toStage:"proposta"}` | 200 + `pipelineStage` atualizado |
| **Mover com toStage inválido** | qualquer | POST com `toStage:"foo"` | 400 |
| **Mover lead de outro user** | contato não pertence ao usuário | POST | 404 |
| **Atribuir agente round-robin** | ≥1 agente ativo | POST /api/brain/actions/assign-agent | 200 + `assignedToUserId` definido (menos carregado) |
| **Atribuir sem agentes ativos** | nenhum agente | POST | 400 |
| **Disparar microlearning** | trilha ativa cadastrada | POST /api/brain/actions/dispatch-microlearning | 200 + `learningDelivery` criada (step 1, pending) |
| **Disparar sem trilha** | nenhuma trilha ativa | POST | 400 |
| **Enviar mensagem (UI)** | qualquer | clique em botão `enviar_mensagem` | navega para `/inbox?contact={id}` |
| Anti-duplicação de clique | ação já em loading | clique repetido | botão disabled (sem nova request) |
| Estado "Feito" | ação concluída | inspecionar botão | variant `secondary` + texto "Feito" + ícone ✓ |
| Cache invalidado | após qualquer ação | observar dashboard | refetch de `/api/brain/insights` e `/api/crm/dashboard` |

### 3.7 Estúdio Social

| Cenário | Resultado |
|---|---|
| Gerar 6 formatos via IA | formats JSONB preenchido |
| TTS OpenAI | audioUrl salvo |
| TTS ElevenLabs | elevenLabsAudioUrl salvo, credenciais NÃO retornadas em GET |
| Vídeo HeyGen | heygenVideoId/Status salvos, polling funciona |
| UTM link builder | URL final contém source/medium/campaign |

## 4. Definition of Done (12 critérios)

> Disponível em **Lab > Protocolos > DoD** com persistência em localStorage.

1. ✅ Schema Drizzle atualizado em `shared/schema.ts`
2. ✅ Zod insert/update schemas com validação (min/max/enum)
3. ✅ IStorage interface estendida com novos métodos
4. ✅ Implementação Drizzle dos métodos
5. ✅ Rotas REST com `authenticateToken` + `checkRole`
6. ✅ Validação `safeParse` no body com 400 em erro
7. ✅ Tratamento de erro com `console.error` + 500
8. ✅ Frontend usa `useQuery` + `useMutation` do TanStack v5
9. ✅ `queryKey` em array para invalidação correta
10. ✅ `data-testid` em interactive + display elements
11. ✅ Smoke test correspondente passa
12. ✅ `replit.md` atualizado se houver mudança arquitetural

## 5. Erros Comuns + Fix

> Disponível em **Lab > Protocolos > Erros Comuns**.

| # | Padrão | Causa | Fix |
|---|---|---|---|
| 1 | `column "X" does not exist` em produção | schema dev não migrado para prod | usar `database` skill com `environment: "production"` |
| 2 | `req.user is undefined` | falta `authenticateToken` antes do handler | adicionar middleware na rota |
| 3 | `req.user!.id` retorna undefined | propriedade correta é `userId` | usar `req.user!.userId` |
| 4 | `<SelectItem value="">` runtime error | shadcn não aceita value vazio | usar `value="all"` ou similar |
| 5 | Cache não invalida após mutation | queryKey usa template string | trocar por array `["/api/x", id]` |
| 6 | Webhook Meta não recebe | verify token incorreto | conferir `meta_verify_token` em settings |

## 6. Quem testa o quê

| Camada | Responsável | Quando |
|---|---|---|
| Schema/Storage | DEV | a cada PR |
| Endpoints | DEV via smoke tests | antes de merge |
| Fluxos completos | DEV via Lab > Flow Sim | antes de release |
| UX | GES/MKT em staging | antes de publicar |
| Carga | DEV (futuro) | trimestral |

## 7. Ambientes

| Ambiente | URL | Banco | Notas |
|---|---|---|---|
| Dev | localhost:5000 | DATABASE_URL local | HMR Vite |
| Staging | (futuro) | snapshot | testes de aceitação |
| Produção | *.replit.app | prod managed | deploy via skill `deployment` |

## 7.1 Renderer de Documentação (Lab → Docs)

O viewer inline em `client/src/pages/admin-lab.tsx` (`renderMarkdownInline`) suporta:

| Sintaxe Markdown | Renderização |
|---|---|
| `# H1` / `## H2` / `### H3` | `<h1>`/`<h2>`/`<h3>` com hierarquia visual |
| `> quote` | `<blockquote>` com borda primary |
| `- item` / `* item` | `<ul>` com `list-disc` |
| `\| col \| col \|` (tabela com `\|---\|`) | `<table>` com header, hover, scroll horizontal |
| ` ```lang ` / ` ``` ` | `<pre><code>` com fundo muted |
| `**negrito**` | `<strong>` |
| `*itálico*` | `<em>` |
| `` `código` `` | `<code>` inline com fundo muted |
| `---` | `<hr>` |

**Não suportado** (cair como texto puro): listas ordenadas (`1.`), links `[text](url)`, imagens, HTML embutido, tabelas sem linha separadora.

## 8. Checklist de release

```
[ ] Smoke tests verde
[ ] DoD 12/12 marcados
[ ] CHANGELOG.md atualizado com versão
[ ] replit.md reflete mudanças arquiteturais
[ ] Migrations aplicadas em prod (se houver schema change)
[ ] Branding/Settings de prod conferidos
[ ] Backup do DB antes do deploy
```
