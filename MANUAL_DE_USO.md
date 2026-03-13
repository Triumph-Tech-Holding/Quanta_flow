# 📚 Manual de Uso - Quanta Flow

Bem-vindo! Este manual vai te ensinar a usar o Quanta Flow de forma simples e prática. Pense no Quanta Flow como um **super assistente** que ajuda seu negócio a vender mais automaticamente! 🚀

---

## 🏠 Dashboard - Seu Centro de Controle

O Dashboard é como o **painel de um carro**: aqui você vê tudo o que está acontecendo em tempo real!

### O que você vê aqui?
- **Total de Contatos**: Quantas pessoas estão na sua base de clientes
- **Temperatura dos Leads**: Se as pessoas estão "frias" (pouco interessadas), "mornas" (talvez comprem) ou "quentes" (prontas para comprar!)
- **Pipeline**: Quantos leads estão em cada etapa da venda
- **Pontuação Média**: Nota de interesse geral dos seus clientes
- **Leads em Destaque**: Os mais quentes aparecem em destaque!

### 💡 Exemplo Prático:
Você é uma loja de celulares. No seu Dashboard você vê:
- 50 contatos no total
- 10 "quentes" (prontos para comprar) ⭐
- 20 "mornas" (ainda analisando)
- 20 "frios" (apenas consultaram)

Assim você sabe **por onde focar seu tempo** - ligando para os "quentes" primeiro!

---

## 💬 Inbox - Centro de Mensagens

O Inbox é o seu **telefone e email central**. Todas as mensagens que chegam no WhatsApp, Instagram, Telegram e Email aparecem aqui em um único lugar!

### Como funciona?

1. **Receber mensagens**: Clientes mandam mensagens em qualquer canal
2. **Responder rápido**: Você responde tudo em um lugar (sem pular entre apps)
3. **Histórico completo**: Vê toda a conversa com cada cliente

### 🎯 Cenário: Uma conversa real

```
CLIENTE (WhatsApp): Olá! Qual é o preço do iPhone 15?
↓
VOCÊ (Inbox): O iPhone 15 sai por R$4.500 à vista
↓
CLIENTE (Instagram): E quanto custa parcelado?
↓
VOCÊ (Inbox - mesmo lugar): Parcelo em até 12x de R$450!
```

**Vantagem**: Não precisa de 10 apps abertos - tudo em um lugar!

### 🔥 Status de Atendimento

Cada conversa tem um status:
- **🟡 Aguardando**: Cliente escreveu e está esperando resposta
- **🟢 Respondido**: Você respondeu, agora espera o cliente voltar
- **🟣 Fila de Atendimento**: Cliente entrou na fila de prioridade
- **✅ Resolvido**: Conversa finalizada!

### 💡 Timer de SLA

O Quanta Flow avisa se você está **demorando muito** para responder (tipo aquele vigia de piscina que grita "ô atendimento!"). Assim você não deixa cliente esperando!

---

## 👥 CRM - Seu Agenda de Clientes (Turbo)

O CRM é como um **caderninho inteligente** onde você anota tudo sobre cada cliente.

### Organizando seus leads

Cada cliente tem:
- **Nome e telefone**: Dados básicos
- **Temperatura**: Se está quente ou frio para vender
- **Estágio**: Aonde está na jornada (novo → qualificado → fechado)
- **Pontuação**: Nota de interesse (IA calcula automaticamente!)
- **Tags**: Etiquetas para agrupar (ex: "interessado em celular", "já comprou antes")
- **Histórico**: Todas as mensagens com esse cliente

### 🎨 Kanban - Painel Visual

Imagina um quadro branco onde você coloca cartaozinhos:

```
┌─────────────┬──────────────┬──────────────┐
│   NOVO      │ QUALIFICADO  │    FECHADO   │
├─────────────┼──────────────┼──────────────┤
│ João Silva  │ Maria Souza  │ Pedro Costa  │
│ Teste       │ Ana Lima     │              │
│ Cliente XYZ │              │              │
└─────────────┴──────────────┴──────────────┘
```

**Você arrasta os cartaozinhos (leads) conforme as vendas avançam!**

### 🔥 Filtros Inteligentes

Quer só os leads "quentes"? Clica no filtro!
Quer só os que chegaram essa semana? Filtra!
Quer só os da categoria "celulares"? Pronto!

