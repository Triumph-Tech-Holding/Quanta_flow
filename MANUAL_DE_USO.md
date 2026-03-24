# 📚 Manual de Uso — Quanta Flow

**"Venda no automático."**

Bem-vindo ao Quanta Flow! Esta plataforma transforma a forma como você gerencia leads, conversa com clientes e fecha vendas — tudo de forma automática, inteligente e omnichannel. Este guia cobre todos os módulos com exemplos práticos do mundo real.

---

## 🏠 1. Dashboard — Visão Geral do Negócio

**O que é:** Painel de controle central com indicadores em tempo real de todo o seu pipeline de vendas.

### Como usar:
1. Acesse o menu lateral → clique em **Dashboard**
2. Visualize os indicadores principais: total de contatos, distribuição de temperatura, estágios do pipeline, score médio e leads em destaque
3. Os leads "quentes" aparecem destacados no topo para ação imediata

### 📊 Indicadores disponíveis:
- **Total de Contatos**: Base total de leads cadastrados
- **Temperatura**: Distribuição entre Frio 🔵, Morno 🟡 e Quente 🔴
- **Pipeline**: Contagem por estágio (Novo → Qualificado → Proposta → Fechado)
- **Score Médio**: Nota de interesse calculada pela IA automaticamente
- **Leads em Destaque**: Os que têm maior score e engajamento recente

### 🎯 Cenário Real — Consultório Odontológico:
```
Dashboard mostra:
• 120 contatos totais
• 18 "quentes" (perguntaram sobre implante, pediram orçamento)
• 45 "mornos" (consultaram preço, mas sumiram)
• 57 "frios" (chegaram via anúncio, sem resposta ainda)

Ação: Focar hoje nos 18 quentes.
Automação trata os 45 mornos com reengajamento automático.
```

---

## 💬 2. Inbox — Central de Mensagens Omnichannel

**O que é:** Todas as mensagens de todos os canais (WhatsApp, Instagram, Telegram, Email) chegam em um único lugar. Nunca mais perca um cliente entre apps.

### Como usar:
1. Acesse **Inbox** no menu lateral
2. Veja a lista de conversas à esquerda (com data, horário e última mensagem)
3. Clique em uma conversa para abrir o chat completo
4. Responda diretamente pelo campo de texto na parte inferior

### 🔧 Recursos do Inbox:
- **Busca de conversas**: Filtre por nome ou número
- **Canal identificado**: Ícone de WhatsApp, Instagram, Telegram ou Email ao lado de cada contato
- **Timestamp completo**: Data + hora de cada mensagem (ex: 13/03 14:42)
- **Atribuição de agente**: Assign manualmente a conversa para um colaborador
- **Timer SLA**: Contador de quanto tempo o cliente está esperando — fica vermelho quando passa do prazo configurado
- **Respostas rápidas**: Atalhos de texto para respostas frequentes (ex: "/preco" expande automaticamente)
- **Fila de Atendimento**: Coloque conversas em fila VIP com SLA e agente designado

### 🎯 Cenário Real — E-commerce de Moda:
```
Terça 09:14 — Ana Lima (WhatsApp):
  "Oi! O vestido azul tem no tamanho P?"

Terça 09:14 — Sistema:
  IA detecta "interesse em produto" → score sobe para 12
  Inbox recebe a mensagem

Terça 09:15 — Atendente Carla (responde pelo Inbox):
  "Oi Ana! Temos sim, no P e M. Quer que eu separe para você?"

Terça 09:16 — Ana Lima:
  "Pode separar sim!"

→ Lead automaticamente marcado como "Quente"
→ Carla conclui venda pelo Inbox sem sair da plataforma
```

### ⚡ Conexão WhatsApp (Configurações → WhatsApp):
- **Z-API** (recomendado para produção): Insira URL e token da sua conta Z-API
- **Baileys** (gratuito, para testes): Clique em "Conectar" e escaneie o QR code com o celular

---

## 👥 3. CRM — Gestão de Leads e Contatos

**O que é:** Banco de dados inteligente de todos os seus leads com pipeline Kanban, scoring por IA e histórico completo de interações.

### Como usar:
1. Acesse **CRM** no menu lateral
2. Visualize o **Kanban** (colunas por estágio) ou a **Lista** de contatos
3. Clique em um lead para abrir o perfil completo
4. Arraste os cards entre colunas para avançar no pipeline

