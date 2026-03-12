import { log } from "./index";
import { getWhatsAppProvider } from "./services/whatsappProvider";
import { storage } from "./storage";


export type JobType = "send_message" | "send_audio" | "send_flow_audio" | "send_flow_image" | "check_inactivity" | "check_sla";
export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";

interface SendMessagePayload {
  userId: string;
  phone: string;
  message: string;
  conversationId: string;
  channel?: string;
  channelMetadata?: Record<string, unknown>;
}

interface SendAudioPayload {
  userId: string;
  phone: string;
  text: string;
  agentId: string;
  conversationId: string;
}

interface SendFlowAudioPayload {
  userId: string;
  phone: string;
  text: string;
  voice: string;
  conversationId: string;
  channel: string;
  channelMetadata: Record<string, unknown>;
}

interface SendFlowImagePayload {
  userId: string;
  phone: string;
  prompt: string;
  conversationId: string;
  channel: string;
  channelMetadata: Record<string, unknown>;
}

interface CheckInactivityPayload {
  userId: string;
  contactId: string;
  conversationId: string;
  lastMessageAt: number;
  inactivityTimeout: number;
}

interface CheckSlaPayload {
  contactId: string;
  userId: string;
}

export interface Job {
  id: string;
  type: JobType;
  payload: SendMessagePayload | SendAudioPayload | SendFlowAudioPayload | SendFlowImagePayload | CheckInactivityPayload | CheckSlaPayload;
  runAt: number;
  status: JobStatus;
  createdAt: number;
}

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;

  add(job: Omit<Job, "id" | "createdAt" | "status">): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullJob: Job = { ...job, id, createdAt: Date.now(), status: "pending" };
    this.jobs.set(id, fullJob);
    log(`JobQueue: added job ${id} type=${job.type} runAt=${new Date(job.runAt).toISOString()}`, "jobqueue");
    return id;
  }

  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (job && job.status === "pending") {
      job.status = "cancelled";
      log(`JobQueue: cancelled job ${id}`, "jobqueue");
    }
  }

  cancelByContactAndType(contactId: string, type: JobType): void {
    for (const job of this.jobs.values()) {
      if (job.status === "pending" && job.type === type) {
        const p = job.payload as CheckInactivityPayload;
        if (p.contactId === contactId) {
          job.status = "cancelled";
          log(`JobQueue: cancelled ${type} job for contact ${contactId}`, "jobqueue");
        }
      }
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.process(), 5000);
    log("JobQueue: started (5s interval)", "jobqueue");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async process(): Promise<void> {
    const now = Date.now();
    const ready = Array.from(this.jobs.values()).filter(
      (j) => j.status === "pending" && j.runAt <= now
    );

    for (const job of ready) {
      job.status = "running";
      try {
        await this.execute(job);
        job.status = "done";
        log(`JobQueue: job ${job.id} done`, "jobqueue");
      } catch (err) {
        job.status = "failed";
        log(`JobQueue: job ${job.id} failed — ${err instanceof Error ? err.message : String(err)}`, "jobqueue");
      }
    }

    for (const [id, job] of this.jobs.entries()) {
      if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
        this.jobs.delete(id);
      }
    }
  }

  private async execute(job: Job): Promise<void> {
    if (job.type === "send_message") {
      const p = job.payload as SendMessagePayload;
      const channel = p.channel || "whatsapp";

      if (channel === "telegram") {
        try {
          const { sendTelegramMessage } = await import("./services/telegramService");
          const { configService } = await import("./services/configService");
          const botToken = await configService.getSetting("TELEGRAM_BOT_TOKEN");
          if (botToken) {
            await sendTelegramMessage(p.phone, p.message, botToken);
            log(`JobQueue: send_message(telegram) → ${p.phone}`, "jobqueue");
          } else {
            log(`JobQueue: send_message(telegram) — no bot token configured`, "jobqueue");
          }
        } catch (err) {
          log(`JobQueue: send_message(telegram) failed: ${err instanceof Error ? err.message : String(err)}`, "jobqueue");
        }
      } else if (channel === "email") {
        try {
          const { sendEmail } = await import("./services/emailService");
          const { configService } = await import("./services/configService");
          const smtpHost = await configService.getSetting("SMTP_HOST");
          const smtpPort = await configService.getSetting("SMTP_PORT");
          const smtpUser = await configService.getSetting("SMTP_USER");
          const smtpPass = await configService.getSetting("SMTP_PASS");
          if (smtpHost && smtpUser && smtpPass) {
            await sendEmail(p.phone, "Campanha", p.message, {
              smtpHost,
              smtpPort: parseInt(smtpPort || "587"),
              smtpUser,
              smtpPass,
            });
            log(`JobQueue: send_message(email) → ${p.phone}`, "jobqueue");
          } else {
            log(`JobQueue: send_message(email) — SMTP not configured`, "jobqueue");
          }
        } catch (err) {
          log(`JobQueue: send_message(email) failed: ${err instanceof Error ? err.message : String(err)}`, "jobqueue");
        }
      } else {
        const provider = await getWhatsAppProvider(p.userId);
        const result = await provider.sendMessage(p.phone, p.message);
        log(`JobQueue: send_message(whatsapp) → ${p.phone} (${result.messageId})`, "jobqueue");
      }

      if (p.conversationId) {
        await storage.createMessage({
          conversationId: p.conversationId,
          userId: p.userId,
          messageId: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          direction: "outgoing",
          content: p.message,
          timestamp: new Date(),
        });
        await storage.updateConversation(p.conversationId, {
          lastMessage: p.message,
          lastMessageAt: new Date(),
        });
      }
    } else if (job.type === "send_audio") {
      const p = job.payload as SendAudioPayload;
      try {
        const { generateAgentTts } = await import("./services/ttsService");
        const audioBuffer = await generateAgentTts(p.agentId, p.text);
        if (!audioBuffer) {
          log(`JobQueue: send_audio — TTS generation failed for agent ${p.agentId}`, "jobqueue");
          return;
        }

        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const audioPath = path.default.join(os.default.tmpdir(), `tts_${Date.now()}.mp3`);
        fs.default.writeFileSync(audioPath, audioBuffer);

        const provider = await getWhatsAppProvider(p.userId);
        if (provider && provider.sendAudio) {
          await provider.sendAudio(p.phone, audioPath);
          log(`JobQueue: send_audio — delivered audio to ${p.phone} via provider`, "jobqueue");
        } else {
          log(`JobQueue: send_audio — generated ${audioBuffer.length} bytes for ${p.phone} (provider lacks audio support, file: ${audioPath})`, "jobqueue");
        }

        try { fs.default.unlinkSync(audioPath); } catch {}
      } catch (audioErr) {
        log(`JobQueue: send_audio — TTS error: ${audioErr instanceof Error ? audioErr.message : String(audioErr)}`, "jobqueue");
      }
    } else if (job.type === "send_flow_audio") {
      const p = job.payload as SendFlowAudioPayload;
      try {
        const { generateFlowTts } = await import("./services/ttsService");
        const audioBuffer = await generateFlowTts(p.text, p.voice);
        const fs = await import("fs");
        const pathMod = await import("path");
        const os = await import("os");
        const audioPath = pathMod.default.join(os.default.tmpdir(), `flow_tts_${Date.now()}.mp3`);
        fs.default.writeFileSync(audioPath, audioBuffer);

        if (p.channel === "whatsapp") {
          const provider = await getWhatsAppProvider(p.userId);
          if (provider.sendAudio) {
            await provider.sendAudio(p.phone, audioPath);
            log(`JobQueue: send_flow_audio — delivered audio via WhatsApp to ${p.phone}`, "jobqueue");
          } else {
            await provider.sendMessage(p.phone, `🔊 ${p.text}`);
            log(`JobQueue: send_flow_audio — fallback text to ${p.phone}`, "jobqueue");
          }
        } else if (p.channel === "telegram") {
          const botToken = (p.channelMetadata?.botToken as string) || "";
          if (botToken) {
            const { Blob } = await import("buffer");
            const audioData = fs.default.readFileSync(audioPath);
            const formData = new FormData();
            formData.append("chat_id", p.phone);
            formData.append("audio", new Blob([audioData], { type: "audio/mpeg" }), "audio.mp3");
            await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, { method: "POST", body: formData });
            log(`JobQueue: send_flow_audio — delivered audio via Telegram to ${p.phone}`, "jobqueue");
          }
        }
        try { fs.default.unlinkSync(audioPath); } catch {}

        await storage.createMessage({
          conversationId: p.conversationId,
          userId: p.userId,
          messageId: `flow_audio_${Date.now()}`,
          direction: "outgoing",
          content: `🔊 ${p.text}`,
          timestamp: new Date(),
        });
      } catch (err) {
        log(`JobQueue: send_flow_audio error — ${err instanceof Error ? err.message : String(err)}`, "jobqueue");
      }
    } else if (job.type === "send_flow_image") {
      const p = job.payload as SendFlowImagePayload;
      try {
        const OpenAI = (await import("openai")).default;
        const imgOpenai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const imageResponse = await imgOpenai.images.generate({
          model: "dall-e-3",
          prompt: p.prompt.slice(0, 1000),
          n: 1,
          size: "1024x1024",
        });
        const imageUrl = imageResponse.data[0]?.url;
        if (imageUrl) {
          if (p.channel === "whatsapp") {
            const provider = await getWhatsAppProvider(p.userId);
            if (provider.sendImage) {
              await provider.sendImage(p.phone, imageUrl, p.prompt);
              log(`JobQueue: send_flow_image — delivered image via WhatsApp to ${p.phone}`, "jobqueue");
            } else {
              await provider.sendMessage(p.phone, imageUrl);
              log(`JobQueue: send_flow_image — sent image URL to ${p.phone}`, "jobqueue");
            }
          } else if (p.channel === "telegram") {
            const botToken = (p.channelMetadata?.botToken as string) || "";
            if (botToken) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: p.phone, photo: imageUrl, caption: p.prompt }),
              });
              log(`JobQueue: send_flow_image — delivered image via Telegram to ${p.phone}`, "jobqueue");
            }
          }
          await storage.createMessage({
            conversationId: p.conversationId,
            userId: p.userId,
            messageId: `flow_img_${Date.now()}`,
            direction: "outgoing",
            content: `🖼️ ${p.prompt}`,
            timestamp: new Date(),
          });
        }
      } catch (err) {
        log(`JobQueue: send_flow_image error — ${err instanceof Error ? err.message : String(err)}`, "jobqueue");
      }
    } else if (job.type === "check_inactivity") {
      const p = job.payload as CheckInactivityPayload;
      const conversation = await storage.getConversation(p.conversationId);
      if (!conversation) return;
      const lastAt = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
      if (lastAt > p.lastMessageAt) {
        log(`JobQueue: check_inactivity — contact ${p.contactId} replied, skipping`, "jobqueue");
        return;
      }
      log(`JobQueue: check_inactivity — contact ${p.contactId} inactive after ${p.inactivityTimeout}min`, "jobqueue");
    } else if (job.type === "check_sla") {
      const p = job.payload as CheckSlaPayload;
      const contact = await storage.getUnifiedContact(p.contactId);
      if (!contact) return;
      if (contact.queueStatus === "waiting" || contact.queueStatus === "assigned") {
        await storage.markSlaBreached(p.contactId);
        log(`JobQueue: check_sla — SLA BREACHED for contact ${p.contactId} (${contact.nome})`, "jobqueue");
      } else {
        log(`JobQueue: check_sla — contact ${p.contactId} already resolved, skipping`, "jobqueue");
      }
    }
  }
}

export const jobQueue = new JobQueue();
