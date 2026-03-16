import { storage } from "../storage";
import { log } from "../index";
import { processIncomingWhatsAppMessage } from "./messageProcessor";
import { emitInstanceConnected } from "../socket";
import { configService } from "./configService";
import fs from "fs";
import path from "path";

export interface SendMessageResult {
  messageId: string;
}

export interface ProviderStatus {
  connected: boolean;
  provider: "zapi" | "baileys" | "evolution" | "meta" | "none";
  qrCode?: string | null;
  phoneNumber?: string | null;
}

export interface IWhatsAppProvider {
  sendMessage(phone: string, text: string): Promise<SendMessageResult>;
  sendAudio?(phone: string, audioPath: string): Promise<SendMessageResult>;
  sendImage?(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult>;
  getStatus(): Promise<ProviderStatus>;
  connect(config?: Record<string, string>): Promise<void>;
  disconnect(): Promise<void>;
  getQRCode(): string | null;
}

// ─── Z-API Provider ──────────────────────────────────────────────────────────

export class ZApiProvider implements IWhatsAppProvider {
  constructor(
    private baseUrl: string,
    private clientToken: string,
    private userId: string,
  ) {}

  async sendMessage(phone: string, text: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const sendUrl = `${this.baseUrl}/send-text`;

    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": this.clientToken,
      },
      body: JSON.stringify({ phone: cleanPhone, message: text }),
    });

    if (!response.ok) {
      throw new Error(`Z-API send error: ${response.status}`);
    }

    const result = await response.json() as { messageId?: string };
    return { messageId: result.messageId || `zapi_${Date.now()}` };
  }

  async sendAudio(phone: string, audioPath: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const fs = await import("fs");
    const audioBuffer = fs.default.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString("base64");
    const sendUrl = `${this.baseUrl}/send-audio`;
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": this.clientToken,
      },
      body: JSON.stringify({ phone: cleanPhone, audio: `data:audio/mpeg;base64,${base64Audio}` }),
    });
    if (!response.ok) {
      throw new Error(`Z-API send-audio error: ${response.status}`);
    }
    const result = await response.json() as { messageId?: string };
    return { messageId: result.messageId || `zapi_audio_${Date.now()}` };
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const sendUrl = `${this.baseUrl}/send-image`;
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": this.clientToken,
      },
      body: JSON.stringify({ phone: cleanPhone, image: imageUrl, caption: caption || "" }),
    });
    if (!response.ok) {
      throw new Error(`Z-API send-image error: ${response.status}`);
    }
    const result = await response.json() as { messageId?: string };
    return { messageId: result.messageId || `zapi_img_${Date.now()}` };
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const statusUrl = `${this.baseUrl}/status`;
      const response = await fetch(statusUrl, {
        headers: { "Client-Token": this.clientToken },
      });
      if (!response.ok) return { connected: false, provider: "zapi" };
      const data = await response.json() as { connected?: boolean; phone?: string };
      return {
        connected: !!data.connected,
        provider: "zapi",
        phoneNumber: data.phone || null,
      };
    } catch {
      return { connected: false, provider: "zapi" };
    }
  }

  async connect(): Promise<void> {
  }

  async disconnect(): Promise<void> {
    await storage.updateEvolutionConfig(this.userId, { status: "disconnected" });
  }

  getQRCode(): null {
    return null;
  }
}

// ─── Evolution API Provider ───────────────────────────────────────────────────

export class EvolutionProvider implements IWhatsAppProvider {
  constructor(
    private evolutionUrl: string,
    private globalToken: string,
    private instanceName: string,
    private userId: string,
  ) {}

  async sendMessage(phone: string, text: string): Promise<SendMessageResult> {
    const remoteJid = phone.includes("@") ? phone : `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    const response = await fetch(`${this.evolutionUrl}/message/sendText/${this.instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": this.globalToken },
      body: JSON.stringify({ number: remoteJid, text }),
    });
    if (!response.ok) throw new Error(`Evolution send error: ${response.status}`);
    const result = await response.json() as { key?: { id?: string } };
    return { messageId: result.key?.id || `evo_${Date.now()}` };
  }

  async getStatus(): Promise<ProviderStatus> {
    return { connected: false, provider: "evolution" };
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  getQRCode(): null { return null; }
}

// ─── Baileys Provider ─────────────────────────────────────────────────────────

type BaileysSocket = {
  sendMessage: (jid: string, content: { text: string }) => Promise<{ key: { id?: string } }>;
  logout: () => Promise<void>;
  ev: {
    on: (event: string, handler: (arg: unknown) => void) => void;
    off: (event: string, handler: (arg: unknown) => void) => void;
  };
  user?: { id: string; name?: string };
};

