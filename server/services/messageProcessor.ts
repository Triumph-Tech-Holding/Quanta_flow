import { storage } from "../storage";
import { emitMessageReceived } from "../socket";
import { processMessageIntent } from "./intentService";
import { log } from "../index";
import { jobQueue } from "../jobQueue";
import { dispatchEvent } from "./webhookDispatcher";
import { sendTelegramMessage } from "./telegramService";
import { sendInstagramMessage } from "./instagramService";
import { sendEmail } from "./emailService";
import { db } from "../db";
import { emailConfigs } from "../../shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

export type MessageChannel = "whatsapp" | "telegram" | "instagram" | "email";

export interface IncomingMessageParams {
  userId: string;
  phone: string;
  contactName: string;
  messageContent: string;
  messageId?: string;
  provider?: string;
  channel?: MessageChannel;
  channelMetadata?: Record<string, unknown>;
}

async function sendChannelMessage(
  channel: MessageChannel,
  phone: string,
  message: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (channel === "whatsapp") {
    const { sendWhatsAppMessage } = await import("./whatsappProvider");
    await sendWhatsAppMessage(userId, phone, message);
  } else if (channel === "telegram") {
    const botToken = (metadata?.botToken as string) || "";
    if (botToken) await sendTelegramMessage(phone, message, botToken);
  } else if (channel === "instagram") {
    const accessToken = (metadata?.accessToken as string) || "";
    if (accessToken) await sendInstagramMessage(phone, message, accessToken);
  } else if (channel === "email") {
    const [emailCfg] = await db
      .select()
      .from(emailConfigs)
      .where(eq(emailConfigs.userId, userId))
      .limit(1);
    if (emailCfg) {
      await sendEmail(phone, "Resposta automática", message, {
        smtpHost: emailCfg.smtpHost,
        smtpPort: emailCfg.smtpPort,
        smtpUser: emailCfg.smtpUser,
        smtpPass: emailCfg.smtpPass,
      });
    }
  }
}