### 📊 Exemplo Completo

**João da Silva**
- Telefone: 11 98888-7777
- Temperatura: 🔥 Quente
- Estágio: Qualificado
- Pontuação: 18/20
- Tags: #iPhone #Premium #Pronta-entrega
- Última mensagem: "Qual é a cor disponível?"
- IA Summary: "Cliente muito interessado, pronto para fechar"

**Próxima ação**: Enviar cores disponíveis + oferecer desconto progressivo!

---

## ⚙️ Automação - Seu Vendedor 24/7

Aqui você cria **fluxos de vendas automáticos**. Pense como um script que o Quanta Flow executa automaticamente, sem você fazer nada!

### Exemplo 1: Bem-vindo automático

```
Cliente NOVO → Envia mensagem → WhatsApp automático:
"Oi João! Bem-vindo à nossa loja! 
Temos os melhores preços em celulares. 
Posso ajudar? 😊"
```

### Exemplo 2: Acompanhamento de lead "morno"

```
Cliente clicou, mas não comprou → Espera 2 dias → Envia:
"João, tá tudo bem? Voltei a pensar no iPhone que você viu.
Posso tirar dúvidas sobre ele?"
```

### Exemplo 3: Ativação de IA

```
Cliente manda: "Qual é a bateria do iPhone 15?"
↓
IA RESPONDE automaticamente:
"O iPhone 15 tem até 26 horas de bateria! 
Quer saber mais sobre outras especificações?"
```

### 🎯 Criando um Fluxo (Passo-a-passo)

1. **Clica em "Automação"** → "Novo Fluxo"
2. **Define quando ativa**: Quando cliente novo chega? Quando abandona carrinho?
3. **Desenha as etapas**: "Enviar mensagem" → "Esperar 3 dias" → "Enviar nova mensagem"
4. **Ativa fluxo**: Agora roda automaticamente!

### 🧠 Blocos de Fluxo

- **Mensagem (Texto)**: "Olá João, tudo bem?"
- **Imagem**: Envia foto do produto
- **Áudio**: Mensagem em áudio (tipo voice note)
- **Delay (Espera)**: Aguarda 2 dias antes de continuar
- **Condição (SE/ENTÃO)**: Se cliente é quente → manda desconto. Se frio → manda newsletter
- **Agente IA**: Deixa a IA responder automaticamente
- **Webhook**: Conecta com sistemas externos (seu ERP, por exemplo)
- **Fila**: Coloca cliente na fila de atendimento VIP
- **Resolver**: Finaliza o fluxo

### 💡 Cenário Real: Loja de Roupas

```
Cliente novo acessa site → Recebe fluxo automático:

Dia 1:
"Oi! Bem-vindo à nossa loja! 🛍️
Aproveita nosso DESCONTO DE 15% para primeira compra!
Use código: BEMVINDO15"

Dia 3 (se não comprou):
"Maria, tá tudo ok? Ficou em dúvida?
Posso ajudar a escolher a roupa certa para você?"

Dia 5 (se ainda não comprou):
"Última chance! Desconto para você expira hoje.
Aproveita?"
```

---

## 🤖 Agentes IA - Seus Vendedores Virtuais

Os Agentes IA são como **vendedores robôs** que conversam naturalmente com seus clientes!

### Como funcionam?

Você cria um agente com:
- **Nome**: Ex: "Vendedor de Iphones"
- **Personalidade**: Como ele fala (profissional, descontraído, entusiasmado)
- **Especialidade**: Sobre o que ele sabe (celulares, roupas, etc)
- **Instruções**: O que ele deve fazer e evitar
- **Voz**: Ele fala em áudio? Com qual voz?

### 💬 Exemplo: Agente "TechGuru"

```
CLIENTE: Oi, qual celular é melhor, Samsung ou iPhone?

TECHGURU (IA):
"Ótima pergunta! Depende do seu uso:
- iPhone: Melhor para quem quer simplicidade
- Samsung: Melhor para quem quer customização
Qual seu orçamento? Posso indicar o melhor! 📱"
```

### 🎯 Casos de Uso

**Suporte 24/7**: Mesmo à noite, a IA responde dúvidas sobre produtos

