import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { storage, workspaceStorage, landingPageStorage } from "../storage";
import { blocksSchema, seoSchema, settingsSchema, findFormBlock, type Block } from "../lib/landingBlocks";
import { insertLandingPageSchema } from "@workspace/db";
import { db } from "../db";
import { landingPages, automationFlows, campaignDeliveries, brandingConfig, workspaces } from "@workspace/db";
import { eq, and, sql as sqlExpr } from "drizzle-orm";
import { randomUUID } from "node:crypto";

interface AuthRequest extends Request {
  user?: { userId: string; email: string; tokenVersion: number; workspaceId?: string };
  workspaceId?: string;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.workspaceId) return res.status(401).json({ message: "Não autenticado" });
  return next();
}

function clientIp(req: Request): string | null {
  const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xf || req.socket.remoteAddress || null;
}

// Simple in-memory token-bucket rate limit for public landing endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now > b.resetAt) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++; return true;
}
function publicRateLimit(prefix: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req) ?? "unknown";
    if (!rateLimit(`${prefix}:${ip}`, limit, windowMs)) return res.status(429).json({ message: "Muitas requisições, tente novamente em instantes" });
    return next();
  };
}

function sanitizeUrl(u: unknown): string {
  if (typeof u !== "string") return "";
  const t = u.trim();
  if (/^javascript:/i.test(t) || /^data:/i.test(t) || /^vbscript:/i.test(t)) return "";
  return t;
}
function normalizePhone(v: string): string { return v.replace(/[^\d+]/g, "").replace(/^\+?(\d)/, "$1"); }
function stripTags(v: string): string { return v.replace(/<[^>]*>/g, "").slice(0, 5000); }
function sanitizeFormValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string") out[k] = stripTags(v);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else out[k] = String(v ?? "").slice(0, 5000);
  }
  return out;
}

const createPageSchema = insertLandingPageSchema.pick({ name: true, slug: true }).extend({
  templateId: z.string().optional(),
});

const updatePageSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  draftBlocks: blocksSchema.optional(),
  seo: seoSchema.optional(),
  settings: settingsSchema.optional(),
  flowId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
}).strict();

