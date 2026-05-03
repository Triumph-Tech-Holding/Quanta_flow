# Quanta Flow — Catálogo de Features

> Documento técnico mantido pelo time de engenharia. Cada feature inclui módulo, status, endpoints principais, dependências e critérios de aceite.

## Índice por Módulo

1. [Autenticação & RBAC](#1-autenticação--rbac)
2. [Inbox Omnichannel](#2-inbox-omnichannel)
3. [CRM & Contatos](#3-crm--contatos)
4. [Automação (Visual Flow Builder)](#4-automação-visual-flow-builder)
5. [IA — Agentes & Intent Detection](#5-ia--agentes--intent-detection)
6. [Campanhas & Sequências](#6-campanhas--sequências)
7. [Microlearning (Trilhas)](#7-microlearning-trilhas)
8. [Estúdio de Conteúdo Social/Ads](#8-estúdio-de-conteúdo-socialads)
9. [Branding & Settings](#9-branding--settings)
10. [Integrações Externas](#10-integrações-externas)
11. [IA Brain — Insights & Ações Executáveis](#11-ia-brain--insights--ações-executáveis)
12. [Lab — Cockpit Técnico](#12-lab--cockpit-técnico)
13. [Documentação Técnica](#13-documentação-técnica)

---

## 1. Autenticação & RBAC

| Feature | Status | Endpoint principal | Dependências |
|---|---|---|---|
| Login JWT 24h | OK | POST /api/auth/login | bcrypt, tokenVersion |
| Logout & invalidação | OK | POST /api/auth/logout | tokenVersion bump |
| Forgot password | OK | POST /api/auth/forgot-password | email transport |
| Mudança obrigatória de senha | OK | flag `mustChangePassword` | — |
| Roles (super_admin, admin, user) | OK | seed automático no startup | RBAC seed |
| 18 permissions × 7 resources | OK | middleware checkRole/checkPermission | — |
| Audit log de alterações admin | OK | tabela `audit_logs` | — |

**Critério de aceite**: token expira em 24h, logout invalida imediatamente, role faltante na produção é re-seedada no boot.

---

## 2. Inbox Omnichannel

| Feature | Status | Provider | Notas |
|---|---|---|---|
| WhatsApp Z-API | OK | Z-API | webhook auto-config |
| WhatsApp Baileys | OK | @whiskeysockets/baileys | sessão local |
| WhatsApp Meta Cloud API | OK | Graph API v19.0 | hub.challenge verify |
| Telegram Bot | OK | Telegram Bot API | — |
| Instagram DM | OK | Meta Graph API | — |
| Email (SMTP/IMAP) | OK | Nodemailer | configurável por usuário |
| Real-time (Socket.io) | OK | namespace `/inbox` | mensagens + status |
| Fila de Atendimento + SLA | OK | `unified_contacts.queueStatus` | timer SLA |

**Critério de aceite**: enviar/receber em todos os canais, atualizações em tempo real ≤ 500ms, SLA dispara webhook ao expirar.

---

## 3. CRM & Contatos

| Feature | Status | Notas |
|---|---|---|
| CRUD de leads (legado) | OK | endpoint `/api/leads` |
| Contatos unificados omnichannel | OK | `unified_contacts` + `contact_identifiers` |
| Timeline omnichannel | OK | `omnichannel_messages` agregado |
| Pipeline customizável | OK | `pipeline_stages` por usuário |
| Kanban com drag-and-drop | OK | filtros: temperatura, intenção |
| AI intent summary por contato | OK | gpt-4o-mini |
| Atribuição de agentes (manual + round-robin) | OK | `agent_assignments` |
| Quick replies | OK | atalhos de texto |

---

## 4. Automação (Visual Flow Builder)

| Feature | Status | Notas |
|---|---|---|
| Canvas React Flow | OK | drag-and-drop nodes |
| 10 tipos de bloco | OK | text, audio_tts, image_ai, delay, condition, ai_agent, webhook, queue_entry, resolve, update_lead |
| Geração de fluxo via IA | OK | gpt-4o-mini → JSON validado |
| 5 templates built-in | OK | seed automático |
| Export/Import JSON | OK | versionável |
| Variáveis interpoladas | OK | `{nome}`, `{telefone}`, `{email}` |
| Detecção de ciclo (max 50 steps) | OK | proteção runtime |
| Branching SIM/NÃO em condition | OK | edges rotuladas |
| Integração com Agente IA | OK | flow.agentId → respostas IA |

---

## 5. IA — Agentes & Intent Detection

| Feature | Status | Modelo | Endpoint |
|---|---|---|---|
| Intent Detection auto | OK | gpt-4o-mini | inline em messageProcessor |
| Auto-score de leads | OK | gpt-4o-mini | atualiza `temperature` |
| Movimento auto pelo pipeline | OK | gpt-4o-mini | `unified_contacts.stageId` |
| Fábrica de Agentes (CRUD) | OK | configurável | `/api/admin/agents` |
| Chat preview por agente | OK | gpt-4o-mini | `/api/admin/agents/:id/chat` |
| TTS por agente | OK | tts-1 (OpenAI) | `/api/admin/agents/:id/tts` |
| Avatar generator | OK | dall-e-3 | `/api/admin/agents/generate-avatar` |

---

## 6. Campanhas & Sequências

| Feature | Status | Notas |
|---|---|---|
| Wizard de criação (4 passos) | OK | segmento → conteúdo → agendamento → revisão |
| Segmentação por temperatura/stage/canal | OK | preview-segment |
| Drip sequences | OK | delays configuráveis |
| Geração de copy via IA | OK | gpt-4o-mini |
| Rate limiting + horários permitidos | OK | configurável por campanha |
| Métricas (envio/entrega/resposta/conversão) | OK | dashboard dedicado |
| Templates reutilizáveis | OK | `message_templates` por categoria |
| CampaignWorker (60s) | OK | processa pending deliveries |
| Reply tracking | OK | atualiza métricas auto |

---

## 7. Microlearning (Trilhas)

| Feature | Status |
|---|---|
| CRUD de trilhas com gatilho por stage/intent | OK |
| Entrega automática | OK (`LearningWorker` 5min) |
| Tracking de delivery por contato | OK |
| Multi-channel delivery | OK |

---

## 8. Estúdio de Conteúdo Social/Ads

| Feature | Status | Notas |
|---|---|---|
| Projetos com brand colors (CRUD) | OK | UUID PK, scoped por userId |
| Geração de conteúdo IA (6 formatos) | OK | headlines, caption, hooks, socialAds, email, blogPost |
| TTS via OpenAI (tts-1) | OK | salvo em `/uploads/social-audio/` |
| TTS via ElevenLabs | OK | eleven_multilingual_v2 |
| Vídeo via HeyGen | OK | /v2/video/generate, polling assíncrono |
| Cloning de voz/avatar | OK | credenciais nunca expostas em GET |
| UTM link builder | OK | source/medium/campaign |
| Calendário agrupado por data/canal | OK | publication_schedules |
| Wizard MFORTE (chat) | OK | enriquece ideia + 3 headlines |
| Métricas dashboard | OK | — |

---

## 9. Branding & Settings

| Feature | Status |
|---|---|
| Branding white-label (cor/logo/favicon) | OK |
| Configuração dinâmica de SLA padrão | OK |
| Settings com criptografia AES-256-CBC | OK |
| Cache em memória das settings | OK |
| Audit log de alterações | OK |

---

## 10. Integrações Externas

| Integração | Tipo | Status |
|---|---|---|
| Google Sheets v4 | OAuth2 | OK |
| Outbound Webhooks (HMAC-SHA256) | Push | OK |
| Z-API / Baileys / Evolution / Meta | WhatsApp | OK |
| Telegram Bot API | Bot | OK |
| Meta Graph API | Instagram/WhatsApp | OK |
| OpenAI (Replit AI Integrations) | gpt-4o-mini, tts-1, dall-e-3 | OK |
| ElevenLabs / HeyGen | Voz/Vídeo | OK |

---

## 11. IA Brain — Insights & Ações Executáveis

> Card "IA Brain — Insights" no Dashboard com geração de insights, predição de conversão e **botões 1-clique** para executar ações sugeridas direto no card.

| Feature | Status | Endpoint | Notas |
|---|---|---|---|
| Detecção de leads estagnados | OK | GET /api/brain/insights | >48h sem contato, quentes ou score≥70 |
| Predição de conversão on-demand | OK | GET /api/brain/insights/:contactId/prediction | gpt-4o-mini |
| Worker de varredura periódica | OK | `BrainWorker` (5min) | emite Socket.io ao detectar críticos |
| Notificação real-time | OK | event `brain:new-insight` | toast 10s + invalidate cache |
| Scan manual | OK | POST /api/brain/scan-now | dev/teste |
| **Ação: Mover pipeline** | OK | POST /api/brain/actions/move-pipeline | valida toStage contra `pipeline_stage` enum |
| **Ação: Atribuir agente (round-robin)** | OK | POST /api/brain/actions/assign-agent | usa `autoAssignContact` |
| **Ação: Disparar microlearning** | OK | POST /api/brain/actions/dispatch-microlearning | cria `learningDelivery` step 1 pending |
| **Ação: Enviar mensagem** | OK | Link → /inbox?contact={id} | abre conversa diretamente |

**Critério de aceite**: insight crítico aparece no card, predição on-demand executa em ≤3s, ação 1-clique mostra spinner→✓ "Feito", ownership validada (`contact.userId === req.user.userId`), cache de `/api/brain/insights` e `/api/crm/dashboard` invalidado após mutação.

---

## 12. Lab — Cockpit Técnico

> LAB = engenharia/governança. NÃO é playground de testes de usuário.

| Aba | Conteúdo |
|---|---|
| **Progresso** | Painel editável de 25+ features (priority/status/progress) |
| **Protocolos** | Smoke Tests, Definition of Done, Erros Comuns |
| **Docs Técnicas** | CLAUDE.md, CHANGELOG, Features, Stories, Dicionário, Fluxo Visual, Testing, Deploy |
| **Flow Sim** | Simulador de execução de fluxos |
| **TTS** | Teste de voz |
| **Imagem IA** | Teste de geração de imagem |
| **Webhooks** | Teste de webhooks outbound |
| **WhatsApp** | Teste de provider WhatsApp |

---

## 13. Documentação Técnica

| Documento | Caminho | Endpoint |
|---|---|---|
| CLAUDE.md | `/CLAUDE.md` | GET /api/documentation/claude-md |
| CHANGELOG.md | `/CHANGELOG.md` | GET /api/documentation/changelog |
| FEATURES.md | `/FEATURES.md` | GET /api/documentation/tech/features |
| STORIES.md | `/STORIES.md` | GET /api/documentation/tech/stories |
| DICTIONARY.md | `/DICTIONARY.md` | GET /api/documentation/tech/dictionary |
| VISUAL_FLOW.md | `/VISUAL_FLOW.md` | GET /api/documentation/tech/visual-flow |
| TESTING.md | `/TESTING.md` | GET /api/documentation/tech/testing |
| DEPLOY_GUIDE.md | `/DEPLOY_GUIDE.md` | GET /api/documentation/tech/deploy-guide |

Cada documento é visualizável inline (Markdown render) e baixável em PDF via `GET /api/documentation/tech/:name/pdf`.
