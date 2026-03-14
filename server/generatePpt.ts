import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const PptxGenJS = _require("pptxgenjs");

const GREEN = "00A86B";
const NAVY = "1B3A57";
const WHITE = "FFFFFF";
const LIGHT_BG = "F8FAFB";
const GRAY_TEXT = "6B7280";
const DARK_TEXT = "1F2937";

interface SlideData {
  title: string;
  subtitle?: string;
  bullets?: string[];
  highlights?: { label: string; value: string }[];
  icon?: string;
}

const SLIDES: SlideData[] = [
  {
    title: "Quanta Flow",
    subtitle: "Venda no automático.\nPlataforma Omnichannel CRM com IA",
  },
  {
    title: "Visão Geral",
    icon: "🎯",
    bullets: [
      "Plataforma completa de CRM, automação e comunicação omnichannel",
      "Inteligência Artificial integrada para classificação e resposta automática",
      "White-label com branding personalizável",
      "Controle de acesso granular (RBAC) com 18 permissões",
      "Suporte a WhatsApp, Telegram, Instagram e Email",
    ],
  },
  {
    title: "Dashboard",
    icon: "📊",
    bullets: [
      "Visão consolidada de leads, contatos e conversas",
      "Métricas de desempenho em tempo real",
      "Indicadores visuais de temperatura de leads",
      "Resumo de atividades e atribuições de agentes",
    ],
    highlights: [
      { label: "Métricas", value: "Leads, Conversas, Score" },
      { label: "Filtros", value: "Período, Agente, Status" },
    ],
  },
  {
    title: "CRM — Pipeline Kanban",
    icon: "🗂️",
    bullets: [
      "Board Kanban com arrastar e soltar entre estágios",
      "Classificação por temperatura: Frio, Morno, Quente",
      "Detecção de intenção por IA (Compra, Dúvida, Reclamação, Suporte, Elogio)",
      "Busca e filtros avançados",
      "Perfil completo do contato com timeline omnichannel",
    ],
    highlights: [
      { label: "Estágios", value: "Novo → Contatado → Qualificado → Proposta → Fechado" },
      { label: "IA", value: "Auto-scoring e classificação de intenção" },
    ],
  },
  {
    title: "Inbox Omnichannel",
    icon: "💬",
    bullets: [
      "Central unificada de mensagens: WhatsApp, Telegram, Instagram, Email",
      "Integração Z-API e Baileys para WhatsApp",
      "Webhooks automáticos para recepção de mensagens",
      "Fila de atendimento com SLA timer",
      "Atualização em tempo real via Socket.io",
    ],
    highlights: [
      { label: "Canais", value: "WhatsApp, Telegram, Instagram, Email" },
      { label: "Real-time", value: "Socket.io bidirecional" },
    ],
  },
  {
    title: "Automação — Visual Flow Builder",
    icon: "⚡",
    bullets: [
      "Editor visual com React Flow — arrastar, conectar e configurar blocos",
      "10 tipos de bloco: Texto, Áudio TTS, Imagem IA, Delay, Condição, Agente IA, Webhook, Fila, Resolver, Atualizar Lead",
      "Geração de fluxos via IA (GPT-4o-mini)",
      "5 templates prontos para uso imediato",
      "Exportação/importação JSON, detecção de ciclos, variáveis dinâmicas",
    ],
    highlights: [
      { label: "Blocos", value: "10 tipos configuráveis" },
      { label: "Templates", value: "5 modelos prontos" },
    ],
  },
  {
    title: "Campanhas Omnichannel",
    icon: "📢",
    bullets: [
      "Campanhas em massa com segmentação por temperatura, estágio e canal",
      "Sequências drip com delays configuráveis",
      "Geração de copy com IA integrada",
      "Rate limiting e horários permitidos",
      "Dashboard de métricas: envio, entrega, resposta e conversão",
    ],
    highlights: [
      { label: "Wizard", value: "4 etapas de criação" },
      { label: "Métricas", value: "Send/Delivery/Reply/Conversion" },
    ],
  },
  {
    title: "Fábrica de Agentes IA",
    icon: "🤖",
    bullets: [
      "Crie agentes especialistas com personalidade, tom e expertise customizados",
      "Configuração de modelo, temperatura, tokens e voz TTS",
      "Preview de chat integrado para testar agentes antes de publicar",
      "Integração com fluxos de automação — respostas inteligentes automáticas",
      "Geração de avatar com IA",
    ],
    highlights: [
      { label: "Modelo", value: "GPT-4o-mini" },
      { label: "Config", value: "Temperatura, Tom, Prompt, Voz" },
    ],
  },
  {
    title: "Laboratório de Testes",
    icon: "🧪",
    bullets: [
      "Ambiente seguro para testar agentes IA sem afetar produção",
      "Simulador de chat com seleção de canal (WhatsApp/Instagram)",
      "Seleção de agente para teste direto",
      "Respostas em tempo real do agente selecionado",
    ],
  },
  {
    title: "Links Compartilháveis & QR Codes",
    icon: "🔗",
    bullets: [
      "Gere links públicos para inscrição em fluxos e campanhas",
      "QR Code automático para cada link compartilhável",
      "Landing pages públicas com branding dinâmico",
      "Botão 'Enviar Fluxo' direto no perfil do contato",
      "Download do QR Code em SVG",
    ],
  },
  {
    title: "Microlearning & Webhooks",
    icon: "📚",
    bullets: [
      "Trilhas de aprendizado automatizadas por estágio/intenção do lead",
      "Entrega automática de conteúdo educativo",
      "Webhooks outbound com HMAC-SHA256 para Zapier, HubSpot etc.",
      "Integração Google Sheets para append automático de dados",
    ],
    highlights: [
      { label: "Eventos", value: "lead.created, lead.qualified, flow.success..." },
      { label: "Segurança", value: "HMAC-SHA256 signing" },
    ],
  },
  {
    title: "Configurações & Integrações",
    icon: "⚙️",
    bullets: [
      "Gerenciamento seguro de credenciais com criptografia AES-256-CBC",
      "Cache em memória para performance",
      "Auditoria completa de todas as alterações",
      "Configuração de SMTP, canais e provedores",
    ],
  },
  {
    title: "Branding White-label",
    icon: "🎨",
    bullets: [
      "Personalize nome, cores, logo e favicon da plataforma",
      "Cores primária e secundária configuráveis",
      "Logo e favicon com URL customizável",
      "SLA padrão configurável por branding",
      "Aplicação instantânea em toda a interface",
    ],
  },
  {
    title: "Segurança & RBAC",
    icon: "🔒",
    bullets: [
      "Autenticação JWT com expiração de 24h e versionamento de token",
      "Controle de acesso baseado em papéis: Super Admin, Admin, Usuário",
      "18 permissões granulares em 7 recursos",
      "Gestão de status de usuário: Ativo, Inativo, Suspenso",
      "Flag de troca obrigatória de senha",
      "Audit logs completos de todas as ações administrativas",
    ],
  },
  {
    title: "Stack Tecnológico",
    icon: "🛠️",
    highlights: [
      { label: "Frontend", value: "React 18 + Vite + TypeScript + Tailwind CSS + Shadcn UI" },
      { label: "Backend", value: "Node.js + Express.js" },
      { label: "Database", value: "PostgreSQL + Drizzle ORM" },
      { label: "Auth", value: "JWT + bcrypt" },
      { label: "Real-time", value: "Socket.io" },
      { label: "IA", value: "OpenAI GPT-4o-mini" },
      { label: "WhatsApp", value: "Z-API + Baileys" },
    ],
  },
  {
    title: "Obrigado!",
    subtitle: "Quanta Flow — Venda no automático.\n\nDúvidas? Entre em contato.",
  },
];

