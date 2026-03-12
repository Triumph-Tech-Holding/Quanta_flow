import { storage } from "./storage";
import { db } from "./db";
import { campaigns as campaignsTable, campaignDeliveries } from "@shared/schema";
import { eq, sql as sqlExpr, and, inArray } from "drizzle-orm";
import { jobQueue } from "./jobQueue";
import { log } from "./index";

async function processCampaigns() {
  try {
    const allCampaigns = await db.select().from(campaignsTable)
      .where(eq(campaignsTable.status, "running"));

    for (const campaign of allCampaigns) {
      if (campaign.allowedHours) {
        const hours = campaign.allowedHours as { days: number[]; startHour: number; endHour: number };
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        if (!hours.days.includes(currentDay) || currentHour < hours.startHour || currentHour >= hours.endHour) {
          continue;
        }
      }

      const rateLimit = campaign.rateLimit || 100;
      const pending = await storage.getPendingDeliveries(campaign.id, rateLimit);

      if (pending.length === 0) {
        const remaining = await db.select().from(campaignDeliveries)
          .where(and(
            eq(campaignDeliveries.campaignId, campaign.id),
            eq(campaignDeliveries.status, "pending"),
          ));
        if (remaining.length === 0) {
          await db.update(campaignsTable)
            .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
            .where(eq(campaignsTable.id, campaign.id));
        }
        continue;
      }

      const messages = (campaign.messages as any[]) || [];
      for (const delivery of pending) {
        const contact = await storage.getUnifiedContact(delivery.contactId);
        if (!contact || !contact.telefone) {
          await storage.updateCampaignDelivery(delivery.id, {
            status: "failed",
            failedAt: new Date(),
            errorMessage: "Contato sem telefone",
          });
          await db.update(campaignsTable)
            .set({ failedCount: sqlExpr`COALESCE(${campaignsTable.failedCount}, 0) + 1` })
            .where(eq(campaignsTable.id, campaign.id));
          continue;
        }

        const msgIndex = delivery.messageIndex || 0;
        let content = "";

        if (campaign.contentType === "single" || campaign.contentType === "sequence") {
          const msg = messages[msgIndex];
          if (!msg) {
            await storage.updateCampaignDelivery(delivery.id, {
              status: "failed",
              failedAt: new Date(),
              errorMessage: "Mensagem não encontrada no índice",
            });
            await db.update(campaignsTable)
              .set({ failedCount: sqlExpr`COALESCE(${campaignsTable.failedCount}, 0) + 1` })
              .where(eq(campaignsTable.id, campaign.id));
            continue;
          }
          content = msg.content
            .replace(/\{nome\}/g, contact.nome || "")
            .replace(/\{telefone\}/g, contact.telefone || "")
            .replace(/\{email\}/g, contact.email || "");
        } else if (campaign.contentType === "agent" && campaign.agentId) {
          await storage.updateCampaignDelivery(delivery.id, {
            status: "sent",
            sentAt: new Date(),
          });
          await db.update(campaignsTable)
            .set({ sentCount: sqlExpr`COALESCE(${campaignsTable.sentCount}, 0) + 1` })
            .where(eq(campaignsTable.id, campaign.id));
          continue;
        }

        if (content) {
          const conversations = await storage.getConversationsByUser(campaign.userId);
          const conv = conversations.find(c => c.remoteJid?.includes(contact.telefone!.replace(/\D/g, "")));

          jobQueue.add({
            type: "send_message",
            payload: {
              userId: campaign.userId,
              phone: contact.telefone,
              message: content,
              conversationId: conv?.id || "",
              channel: delivery.channel || "whatsapp",
            },
            runAt: Date.now(),
          });

          if (campaign.contentType === "sequence" && msgIndex < messages.length - 1) {
            const nextDelay = messages[msgIndex + 1]?.delayMinutes || 1;
            await storage.updateCampaignDelivery(delivery.id, {
              status: "sent",
              sentAt: new Date(),
              messageIndex: msgIndex + 1,
            });
            setTimeout(async () => {
              try {
                const current = await db.select().from(campaignDeliveries)
                  .where(eq(campaignDeliveries.id, delivery.id)).limit(1);
                if (current[0] && !["replied", "converted", "failed"].includes(current[0].status)) {
                  await storage.updateCampaignDelivery(delivery.id, { status: "pending" });
                }
              } catch (e) {
                console.error("[CampaignWorker] Error re-queuing sequence delivery:", e);
              }
            }, nextDelay * 60000);
          } else {
            await storage.updateCampaignDelivery(delivery.id, {
              status: "sent",
              sentAt: new Date(),
            });
          }

          await db.update(campaignsTable)
            .set({ sentCount: sqlExpr`COALESCE(${campaignsTable.sentCount}, 0) + 1` })
            .where(eq(campaignsTable.id, campaign.id));
        }
      }
    }
  } catch (err) {
    console.error("[CampaignWorker] Error processing campaigns:", err);
  }
}

let campaignInterval: NodeJS.Timeout | null = null;

export function startCampaignWorker() {
  if (campaignInterval) return;
  log("Campaign worker started (every 60s)", "campaign");
  campaignInterval = setInterval(processCampaigns, 60000);
  setTimeout(processCampaigns, 5000);
}
