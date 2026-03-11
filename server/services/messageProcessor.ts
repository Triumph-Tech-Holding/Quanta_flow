import { storage } from "../storage";
import { emitMessageReceived } from "../socket";
import { processMessageIntent } from "./intentService";
import { log } from "../index";
import { jobQueue } from "../jobQueue";

export interface IncomingMessageParams {
  userId: string;
  phone: string;
  contactName: string;
  messageContent: string;
  messageId?: string;
  provider?: string;
}

export async function processIncomingWhatsAppMessage(params: IncomingMessageParams): Promise<void> {
  const { userId, phone, contactName, messageContent, messageId, provider = "zapi" } = params;

  const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  const msgId = messageId || `${provider}_${Date.now()}`;

  let conversation = await storage.getConversationByRemoteJid(userId, remoteJid);

  if (!conversation) {
    conversation = await storage.createConversation({
      userId,
      remoteJid,
      contactName,
      contactPhone: phone,
      lastMessage: messageContent,
      lastMessageAt: new Date(),
      unreadCount: "1",
    });
  } else {
    const currentUnread = parseInt(conversation.unreadCount || "0");
    await storage.updateConversation(conversation.id, {
      lastMessage: messageContent,
      lastMessageAt: new Date(),
      unreadCount: String(currentUnread + 1),
      contactName: contactName || conversation.contactName,
    });
  }

  const newMessage = await storage.createMessage({
    conversationId: conversation.id,
    userId,
    messageId: msgId,
    direction: "incoming",
    content: messageContent,
    timestamp: new Date(),
  });

  log(`[${provider}] Message saved: ${newMessage.id} from ${phone}`, "msg-processor");

  emitMessageReceived(userId, {
    message: newMessage,
    conversation: await storage.getConversation(conversation.id),
  });

  const skipIntentPatterns = ["[Mensagem]", "[Imagem]", "[Sticker]", "[Contato]", "[Localização]"];
  if (messageContent && !skipIntentPatterns.includes(messageContent)) {
    try {
      let crmContact = await storage.findUnifiedContactByIdentifier(userId, "whatsapp", phone);
      if (!crmContact) {
        crmContact = await storage.findUnifiedContactByPhoneOrEmail(userId, phone);
      }

      const isNewContact = !crmContact;

      if (!crmContact) {
        crmContact = await storage.createUnifiedContact({
          userId,
          nome: contactName || phone,
          telefone: phone,
          pipelineStage: "novo",
          temperature: "frio",
          lastIntent: "indefinido",
        });
        await storage.createContactIdentifier({
          unifiedContactId: crmContact.id,
          channelType: "whatsapp",
          identifier: phone,
          displayName: contactName || phone,
        });
        log(`CRM: Auto-created contact ${crmContact.id} for ${phone}`, "msg-processor");
      }

      if (isNewContact) {
        await storage.autoAssignContact(userId, crmContact.id);
      }

      // Cancela jobs de inatividade pendentes para este contato (nova mensagem reinicia o timer)
      jobQueue.cancelByContactAndType(crmContact.id, "check_inactivity");

      const intentResult = await processMessageIntent(messageContent, crmContact.id, userId, storage);

      if (intentResult) {
        await storage.createOmnichannelMessage({
          unifiedContactId: crmContact.id,
          channelType: "whatsapp",
          direction: "incoming",
          content: messageContent,
          externalMessageId: msgId,
          detectedIntent: intentResult.intent,
          intentConfidence: String(intentResult.confidence),
          userId,
          timestamp: new Date(),
        });
        log(`CRM Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(0)}%) - ${intentResult.reasoning}`, "msg-processor");
      }

      // Automação com delay e steps
      try {
        const automationFlow = await storage.findMatchingAutomationFlow(userId, messageContent);
        if (automationFlow && automationFlow.isActive) {
          const delay = (automationFlow.responseDelay ?? 10) * 1000;
          const now = Date.now();

          const steps = automationFlow.steps as Array<{ order: number; message: string; delaySeconds: number }> | null;

          if (steps && steps.length > 0) {
            // Fluxo multi-etapa: agendar cada step com seu delay
            const sorted = [...steps].sort((a, b) => a.order - b.order);
            for (const step of sorted) {
              const runAt = now + (step.delaySeconds * 1000);
              jobQueue.add({
                type: "send_message",
                payload: {
                  userId,
                  phone,
                  message: step.message,
                  conversationId: conversation.id,
                },
                runAt,
              });
            }
            log(`Automation: scheduled ${sorted.length} steps for ${phone}`, "msg-processor");
          } else {
            // Fluxo simples: usar responseTemplate com responseDelay
            jobQueue.add({
              type: "send_message",
              payload: {
                userId,
                phone,
                message: automationFlow.responseTemplate,
                conversationId: conversation.id,
              },
              runAt: now + delay,
            });
            log(`Automation: scheduled response to ${phone} in ${delay / 1000}s`, "msg-processor");
          }

          // Agendar job de inatividade após o envio
          if (automationFlow.inactivityTimeout && automationFlow.inactivityTimeout > 0) {
            const inactivityMs = automationFlow.inactivityTimeout * 60 * 1000;
            jobQueue.add({
              type: "check_inactivity",
              payload: {
                userId,
                contactId: crmContact.id,
                conversationId: conversation.id,
                lastMessageAt: now,
                inactivityTimeout: automationFlow.inactivityTimeout,
              },
              runAt: now + delay + inactivityMs,
            });
          }
        }
      } catch (automationErr) {
        console.error("Automation flow processing error (non-blocking):", automationErr);
      }
    } catch (err) {
      console.error("CRM/Intent processing error (non-blocking):", err);
    }
  }
}
