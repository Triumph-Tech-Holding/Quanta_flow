# Quanta Flow — Histórias de Usuário

> Backlog vivo de user stories organizadas por persona e épico.
> Formato: **US-XXX** | _Como [persona], quero [ação], para que [valor]._

## Personas

| Sigla | Persona | Descrição |
|---|---|---|
| **OPR** | Operador / SDR | Atende leads no inbox e move pipeline |
| **GES** | Gestor de Vendas | Configura campanhas, mede resultados |
| **MKT** | Profissional de Marketing | Cria conteúdo, automações, jornadas |
| **ADM** | Admin/TI | Configura integrações, RBAC, branding |
| **DEV** | Engenheiro do produto | Mantém o sistema, debug, deploys |
| **CLI** | Cliente final | Interage via WhatsApp/Telegram/Instagram/Email |

---

## Épico 1 — Inbox Omnichannel

- **US-001** | Como **OPR**, quero ver todas as conversas dos canais conectados em um lugar, para responder rápido sem trocar de tela.
- **US-002** | Como **OPR**, quero receber mensagens em tempo real (notificação visual), para não perder janela de contato.
- **US-003** | Como **OPR**, quero usar quick replies, para responder dúvidas frequentes em 1 clique.
- **US-004** | Como **GES**, quero configurar SLA por fila, para garantir tempo de primeira resposta.
- **US-005** | Como **OPR**, quero pegar o próximo lead da fila (round-robin), para distribuir trabalho de forma justa.
- **US-006** | Como **CLI**, quero enviar áudio/imagem/documento, para comunicar com riqueza de mídia.

## Épico 2 — CRM & Pipeline

- **US-010** | Como **OPR**, quero arrastar contatos entre estágios no Kanban, para mover o pipeline visualmente.
- **US-011** | Como **OPR**, quero ver a timeline omnichannel do contato, para entender histórico antes de responder.
- **US-012** | Como **GES**, quero customizar os estágios do pipeline, para refletir nosso processo de vendas.
- **US-013** | Como **OPR**, quero filtrar contatos por temperatura/intenção, para priorizar leads quentes.
- **US-014** | Como **GES**, quero atribuir contatos automaticamente por round-robin, para evitar que leads fiquem sem dono.

## Épico 3 — Automação

- **US-020** | Como **MKT**, quero criar fluxos visualmente arrastando blocos, para não depender de dev.
- **US-021** | Como **MKT**, quero gerar um fluxo descrevendo em linguagem natural, para acelerar criação.
- **US-022** | Como **MKT**, quero usar templates prontos, para começar com algo pronto.
- **US-023** | Como **MKT**, quero usar variáveis ({nome}, {telefone}), para personalizar mensagens.
- **US-024** | Como **MKT**, quero condicionais com saídas SIM/NÃO, para ramificar a jornada.
- **US-025** | Como **MKT**, quero conectar um Agente IA num fluxo, para a conversa ficar fluida.

## Épico 4 — IA & Agentes

- **US-030** | Como **GES**, quero que mensagens recebidas sejam classificadas por intenção, para entender o que cada lead quer.
- **US-031** | Como **GES**, quero que leads sejam pontuados automaticamente, para focar nos quentes.
- **US-032** | Como **MKT**, quero criar agentes IA com tom/especialidade configurados, para simular um especialista da empresa.
- **US-033** | Como **MKT**, quero testar o agente em chat antes de usar em produção, para validar respostas.
- **US-034** | Como **MKT**, quero gerar áudio do agente (TTS), para enviar voz no WhatsApp.

## Épico 5 — Campanhas

- **US-040** | Como **GES**, quero disparar campanhas por segmento (temperatura, canal), para atingir o público certo.
- **US-041** | Como **GES**, quero criar drip sequences com delays, para nutrir leads automaticamente.
- **US-042** | Como **MKT**, quero gerar copy de campanha via IA, para acelerar produção.
- **US-043** | Como **GES**, quero respeitar horários permitidos, para não enviar fora do horário comercial.
- **US-044** | Como **GES**, quero ver métricas (envio/entrega/resposta/conversão), para medir performance.

