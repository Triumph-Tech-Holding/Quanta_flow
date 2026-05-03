# Quanta Flow — Guia de Uso do Sistema

> Versão do sistema: 2026. Última atualização: maio 2026.

Este guia explica o que o Quanta Flow faz, quem usa cada parte, e como os módulos se encaixam na prática — com histórias reais de uso.

---

## O que é o Quanta Flow?

O **Quanta Flow** é uma plataforma omnichannel de relacionamento e automação. Ele une num só lugar:

- **Comunicação**: recebe e envia mensagens pelo WhatsApp, Telegram e Instagram em tempo real.
- **CRM**: organiza todos os contatos, seu progresso no pipeline e o histórico completo.
- **Automação**: fluxos de mensagens, campanhas em sequência e agentes de IA que respondem por conta própria.
- **Inteligência**: um motor de pontuação que mede o engajamento de cada contato e um sistema de gamificação que ranqueia os mais ativos.
- **Captação**: landing pages com formulários que geram leads diretamente no CRM.
- **Conteúdo**: estúdio de mídia com IA para criar textos, áudios com voz clonada e vídeos com avatar.

---

## Mapa de Módulos

```
┌─────────────────────────────────────────────────────────────┐
│                        QUANTA FLOW                          │
│                                                             │
│  ┌───────────┐    ┌───────────┐    ┌─────────────────────┐ │
│  │  Landing  │───▶│   CRM     │───▶│      Inbox          │ │
│  │   Pages   │    │ Contatos  │    │  (WhatsApp/Telegram/ │ │
│  │  /p/:slug │    │ Pipeline  │    │   Instagram RT)      │ │
│  └───────────┘    └─────┬─────┘    └──────────┬──────────┘ │
│         │               │                      │            │
│         ▼               ▼                      ▼            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               AUTOMAÇÃO                              │   │
│  │  Fluxos │ Campanhas │ Agentes IA │ Landing Pages     │   │
│  └──────────────────────────────────────────────────────┘   │
│         │               │                                   │
│         ▼               ▼                                   │
│  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │ Microlearn  │  │  Score Engine + Gamificação         │  │
│  │   Trilhas   │  │  (pontos, temperatura, badges,      │  │
│  │   Badges    │  │   ranking, 7-11-4, ops/SLA)         │  │
│  └─────────────┘  └─────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Social/Ads │  │   IA Brain   │  │  LAB Cockpit      │  │
│  │  Estúdio AI │  │  (insights)  │  │  (smoke tests)    │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        CONFIGURAÇÕES (empresa, branding, canais,    │    │
│  │        usuários, webhooks, integrações, RBAC)       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Personas Principais

| Persona | Quem é | O que usa |
|---|---|---|
| **Gestor** | Dono do negócio ou gerente | Dashboard, Ranking, Ops Summary, Empresa |
| **Atendente** | Agente de suporte / vendas | Inbox, CRM, Fila de atendimento |
| **Estrategista** | Marketing / automação | Fluxos, Campanhas, Landing Pages, Social/Ads |
| **Admin Técnico** | TI / dev | Canais, Webhooks, LAB, Configurações API |
| **Lead** | Consumidor final | Landing pages, fluxos públicos, recebe mensagens |

---

## Módulo 1 — Auth & Multi-Workspace

### O que é
Sistema de login com JWT, múltiplos workspaces (empresas) e controle de permissões (RBAC) por papel (owner, admin, member).

### Funcionalidades
- Login/registro com e-mail e senha
- Troca obrigatória de senha no primeiro acesso
- Múltiplos workspaces por usuário — troca na sidebar
- Papéis: `owner` (tudo), `admin` (gestão), `member` (operação)
- Auditoria completa de ações por usuário

### História: Primeiro acesso do gestor
> **Cláudio** recebeu as credenciais `admin@quantaflow.com / Admin@123`. Ao fazer login pela primeira vez, o sistema o redireciona para trocar a senha. Depois, ele cria o workspace da empresa — chama de "Loja Central" — e convida a atendente Fernanda com papel `member`. Fernanda vê apenas o Inbox e o CRM; Cláudio vê tudo.

---

## Módulo 2 — CRM (Contatos e Pipeline)

### O que é
Banco de contatos centralizado com pipeline de vendas visual, histórico de interações e atribuição de agentes.

### Funcionalidades
- Ficha completa de contato (nome, telefone, e-mail, notas, tags)
- Pipeline com estágios: `novo → qualificado → proposta → fechado`
- Temperatura automática: **frio** / **morno** / **quente** (calculada pelo motor de score)
- Histórico unificado: mensagens + eventos de score + trilhas de aprendizado
- Atribuição de atendente ao contato
- Identifiers multi-canal (mesmo contato pode ter WhatsApp + Telegram)
- Detecção de intenção por IA numa mensagem recebida
- Atalhos: gatilhar fluxo a partir do perfil do contato

### História: Atendente organiza a fila do dia
> **Fernanda** abre o CRM de manhã e filtra por temperatura "quente". Vê 3 contatos — todos com mais de 80 pontos. Clica no primeiro, lê o histórico de mensagens e o resumo de IA. Move ele de "qualificado" para "proposta" com um clique e aciona um fluxo de proposta diretamente da ficha.

---

## Módulo 3 — Inbox Omnichannel

### O que é
Central de mensagens em tempo real para WhatsApp (Evolution API, Z-API ou Meta Cloud API), Telegram e Instagram. Todos os canais numa única tela.

### Funcionalidades
- Mensagens em tempo real via Socket.io
- Suporte a: texto, imagem, áudio, documento, sticker
- Fila de atendimento (contatos aguardando atribuição)
- Respostas rápidas pré-definidas
- Resolução de conversa (arquiva da fila ativa)
- Múltiplos provedores WhatsApp configuráveis (troca sem downtime)
- Webhooks recebem mensagens de cada canal automaticamente

### História: Atendimento no WhatsApp
> Às 10h, Fernanda recebe uma nova mensagem no Inbox. O contato veio de uma landing page e já está na fila. Ela aceita o atendimento, vê que o contato tem score 45 (morno), seleciona uma resposta rápida pré-configurada "Olá! Como posso ajudar?" e responde. Após a conversa, clica em "Resolver" — o contato sai da fila e fica registrado no CRM.

---

## Módulo 4 — Automação: Fluxos

### O que é
Editor visual de fluxos de mensagens com nós arrastaveis. Cada fluxo é uma sequência de ações automáticas disparadas para um contato.

### Funcionalidades
- Nós disponíveis: `mensagem`, `condição (if/else)`, `espera (delay)`, `resposta IA`, `TTS (voz)`, `geração de imagem`
- Templates prontos (boas-vindas, onboarding, reengajamento, etc.)
- Geração de fluxo completo por IA a partir de descrição em texto
- Importar/exportar fluxos em JSON
- Link público + QR code para o contato entrar no fluxo diretamente (`/f/:token`)
- Botão "Gatilhar fluxo" no perfil do contato

### História: Fluxo de boas-vindas
> **Mariana** (estrategista) cria um fluxo de 5 passos: mensagem de boas-vindas → delay 1h → mensagem com vídeo → condição (abriu link?) → mensagem de follow-up. Ela usa a IA para gerar o texto de cada etapa em segundos. Salva, gera o QR code e cola na bio do Instagram. Todo lead que escanear entra no fluxo automaticamente.

---

## Módulo 5 — Automação: Campanhas

### O que é
Sequências de mensagens agendadas para segmentos de contatos — como e-mail marketing, mas por WhatsApp.

### Funcionalidades
- Criação de campanhas multi-etapa com delay entre cada mensagem
- Segmentação de contatos por estágio, temperatura, tags
- Pré-visualização do segmento antes de disparar
- IA gera copy de mensagem e sequência inteira
- Métricas: entregue, aberto, clicado, convertido
- Pausa e retomada sem perder progresso
- Link público de adesão voluntária (`/c/:token`)

### História: Campanha de reativação
> Cláudio quer reativar leads inativos há 30 dias. No painel de campanhas, filtra contatos com temperatura "frio" e cria uma sequência de 3 mensagens em 7 dias. Usa a IA para sugerir os textos, revisa, e dispara. O worker de campanhas cuida do envio automático — ele só acompanha as métricas no dia seguinte.

---

## Módulo 6 — Automação: Agentes IA

### O que é
Agentes de IA com personalidade configurável que respondem mensagens automaticamente em nome da empresa.

### Funcionalidades
- Criação de agente com nome, persona, instruções, tom de voz
- Simulador de chat para testar o agente antes de ativar
- TTS: voz clonada (ElevenLabs) — o agente fala com a voz da empresa
- Avatar de vídeo (HeyGen) — o agente aparece em vídeo
- Integração com fluxos: um nó de fluxo pode delegar para o agente

### História: Agente de vendas 24h
> Mariana configura o "Agente Max" com o tom de um consultor de vendas. Define que ele responde perguntas sobre preços e disponibilidade, mas encaminha para humano se o cliente pedir. Gera a voz clonada do Max e um vídeo de apresentação com avatar. A partir daí, contatos que chegam fora do horário comercial recebem resposta instantânea do Max.

---

## Módulo 7 — Automação: Landing Pages

### O que é
Construtor de páginas de captura com editor drag-and-drop, formulários integrados ao CRM e métricas de conversão.

### Funcionalidades
- 16 tipos de blocos: header, hero, benefícios, depoimentos, FAQ, vídeo, galeria, countdown, prova social, preços, texto rico, CTA, formulário, calendário embed, embed raw, rodapé
- Editor em 3 colunas: biblioteca de blocos / canvas / inspector
- Preview em desktop, tablet e mobile
- Publicação com versionamento (rollback disponível)
- URL pública: `/p/:slug`
- Submissão de formulário → cria/atualiza contato no CRM + dispara score event (15pt) + ativa fluxo
- Métricas: pageviews, scroll depth, conversão, funil
- Captura automática de UTM params
- 6 templates prontos (geração de leads, webinar, e-book, SaaS, imóveis, consultoria)

### História: Landing page de evento
> Mariana precisa capturar inscrições para um webinar. Em 10 minutos monta uma landing page usando o template "Webinar": adiciona bloco de countdown, lista de benefícios, formulário (nome + WhatsApp) e rodapé. Publica. O link `/p/webinar-maio` é divulgado nas redes. Cada inscrição cria um contato no CRM, pontua 15 pontos e dispara um fluxo de confirmação automaticamente.

---

## Módulo 8 — Score Engine & Gamificação

### O que é
Motor de pontuação automático que mede o engajamento de cada contato em tempo real. Classifica contatos em frio, morno e quente com base nos pontos acumulados.

### Funcionalidades
- 11 tipos de evento com pontuação configurável por workspace:
  | Evento | Pontos padrão |
  |---|---|
  | Formulário preenchido | +15 |
  | Link clicado | +4 |
  | CTA clicado | +3 |
  | Trilha concluída | +10 |
  | Negócio fechado | +50 |
  | Negócio perdido | -20 |
  | Entrega de aprendizado | +2 |
  | Ajuste manual | livre |
- Temperatura: frio (<40), morno (40-79), quente (≥80)
- Janela de cooldown: 14 dias (eventos mais antigos não contam)
- Score clampado entre 0 e 100
- Ajuste manual com motivo registrado
- Timeline unificada do contato (score + mensagens + aprendizado)
- Página `/admin/score-rules` para editar as regras sem código

### Ops Summary
- Cards em `/ranking`: contatos dentro do SLA, pílulas entregues, minutos de conteúdo, score events na janela
- Distribuição de temperatura em tempo real
- Top consumidores com avatar, badges e RPM (pílulas/min)

### 7-11-4 Framework
- Alvo: 7 horas de contato, 11 touchpoints, 4 canais diferentes por lead
- Status calculado por contato e exibido no perfil

### História: Identificando leads quentes
> Cláudio abre `/ranking` numa segunda-feira. Vê que 5 contatos ficaram "quentes" durante o fim de semana — todos vieram de landing pages, clicaram em links e completaram trilhas. Ele passa a lista para Fernanda focar neles no Inbox. Nenhum lead quente foi perdido.

---

## Módulo 9 — Microlearning

### O que é
Sistema de envio automático de conteúdos educativos (pílulas de aprendizado) para os contatos, baseado no estágio e intenção de cada um.

### Funcionalidades
- Criação de trilhas por estágio (novo, qualificado, proposta, etc.) ou intenção detectada
- Tipos de conteúdo: texto, link, vídeo, áudio
- Delay configurável entre cada passo (ex: enviar próxima pílula 24h depois)
- Entrega automática pelo worker a cada 5 minutos
- Registro de conclusão → badge automático (`first_step`, 5, 25, 100 conclusões)
- Cada entrega pontua +2 no score; cada conclusão +10
- Estatísticas por contato: total entregue, concluído, badges

### História: Trilha de onboarding para novos leads
> Mariana cria uma trilha de 7 pílulas para contatos no estágio "novo": dia 1 - vídeo de boas-vindas, dia 2 - texto sobre produto, dia 4 - link para case de sucesso, etc. Quando um novo lead entra pelo formulário, ele recebe as pílulas automaticamente no ritmo configurado. Ao completar a 5ª pílula, ganha o badge `badge_5` e o score sobe.

---

## Módulo 10 — Social/Ads: Estúdio de Conteúdo

### O que é
Estúdio completo para criar, editar e agendar conteúdo para redes sociais — com IA para texto, voz clonada e avatar de vídeo.

### Funcionalidades
- Projetos de conteúdo com múltiplos assets (texto, imagem, vídeo)
- Geração de copy por IA (OpenAI)
- Geração de voz com clonagem (ElevenLabs TTS)
- Geração de vídeo com avatar digital (HeyGen)
- Geração de UTM links automático por asset
- Calendário de agendamento de publicações
- **MFORTE Wizard**: criação de conteúdo via conversa — você descreve a ideia, o sistema monta o pacote completo
- Estatísticas de conteúdo por projeto

### História: Criando conteúdo para a semana
> Mariana abre o Estúdio e inicia o Wizard MFORTE. Descreve: "Quero 3 posts para promover nosso webinar de quarta, tom descontraído, público de pequenos empresários". Em 2 minutos o sistema gera os 3 textos, sugere imagens e cria um áudio narrado com a voz da empresa clonada via ElevenLabs. Ela ajusta um detalhe, gera os links com UTM e agenda os posts para segunda, terça e quarta.

---

## Módulo 11 — Configurações

### O que é
Painel administrativo completo para configurar a empresa, os canais de comunicação, os usuários e as integrações.

### Seções

| Seção | O que configura |
|---|---|
| **Empresa** | Nome, slug, plano, membros e papéis |
| **Branding** | Logo, favicon, cor primária/secundária, timezone, locale, SLA padrão |
| **Usuários** | Criar/editar/remover colaboradores |
| **Canais** | Conectar WhatsApp (Evolution/Z-API/Meta), Telegram, Instagram |
| **Configurações API** | Credenciais dos provedores WhatsApp |
| **Webhooks** | Endpoints de saída para integrar com sistemas externos |
| **Integrações** | Google Sheets (exportar leads automaticamente) |
| **Email** | Configurações SMTP para notificações |
| **Audit Logs** | Histórico de todas as ações no sistema |
| **Documentação** | Versões da documentação interna |

### História: Configurando o WhatsApp
> O Admin Técnico acessa "Canais", escolhe o provedor Z-API, insere o Instance ID e o Token. Escaneia o QR code com o celular. Em 30 segundos o canal está ativo. A partir daí, todas as mensagens recebidas naquele número chegam no Inbox em tempo real.

---

## Módulo 12 — LAB: Cockpit Técnico

### O que é
Painel exclusivo para administradores técnicos acompanhar o status de cada feature do sistema e rodar testes de fumaça.

### Funcionalidades
- Dashboard de features com status (disponível / em desenvolvimento / em breve)
- Smoke tests rodando ao vivo: health check, banco, JWT, workers, webhooks
- Visão rápida de saúde do sistema sem precisar de logs do servidor

### História: Diagnóstico rápido
> Após um deploy, o Admin Técnico abre o LAB. Todos os indicadores verdes — banco conectado, JWT ok, workers rodando, webhooks respondendo. Nenhum problema. Em outros casos, um indicador vermelho avisa onde investigar.

---

## App Mobile — Quanta Flow Mobile

### O que é
Versão mobile nativa (Expo/React Native) do Quanta Flow para atendimento e acompanhamento em movimento.

### Funcionalidades (F40)
- Acesso ao Inbox omnichannel pelo celular
- Visualização do CRM e contatos
- Notificações de novas mensagens
- Servido em `/mobile/`

---

## 3 Fluxos Fim-a-Fim

### Fluxo 1: Do desconhecido ao lead quente

```
1. Visitante acessa a landing page /p/meu-produto
   → O sistema registra o page_view automaticamente