**Pré-qualificação**: IA faz perguntas básicas antes de você falar com cliente

**Pós-venda**: IA pergunta se produto chegou bem, se tá feliz

**Geração de conteúdo**: IA cria textos para campanhas de marketing

### 🧪 Testando Agentes

Existe um **Laboratório** onde você:
1. Seleciona um agente
2. Manda mensagens para ele
3. Vê como ele responde **antes de liberar para clientes**

Tipo um teste de direção antes de sair na rua!

---

## 📢 Campanhas - Venda em Massa (Com Respeito)

Campanhas permitem enviar mensagens para **muitos clientes ao mesmo tempo**, mas de forma inteligente!

### Tipos de Campanha

**1. Broadcast (Mensagem Única)**
Envia a mesma mensagem para vários clientes:

```
"MEGA PROMOÇÃO! 🎉
Desconto de 40% em TODOS os celulares!
Válido até domingo!
"
```

**2. Sequência Drip (Campanha em Série)**
Envia uma série de mensagens ao longo do tempo:

```
Dia 1: "Oi João! Novo produto chegou!"
Dia 3: "Que tal conhecer o novo modelo?"
Dia 5: "Últimos dias para aproveitar a promoção"
Dia 7: "Ainda está disponível para você!"
```

### 🎯 Segmentação Inteligente

Você escolhe **para quem enviar**:
- Só clientes "quentes"? ✅
- Só quem comprou nos últimos 30 dias? ✅
- Só quem tá no estágio "qualificado"? ✅

Assim você **não enche caixa de entrada** de quem não tá interessado.

### 📊 Métricas

O Quanta Flow conta:
- **Quantas mensagens foram enviadas**: 500
- **Quantas foram entregues**: 480 (15 números inválidos)
- **Quantas foram lidas**: 380
- **Quantas geraram resposta**: 150
- **Quantas viraram vendas**: 45 vendas! 💰

### 💡 Exemplo: Black Friday

```
CAMPANHA: Black Friday 2026

Alvo: Todos os clientes "mornos" que viram celulares

Mensagem:
"🖤 BLACK FRIDAY! 🖤
iPhone 15 → De R$4.500 por R$3.200! 
Estoque limitado!
Link: www.loja.com/blackfriday"

Resultado:
- 10.000 mensagens enviadas
- 8.000 abriram (80%)
- 2.000 clicaram no link
- 450 compraram (22% de conversão)
```

---

## ⚙️ Configurações - Personalizando Tudo

Aqui você ajusta como o Quanta Flow funciona para seu negócio.

### 🎨 Branding (Aparência)

Você customiza:
- **Logo**: Sua marca aparece no sistema
- **Cores primárias**: Verde, azul, vermelho?
- **Nome da empresa**: Aparece em tudo
- **Favicon**: O ícone da abinha do navegador

**Resultado**: Sistema parece 100% seu! (White-label)

### 📱 Canais de Integração

Conecta seus apps:

**WhatsApp**
- Via Z-API (paga, mais rápido)
- Via Baileys (grátis, precisa ler QR code)

**Telegram**: Cria um bot que recebe mensagens

**Instagram**: Recebe mensagens de seguidores

**Email**: Integra com seu email corporativo

Assim todas as mensagens chegam no Inbox em um lugar!

### 🔑 API Keys & Webhooks

Aqui você:
- Coloca as chaves de segurança dos serviços (WhatsApp, Telegram)
- Configura webhooks (quando algo aconteça, avisa seu sistema)

**Exemplo**: Quando alguém virar cliente no Quanta Flow, automaticamente adiciona no seu CRM interno.

### 📋 Gerenciamento de Usuários

Você:
- **Cria colaboradores**: "João tem acesso total", "Maria vê só leads"
- **Define permissões**: Quem pode fazer o quê
- **Acompanha atividades**: Quem fez o quê e quando

**Funções disponíveis:**
- Super Admin: Acesso TOTAL a tudo
- Admin: Gerencia usuários, campanhas, fluxos
- Usuário: Só usa Inbox, CRM, Automação

---

## 🧪 Laboratório - Testando Antes de Usar

Aqui você testa tudo antes de liberar para seus clientes!

### Chat Simulator

**Simula conversas com seus agentes IA:**