export function registerLandingPageRoutes(app: Express, authenticateToken: any) {
  // ----- ADMIN -----
  app.get("/api/landing-pages", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const pages = await landingPageStorage.listByWorkspace(req.workspaceId!);
      return res.json(pages);
    } catch (err) {
      (req as any).log?.error?.({ err }, "list landing pages failed");
      return res.status(500).json({ message: "Erro ao listar páginas" });
    }
  });

  app.get("/api/landing-pages/:id", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const page = await landingPageStorage.getById(String(req.params.id), req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      return res.json(page);
    } catch (err) {
      (req as any).log?.error?.({ err }, "get landing page failed");
      return res.status(500).json({ message: "Erro ao buscar página" });
    }
  });

  app.post("/api/landing-pages", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createPageSchema.parse(req.body);
      const existing = await landingPageStorage.getBySlug(req.workspaceId!, parsed.slug);
      if (existing) return res.status(409).json({ message: "Já existe uma página com esse slug" });
      const tpl = parsed.templateId ? getTemplate(parsed.templateId) : null;
      const page = await landingPageStorage.create({
        workspaceId: req.workspaceId!,
        ownerUserId: req.user!.userId,
        name: parsed.name,
        slug: parsed.slug,
        status: "draft",
        draftBlocks: (tpl?.blocks ?? []) as any,
        seo: (tpl?.seo ?? { title: parsed.name }) as any,
        settings: {} as any,
        flowId: null,
        campaignId: null,
      });
      return res.status(201).json(page);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      (req as any).log?.error?.({ err }, "create landing page failed");
      return res.status(500).json({ message: "Erro ao criar página" });
    }
  });

  app.patch("/api/landing-pages/:id", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const data = updatePageSchema.parse(req.body);
      const page = await landingPageStorage.getById(id, req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      if (data.slug && data.slug !== page.slug) {
        const dup = await landingPageStorage.getBySlug(req.workspaceId!, data.slug);
        if (dup && dup.id !== id) return res.status(409).json({ message: "Slug já utilizado" });
      }
      const updated = await landingPageStorage.update(id, req.workspaceId!, data as any);
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      (req as any).log?.error?.({ err }, "update landing page failed");
      return res.status(500).json({ message: "Erro ao atualizar página" });
    }
  });

  app.delete("/api/landing-pages/:id", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const ok = await landingPageStorage.remove(String(req.params.id), req.workspaceId!);
      if (!ok) return res.status(404).json({ message: "Página não encontrada" });
      return res.json({ ok: true });
    } catch (err) {
      (req as any).log?.error?.({ err }, "delete landing page failed");
      return res.status(500).json({ message: "Erro ao remover página" });
    }
  });

  app.post("/api/landing-pages/:id/publish", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      // Atomic save+publish: aceita blocos/seo no body para evitar race entre PATCH e POST publish
      const body = z.object({
        draftBlocks: blocksSchema.optional(),
        seo: seoSchema.optional(),
        settings: settingsSchema.optional(),
        flowId: z.string().nullable().optional(),
        campaignId: z.string().nullable().optional(),
        name: z.string().min(2).optional(),
        slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
      }).strict().parse(req.body ?? {});
      let page = await landingPageStorage.getById(id, req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      if (body.slug && body.slug !== page.slug) {
        const dup = await landingPageStorage.getBySlug(req.workspaceId!, body.slug);
        if (dup && dup.id !== id) return res.status(409).json({ message: "Slug já utilizado" });
      }
      if (Object.keys(body).length > 0) {
        page = (await landingPageStorage.update(id, req.workspaceId!, body as any)) ?? page;
      }
      const blocks = blocksSchema.parse(page.draftBlocks ?? []);
      const seo = seoSchema.parse(page.seo ?? {});
      const version = await landingPageStorage.createVersion(id, blocks, seo, req.user!.userId);
      const updated = await landingPageStorage.update(id, req.workspaceId!, {
        status: "published" as any,
        publishedBlocks: blocks as any,
        publishedVersion: version.version,
        publishedAt: new Date() as any,
      });
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Blocos inválidos: " + (err.issues[0]?.message || "") });
      (req as any).log?.error?.({ err }, "publish landing page failed");
      return res.status(500).json({ message: "Erro ao publicar página" });
    }
  });

  app.get("/api/landing-pages/:id/versions", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const page = await landingPageStorage.getById(String(req.params.id), req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      const versions = await landingPageStorage.listVersions(page.id);
      return res.json(versions);
    } catch (err) {
      (req as any).log?.error?.({ err }, "list versions failed");
      return res.status(500).json({ message: "Erro ao listar versões" });
    }
  });

  app.get("/api/landing-pages/:id/submissions", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const page = await landingPageStorage.getById(String(req.params.id), req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      const subs = await landingPageStorage.listSubmissions(page.id);
      return res.json(subs);
    } catch (err) {
      (req as any).log?.error?.({ err }, "list submissions failed");
      return res.status(500).json({ message: "Erro ao listar respostas" });
    }
  });

  app.get("/api/landing-pages/:id/metrics", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const page = await landingPageStorage.getById(String(req.params.id), req.workspaceId!);
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      const events = await landingPageStorage.aggregateMetrics(page.id);
      const subs = await landingPageStorage.listSubmissions(page.id, 1);
      const submissionCount = (await db.execute(sqlExpr`SELECT COUNT(*)::int AS c FROM landing_page_submissions WHERE page_id = ${page.id}`)).rows[0] as any;
      return res.json({ events, submissionCount: Number(submissionCount?.c ?? 0), lastSubmissionAt: subs[0]?.createdAt ?? null });
    } catch (err) {
      (req as any).log?.error?.({ err }, "metrics failed");
      return res.status(500).json({ message: "Erro ao carregar métricas" });
    }
  });

  // ----- PUBLIC -----
  app.get("/api/public/landing/:slug", async (req: Request, res: Response) => {
    try {
      const page = await landingPageStorage.getPublishedBySlug(String(req.params.slug));
      if (!page || !page.publishedBlocks) return res.status(404).json({ message: "Página não encontrada" });
      const [branding] = await db.select().from(brandingConfig).where(eq(brandingConfig.workspaceId, page.workspaceId)).limit(1);
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, page.workspaceId)).limit(1);
      return res.json({
        id: page.id,
        slug: page.slug,
        name: page.name,
        blocks: page.publishedBlocks,
        seo: page.seo,
        settings: page.settings,
        branding: {
          companyName: ws?.companyName || branding?.companyName || null,
          primaryColor: ws?.primaryColor || branding?.primaryColor || "#00A86B",
          secondaryColor: ws?.secondaryColor || branding?.secondaryColor || "#0066CC",
          logoUrl: ws?.logoUrl || branding?.logoUrl || null,
          faviconUrl: ws?.faviconUrl || null,
        },
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao carregar página" });
    }
  });

  app.post("/api/public/landing/:slug/submit", publicRateLimit("submit", 10, 60_000), async (req: Request, res: Response) => {
    try {
      const page = await landingPageStorage.getPublishedBySlug(String(req.params.slug));
      if (!page || !page.publishedBlocks) return res.status(404).json({ message: "Página não encontrada" });
      const blocks = blocksSchema.parse(page.publishedBlocks);
      const blockId = typeof req.body?.blockId === "string" ? req.body.blockId : undefined;
      const formBlock = findFormBlock(blocks as Block[], blockId);
      if (!formBlock) return res.status(400).json({ message: "Esta página não tem formulário" });
      const fields = formBlock.props.fields;
      const rawValues: Record<string, unknown> = req.body?.values ?? {};
      const values = sanitizeFormValues(rawValues);
      for (const f of fields) {
        if (f.required && (values[f.name] === undefined || values[f.name] === "" || values[f.name] === null)) {
          return res.status(400).json({ message: `Campo "${f.label}" é obrigatório` });
        }
      }
      const email = typeof values["email"] === "string" ? values["email"] : (typeof values["e-mail"] === "string" ? values["e-mail"] : undefined);
      const rawPhone = typeof values["telefone"] === "string" ? values["telefone"] : (typeof values["phone"] === "string" ? values["phone"] : (typeof values["whatsapp"] === "string" ? values["whatsapp"] : undefined));
      const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
      if (phone) values["telefone"] = phone;
      const nome = typeof values["nome"] === "string" ? values["nome"] : (typeof values["name"] === "string" ? values["name"] : (email || phone || "Lead"));

      // Lookup contact preferindo telefone normalizado, depois e-mail
      let contact = phone ? await storage.findUnifiedContactByPhoneOrEmail(page.ownerUserId, phone) : undefined;
      if (!contact && email) contact = await storage.findUnifiedContactByPhoneOrEmail(page.ownerUserId, email);
      if (!contact) {
        contact = await storage.createUnifiedContact({
          userId: page.ownerUserId,
          workspaceId: page.workspaceId,
          nome: String(nome),
          email: email ?? null,
          telefone: phone ?? null,
          activeFlowId: (formBlock.props.flowId || page.flowId) ?? null,
        });
      } else if ((formBlock.props.flowId || page.flowId) && !contact.activeFlowId) {
        // Não sobrescrevemos um fluxo já em andamento — apenas iniciamos se não houver
        await storage.updateUnifiedContact(contact.id, { activeFlowId: (formBlock.props.flowId || page.flowId) as any });
      }

      // Optional campaign enrollment
      const campaignId = formBlock.props.campaignId || page.campaignId;
      if (campaignId) {
        await db.insert(campaignDeliveries).values({
          id: randomUUID(),
          campaignId,
          contactId: contact.id,
          channel: "whatsapp",
          status: "pending",
          messageIndex: 0,
        }).onConflictDoNothing();
      }

      const utm = req.body?.utm ?? null;
      await landingPageStorage.createSubmission({
        pageId: page.id,
        versionId: null,
        contactId: contact.id,
        payload: values,
        utm,
        ip: clientIp(req),
        userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
      });
      // Always count a submit event too
      await landingPageStorage.recordEvent(page.id, "form_submit", formBlock.id, null, null);

      const successMessage = formBlock.props.successMessage || "Recebemos suas informações. Em breve entraremos em contato!";
      const redirectUrl = formBlock.props.redirectUrl || null;
      return res.json({ ok: true, successMessage, redirectUrl });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      return res.status(500).json({ message: "Erro ao enviar formulário" });
    }
  });

  app.post("/api/public/landing/:slug/event", publicRateLimit("event", 60, 60_000), async (req: Request, res: Response) => {
    try {
      const page = await landingPageStorage.getPublishedBySlug(String(req.params.slug));
      if (!page) return res.status(404).json({ message: "Página não encontrada" });
      const eventType = String(req.body?.type || "").slice(0, 40);
      const ALLOWED = new Set(["page_view", "form_view", "form_submit", "cta_click", "scroll_25", "scroll_50", "scroll_75", "scroll_100", "video_play"]);
      if (!ALLOWED.has(eventType)) return res.status(400).json({ message: "Evento inválido" });
      const blockId = typeof req.body?.blockId === "string" ? req.body.blockId : null;
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.slice(0, 64) : null;
      await landingPageStorage.recordEvent(page.id, eventType, blockId, sessionId, null);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao registrar evento" });
    }
  });
}