### 📋 Perfil de um Lead:
- **Nome, telefone, email**: Dados básicos
- **Temperatura**: Frio / Morno / Quente
- **Estágio no Pipeline**: Novo → Qualificado → Proposta → Negociação → Fechado Ganho / Perdido
- **Score**: 0 a 20 (calculado pela IA com base nas interações)
- **Tags**: Etiquetas personalizadas (#iPhone #Urgente #VIP)
- **Intenção detectada pela IA**: compra_quente, duvida, reclamacao, indefinido
- **Resumo da IA**: Síntese do que o lead precisa
- **Histórico**: Todas as mensagens trocadas

### 🔄 Criação Automática de Leads:
Toda vez que alguém envia uma mensagem para o seu WhatsApp/Instagram/Telegram pela primeira vez, o sistema **cria automaticamente um card no CRM** com temperatura "Frio" e estágio "Novo". Sem precisar de nenhuma ação manual.

### 🎯 Cenário Real — Imobiliária:
```
Cliente busca apartamento online
↓
Clica no anúncio e manda mensagem no WhatsApp:
"Quero informações sobre o apto na Rua das Flores"
↓
Quanta Flow:
1. Cria lead "José Pereira" automaticamente no CRM (Estágio: Novo, Temp: Frio)
2. IA detecta intenção: "interesse_imovel"
3. Score inicial: 8/20
4. Automação envia resposta com fotos e link de visita virtual
↓
5 dias depois, José pergunta sobre financiamento:
→ IA recalcula: Score 16/20, Temperatura: Quente
→ CRM mostra lead destacado para o corretor
→ Corretor entra em contato pessoalmente para fechar
```

### 🔍 Filtros do CRM:
- Por temperatura (frio/morno/quente)
- Por estágio do pipeline
- Por intenção da IA
- Por agente responsável
- Por tag

---

## ⚙️ 4. Automação — Fluxos de Vendas Automáticos

**O que é:** Motor de automação que executa sequências de ações automaticamente com base em eventos e condições. Seu vendedor 24/7 que nunca falta, nunca atrasa e nunca esquece.

### 4.1 — Builder Visual de Fluxos

Construa fluxos arrastando e conectando blocos em um canvas visual (estilo fluxograma).

**Como criar um fluxo:**
1. Acesse **Automação** → clique em **Novo Fluxo**
2. Dê um nome, defina palavras-chave que acionam o fluxo
3. Clique em **Abrir Builder** para editar visualmente
4. Arraste blocos da barra lateral para o canvas
5. Conecte os blocos puxando as setas
6. Configure cada bloco clicando nele
7. Salve e ative o fluxo

### 🧱 Tipos de Blocos:

| Bloco | Função | Configuração |
|-------|--------|-------------|
| **Texto** | Envia mensagem de texto | Mensagem com variáveis {nome}, {telefone} |
| **Áudio TTS** | Envia mensagem de voz gerada por IA | Texto a ser narrado + voz selecionada |
| **Imagem IA** | Gera e envia imagem com IA | Prompt descritivo da imagem |
| **Delay** | Espera antes de continuar | Tempo em segundos, minutos ou horas |
| **Condição** | Ramifica por SIM ou NÃO | Tipo: keyword, intenção, temperatura, score |
| **Agente IA** | Coloca um especialista de IA para responder | Seleciona o agente configurado |
| **Webhook** | Chama uma URL externa | URL + método HTTP |
| **Fila** | Coloca lead na fila de atendimento humano | SLA em minutos |
| **Resolver** | Finaliza o fluxo com sucesso | - |
| **Atualizar Lead** | Muda estágio, temperatura, tag ou score | Campos a atualizar |

### 🎯 Cenário Real — Clínica de Estética:

```
PALAVRAS-CHAVE: "botox", "preenchimento", "harmonização"

FLUXO "Interesse em Harmonização":

[TEXTO] "Oi {nome}! 😊 Vi que você se interessou por harmonização facial.
Temos horários disponíveis essa semana. Posso te ajudar?"

[DELAY] 30 segundos

[AGENTE IA "Dr. Estética"]
  → Especialista responde dúvidas sobre procedimentos
  → Usa systemPrompt com informações da clínica

[CONDIÇÃO: intenção = "compra_quente"]
  SIM → [ATUALIZAR LEAD: temperatura=quente, estágio=qualificado]
         [FILA: SLA 30min] — Recepcionista entra em contato
  NÃO → [TEXTO] "Posso te enviar mais informações por email?"
         [DELAY: 2 dias]
         [TEXTO] "Lembrete: sua dúvida sobre harmonização ainda está aqui!"
```

### 4.2 — Simulador de Conversa Interativo (Lab → Flow Sim)

Antes de ativar para clientes reais, **teste o fluxo você mesmo** através de uma conversa real:

1. Acesse **Lab** → aba **Flow Sim**
2. Selecione o fluxo que quer testar
3. Preencha nome e telefone fictícios
4. Clique em **Iniciar Conversa**
5. O bot vai responder como faria com um lead real
6. Você digita como se fosse o cliente e vê exatamente como o fluxo reage
7. Blocos **Agente IA** chamam a IA de verdade com o prompt configurado
8. Blocos **Condição** seguem o branch baseado no que você digitou
9. Clique em **Reiniciar** para testar outro cenário

### 📦 Templates Prontos:

O sistema já vem com 5 templates de fluxo:
- **Boas-vindas Básico**: Mensagem de boas-vindas + apresentação
- **Captação de Lead**: Coleta nome, telefone e email
- **Suporte Automatizado**: FAQ com IA respondendo dúvidas
- **Reengajamento**: Para leads que sumiram
- **Pós-Venda**: Acompanhamento após fechamento

---

## 🤖 5. Fábrica de Agentes IA

**O que é:** Crie especialistas virtuais com IA para responder automaticamente por você em qualquer canal. Cada agente tem sua personalidade, especialidade e contexto.

### Como criar um Agente:
1. Acesse **Agentes IA** no menu lateral → **Novo Agente**
2. Preencha:
   - **Nome**: Ex: "Consultora de Beleza", "Atendente Técnico", "Vendedor VIP"
   - **Especialidade**: O que ele sabe (produtos, área, setor)
   - **Tom**: Formal, casual, empático, direto
   - **System Prompt**: Instruções detalhadas do comportamento
   - **Modelo**: GPT-4o-mini (padrão) ou outro
   - **Temperatura criativa**: 0 = mais previsível, 1 = mais criativo
   - **Máx. tokens**: Limite do tamanho das respostas
   - **Voz TTS**: Para respostas em áudio
3. Clique em **Salvar**
4. Teste na aba **Chat de Preview** — converse diretamente com o agente antes de usar

### 📝 Exemplo de System Prompt (Restaurante):
```
Você é Maria, atendente virtual do Restaurante Bella Cucina.
Você é simpática, usa emojis e fala de forma descontraída.
Você conhece todo o cardápio: Pizza Margherita R$45, Lasanha R$52, etc.
Horário: Terça a Domingo, 11h às 23h.
Aceita: cartão, Pix e dinheiro.
Quando o cliente quiser fazer pedido, peça: nome, endereço, pedido e forma de pagamento.
Não ofereça descontos não autorizados.
Se não souber algo, diga: "Deixa eu verificar com a equipe, te retorno em breve!"
```

### 🎯 Cenário Real — E-commerce de Suplementos:
```
CLIENTE (23h45): "Oi! Quero comprar whey protein. Qual é o melhor?"

AGENTE IA "NutriBot":
"Olá! 💪 Boa noite! Temos 3 opções incríveis:

1. Whey Gold Standard - R$189 (2kg) — o mais vendido!
2. ISO Whey Zero - R$215 (1,8kg) — para quem é intolerante à lactose
3. 100% Whey - R$149 (2kg) — melhor custo-benefício

Qual é o seu objetivo? Ganho de massa ou definição?
Assim indico o melhor para você! 🏋️"

→ Conversa às 23h45 sem nenhum humano envolvido
→ Lead qualificado e pronto para fechar quando abrir amanhã
```

### 🎤 Text-to-Speech (TTS):
Cada agente pode ter uma **voz** configurada. Quando integrado ao WhatsApp, pode enviar mensagens de áudio geradas automaticamente. Teste a voz no **Lab → TTS**.

---

## 📢 6. Campanhas Omnichannel

**O que é:** Envie mensagens em massa para segmentos específicos da sua base, com rastreamento completo de resultados. Ideal para promoções, lançamentos e reengajamento.

### Como criar uma Campanha:
1. Acesse **Campanhas** → **Nova Campanha**
2. Siga o assistente de 4 etapas:
   - **Etapa 1**: Nome, canal (WhatsApp/Instagram), tipo (Broadcast ou Sequência Drip)
   - **Etapa 2**: Segmentação — quem vai receber (temperatura, estágio, canal)
   - **Etapa 3**: Mensagem — escreva ou use **Geração por IA** para criar o texto
   - **Etapa 4**: Agendamento — envie agora ou programe para uma data/hora
3. Clique em **Iniciar Campanha**

### 📊 Tipos de Campanha:

**Broadcast (Disparo Único):**
Uma mensagem para todos do segmento ao mesmo tempo.
```
Segmento: Leads mornos que viram smartphones
Mensagem: "🔥 SUPER SALE! Só hoje: todos os iPhones com 20% OFF!
Clique aqui → bit.ly/sale"
```

**Sequência Drip (Gotejamento):**
Série de mensagens ao longo do tempo.
```
Dia 1: "Oi {nome}! Sabia que temos novidades incríveis?"
Dia 3: "Viu nossa nova coleção? Fica o link: ..."
Dia 5: "Última chance! Promoção termina amanhã!"
Dia 7: "Perdi você? Posso ajudar com algo?"
```

### 🎯 Segmentação Disponível:
- Por temperatura (frio / morno / quente)
- Por estágio no pipeline
- Por canal de entrada (WhatsApp / Instagram / Email)
- Prévia do segmento antes de enviar

### 📈 Métricas em Tempo Real:
```
Campanha: "Black Friday 2026"
Enviadas:  10.000 ✉️
Entregues:  9.750 ✅ (97,5%)
Lidas:      7.200 👁️ (73,8%)
Responderam:1.800 💬 (25%)
Converteram: 340  💰 (4,7%)
```

### 🎯 Cenário Real — Academia de Ginástica:
```
Situação: Janeiro (mês de resolução de ano novo)

Campanha: "Comece 2026 em Forma!"
Segmento: Leads frios que consultaram preços em dezembro
Canal: WhatsApp

Mensagem (gerada por IA):
"Oi {nome}! 🏋️ Feliz 2026!
Que tal começar o ano cuidando da saúde?
Nossa academia tem tudo para você:
✅ Musculação, Spinning, Yoga e mais
✅ Instrutores certificados
✅ Promoção de Janeiro: 1ª mensalidade GRÁTIS!
Quer conhecer? Responda "SIM" e te mando mais infos 😊"

Resultado: 2.400 enviadas → 312 responderam → 89 matricularam!
```

### 📝 Biblioteca de Templates:
Salve mensagens reutilizáveis em **Campanhas → Templates**. Categorize por tipo (promoção, boas-vindas, pós-venda, etc.) para usar rapidamente nas campanhas.

---

## ⏱️ 7. Fila de Atendimento

**O que é:** Sistema para gerenciar quando um atendimento humano é necessário, com SLA definido e atribuição de agente.

### Como funciona:
1. Um fluxo ou agente IA decide que o cliente precisa de atendimento humano
2. O bloco **Fila** é acionado — o lead entra na fila com status "Aguardando"
3. Um atendente recebe a notificação no **Inbox**
4. O atendente assume a conversa e o status muda para "Em atendimento"
5. Ao resolver, clica em "Resolver" — status vira "Resolvido"

### ⏰ SLA (Tempo de Resposta):
Configure o SLA padrão em **Configurações → Branding → SLA Padrão (minutos)**.
- O timer começa quando o lead entra na fila
- Se o SLA for ultrapassado, o timer fica **vermelho** no Inbox
- Relatórios mostram quantas vezes o SLA foi quebrado

### 🎯 Cenário Real — Banco Digital:
```
Cliente: "Preciso cancelar meu cartão de crédito urgente"
↓
IA detecta: intenção = "urgente_cancelamento"
↓
Bloco Fila acionado (SLA: 5 minutos)
↓
Notificação para equipe de atendimento
↓
Em 3 minutos, atendente Eduardo assume
↓
"Oi! Sou o Eduardo, vou te ajudar agora mesmo. 
Me passa o número do cartão (últimos 4 dígitos)?"
↓
Problema resolvido, conversa marcada como "Resolvida"
```

---

## 🎓 8. Microlearning — Conteúdo Automático

**O que é:** Entregue conteúdo educativo automaticamente para seus leads baseado no estágio que estão no pipeline. Ideal para nutrição de leads.

### Como criar uma Trilha:
1. Acesse **Microlearning** no menu lateral → **Nova Trilha**
2. Configure:
   - **Nome**: Ex: "Trilha Iniciante", "Curso de Finanças"
   - **Gatilho**: Quando o lead muda para qual estágio (ex: "qualificado")
   - **Conteúdo**: Módulos sequenciais com textos, links, vídeos
   - **Intervalo**: A cada quantos dias enviar o próximo módulo

### 🎯 Cenário Real — Escola de Programação:
```
Lead se torna "Qualificado" (pediu informações sobre o curso)
↓
Trilha "Preview do Curso" é ativada automaticamente:

Dia 1: "Bem-vindo(a)! 👋 Separei uma mini-aula gratuita para você..."
Dia 3: "Hoje: variáveis e tipos de dados em Python! (5 minutos)"
Dia 5: "Você já está no caminho! Veja a aula 3: funções..."
Dia 7: "Você curtiu? Temos vagas abertas para a próxima turma!"

→ Lead educado, aquecido e pronto para a decisão de compra
```

---

## 🔗 9. Webhooks Outbound

**O que é:** Notifique sistemas externos automaticamente quando eventos acontecem no Quanta Flow. Integre com Zapier, HubSpot, seu próprio CRM ou qualquer sistema via HTTP.

### Eventos disponíveis:
- **lead.created**: Quando um novo lead é criado
- **lead.qualified**: Quando um lead muda para "Qualificado"
- **flow.success**: Quando um fluxo é concluído com sucesso
- **flow.interrupt**: Quando um fluxo é interrompido
- **conversation.closed**: Quando uma conversa é resolvida

### Como configurar:
1. Acesse **Configurações → Webhooks**
2. Clique em **Novo Webhook**
3. Preencha URL, evento e headers opcionais
4. Ative e teste pelo **Lab → Webhooks**

### 🔒 Segurança HMAC:
Cada requisição inclui o header `X-Quanta-Signature` com assinatura HMAC-SHA256. Valide no seu sistema para garantir que veio do Quanta Flow.

### 🎯 Cenário Real — Integração com CRM Externo:
```
Evento: lead.qualified
URL: https://seu-crm.com/api/leads/import

Payload enviado:
{
  "event": "lead.qualified",
  "lead": {
    "nome": "Maria Silva",
    "telefone": "11999999999",
    "email": "maria@email.com",
    "score": 15,
    "temperature": "quente"
  }
}

→ Seu CRM recebe e cria o lead automaticamente
→ Sem precisar de nenhuma ação manual
```

---

## 📊 10. Google Sheets — Sincronização Automática

**O que é:** Exporte dados de leads automaticamente para planilhas Google em tempo real.

### Como configurar:
1. Acesse **Configurações → Google Sheets**
2. Faça login com sua conta Google (OAuth)
3. Selecione a planilha e a aba
4. Mapeie as colunas (ex: Coluna A = Nome, Coluna B = Telefone)
5. Escolha o evento que dispara (lead criado, qualificado, etc.)
6. Ative a integração

### 🎯 Cenário Real — Vendas com Planilha Compartilhada:
```
Situação: Equipe de vendas usa Google Sheets para acompanhamento

Configuração: A cada lead "qualificado" → adicionar linha na planilha

Resultado automático na planilha:
Nome      | Telefone       | Score | Temperatura | Data
Maria     | 11 9999-7777   | 15    | Quente      | 13/03/2026
José      | 21 8888-5555   | 12    | Morno       | 13/03/2026

→ Toda a equipe vê os leads qualificados em tempo real
→ Sem precisar entrar no Quanta Flow
```

---

## 🧪 11. Lab — Ambiente de Testes

**O que é:** Laboratório para testar todas as funcionalidades antes de colocar em produção. Nunca mais experimente direto com clientes reais.

### Abas disponíveis:

### Aba 1 — Flow Sim (Simulador de Conversa)
Teste fluxos de automação interativamente:
- Selecione um fluxo ativo
- Preencha nome e telefone fictícios
- Clique em "Iniciar Conversa"
- Dialogue como um cliente real
- Blocos de Agente IA chamam a IA de verdade
- Veja cada etapa sendo executada em tempo real

### Aba 2 — TTS (Texto para Voz)
Teste como seus agentes vão soar em áudio:
- Digite o texto
- Selecione a voz (Alloy, Echo, Fable)
- Clique em "Gerar Áudio"
- Ouça o resultado antes de usar com clientes

### Aba 3 — Imagem IA
Teste geração de imagens para campanhas:
- Digite o prompt descritivo
- Clique em "Gerar Imagem"
- Veja o resultado e ajuste o prompt se necessário

### Aba 4 — Webhooks
Teste seus webhooks outbound:
- Lista todos os webhooks configurados
- Clique em "Testar" para enviar um payload de teste
- Veja o status da resposta e o corpo retornado

### Aba 5 — WhatsApp
Teste o envio de mensagens pelo WhatsApp:
- Digite o número (com DDI: 5511999999999)
- Digite a mensagem de teste
- Clique em "Enviar Teste"
- Confirma que a integração está funcionando

---

## ⚙️ 12. Configurações

### 12.1 — WhatsApp

**Z-API (Recomendado para produção):**
1. Crie uma conta em z-api.io
2. Em Configurações → WhatsApp, selecione "Z-API"
3. Insira a URL da instância e o Token de segurança
4. Clique em "Salvar" e depois em "Testar Conexão"

**Baileys (Gratuito, para desenvolvimento):**
1. Em Configurações → WhatsApp, selecione "Baileys"
2. Clique em "Conectar"
3. Escaneie o QR code com o celular que vai receber as mensagens
4. Aguarde a confirmação "Conectado!"
5. ⚠️ A conexão Baileys é reiniciada com o servidor. Para manter estável, use Z-API em produção.

### 12.2 — Email (SMTP)
Configure para enviar emails automáticos:
1. Acesse Configurações → Email
2. Preencha: Servidor SMTP, porta, usuário e senha
3. Clique em "Testar Conexão" para validar

### 12.3 — Telegram
1. Crie um bot em @BotFather no Telegram
2. Copie o token gerado
3. Em Configurações → Telegram, insira o token
4. Clique em "Salvar" e depois em "Registrar Webhook"

### 12.4 — Instagram
1. Configure um app no Meta Business
2. Em Configurações → Instagram, insira o Token de Acesso
3. Configure o webhook no painel Meta apontando para sua URL

### 12.5 — OpenAI
1. Acesse platform.openai.com e crie uma API Key
2. Em Configurações → OpenAI, insira a chave
3. Todos os recursos de IA (agentes, intenção, campanhas) passam a usar

---

## 🎨 13. Branding — White-Label

**O que é:** Customize a aparência do sistema para parecer 100% sua plataforma, com sua marca e suas cores.

### Como personalizar:
1. Acesse **Configurações → Branding**
2. Preencha:
   - **Nome da Empresa**: Aparece no header e login
   - **Cor Primária**: Cor principal dos botões e destaques (ex: #00A86B)
   - **Cor Secundária**: Cor secundária de contraste (ex: #1B3A57)
   - **Logo**: URL da imagem do logo (192x192 recomendado)
   - **Favicon**: Ícone da aba do navegador
   - **SLA Padrão**: Tempo (em minutos) para alertar sobre resposta atrasada
3. Clique em "Salvar" — as mudanças aparecem em tempo real

### 🎯 Cenário: Agência de Marketing Revendendo o Quanta Flow
```
Antes: Sistema aparece como "Quanta Flow"
Depois da configuração:
  Nome: "AgênciaX — CRM Inteligente"
  Logo: logo da AgênciaX
  Cor primária: #FF6B35 (laranja da agência)
  
→ Cliente da agência vê o sistema 100% como marca própria
```

---

## 👤 14. Usuários e Permissões (RBAC)

**O que é:** Controle granular de quem pode acessar o quê na plataforma. Ideal para equipes com diferentes funções.

### Níveis de Acesso:

| Função | O que pode fazer |
|--------|-----------------|
| **Super Admin** | Tudo — configurações, usuários, branding, permissões |
| **Admin** | Gerencia campanhas, fluxos, agentes, relatórios |
| **Usuário** | Acessa Inbox, CRM, responde mensagens |

### Como adicionar um colaborador:
1. Acesse **Configurações → Usuários**
2. Clique em **Convidar Usuário**
3. Preencha nome, email e senha temporária
4. Selecione o papel (Super Admin / Admin / Usuário)
5. Clique em **Criar**

### 📋 Permissões disponíveis (18 no total):
- Ver, criar, editar, deletar leads
- Ver, enviar, gerenciar mensagens
- Gerenciar automações, campanhas, agentes
- Acessar configurações e relatórios
- Gerenciar usuários e permissões

### 🎯 Cenário — Time de Vendas:
```
Gerente Comercial (Admin):
→ Cria fluxos e campanhas
→ Acessa relatórios completos
→ Gerencia agentes IA

Atendente Ana (Usuário):
→ Responde no Inbox
→ Move leads no CRM
→ Não acessa configurações ou campanhas

→ Cada um vê apenas o que precisa
→ Sem risco de configurações erradas
```

---

## 🚀 15. Guia de Início Rápido (30 Minutos para Funcionar)

### Passo 1 — Configurar WhatsApp (10 min)
```
Configurações → WhatsApp → Escolha Z-API ou Baileys → Conectar
```

### Passo 2 — Criar seu Primeiro Agente IA (5 min)
```
Agentes IA → Novo Agente → Preencha nome, especialidade e system prompt
Teste no Chat Preview antes de salvar
```

### Passo 3 — Montar Fluxo de Boas-Vindas (10 min)
```
Automação → Novo Fluxo → Use o template "Boas-vindas Básico"
Palavra-chave: "oi, olá, hello"
Blocos: [Texto: Boas-vindas] → [Agente IA] → [Resolver]
Ative o fluxo
```

### Passo 4 — Testar no Lab (3 min)
```
Lab → Flow Sim → Selecione o fluxo → Iniciar Conversa
Digite "oi" e veja a magia acontecer!
```

### Passo 5 — Ativar para Clientes Reais (2 min)
```
Automação → Clique no toggle do fluxo → Ativo!
Agora qualquer mensagem que chegar será atendida automaticamente 24/7
```

### Passo 6 — Criar Conteúdo para Redes Sociais com IA (5 min)
```
Estúdio de Conteúdo → Projetos → Novo Projeto (dê um nome e escolha o nicho)
Estúdio → Selecione o projeto → Wizard IA → Descreva sua ideia em linguagem natural
A IA gera: 3 headlines, caption, hooks, roteiro para reel e muito mais
```

---

## 🎨 17. Estúdio de Conteúdo Omnichannel

**O que é:** Central de criação de conteúdo com IA para redes sociais e anúncios. Transforma uma simples ideia em pacotes completos de publicação — headline, caption, hooks, roteiro de reel, post de blog e email — tudo gerado em segundos.

### Como usar:

**1. Criar um Projeto de Marca:**
1. Acesse **Estúdio de Conteúdo** no menu lateral
2. Clique na aba **Projetos** → **Novo Projeto**
3. Preencha:
   - **Nome do Projeto**: Ex: "Clínica Dr. Paulo", "Loja de Moda Verão 26"
   - **Cliente**: Nome do cliente (opcional)
   - **Nicho**: Ex: "Saúde e Bem-estar", "Moda Feminina"
   - **Tom de Voz**: Formal, Descontraído, Inspiracional, Técnico
   - **Estilo de Liderança**: Ex: "Especialista", "Amigo", "Coach"
   - **Cores da Marca**: Palette de até 3 cores (#HEX)
4. Clique em **Salvar Projeto**

**2. Criar um Ativo de Conteúdo:**
1. Vá para a aba **Estúdio**
2. Selecione o projeto de marca
3. Preencha:
   - **Título**: Tema central do conteúdo
   - **Canal**: Instagram, WhatsApp, Email, Blog, Anúncio
   - **Formato**: Reel, Feed, Stories, Email, Blog
4. Clique em **Gerar com IA** — a IA cria todos os formatos em paralelo

### 🧱 Formatos de Conteúdo Gerados:

| Formato | Descrição | Uso Ideal |
|---------|-----------|-----------|
| **Headlines** | 3 títulos chamativos | Anúncios, blog posts |
| **Caption** | Legenda completa com CTA | Feed Instagram/Facebook |
| **Hooks** | Frases de abertura impactantes | Início de Reels e Stories |
| **Social Ads** | Texto completo para anúncio pago | Meta Ads, Google Ads |
| **Email** | Email marketing completo | Disparos para lista |
| **Blog Post** | Artigo longo otimizado | SEO e nutrição de leads |

### 🔧 Recursos do Estúdio:

- **TTS de Áudio (OpenAI)**: Gere narração em áudio para qualquer ativo (5 vozes disponíveis: Nova, Alloy, Echo, Onyx, Shimmer)
- **Construtor UTM**: Adicione parâmetros de rastreamento ao link (source, medium, campaign) para medir o tráfego com precisão
- **Biblioteca de Conteúdos**: Filtre e organize todos os ativos por status (rascunho, aprovado, publicado) e por canal
- **Calendário de Publicação**: Visualize os conteúdos agendados por data e canal em formato de agenda
- **Agendamentos por Plataforma**: Programe quando e em qual rede social cada ativo vai ser publicado
- **Dashboard de Métricas**: Total de ativos criados, distribuição por status e por canal

### 📊 Fluxo de Trabalho Completo:
```
Ideia → Estúdio → [Gerar com IA] → Editar se necessário → [Aprovar]
→ [Gerar Áudio TTS] → [Adicionar UTM] → [Agendar]
→ Biblioteca mostra ativo como "Agendado"
```

### 🎯 Cenário Real — Agência de Marketing:
```
Agência tem 15 clientes para produzir conteúdo todo mês

Antes: 3 redatores trabalhando 40h/semana
Depois (com Estúdio de Conteúdo):

1. Cria projeto "Clínica Odonto Premium" com cores e tom da marca
2. Entra no Estúdio e descreve: "Post sobre clareamento dental a laser"
3. IA gera em 8 segundos:
   • 3 headlines ("Sorria com Confiança", "Dentes Brancos em 1 Hora", ...)
   • Caption completa com CTA e hashtags
   • Roteiro do reel (30 segundos)
   • Texto do anúncio para Meta Ads
4. Redator revisa em 5 min, aprova e agenda
5. Áudio narrado gerado automaticamente para os Stories

Resultado: 60 posts/mês por cliente em vez de 20
Tempo: 5 min por post em vez de 2h
```

---

### 17.1 — Chat Wizard MFORTE

**O que é:** Interface de chat conversacional dentro do Estúdio que transforma uma ideia em linguagem natural em um pacote completo de conteúdo — com enriquecimento por IA antes de gerar.

### Como usar:
1. Acesse a aba **Estúdio** e selecione um projeto
2. Clique no botão **Wizard IA** (ícone de varinha mágica)
3. O chat abre com a pergunta: *"Qual é a sua ideia de conteúdo?"*
4. Digite sua ideia livremente, por exemplo:
   - *"Quero falar sobre os benefícios do jejum intermitente para quem malha"*
   - *"Post para anunciar a chegada da coleção outono/inverno"*
5. A IA enriquece automaticamente com:
   - **Área temática** identificada (ex: "Saúde e Nutrição Esportiva")
   - **Fontes sugeridas** para embasar o conteúdo
   - **3 Headlines prontos** para usar ou adaptar
6. Os resultados aparecem como balões de chat
7. Clique em **Usar esta ideia** para criar o ativo com os dados enriquecidos

### 🎤 Exemplos de Ideias e Resultados:
```
VOCÊ DIGITOU:
"Post sobre liquidação de fim de ano na minha loja de roupas"

IA RESPONDEU:
Área: Varejo de Moda / Promoções Sazonais

Fontes: Pesquisa de comportamento de compra de fim de ano (ABCOMM 2025)

Headlines gerados:
1. "Liquidação de Janeiro: Até 70% OFF em toda a Coleção Verão!"
2. "Renove seu Guarda-Roupa Sem Pesar no Bolso — Só Até Domingo!"
3. "Os Preços Mais Baixos do Ano Estão Aqui. Corre que É Por Tempo Limitado!"
```

---

### 17.2 — Clonagem de Voz e Avatar (ElevenLabs + HeyGen)

**O que é:** Integração avançada que permite gerar conteúdo com **voz clonada** (ElevenLabs) e **vídeos com avatar digital** (HeyGen) — tudo a partir dos ativos criados no Estúdio.

### Configuração (por Projeto):

**ElevenLabs — Voz Clonada:**
1. Acesse **Projetos** → edite o projeto desejado
2. Clique em **Credenciais de Clonagem** → **Configurar ElevenLabs**
3. Insira:
   - **ElevenLabs API Key**: Encontrada em elevenlabs.io → Profile → API Keys
   - **Voice ID**: ID da voz clonada criada no ElevenLabs (ex: `21m00Tcm4TlvDq8ikWAM`)
4. Clique em **Salvar** — o badge "ElevenLabs" fica verde no projeto

**HeyGen — Avatar Digital:**
1. No mesmo painel de credenciais, clique em **Configurar HeyGen**
2. Insira:
   - **HeyGen API Key**: Encontrada em heygen.com → Settings → API
   - **Avatar ID**: ID do avatar criado no HeyGen (ex: `Abigail_expressive_20240926`)
3. Clique em **Salvar** — o badge "HeyGen" fica verde no projeto

> ⚠️ **Segurança**: As credenciais são armazenadas criptografadas e nunca ficam visíveis após salvar. O sistema exibe apenas os indicadores "Configurado" (verde) ou "Não configurado" (cinza).

### Como Gerar Conteúdo com Voz Clonada (ElevenLabs):
1. Abra um ativo na **Biblioteca**
2. Na seção **Clonagem de Mídia**, clique em **Gerar com Voz Clonada**
3. O sistema envia o texto do ativo para o ElevenLabs via eleven_multilingual_v2
4. O áudio MP3 é gerado e fica disponível para:
   - ▶️ Reproduzir diretamente no navegador
   - ⬇️ Baixar o arquivo MP3
   - 📋 Copiar URL para usar em outras ferramentas

### Como Gerar Vídeo com Avatar (HeyGen):
1. Abra um ativo na **Biblioteca**
2. Na seção **Clonagem de Mídia**, selecione o tipo de roteiro:
   - **Reels**: Usa o roteiro de reel do ativo
   - **Live**: Usa o roteiro de live do ativo
3. Clique em **Gerar Vídeo com Avatar**
4. O status muda para **Processando...** (HeyGen processa em background)
5. Clique em **Verificar Status** até aparecer **Vídeo pronto**
6. Acesse o vídeo finalizado:
   - ⬇️ Baixar o vídeo MP4
   - 📋 Copiar URL do vídeo

### 🎯 Cenário Real — Criador de Conteúdo:
```
João é coach de finanças com 200k seguidores no Instagram

Antes: Gravava vídeos 3x/semana — 2h de produção cada
Depois (com Clonagem):

1. Escreve ideia no Wizard: "Dica de como sair das dívidas em 6 meses"
2. IA gera roteiro completo do reel (30s)
3. Clica em "Gerar Vídeo com Avatar" — HeyGen cria o vídeo em 10 min
4. Clica em "Gerar com Voz Clonada" — narração em PT-BR perfeita em 30s
5. Baixa o vídeo final pronto para publicar

De 2h de gravação para 15 minutos de revisão
Mantém a própria voz e aparência — sem contratação de atores
```

---

## 💡 16. Dicas de Ouro

### ✅ Boas Práticas

**1. Teste sempre no Lab antes de ativar**
Nunca ative um fluxo sem testá-lo pelo Simulador de Conversa. Identifique bugs antes que seus clientes os encontrem.

**2. Seja específico no System Prompt do Agente IA**
Quanto mais detalhado o prompt, melhor o agente responde. Inclua: tom de voz, o que pode e não pode dizer, preços atualizados, horário de funcionamento.

**3. Segmente bem suas campanhas**
Não mande promoção de iPhone para quem está procurando Samsung. Use os filtros de temperatura e estágio para personalizar.

**4. Configure SLA de acordo com sua operação**
Se você responde em até 1 hora, configure SLA de 60 minutos. Assim você é alertado antes de perder o prazo.

**5. Use variáveis nas mensagens**
Em vez de "Olá!", use "Olá, {nome}!" — o sistema substitui automaticamente pelo nome do lead.

**6. Monitore o Dashboard diariamente**
Leads "quentes" com alta pontuação merecem atenção imediata. Não deixe esfriar!

### ❌ Erros Comuns a Evitar

- Criar fluxos sem testar e enviar mensagens erradas para clientes
- Usar System Prompt vago ("seja útil") sem especificar o contexto
- Disparar campanhas sem segmentação (spam gera bloqueios)
- Ignorar o timer de SLA vermelho no Inbox
- Não configurar palavras-chave nos fluxos (fluxo nunca ativa)

---

## 📞 Suporte

**Precisa de ajuda?**
- 📧 Email: support@quantaflow.com
- 📚 Documentação online: `/admin/documentation`
- 🧪 Teste seus fluxos: `/admin/lab`

---

**Boa sorte! O Quanta Flow está pronto para trabalhar por você 24 horas por dia. 🚀**

*Automatize o repetitivo. Foque no que importa: relacionamentos.*
