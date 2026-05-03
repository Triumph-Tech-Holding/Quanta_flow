import { log } from "../index";

export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: string[],
  accessToken: string
): Promise<boolean> {
  try {
    const range = encodeURIComponent(`${sheetName}!A1`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: [values] }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`[sheets] appendRow failed: ${res.status} - ${text}`, "google-sheets");
      return false;
    }
    log(`[sheets] Row appended to ${spreadsheetId}/${sheetName}`, "google-sheets");
    return true;
  } catch (err) {
    log(`[sheets] appendRow error: ${String(err)}`, "google-sheets");
    return false;
  }
}

export function getAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ access_token: string; refresh_token?: string }>;
  } catch {
    return null;
  }
}

export async function mapContactToRow(
  contact: Record<string, unknown>,
  columnMapping: Record<string, string>
): Promise<string[]> {
  const fieldMap: Record<string, unknown> = {
    name: contact.nome,
    phone: contact.telefone,
    email: contact.email,
    stage: contact.pipelineStage,
    score: contact.score,
    temperature: contact.temperature,
    intent: contact.lastIntent,
  };

  const sorted = Object.entries(columnMapping).sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  return sorted.map(([field]) => String(fieldMap[field] ?? ""));
}