// ===== Templates =====
type Template = { id: string; name: string; description: string; blocks: Block[]; seo?: { title?: string; description?: string } };

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Em branco",
    description: "Comece do zero",
    blocks: [],
  },
  {
    id: "lead-magnet",
    name: "Lead Magnet (E-book)",
    description: "Captação com isca digital",
    seo: { title: "Baixe nosso E-book gratuito", description: "Material exclusivo para você" },
    blocks: [
      { id: "h1", type: "hero", props: { eyebrow: "Material gratuito", title: "Baixe nosso E-book e transforme seu negócio", subtitle: "Um guia completo com estratégias que realmente funcionam.", ctaLabel: "Quero baixar agora", ctaHref: "#form", mediaUrl: null, mediaAlt: "Capa do e-book", layout: "split" }, style: { paddingY: "xl" } },
      { id: "b1", type: "benefits", props: { title: "O que você vai aprender", items: [{ title: "Fundamentos", description: "Base sólida para começar", icon: "BookOpen" }, { title: "Casos práticos", description: "Exemplos do mundo real", icon: "Lightbulb" }, { title: "Ferramentas", description: "Stack recomendada", icon: "Wrench" }] } },
      { id: "f1", type: "form", props: { title: "Receba agora no seu e-mail", description: "Preenche os campos abaixo e te enviamos o link.", submitLabel: "Quero meu e-book", successMessage: "Pronto! Confira seu e-mail.", fields: [{ id: "n", type: "text", name: "nome", label: "Nome", required: true }, { id: "e", type: "email", name: "email", label: "E-mail", required: true }, { id: "p", type: "phone", name: "telefone", label: "WhatsApp", required: false }] } },
      { id: "ft", type: "footer", props: { text: "© Todos os direitos reservados.", links: [] } },
    ],
  },
  {
    id: "webinar",
    name: "Webinar/Evento",
    description: "Inscrição para evento ao vivo",
    blocks: [
      { id: "h1", type: "hero", props: { eyebrow: "AO VIVO • ONLINE • GRATUITO", title: "Webinar: como dobrar suas vendas em 90 dias", subtitle: "Aulas ao vivo com especialistas. Vagas limitadas.", ctaLabel: "Garantir minha vaga", ctaHref: "#form", mediaUrl: null, mediaAlt: null, layout: "center" } },
      { id: "c1", type: "countdown", props: { deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), label: "Faltam para começar" } },
      { id: "b1", type: "benefits", props: { title: "O que será apresentado", items: [{ title: "Estratégia", description: "Plano em 3 passos", icon: "Target" }, { title: "Cases", description: "Estudos reais", icon: "Trophy" }, { title: "Q&A", description: "Tira-dúvidas ao vivo", icon: "MessageCircle" }] } },
      { id: "f1", type: "form", props: { title: "Inscrição", submitLabel: "Reservar minha vaga", successMessage: "Inscrição confirmada! Te enviaremos o link.", fields: [{ id: "n", type: "text", name: "nome", label: "Nome", required: true }, { id: "e", type: "email", name: "email", label: "E-mail", required: true }, { id: "p", type: "phone", name: "telefone", label: "WhatsApp", required: true }] } },
    ],
  },
  {
    id: "launch",
    name: "Lançamento de produto",
    description: "Páginas com prova social, oferta e CTA",
    blocks: [
      { id: "h", type: "header", props: { logoUrl: null, companyName: "Sua marca", menuLinks: [{ label: "Benefícios", href: "#benefits" }, { label: "Preço", href: "#pricing" }, { label: "FAQ", href: "#faq" }], ctaLabel: "Comprar", ctaHref: "#pricing" } },
      { id: "h1", type: "hero", props: { eyebrow: "NOVO LANÇAMENTO", title: "Apresentamos o produto que vai mudar sua rotina", subtitle: "Mais resultado, menos esforço. Conheça os detalhes.", ctaLabel: "Quero conhecer", ctaHref: "#pricing", mediaUrl: null, mediaAlt: null, layout: "split" } },
      { id: "sp", type: "socialProof", props: { title: "Empresas que confiam", logos: [] } },
      { id: "b1", type: "benefits", props: { title: "Por que escolher", items: [{ title: "Rápido", description: "Setup em minutos", icon: "Zap" }, { title: "Seguro", description: "Padrão enterprise", icon: "Shield" }, { title: "Suporte", description: "Time dedicado", icon: "Headphones" }] } },
      { id: "t1", type: "testimonials", props: { title: "Quem já usa, recomenda", items: [{ name: "Cliente feliz", role: "CEO, Empresa", quote: "Impressionante o quanto simplificou nosso processo." }] } },
      { id: "p1", type: "pricing", props: { title: "Escolha seu plano", plans: [{ name: "Starter", price: "R$ 97", period: "/mês", features: ["Recurso A", "Recurso B"], ctaLabel: "Começar", ctaHref: "#form" }, { name: "Pro", price: "R$ 297", period: "/mês", features: ["Tudo do Starter", "Recurso C", "Recurso D"], ctaLabel: "Assinar", ctaHref: "#form", highlight: true }] } },
      { id: "fq", type: "faq", props: { title: "Perguntas frequentes", items: [{ question: "Como funciona o teste?", answer: "Você tem 7 dias para testar." }] } },
      { id: "f1", type: "form", props: { title: "Quero saber mais", submitLabel: "Falar com vendas", fields: [{ id: "n", type: "text", name: "nome", label: "Nome", required: true }, { id: "e", type: "email", name: "email", label: "E-mail", required: true }, { id: "p", type: "phone", name: "telefone", label: "WhatsApp", required: true }] } },
      { id: "ft", type: "footer", props: { text: "© Todos os direitos reservados.", links: [] } },
    ],
  },
  {
    id: "simple-capture",
    name: "Captura simples",
    description: "Headline + formulário",
    blocks: [
      { id: "h1", type: "hero", props: { title: "Comece agora gratuitamente", subtitle: "Deixe seu contato e te chamamos no WhatsApp.", ctaLabel: "Quero começar", ctaHref: "#form", layout: "center", mediaUrl: null, mediaAlt: null } },
      { id: "f1", type: "form", props: { title: "Deixe seu contato", submitLabel: "Falar com um consultor", fields: [{ id: "n", type: "text", name: "nome", label: "Nome", required: true }, { id: "p", type: "phone", name: "telefone", label: "WhatsApp", required: true }] } },
    ],
  },
  {
    id: "thanks",
    name: "Obrigado/Upsell",
    description: "Página pós-conversão com próximo passo",
    blocks: [
      { id: "h1", type: "hero", props: { title: "Obrigado pelo seu cadastro!", subtitle: "Aproveite uma oferta exclusiva, válida só agora.", ctaLabel: "Quero a oferta", ctaHref: "#cta", layout: "center", mediaUrl: null, mediaAlt: null } },
      { id: "v1", type: "video", props: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", caption: "Veja em 2 minutos como aproveitar." } },
      { id: "c1", type: "cta", props: { title: "Oferta limitada", subtitle: "Adquira agora com 50% off.", ctaLabel: "Aproveitar oferta", ctaHref: "#" } },
    ],
  },
];

function getTemplate(id: string): Template | null {
  return TEMPLATES.find(t => t.id === id) ?? null;
}

export const LANDING_TEMPLATES = TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description }));