## Épico 6 — Microlearning

- **US-050** | Como **MKT**, quero programar entrega de conteúdo educacional por estágio, para nutrir contatos passivamente.
- **US-051** | Como **GES**, quero rastrear quem recebeu cada conteúdo, para evitar repetição.

## Épico 7 — Estúdio de Conteúdo Social/Ads

- **US-060** | Como **MKT**, quero criar projetos por marca com cores, para manter identidade visual consistente.
- **US-061** | Como **MKT**, quero gerar headlines, captions, hooks via IA, para publicar mais rápido.
- **US-062** | Como **MKT**, quero clonar minha voz (ElevenLabs) e gerar áudio, para parecer eu mesmo.
- **US-063** | Como **MKT**, quero gerar vídeos com avatar (HeyGen), para escalar produção visual.
- **US-064** | Como **MKT**, quero agendar publicações no calendário omnichannel, para planejar o mês.
- **US-065** | Como **MKT**, quero gerar links UTM, para medir tráfego das campanhas.

## Épico 8 — Settings, RBAC & Branding

- **US-070** | Como **ADM**, quero criar usuários com role específica, para limitar acesso por área.
- **US-071** | Como **ADM**, quero forçar troca de senha no primeiro acesso, para garantir segurança.
- **US-072** | Como **ADM**, quero configurar branding (cor/logo/favicon), para usar como white-label.
- **US-073** | Como **ADM**, quero ver o audit log de alterações de configuração, para rastrear quem mudou o quê.

## Épico 9 — Integrações

- **US-080** | Como **GES**, quero conectar Google Sheets para registrar leads novos, para integrar com planilhas existentes.
- **US-081** | Como **DEV**, quero configurar webhooks outbound (HMAC), para integrar com Zapier/HubSpot.
- **US-082** | Como **ADM**, quero alternar entre providers WhatsApp (Z-API/Baileys/Meta), para escolher o melhor para o caso.

## Épico 10 — IA Brain (Insights & Ações)

- **US-100** | Como **GES**, quero ver no Dashboard um card com leads em risco (estagnados, quentes esfriando), para agir antes de perder a oportunidade.
- **US-101** | Como **GES**, quero pedir uma predição de conversão de um lead específico, para decidir onde investir esforço.
- **US-102** | Como **OPR**, quero receber notificação em tempo real quando o sistema detectar um insight crítico novo, para não perder janela.
- **US-103** | Como **OPR**, quero mover o lead pelo pipeline em 1 clique direto do insight, sem ter que abrir o contato.
- **US-104** | Como **OPR**, quero atribuir o lead a um agente em 1 clique (round-robin), sem precisar escolher quem.
- **US-105** | Como **MKT**, quero disparar a trilha de microlearning de reengajamento em 1 clique a partir do insight, para reativar leads frios.
- **US-106** | Como **OPR**, quero ir direto para a conversa do contato a partir do insight, para responder rápido.
- **US-107** | Como **GES**, quero que o card mostre o estado da ação (loading/feito), para ter feedback visual claro.

## Épico 11 — Lab / Engenharia

- **US-090** | Como **DEV**, quero ver o painel de status de features, para acompanhar progresso.
- **US-091** | Como **DEV**, quero rodar smoke tests com 1 clique, para validar saúde rápida.
- **US-092** | Como **DEV**, quero acessar toda doc técnica num só lugar, para onboarding novo dev.
- **US-093** | Como **DEV**, quero baixar PDFs da doc, para revisar offline ou compartilhar.
- **US-094** | Como **DEV**, quero ver erros comuns + fix, para debugar mais rápido.

---

## Status do Backlog

| Total | Done | In progress | Backlog |
|---|---|---|---|
| 58+ stories | ~50 | 5 | 3 |

> Atualizado a cada sprint. Use a aba **Progresso** do Lab para acompanhar status detalhado por feature.
