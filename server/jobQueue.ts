import { log } from "./index";
import { getWhatsAppProvider } from "./services/whatsappProvider";
import { storage } from "./storage";


export type JobType = "send_message" | "send_audio" | "check_inactivity" | "check_sla";
export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";

interface SendMessagePayload {
  userId: string;
  phone: string;
  message: string;
  conversationId: string;
}

interface SendAudioPayload {
  userId: string;
  phone: string;
  text: string;
  agentId: string;
  conversationId: string;
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
  payload: SendMessagePayload | SendAudioPayload | CheckInactivityPayload | CheckSlaPayload;
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
      const provider = await getWhatsAppProvider(p.userId);
      const result = await provider.sendMessage(p.phone, p.message);
      await storage.createMessage({
        conversationId: p.conversationId,
        userId: p.userId,
        messageId: `auto_${result.messageId}`,
        direction: "outgoing",
        content: p.message,
        timestamp: new Date(),
      });
      await storage.updateConversation(p.conversationId, {
        lastMessage: p.message,
        lastMessageAt: new Date(),
      });
      log(`JobQueue: send_message → ${p.phone} (${result.messageId})`, "jobqueue");
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
        if (provider && typeof (provider as any).sendAudio === "function") {
          await (provider as any).sendAudio(p.phone, audioPath);
          log(`JobQueue: send_audio — delivered audio to ${p.phone} via provider`, "jobqueue");
        } else {
          log(`JobQueue: send_audio — generated ${audioBuffer.length} bytes for ${p.phone} (provider lacks audio support, file: ${audioPath})`, "jobqueue");
        }

        try { fs.default.unlinkSync(audioPath); } catch {}
      } catch (audioErr) {
        log(`JobQueue: send_audio — TTS error: ${audioErr instanceof Error ? audioErr.message : String(audioErr)}`, "jobqueue");
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
