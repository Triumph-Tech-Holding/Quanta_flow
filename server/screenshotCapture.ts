import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import type { Browser, Page } from "puppeteer-core";
const _require = createRequire(import.meta.url);

interface ScreenshotMap {
  [slideTitle: string]: string;
}

const ROUTES_TO_CAPTURE: { slideTitle: string; route: string }[] = [
  { slideTitle: "Dashboard", route: "/dashboard" },
  { slideTitle: "Inbox Omnichannel", route: "/inbox" },
  { slideTitle: "CRM — Pipeline Kanban", route: "/crm" },
  { slideTitle: "Automação — Visual Flow Builder", route: "/automation" },
  { slideTitle: "Campanhas Omnichannel", route: "/admin/campaigns" },
  { slideTitle: "Fábrica de Agentes IA", route: "/admin/agents" },
  { slideTitle: "Laboratório de Testes", route: "/admin/lab" },
  { slideTitle: "Microlearning & Webhooks", route: "/learning-tracks" },
  { slideTitle: "Configurações & Integrações", route: "/settings" },
  { slideTitle: "Branding White-label", route: "/admin/branding" },
];

function findChromiumPath(): string | null {
  try {
    const result = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null", { encoding: "utf-8" }).trim();
    return result || null;
  } catch {
    return null;
  }
}

async function loginAndGetToken(baseUrl: string): Promise<string> {
  const email = process.env.SCREENSHOT_ADMIN_EMAIL;
  const password = process.env.SCREENSHOT_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SCREENSHOT_ADMIN_EMAIL and SCREENSHOT_ADMIN_PASSWORD env vars are required");
  }
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

export async function captureScreenshots(): Promise<ScreenshotMap> {
  const screenshots: ScreenshotMap = {};
  const port = process.env.PORT || "5000";
  const baseUrl = `http://localhost:${port}`;

  const chromiumPath = findChromiumPath();
  if (!chromiumPath) {
    console.warn("[screenshots] chromium not found in system, skipping captures");
    return screenshots;
  }

  let puppeteer: typeof import("puppeteer-core");
  try {
    puppeteer = _require("puppeteer-core");
  } catch {
    console.warn("[screenshots] puppeteer-core not available, skipping captures");
    return screenshots;
  }

  let token: string;
  try {
    token = await loginAndGetToken(baseUrl);
  } catch (err) {
    console.warn("[screenshots] login failed, skipping captures:", err);
    return screenshots;
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--single-process",
        "--no-zygote",
      ],
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await page.evaluate((t: string) => {
      localStorage.setItem("token", t);
    }, token);

    for (const { slideTitle, route } of ROUTES_TO_CAPTURE) {
      try {
        await page.goto(`${baseUrl}${route}`, {
          waitUntil: "networkidle2",
          timeout: 12000,
        });
        await new Promise((r) => setTimeout(r, 2000));
        const buf = await page.screenshot({ type: "png", encoding: "base64" });
        screenshots[slideTitle] = buf as string;
        console.log(`[screenshots] captured: ${slideTitle}`);
      } catch (err) {
        console.warn(`[screenshots] failed to capture ${slideTitle}:`, err);
      }
    }

    await page.close();
  } catch (err) {
    console.warn("[screenshots] browser launch failed:", err);
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }

  return screenshots;
}