2. Visitante preenche o formulário (nome + WhatsApp)
   → Contato criado no CRM com temperatura "frio"
   → Score recebe +15 pontos (form_submitted)

3. Fluxo de boas-vindas dispara automaticamente
   → Mensagem 1 enviada no WhatsApp (score +4 ao clicar no link)

4. learningWorker envia pílula 1 da trilha "novo"
   → Score +2 (entrega); se concluir: +10 (conclusão)

5. Após 3 pílulas concluídas + 2 links clicados
   → Score ≈ 45 → temperatura muda para "morno" automaticamente

6. Gestor vê no Ranking que o contato passou para morno
   → Atendente assume o Inbox e inicia conversa personalizada

7. Contato fecha negócio → score +50 → temperatura = "quente"
```

---

### Fluxo 2: Campanha de reengajamento com Social/Ads

```
1. Gestor identifica 20 contatos com temperatura "frio" há 60 dias

2. No Estúdio Social, usa o Wizard MFORTE para criar 3 posts de reengajamento
   → IA gera copy + ElevenLabs gera áudio → agendado para 3 dias

3. Paralelamente, cria campanha de WhatsApp para os 20 contatos
   → IA sugere sequência de 3 mensagens em 7 dias

4. Campanha dispara:
   - Dia 1: mensagem de oferta personalizada
   - Dia 3: vídeo com avatar HeyGen explicando o produto
   - Dia 7: CTA direto para landing page

