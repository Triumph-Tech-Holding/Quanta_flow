import { log } from "../index";

export async function sendInstagramMessage(
  recipientId: string,
  message: string,
  accessToken: string
): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`;
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { text: message },
    messaging_type: "RESPONSE",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      log(`[instagram] sendMessage failed: ${res.status} - ${text}`, "instagram");
    }
  } catch (err) {
    log(`[instagram] sendMessage error: ${String(err)}`, "instagram");
  }
}

export function verifyInstagramWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}