1. Seleciona um agente
2. Escolhe se é WhatsApp ou Instagram
3. Manda mensagens
4. Vê como a IA responde em tempo real

**Exemplo:**
```
VOCÊ: "Olá, quanto custa um iPhone 15 Pro?"

IA RESPONDE:
"Olá! O iPhone 15 Pro custa a partir de R$7.999!
Quer conhecer as cores disponíveis?"
```

Se a resposta ficar estranha, você ajusta o agente antes de usar com clientes.

---

## 🚀 Fluxo Completo de Uma Venda

Vamos ver tudo funcionando junto em um cenário real!

### Dia 1: Cliente Chega

```
Maria vê anúncio seu no Instagram
↓
Entra em contato via WhatsApp: "Oi, quanto custa?"
↓
Quanta Flow RECEBE no Inbox ✅
```

### Dia 1: Resposta Automática

```
Quanta Flow ativa fluxo "Lead Novo"
↓
AUTOMAÇÃO envia: "Oi Maria! Bem-vinda! 
iPhone 15 sai por R$4.500 à vista ou 12x de R$450"
↓
IA está ativada e responde dúvidas automaticamente:
"Qual a cor que você prefere?"
```

### Dia 2: Qualificação

```
Maria: "Tem verde?"
↓
IA: "Temos verde, preto e azul! 
Qual combina mais com seu estilo?"
```

### Dia 3: Lead Aquecido

```
CRM marca Maria como "QUENTE"
↓
Você (humano) toma a conversa:
"Oi Maria! Posso ajudar de forma ainda melhor?
Posso desbloquear 10% off só para você hoje!"
```

### Dia 3-4: Fechamento

```
Maria compra! 🎉
↓
Automação ativa fluxo "Pós-Venda":
"Seu pedido saiu! Rastreamento: ..."
↓
5 dias depois:
"Chegou bem? Curtiu? Avalia para a gente!"
```

### Resultado na Dashboard

```
❌ Novo → ✅ Qualificado → 💰 Fechado
        Maria Silva
```

---

## 💡 Dicas de Ouro

### 1️⃣ Comece Simples
Não faça 100 fluxos no primeiro dia. Comece com:
- Bem-vindo automático
- Acompanhamento após 2 dias
- Desconto progressivo

### 2️⃣ Teste Tudo no Laboratório
Antes de mandar fluxo para 1.000 clientes, teste com você mesmo!

### 3️⃣ Qualifique seus Leads
Coloque notas e tags:
- "Interessado em X"
- "Precisa de orçamento"
- "Já visitou site 3x"

Isso ajuda a automação a tomar melhores decisões.

### 4️⃣ Use IA Estrategicamente
IA é ótima para:
- ✅ Responder perguntas técnicas
- ✅ Fazer pré-qualificação
- ✅ Respostas rápidas 24/7
- ❌ Não é boa para problemas complexos (aí você entra)

### 5️⃣ Acompanhe Métricas
Sempre checke:
- Taxa de resposta: Está subindo?
- Taxa de conversão: Quanto de lead vira venda?
- Tempo de resposta: Está mais rápido?

Se está ruim, ajusta os fluxos!

### 6️⃣ Segmente suas Campanhas
Não mande a mesma mensagem para quem vai comprar e quem é frio.
- Lead QUENTE: Desconto maior, urgência
- Lead MORNO: Educational, mostra valor
- Lead FRIO: Newsletter, buildando relacionamento

---

## 📞 Suporte Rápido

**Precisa de ajuda?**
- 📧 Email: support@quantaflow.com
- 💬 WhatsApp: (11) 9XXXX-XXXX
- 📚 Documentação: /admin/documentation

---

**Boa sorte vendendo! 🚀 Quanta Flow + Você = Máximo de Vendas!**

*Lembre-se: Automação não substitui relacionamento. Use o Quanta para economizar tempo com tarefas repetitivas e focar em relacionamentos que importam.*

---

## 🎓 Próximos Passos Recomendados

1. **Criar seu primeiro agente IA** (5 minutos)
2. **Montar fluxo "Bem-vindo"** (10 minutos)
3. **Conectar seu WhatsApp** (15 minutos)
4. **Testar tudo no Laboratório** (5 minutos)
5. **Ativar para clientes reais** (Let's go! 🚀)