export async function processIncomingMessage(params: IncomingMessageParams): Promise<void> {
  const {
    userId,
    phone,
    contactName,
    messageContent,
    messageId,
    provider = "zapi",
    channel = "whatsapp",
    channelMetadata = {},
  } = params;

  const remoteJid =
    channel === "whatsapp" && !phone.includes("@")
      ? `${phone}@s.whatsapp.net`
      : phone;
  const msgId = messageId || `${channel}_${Date.now()}`;

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
      channel,
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

  log(`[${channel}/${provider}] Message saved: ${newMessage.id} from ${phone}`, "msg-processor");

  emitMessageReceived(userId, {
    message: newMessage,
    conversation: await storage.getConversation(conversation.id),
  });

  const skipIntentPatterns = ["[Mensagem]", "[Imagem]", "[Sticker]", "[Contato]", "[Localização]"];
  if (messageContent && !skipIntentPatterns.includes(messageContent)) {
    try {
      let crmContact = await storage.findUnifiedContactByIdentifier(userId, channel, phone);
      if (!crmContact) {
        crmContact = await storage.findUnifiedContactByPhoneOrEmail(userId, phone);
      }

      const isNewContact = !crmContact;

      if (!crmContact) {
        crmContact = await storage.createUnifiedContact({
          userId,
          nome: contactName || phone,
          telefone: channel !== "email" ? phone : undefined,
          email: channel === "email" ? phone : undefined,
          pipelineStage: "novo",
          temperature: "frio",
          lastIntent: "indefinido",
        });
        await storage.createContactIdentifier({
          unifiedContactId: crmContact.id,
          channelType: channel,
          identifier: phone,
          displayName: contactName || phone,
        });
        log(`CRM: Auto-created contact ${crmContact.id} for ${phone} [${channel}]`, "msg-processor");

        // Dispatch lead.created event
        dispatchEvent("lead.created", crmContact, userId).catch(() => {});
      }

      if (isNewContact) {
        await storage.autoAssignContact(userId, crmContact.id);
      }

      jobQueue.cancelByContactAndType(crmContact.id, "check_inactivity");

      const intentResult = await processMessageIntent(messageContent, crmContact.id, userId, storage);

      if (intentResult) {
        await storage.createOmnichannelMessage({
          unifiedContactId: crmContact.id,
          channelType: channel,
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

      // === AUTOMAÇÃO ===
      try {
        let automationFlow = crmContact.activeFlowId
          ? await storage.getAutomationFlow(crmContact.activeFlowId)
          : null;

        if (!automationFlow || !automationFlow.isActive) {
          automationFlow = await storage.findMatchingAutomationFlow(userId, messageContent);
        }

        if (automationFlow && automationFlow.isActive) {
          const now = Date.now();
          const msgLower = messageContent.toLowerCase();

          // Verificar saídas condicionais
          const conditionalExits = automationFlow.conditionalExits as Array<{
            condition: string; label: string; targetFlowId: string; triggerKeywords: string[];
          }> | null;

          if (conditionalExits && conditionalExits.length > 0) {
            for (const exit of conditionalExits) {
              const matched = exit.triggerKeywords.some((kw) =>
                msgLower.includes(kw.toLowerCase())
              );
              if (matched) {
                const targetFlow = await storage.getAutomationFlow(exit.targetFlowId);
                if (targetFlow && targetFlow.isActive) {
                  await storage.updateUnifiedContact(crmContact.id, { activeFlowId: targetFlow.id });
                  crmContact = { ...crmContact, activeFlowId: targetFlow.id };
                  log(`Automation: conditional exit "${exit.label}" → flow ${targetFlow.id} for ${phone}`, "msg-processor");

                  if (targetFlow.initialMessage) {
                    const exitDelay = (targetFlow.responseDelay ?? 10) * 1000;
                    jobQueue.add({
                      type: "send_message",
                      payload: { userId, phone, message: targetFlow.initialMessage, conversationId: conversation.id, channel, channelMetadata },
                      runAt: now + exitDelay,
                    });
                  }
                  automationFlow = targetFlow;
                }
                break;
              }
            }
          }

          if (!crmContact.activeFlowId && automationFlow) {
            await storage.updateUnifiedContact(crmContact.id, { activeFlowId: automationFlow.id });
          }

          const delay = (automationFlow.responseDelay ?? 10) * 1000;

          // Verificar interruptCondition → entrar na fila
          if (automationFlow.interruptCondition) {
            const interruptLower = automationFlow.interruptCondition.toLowerCase();
            if (
              msgLower.includes(interruptLower) ||
              (intentResult && intentResult.intent === interruptLower)
            ) {
              const brandingCfg = await storage.getBrandingConfig(userId);
              const slaMinutes = brandingCfg?.defaultSlaMinutes ?? 60;
              const updated = await storage.enterQueue(crmContact.id, slaMinutes);
              if (updated?.slaDeadline) {
                const slaRunAt = new Date(updated.slaDeadline).getTime();
                jobQueue.add({
                  type: "check_sla",
                  payload: { contactId: crmContact.id, userId },
                  runAt: slaRunAt,
                });
              }
              dispatchEvent("flow.interrupt", { contact: crmContact, flow: automationFlow }, userId).catch(() => {});
              log(`Automation: contact ${crmContact.id} entered queue (interruptCondition matched)`, "msg-processor");
              return;
            }
          }

          // Verificar successCondition → resolver
          if (automationFlow.successCondition) {
            const successLower = automationFlow.successCondition.toLowerCase();
            if (msgLower.includes(successLower)) {
              await storage.resolveContact(crmContact.id, userId);
              await storage.updateUnifiedContact(crmContact.id, { activeFlowId: null });
              dispatchEvent("flow.success", { contact: crmContact, flow: automationFlow }, userId).catch(() => {});
              log(`Automation: contact ${crmContact.id} resolved (successCondition matched)`, "msg-processor");
              return;
            }
          }

          const steps = automationFlow.steps as Array<{ order: number; message: string; delaySeconds: number }> | null;
          const flowAgentId = automationFlow.agentId;

          if (flowAgentId) {
            try {
              const aiAgent = await storage.getAiAgent(flowAgentId);
              if (aiAgent && aiAgent.isActive) {
                const agentOpenai = new OpenAI({
                  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
                  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
                });
                const agentResponse = await agentOpenai.chat.completions.create({
                  model: aiAgent.model || "gpt-4o-mini",
                  messages: [
                    { role: "system", content: aiAgent.systemPrompt },
                    { role: "user", content: messageContent },
                  ],
                  temperature: aiAgent.temperature ?? 0.7,
                  max_tokens: aiAgent.maxTokens ?? 500,
                });
                const agentReply = agentResponse.choices[0]?.message?.content || automationFlow.responseTemplate;

                const escRules = aiAgent.escalationRules as { keywords: string[]; message: string } | null;
                if (escRules && escRules.keywords && escRules.keywords.length > 0) {
                  const msgLowerEsc = messageContent.toLowerCase();
                  const escalationTriggered = escRules.keywords.some((kw) => msgLowerEsc.includes(kw.toLowerCase()));
                  if (escalationTriggered && crmContact) {
                    const { generateEscalationSummary } = await import("./ttsService");
                    const summary = await generateEscalationSummary(messageContent, aiAgent.name);
                    const escalationMsg = escRules.message || "Transferindo para um atendente humano...";
                    const fullEscalationMsg = summary
                      ? `${escalationMsg}\n\n📋 Resumo: ${summary}`
                      : escalationMsg;
                    jobQueue.add({
                      type: "send_message",
                      payload: { userId, phone, message: fullEscalationMsg, conversationId: conversation.id, channel, channelMetadata },
                      runAt: now + delay,
                    });
                    const brandingCfg = await storage.getBrandingConfig(userId);
                    const slaMinutes = brandingCfg?.defaultSlaMinutes ?? 60;
                    await storage.enterQueue(crmContact.id, slaMinutes);
                    await storage.updateUnifiedContact(crmContact.id, {
                      activeFlowId: null,
                      aiSummary: summary || `Escalação automática por keyword — Agente: ${aiAgent.name}`,
                    });
                    log(`Automation: AI Agent "${aiAgent.name}" escalated to human for ${phone} (keyword match, summary: ${summary ? "generated" : "skipped"})`, "msg-processor");
                    return;
                  }
                }

                jobQueue.add({
                  type: "send_message",
                  payload: { userId, phone, message: agentReply, conversationId: conversation.id, channel, channelMetadata },
                  runAt: now + delay,
                });
                if (aiAgent.ttsVoice) {
                  jobQueue.add({
                    type: "send_audio",
                    payload: { userId, phone, text: agentReply, agentId: aiAgent.id, conversationId: conversation.id },
                    runAt: now + delay + 2000,
                  });
                }
                log(`Automation: AI Agent "${aiAgent.name}" generated response for ${phone}`, "msg-processor");
              } else {
                jobQueue.add({
                  type: "send_message",
                  payload: { userId, phone, message: automationFlow.responseTemplate, conversationId: conversation.id, channel, channelMetadata },
                  runAt: now + delay,
                });
              }
            } catch (agentErr) {
              console.error("AI Agent response error, falling back to template:", agentErr);
              jobQueue.add({
                type: "send_message",
                payload: { userId, phone, message: automationFlow.responseTemplate, conversationId: conversation.id, channel, channelMetadata },
                runAt: now + delay,
              });
            }
          } else if (steps && steps.length > 0) {
            const sorted = [...steps].sort((a, b) => a.order - b.order);
            for (const step of sorted) {
              const runAt = now + (step.delaySeconds * 1000);
              jobQueue.add({
                type: "send_message",
                payload: { userId, phone, message: step.message, conversationId: conversation.id, channel, channelMetadata },
                runAt,
              });
            }
            log(`Automation: scheduled ${sorted.length} steps for ${phone}`, "msg-processor");
          } else {
            jobQueue.add({
              type: "send_message",
              payload: { userId, phone, message: automationFlow.responseTemplate, conversationId: conversation.id, channel, channelMetadata },
              runAt: now + delay,
            });
            log(`Automation: scheduled response to ${phone} in ${delay / 1000}s [${channel}]`, "msg-processor");
          }

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

// Backward-compatible alias
export const processIncomingWhatsAppMessage = (params: IncomingMessageParams) =>
  processIncomingMessage({ ...params, channel: "whatsapp" });

export { sendChannelMessage };
