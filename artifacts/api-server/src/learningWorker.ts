import { storage } from "./storage";
import { jobQueue } from "./jobQueue";
import { log } from "./index";
import { db } from "./db";
import { learningPoints } from "@workspace/db";
import { awardScoreEvent } from "./services/scoreEngine";

async function processLearningTracks(): Promise<void> {
  try {
    const allUsers = await storage.getActiveAgents();
    for (const user of allUsers) {
      try {
        await processLearningForUser(user.id);
      } catch (err) {
        log(`LearningWorker: error processing user ${user.id} — ${err instanceof Error ? err.message : String(err)}`, "learning");
      }
    }
  } catch (err) {
    log(`LearningWorker: top-level error — ${err instanceof Error ? err.message : String(err)}`, "learning");
  }
}

async function processLearningForUser(userId: string): Promise<void> {
  const contacts = await storage.getActiveLearningContacts(userId, 48);
  if (!contacts.length) return;

  for (const contact of contacts) {
    try {
      const stageOrIntent = contact.lastIntent || contact.pipelineStage;
      const tracks = await storage.getLearningTracksByStageOrIntent(userId, stageOrIntent);
      if (!tracks.length) continue;

      const conversationList = await storage.getConversationsByUser(userId);
      const phone = contact.telefone;
      if (!phone) continue;

      const conversation = conversationList.find(
        (c) => c.contactPhone === phone || c.remoteJid?.includes(phone.replace(/\D/g, ""))
      );
      if (!conversation) continue;

      for (const track of tracks) {
        const deliveries = await storage.getLearningDeliveriesForContact(contact.id, track.id);
        const alreadySent = deliveries.some(
          (d) => d.stepOrder === track.stepOrder && (d.status === "sent" || d.status === "pending")
        );
        if (alreadySent) continue;

        const lastContactAt = contact.lastContactAt ? new Date(contact.lastContactAt).getTime() : Date.now();
        const runAt = lastContactAt + track.delayHours * 60 * 60 * 1000;

        if (runAt > Date.now() + 7 * 24 * 60 * 60 * 1000) continue;

        const delivery = await storage.createLearningDelivery({
          contactId: contact.id,
          trackId: track.id,
          stepOrder: track.stepOrder,
          status: "pending",
        });

        jobQueue.add({
          type: "send_message",
          payload: {
            userId,
            phone,
            message: track.content,
            conversationId: conversation.id,
          },
          runAt: Math.max(runAt, Date.now() + 5000),
        });

        await storage.updateLearningDelivery(delivery.id, { status: "sent", sentAt: new Date() });

        // Awards de "delivered" (consumo) — só vale se o contato tiver workspace
        if (contact.workspaceId) {
          try {
            await db.insert(learningPoints).values({
              workspaceId: contact.workspaceId,
              contactId: contact.id,
              trackId: track.id,
              deliveryId: delivery.id,
              points: 2,
              reason: "delivered",
              durationSeconds: 0,
            });
            await awardScoreEvent({
              workspaceId: contact.workspaceId,
              contactId: contact.id,
              eventType: "learning_delivered",
              source: "microlearning",
              refId: track.id,
            });
          } catch (e) {
            log(`LearningWorker: failed to award learning_delivered — ${e instanceof Error ? e.message : String(e)}`, "learning");
          }
        }

        log(`LearningWorker: scheduled track ${track.id} step ${track.stepOrder} for contact ${contact.id}`, "learning");
      }
    } catch (err) {
      log(`LearningWorker: error for contact ${contact.id} — ${err instanceof Error ? err.message : String(err)}`, "learning");
    }
  }
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startLearningWorker(): void {
  if (workerTimer) return;
  workerTimer = setInterval(processLearningTracks, 5 * 60 * 1000);
  log("LearningWorker: started (5min interval)", "learning");
}

export function stopLearningWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