function addBackground(slide: PptxGenJS.Slide) {
  slide.background = { color: WHITE };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.08,
    fill: { color: GREEN },
  });
  slide.addShape("rect", {
    x: 0,
    y: "95%",
    w: "100%",
    h: "5%",
    fill: { color: NAVY },
  });
  slide.addText("Quanta Flow", {
    x: 0.3,
    y: 5.1,
    w: 3,
    h: 0.3,
    fontSize: 8,
    color: "CCCCCC",
    fontFace: "Arial",
  });
}

export async function generatePresentation(): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Quanta Flow";
  pptx.title = "Quanta Flow — Apresentação Comercial";
  pptx.subject = "Plataforma Omnichannel CRM com IA";

  for (let i = 0; i < SLIDES.length; i++) {
    const data = SLIDES[i];
    const slide = pptx.addSlide();

    if (i === 0) {
      slide.background = { color: NAVY };
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.12,
        fill: { color: GREEN },
      });
      slide.addText(data.icon || "", {
        x: 0,
        y: 1.2,
        w: "100%",
        h: 0.8,
        fontSize: 48,
        align: "center",
      });
      slide.addText("Quanta Flow", {
        x: 0,
        y: 1.8,
        w: "100%",
        h: 1.0,
        fontSize: 44,
        bold: true,
        color: GREEN,
        align: "center",
        fontFace: "Arial",
      });
      slide.addText(data.subtitle || "", {
        x: 1,
        y: 2.8,
        w: 11.3,
        h: 1,
        fontSize: 18,
        color: "CCCCCC",
        align: "center",
        fontFace: "Arial",
      });
      continue;
    }

    if (i === SLIDES.length - 1) {
      slide.background = { color: NAVY };
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.12,
        fill: { color: GREEN },
      });
      slide.addText(data.title, {
        x: 0,
        y: 1.8,
        w: "100%",
        h: 1,
        fontSize: 40,
        bold: true,
        color: GREEN,
        align: "center",
        fontFace: "Arial",
      });
      slide.addText(data.subtitle || "", {
        x: 1,
        y: 2.8,
        w: 11.3,
        h: 1.5,
        fontSize: 18,
        color: "CCCCCC",
        align: "center",
        fontFace: "Arial",
      });
      continue;
    }

    addBackground(slide);

    const titleText = data.icon ? `${data.icon}  ${data.title}` : data.title;
    slide.addText(titleText, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.7,
      fontSize: 26,
      bold: true,
      color: NAVY,
      fontFace: "Arial",
    });

    slide.addShape("rect", {
      x: 0.5,
      y: 1.0,
      w: 2,
      h: 0.04,
      fill: { color: GREEN },
    });

    let bulletY = 1.3;

    if (data.bullets && data.bullets.length > 0) {
      const bulletRows: PptxGenJS.TextProps[] = data.bullets.map((b) => ({
        text: b,
        options: {
          fontSize: 13,
          color: DARK_TEXT,
          fontFace: "Arial",
          bullet: { type: "bullet" as const, color: GREEN },
          paraSpaceAfter: 6,
        },
      }));

      const bulletH = data.highlights ? 2.2 : 3.5;
      slide.addText(bulletRows, {
        x: 0.5,
        y: bulletY,
        w: data.highlights ? 7.5 : 12.3,
        h: bulletH,
        valign: "top",
      });
      bulletY += bulletH + 0.1;
    }

    if (data.highlights && data.highlights.length > 0) {
      const hlX = data.bullets ? 8.5 : 0.5;
      const hlY = data.bullets ? 1.3 : bulletY;
      const hlW = data.bullets ? 4.3 : 12.3;

      slide.addShape("roundRect", {
        x: hlX,
        y: hlY,
        w: hlW,
        h: data.highlights.length * 0.55 + 0.5,
        fill: { color: LIGHT_BG },
        line: { color: "E5E7EB", width: 1 },
        rectRadius: 0.1,
      });

      data.highlights.forEach((hl, idx) => {
        const rowY = hlY + 0.2 + idx * 0.55;
        slide.addText(hl.label, {
          x: hlX + 0.2,
          y: rowY,
          w: hlW - 0.4,
          h: 0.22,
          fontSize: 10,
          bold: true,
          color: GREEN,
          fontFace: "Arial",
        });
        slide.addText(hl.value, {
          x: hlX + 0.2,
          y: rowY + 0.2,
          w: hlW - 0.4,
          h: 0.22,
          fontSize: 10,
          color: GRAY_TEXT,
          fontFace: "Arial",
        });
      });
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