interface BaileysInstance {
  socket: BaileysSocket | null;
  qrCode: string | null;
  connected: boolean;
  userId: string;
  phoneNumber: string | null;
}

const baileysInstances = new Map<string, BaileysInstance>();

export class BaileysProvider implements IWhatsAppProvider {
  private instance: BaileysInstance;

  constructor(private userId: string) {
    if (!baileysInstances.has(userId)) {
      baileysInstances.set(userId, {
        socket: null,
        qrCode: null,
        connected: false,
        userId,
        phoneNumber: null,
      });
    }
    this.instance = baileysInstances.get(userId)!;
  }

  async connect(): Promise<void> {
    if (this.instance.connected && this.instance.socket) {
      log("Baileys already connected", "baileys");
      return;
    }

    try {
      const authDir = path.join(process.cwd(), ".baileys_auth", this.userId);
      fs.mkdirSync(authDir, { recursive: true });

      const baileys = await import("@whiskeysockets/baileys");
      const makeWASocket = baileys.default;
      const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: (m: unknown) => log(`Baileys: ${m}`, "baileys"), error: (m: unknown) => log(`Baileys error: ${m}`, "baileys"), fatal: (m: unknown) => log(`Baileys fatal: ${m}`, "baileys"), child: () => ({ level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({} as unknown) }) },
      }) as BaileysSocket;

      this.instance.socket = sock;

      sock.ev.on("connection.update", async (update: unknown) => {
        const u = update as { connection?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } }; qr?: string };
        const { connection, lastDisconnect, qr } = u;

        if (qr) {
          log("Baileys QR code generated", "baileys");
          const QRCode = await import("qrcode");
          this.instance.qrCode = await QRCode.toDataURL(qr);
          this.instance.connected = false;
        }

        if (connection === "open") {
          log("Baileys connected!", "baileys");
          this.instance.connected = true;
          this.instance.qrCode = null;
          const rawId = sock.user?.id || "";
          const phone = rawId.split(":")[0].split("@")[0];
          this.instance.phoneNumber = phone || null;
          log(`Baileys phone number: ${this.instance.phoneNumber}`, "baileys");
          await storage.updateEvolutionConfig(this.userId, {
            status: "connected",
            activeProvider: "baileys",
          });
          emitInstanceConnected(this.userId, { status: "connected", provider: "baileys", phoneNumber: this.instance.phoneNumber });
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const { Boom } = await import("@hapi/boom");
          const shouldReconnect = statusCode !== (DisconnectReason as Record<string, number>).loggedOut;
          log(`Baileys connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`, "baileys");
          this.instance.connected = false;
          await storage.updateEvolutionConfig(this.userId, { status: "disconnected" });
          if (shouldReconnect) {
            setTimeout(() => this.connect(), 5000);
          }
        }
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messages.upsert", async (payload: unknown) => {
        const { messages: msgs, type } = payload as { messages: unknown[]; type: string };
        if (type !== "notify") return;

        for (const msg of msgs) {
          const m = msg as {
            key: { fromMe?: boolean; remoteJid?: string; id?: string };
            message?: { conversation?: string; extendedTextMessage?: { text?: string } };
            pushName?: string;
          };

          if (m.key.fromMe) continue;
          const jid = m.key.remoteJid || "";
          if (jid.endsWith("@g.us")) continue;

          const phone = jid.replace("@s.whatsapp.net", "");
          const contactName = m.pushName || phone;
          const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "[Mensagem]";
          const msgId = m.key.id;

          await processIncomingWhatsAppMessage({
            userId: this.userId,
            phone,
            contactName,
            messageContent: text,
            messageId: msgId,
            provider: "baileys",
          });
        }
      });

      log("Baileys socket initialized — waiting for QR scan", "baileys");
    } catch (err) {
      log(`Baileys connect error: ${err}`, "baileys");
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.instance.socket) {
      try {
        await this.instance.socket.logout();
      } catch {
        // ignore
      }
      this.instance.socket = null;
    }
    this.instance.connected = false;
    this.instance.qrCode = null;
    await storage.updateEvolutionConfig(this.userId, {
      status: "disconnected",
      activeProvider: "none",
    });
    const authDir = path.join(process.cwd(), ".baileys_auth", this.userId);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    log("Baileys disconnected and session cleared", "baileys");
  }

  async sendMessage(phone: string, text: string): Promise<SendMessageResult> {
    if (!this.instance.socket || !this.instance.connected) {
      throw new Error("Baileys não conectado");
    }
    const jid = phone.includes("@") ? phone : `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    const result = await this.instance.socket.sendMessage(jid, { text });
    return { messageId: result?.key?.id || `baileys_${Date.now()}` };
  }

  async sendAudio(phone: string, audioPath: string): Promise<SendMessageResult> {
    if (!this.instance.socket || !this.instance.connected) {
      throw new Error("Baileys não conectado");
    }
    const jid = phone.includes("@") ? phone : `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    const audioBuffer = fs.readFileSync(audioPath);
    const result = await this.instance.socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: "audio/mpeg",
      ptt: true,
    });
    return { messageId: result?.key?.id || `baileys_audio_${Date.now()}` };
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
    if (!this.instance.socket || !this.instance.connected) {
      throw new Error("Baileys não conectado");
    }
    const jid = phone.includes("@") ? phone : `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    const result = await this.instance.socket.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || "",
    });
    return { messageId: result?.key?.id || `baileys_img_${Date.now()}` };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      connected: this.instance.connected,
      provider: "baileys",
      qrCode: this.instance.qrCode,
      phoneNumber: this.instance.phoneNumber,
    };
  }

  getQRCode(): string | null {
    return this.instance.qrCode;
  }

  isConnected(): boolean {
    return this.instance.connected;
  }
}

// ─── Meta (Cloud API) Provider ───────────────────────────────────────────────

export class MetaProvider implements IWhatsAppProvider {
  private static readonly GRAPH_URL = "https://graph.facebook.com/v19.0";

  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private userId: string,
  ) {}

  async sendMessage(phone: string, text: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const response = await fetch(
      `${MetaProvider.GRAPH_URL}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: text },
        }),
      },
    );
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Meta Cloud API send error: ${response.status} — ${errBody}`);
    }
    const result = await response.json() as { messages?: { id: string }[] };
    return { messageId: result.messages?.[0]?.id || `meta_${Date.now()}` };
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const response = await fetch(
      `${MetaProvider.GRAPH_URL}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "image",
          image: { link: imageUrl, caption: caption || "" },
        }),
      },
    );
    if (!response.ok) throw new Error(`Meta send-image error: ${response.status}`);
    const result = await response.json() as { messages?: { id: string }[] };
    return { messageId: result.messages?.[0]?.id || `meta_img_${Date.now()}` };
  }

  async sendAudio(phone: string, audioPath: string): Promise<SendMessageResult> {
    const cleanPhone = phone.replace(/\D/g, "");
    const fsModule = await import("fs");
    const filename = audioPath.split("/").pop() || "audio.ogg";
    const audioBuffer = fsModule.default.readFileSync(audioPath);
    const blob = new Blob([audioBuffer], { type: "audio/ogg" });
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("file", blob, filename);
    const uploadRes = await fetch(
      `${MetaProvider.GRAPH_URL}/${this.phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: formData,
      },
    );
    if (!uploadRes.ok) throw new Error(`Meta media upload error: ${uploadRes.status}`);
    const uploaded = await uploadRes.json() as { id: string };
    const response = await fetch(
      `${MetaProvider.GRAPH_URL}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "audio",
          audio: { id: uploaded.id },
        }),
      },
    );
    if (!response.ok) throw new Error(`Meta send-audio error: ${response.status}`);
    const result = await response.json() as { messages?: { id: string }[] };
    return { messageId: result.messages?.[0]?.id || `meta_audio_${Date.now()}` };
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.phoneNumberId || !this.accessToken) {
      return { connected: false, provider: "meta" };
    }
    try {
      const res = await fetch(
        `${MetaProvider.GRAPH_URL}/${this.phoneNumberId}?fields=display_phone_number`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (!res.ok) return { connected: false, provider: "meta" };
      const data = await res.json() as { display_phone_number?: string };
      return {
        connected: true,
        provider: "meta",
        phoneNumber: data.display_phone_number || null,
      };
    } catch {
      return { connected: false, provider: "meta" };
    }
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {
    await storage.updateEvolutionConfig(this.userId, { status: "disconnected" });
  }

  getQRCode(): null { return null; }
}

// ─── Provider Router ──────────────────────────────────────────────────────────

export async function getWhatsAppProvider(userId: string): Promise<IWhatsAppProvider> {
  const config = await storage.getEvolutionConfig(userId);
  if (!config) throw new Error("Configuração WhatsApp não encontrada");

  const provider = config.activeProvider || "zapi";

  if (provider === "baileys") {
    return new BaileysProvider(userId);
  }

  if (provider === "meta") {
    const phoneNumberId = await configService.getSetting("meta_phone_number_id") || "";
    const accessToken = await configService.getSetting("meta_access_token") || "";
    return new MetaProvider(phoneNumberId, accessToken, userId);
  }

  if (provider === "zapi" && config.evolutionUrl.includes("z-api.io")) {
    return new ZApiProvider(config.evolutionUrl, config.globalToken, userId);
  }

  return new EvolutionProvider(config.evolutionUrl, config.globalToken, config.instanceName, userId);
}

export function getBaileysInstance(userId: string): BaileysInstance | undefined {
  return baileysInstances.get(userId);
}
