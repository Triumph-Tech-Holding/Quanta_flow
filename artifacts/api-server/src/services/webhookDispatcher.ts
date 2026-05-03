import crypto from "crypto";
import { db } from "../db";
import { outboundWebhooks } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { log } from "../index";

const SUPPORTED_EVENTS = [
  "lead.created",
  "lead.qualified",
  "flow.success",
  "flow.interrupt",
  "conversation.closed",
] as const;

export type WebhookEvent = (typeof SUPPORTED_EVENTS)[number];

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function dispatchEvent(
  event: WebhookEvent,
  payload: unknown,
  userId: string
): Promise<void> {
  try {
    const webhooks = await db
      .select()
      .from(outboundWebhooks)
      .where(and(eq(outboundWebhooks.userId, userId), eq(outboundWebhooks.isActive, true)));

    const matching = webhooks.filter((wh) => {
      const events = (wh.events as string[]) || [];
      return events.includes(event);
    });

    if (matching.length === 0) return;

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      matching.map(async (wh) => {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Quanta-Event": event,
          };
          if (wh.secret) {
            headers["X-Quanta-Signature"] = `sha256=${signPayload(body, wh.secret)}`;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(wh.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const status = response.ok ? "success" : `error:${response.status}`;
          await db
            .update(outboundWebhooks)
            .set({ lastStatus: status, lastTriggeredAt: new Date() })
            .where(eq(outboundWebhooks.id, wh.id));

          log(`[webhook] ${event} → ${wh.url} → ${status}`, "webhook-dispatcher");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`[webhook] ${event} → ${wh.url} → FAILED: ${msg}`, "webhook-dispatcher");
          await db
            .update(outboundWebhooks)
            .set({ lastStatus: `error:${msg}`.slice(0, 100), lastTriggeredAt: new Date() })
            .where(eq(outboundWebhooks.id, wh.id))
            .catch(() => {});
        }
      })
    );
  } catch (err) {
    console.error("[webhookDispatcher] fatal (non-blocking):", err);
  }
}

export { SUPPORTED_EVENTS };