5. Contatos que clicam na landing page ganham +3 (CTA) + +15 (form)
   → Alguns saem do "frio" e voltam para "morno"

6. Gestor acompanha métricas da campanha em tempo real (abertos/clicados/convertidos)
```

---

### Fluxo 3: Atendimento com Agente IA + humano

```
1. Lead envia mensagem no WhatsApp às 23h (fora do horário)

2. Agente IA "Max" recebe a mensagem automaticamente
   → Detecta intenção: dúvida sobre preço
   → Responde com tabela de preços em tom consultivo

3. Lead pede desconto especial
   → Agente detecta que não pode autorizar
   → Escala para humano: "Deixa eu conectar você com nosso consultor!"

4. No dia seguinte, Fernanda abre o Inbox
   → Vê a conversa completa, o resumo do agente e o score do contato (62 — morno)
   → Retoma de onde o agente parou e fecha a proposta

5. Ao fechar: admin registra "deal_won" → score +50 → quente
   → Contato aparece no ranking semanal dos mais engajados
```

---

## Tabela Completa de Funcionalidades

| Funcionalidade | Módulo | Rota/Página | Status |
|---|---|---|---|
| Login + JWT | Auth | `POST /api/auth/login` | Disponível |
| Multi-workspace | Auth | `GET /api/workspaces` | Disponível |
| RBAC (roles/permissions) | Auth | `GET /api/admin/roles` | Disponível |
| Auditoria de ações | Auth | `/admin/audit-logs` | Disponível |
| Lista de contatos com filtros | CRM | `/crm` | Disponível |
| Perfil completo do contato | CRM | `/crm/contact/:id` | Disponível |
| Pipeline Kanban | CRM | `/crm` | Disponível |
| Temperatura automática | CRM + Score | automático | Disponível |
| Atribuição de agente | CRM | `PATCH /api/crm/contacts/:id/assign` | Disponível |
| Detecção de intenção IA | CRM | `POST /api/ai/detect-intent` | Disponível |
| Inbox em tempo real | Inbox | `/inbox` | Disponível |
| WhatsApp (Evolution API) | Inbox | `/settings/channels` | Disponível |
| WhatsApp (Z-API) | Inbox | `/settings/channels` | Disponível |
| WhatsApp (Meta Cloud API) | Inbox | `/settings/channels` | Disponível |
| Telegram | Inbox | `/settings/channels` | Disponível |
| Instagram/Meta | Inbox | `/settings/channels` | Disponível |
| Troca de provedor sem downtime | Inbox | `POST /api/whatsapp-provider/switch` | Disponível |
| Fila de atendimento | Inbox | `GET /api/queue` | Disponível |
| Respostas rápidas | Inbox | `GET /api/quick-replies` | Disponível |
| Flow Builder visual | Automação | `/admin/flows` | Disponível |
| Geração de fluxo por IA | Automação | `POST /api/admin/flows/generate` | Disponível |
| TTS nos fluxos | Automação | `POST /api/flows/tts` | Disponível |
| Link/QR code de fluxo | Automação | `/f/:token` | Disponível |
| Campanhas multi-step | Automação | `/admin/campaigns` | Disponível |
| IA para copy de campanha | Automação | `POST /api/admin/campaigns/generate-copy` | Disponível |
| Métricas de campanha | Automação | `GET /api/admin/campaigns/:id/metrics` | Disponível |
| Agentes IA com persona | Automação | `/admin/agents` | Disponível |
| Voz clonada (ElevenLabs) | Automação | `POST /api/admin/agents/:id/tts` | Disponível |
| Avatar vídeo (HeyGen) | Automação | `POST /api/admin/agents/generate-avatar` | Disponível |
| Landing Page editor | Automação | `/admin/landing-pages/:id` | Disponível |
| 16 tipos de bloco | Automação | editor | Disponível |
| Publicação com versionamento | Automação | `POST /api/landing-pages/:id/publish` | Disponível |
| Métricas de landing page | Automação | `/admin/landing-pages/:id/metrics` | Disponível |
| Formulário → CRM automático | Automação | `POST /api/public/landing/:slug/submit` | Disponível |
| Motor de score (11 eventos) | Score | `GET /api/score-rules` | Disponível |
| Ajuste manual de score | Score | `POST /api/contacts/:id/score/manual` | Disponível |
| Timeline unificada | Score | `GET /api/contacts/:id/timeline` | Disponível |
| 7-11-4 framework | Score | `GET /api/contacts/:id/seven-eleven-four` | Disponível |
| Ranking de leads | Score | `/ranking` | Disponível |
| Ops Summary (SLA + temperatura) | Score | `GET /api/ops/summary` | Disponível |
| Trilhas de microlearning | Microlearning | `/learning-tracks` | Disponível |
| Entrega automática (worker) | Microlearning | learningWorker | Disponível |
| Badges por progressão | Microlearning | automático | Disponível |
| Estúdio Social/Ads | Social | `/social` | Disponível |
| MFORTE Wizard | Social | `POST /api/admin/social/wizard/start` | Disponível |
| Geração de conteúdo por IA | Social | `POST /api/admin/social/generate` | Disponível |
| ElevenLabs TTS para assets | Social | `POST /api/admin/social/assets/:id/elevenlabs-tts` | Disponível |
| HeyGen vídeo para assets | Social | `POST /api/admin/social/assets/:id/heygen-video` | Disponível |
| UTM automático | Social | `POST /api/admin/social/assets/:id/generate-utm` | Disponível |
| Branding por workspace | Config | `/settings/company` | Disponível |
| Webhooks de saída | Config | `/settings/webhooks` | Disponível |
| Google Sheets | Config | `/settings/integrations` | Disponível |
| LAB cockpit técnico | LAB | `/admin/lab` | Disponível |
| App Mobile (Expo) | Mobile | `/mobile/` | Disponível |
| IA Brain insights | Brain | `GET /api/brain/insights` | Parcial |
| SSO Google + Microsoft | Auth | — | Pendente |
| Notificações Push + In-App | — | — | Pendente |
| Relatórios CSV/Excel | — | — | Pendente |
| Tribos | — | — | Em breve |

---

## Primeiros Passos

### 1. Acessar o sistema
- URL: endereço da plataforma (preview pane no Replit durante desenvolvimento)
- Credenciais padrão: `admin@quantaflow.com` / `Admin@123`
- Trocar senha no primeiro acesso (obrigatório)

### 2. Configurar a empresa
- Ir em **Empresa** no menu Configurações
- Preencher nome da empresa, timezone e SLA padrão
- Em **Branding**: subir logo, favicon e definir as cores

### 3. Conectar o WhatsApp
- Ir em **Canais** → escolher o provedor (Z-API recomendado para começo)
- Inserir credenciais do provedor
- Escanear o QR code com o celular da empresa
- Testar enviando uma mensagem de teste

### 4. Criar a primeira landing page
- Ir em **Automação → Landing Pages → Nova página**
- Escolher um template
- Editar os blocos, adicionar o formulário
- Publicar e copiar o link `/p/seu-slug`

### 5. Criar o primeiro fluxo de boas-vindas
- Ir em **Automação → Fluxos → Novo fluxo**
- Usar um template ou gerar por IA
- Ativar o fluxo na landing page (campo "Fluxo ativo")

### 6. Convidar a equipe
- Ir em **Empresa → Membros → Convidar**
- Definir o papel de cada pessoa (admin ou member)

---

## Suporte e Referência Técnica

- **Documentação técnica/arquitetural**: `replit.md` na raiz do projeto
- **API Reference**: `/api/api-spec` (OpenAPI)
- **Status do sistema**: `/admin/lab`
- **Versões da documentação interna**: `/admin/documentation`
