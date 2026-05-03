import { log } from "../index";

export async function sendTelegramMessage(
  chatId: string | number,
  message: string,
  botToken: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      log(`[telegram] sendMessage failed: ${res.status} - ${text}`, "telegram");
    }
  } catch (err) {
    log(`[telegram] sendMessage error: ${String(err)}`, "telegram");
  }
}

export async function registerTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const body = JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return res.json() as Promise<{ ok: boolean; description?: string }>;
}

export async function getTelegramBotInfo(
  botToken: string
): Promise<{ ok: boolean; result?: { username: string; first_name: string } }> {
  const url = `https://api.telegram.org/bot${botToken}/getMe`;
  const res = await fetch(url);
  return res.json() as Promise<{ ok: boolean; result?: { username: string; first_name: string } }>;
}
