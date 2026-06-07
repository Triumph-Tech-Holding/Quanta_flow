import { type Express, type Request, type Response } from "express";
import { timingSafeEqual } from "crypto";
import { log } from "../index";
import { getWhatsAppProvider, getBaileysInstance } from "../services/whatsappProvider";
import { storage } from "../storage";

// ── In-memory rate limiter: max 20 requests per minute per IP ────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

// ── Timing-safe API key comparison ───────────────────────────────────────────
function isValidApiKey(provided: string): boolean {
  const expected = process.env.QF_SEND_API_KEY;
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided.padEnd(64).slice(0, 64));
    const b = Buffer.from(expected.padEnd(64).slice(0, 64));
    return timingSafeEqual(a, b) && provided === expected;
  } catch {
    return false;
  }
}

// ── Route registration ────────────────────────────────────────────────────────
export function registerExternalRoutes(app: Express): void {
  /**
   * POST /api/messages/send
   *
   * Endpoint B2B para sistemas externos (ex.: TTHM) dispararem mensagens
   * WhatsApp usando a sessão configurada no Quanta Flow.
   *
   * Headers obrigatórios:
   *   x-api-key: <QF_SEND_API_KEY>
   *
   * Corpo JSON:
   *   { "to": "5511999999999", "message": "texto", "userId"?: "uuid" }
   *
   * Respostas:
   *   200  { ok: true,  messageId: "..." }
   *   401  { ok: false, error: "unauthorized" }
   *   422  { ok: false, error: "validation_error", fields: [...] }
   *   429  { ok: false, error: "rate_limit_exceeded" }
   *   503  { ok: false, error: "whatsapp_indisponivel" }
   *   500  { ok: false, error: "internal_error" }
   */
  app.post("/api/messages/send", async (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? "unknown";

    // ── 1. Rate limit ─────────────────────────────────────────────────────────
    if (!checkRateLimit(ip)) {
      log(`[external-send] rate limit exceeded — ip=${ip}`, "external-api");
      return res.status(429).json({ ok: false, error: "rate_limit_exceeded" });
    }

    // ── 2. Authentication ─────────────────────────────────────────────────────
    const providedKey = (req.headers["x-api-key"] as string | undefined) ?? "";
    if (!isValidApiKey(providedKey)) {
      log(`[external-send] unauthorized attempt — ip=${ip}`, "external-api");
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // ── 3. Input validation ───────────────────────────────────────────────────
    const { to, message, userId: bodyUserId } = req.body as {
      to?: unknown;
      message?: unknown;
      userId?: unknown;
    };

    const missingFields: string[] = [];
    if (!to || typeof to !== "string" || !/^\d{10,15}$/.test(to.replace(/\D/g, ""))) {
      missingFields.push("to (número E.164 sem +, ex.: 5511999999999)");
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      missingFields.push("message (string não vazia)");
    }

    if (missingFields.length > 0) {
      return res.status(422).json({
        ok: false,
        error: "validation_error",
        fields: missingFields,
      });
    }

    const phone = (to as string).replace(/\D/g, "");
    const text  = (message as string).trim();

    // ── 4. Resolve userId ─────────────────────────────────────────────────────
    const userId =
      typeof bodyUserId === "string" && bodyUserId.trim().length > 0
        ? bodyUserId.trim()
        : (process.env.QF_SYSTEM_USER_ID ?? "");

    if (!userId) {
      log(`[external-send] userId não resolvido — defina QF_SYSTEM_USER_ID`, "external-api");
      return res.status(500).json({ ok: false, error: "internal_error" });
    }

    // ── 5. Verificar conectividade WhatsApp ───────────────────────────────────
    try {
      const config = await storage.getEvolutionConfig(userId);
      if (!config) {
        log(`[external-send] userId=${userId} sem config WhatsApp`, "external-api");
        return res.status(503).json({ ok: false, error: "whatsapp_indisponivel" });
      }

      const activeProvider = config.activeProvider ?? "none";

      // Para Baileys, verificar instância em memória
      if (activeProvider === "baileys") {
        const baileysInst = getBaileysInstance(userId);
        if (!baileysInst?.connected) {
          log(`[external-send] Baileys desconectado — userId=${userId}`, "external-api");
          return res.status(503).json({ ok: false, error: "whatsapp_indisponivel" });
        }
      } else if (config.status !== "connected") {
        log(`[external-send] provider=${activeProvider} status=${config.status} — userId=${userId}`, "external-api");
        return res.status(503).json({ ok: false, error: "whatsapp_indisponivel" });
      }

      // ── 6. Enviar ──────────────────────────────────────────────────────────
      const provider = await getWhatsAppProvider(userId);
      const result   = await provider.sendMessage(phone, text);

      log(
        `[external-send] sucesso — to=${phone} messageId=${result.messageId} provider=${activeProvider} userId=${userId}`,
        "external-api",
      );

      return res.status(200).json({ ok: true, messageId: result.messageId });

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith("NUMERO_NAO_WHATSAPP:")) {
        const num = errMsg.split(":")[1] ?? phone;
        log(`[external-send] número não encontrado no WhatsApp — to=${num} userId=${userId}`, "external-api");
        return res.status(422).json({
          ok: false,
          error: "numero_nao_whatsapp",
          detail: `O número ${num} não está registrado no WhatsApp ou não foi encontrado.`,
        });
      }
      log(`[external-send] erro — to=${phone} userId=${userId} err=${errMsg}`, "external-api");
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  });
}
