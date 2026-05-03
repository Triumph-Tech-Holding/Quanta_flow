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
import { emailConfigs, campaigns as campaignsTable } from "@workspace/db";
import { eq, sql as sqlExpr } from "drizzle-orm";
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

interface BlockExecContext {
  userId: string;
  phone: string;
  messageContent: string;
  conversationId: string;
  channel: MessageChannel;
  channelMetadata: Record<string, unknown>;
  contactId: string;
  crmContact: { id: string; nome: string; temperature?: string | null; score?: number; lastIntent?: string | null; [key: string]: unknown };
  intentResult?: { intent: string } | null;
  now: number;
  delay: number;
}

function interpolateVars(msg: string, contact: BlockExecContext["crmContact"]): string {
  return msg
    .replace(/\{nome\}/gi, contact.nome || "")
    .replace(/\{telefone\}/gi, (contact as Record<string, unknown>).telefone as string || "")
    .replace(/\{email\}/gi, (contact as Record<string, unknown>).email as string || "");
}

async function executeFlowBlocks(
  blocks: import("@workspace/db").FlowBlock[],
  ctx: BlockExecContext
): Promise<void> {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  const targetIds = new Set<string>();
  for (const b of blocks) {
    if (b.nextBlockId) targetIds.add(b.nextBlockId);
    if (b.conditionTrueId) targetIds.add(b.conditionTrueId);
    if (b.conditionFalseId) targetIds.add(b.conditionFalseId);
  }
  const rootBlock = blocks.find((b) => !targetIds.has(b.id)) || blocks[0];
  if (!rootBlock) return;

  let currentBlockId: string | null = rootBlock.id;
  let stepDelay = 0;
  const visited = new Set<string>();
  const MAX_STEPS = 50;
  let steps = 0;

  while (currentBlockId) {
    if (steps++ >= MAX_STEPS) {
      log(`Block executor: max steps (${MAX_STEPS}) reached — aborting flow`, "msg-processor");
      break;
    }
    if (visited.has(currentBlockId)) {
      log(`Block executor: cycle detected at block ${currentBlockId} — aborting`, "msg-processor");
      break;
    }
    visited.add(currentBlockId);

    const block = blockMap.get(currentBlockId);
    if (!block) break;

    const cfg = block.config;

    switch (block.type) {
      case "text": {
        const msg = interpolateVars(cfg.message || "", ctx.crmContact);
        jobQueue.add({
          type: "send_message",
          payload: { userId: ctx.userId, phone: ctx.phone, message: msg, conversationId: ctx.conversationId, channel: ctx.channel, channelMetadata: ctx.channelMetadata },
          runAt: ctx.now + ctx.delay + stepDelay,
        });
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "audio_tts": {
        const text = interpolateVars(cfg.message || "", ctx.crmContact);
        const voice = (cfg.voice as string) || "nova";
        jobQueue.add({
          type: "send_flow_audio",
          payload: {
            userId: ctx.userId, phone: ctx.phone, text, voice,
            conversationId: ctx.conversationId, channel: ctx.channel, channelMetadata: ctx.channelMetadata,
          },
          runAt: ctx.now + ctx.delay + stepDelay,
        });
        log(`Block executor: audio_tts — scheduled TTS for ${ctx.phone} (delay: ${stepDelay}ms)`, "msg-processor");
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "image_ai": {
        const prompt = (cfg.prompt as string) || "abstract art";
        jobQueue.add({
          type: "send_flow_image",
          payload: {
            userId: ctx.userId, phone: ctx.phone, prompt,
            conversationId: ctx.conversationId, channel: ctx.channel, channelMetadata: ctx.channelMetadata,
          },
          runAt: ctx.now + ctx.delay + stepDelay,
        });
        log(`Block executor: image_ai — scheduled image gen for ${ctx.phone} (delay: ${stepDelay}ms)`, "msg-processor");
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "delay": {
        let delaySec = (cfg.delaySeconds as number) || 30;
        const unit = (cfg.delayUnit as string) || "seconds";
        if (unit === "minutes") delaySec *= 60;
        else if (unit === "hours") delaySec *= 3600;
        stepDelay += delaySec * 1000;
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "condition": {
        let conditionMet = false;
        const condVal = (cfg.conditionValue || "").toLowerCase();
        const msgLow = ctx.messageContent.toLowerCase();

        if (cfg.conditionType === "keyword") {
          const keywords = condVal.split(",").map((k) => k.trim());
          conditionMet = keywords.some((kw) => msgLow.includes(kw));
        } else if (cfg.conditionType === "intent") {
          conditionMet = ctx.intentResult?.intent === condVal;
        } else if (cfg.conditionType === "temperature") {
          conditionMet = (ctx.crmContact.temperature || "").toLowerCase() === condVal;
        } else if (cfg.conditionType === "score") {
          const scoreThreshold = parseInt(condVal) || 0;
          conditionMet = (ctx.crmContact.score || 0) >= scoreThreshold;
        }

        currentBlockId = conditionMet
          ? (block.conditionTrueId || null)
          : (block.conditionFalseId || null);
        break;
      }
      case "ai_agent": {
        try {
          const agentId = cfg.agentId;
          const aiAgent = agentId ? await storage.getAiAgent(agentId) : null;
          const agentOpenai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const agentResponse = await agentOpenai.chat.completions.create({
            model: aiAgent?.model || "gpt-4o-mini",
            messages: [
              { role: "system", content: aiAgent?.systemPrompt || "You are a helpful assistant." },
              { role: "user", content: ctx.messageContent },
            ],
            temperature: aiAgent?.temperature ?? 0.7,
            max_tokens: aiAgent?.maxTokens ?? 500,
          });
          const reply = agentResponse.choices[0]?.message?.content || "...";
          jobQueue.add({
            type: "send_message",
            payload: { userId: ctx.userId, phone: ctx.phone, message: reply, conversationId: ctx.conversationId, channel: ctx.channel, channelMetadata: ctx.channelMetadata },
            runAt: ctx.now + ctx.delay + stepDelay,
          });
        } catch (err) {
          log(`Block executor: ai_agent error — ${err instanceof Error ? err.message : String(err)}`, "msg-processor");
        }
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "webhook": {
        try {
          const method = cfg.webhookMethod || "POST";
          const url = cfg.webhookUrl || "";
          if (url) {
            fetch(url, {
              method,
              headers: { "Content-Type": "application/json", ...(cfg.webhookHeaders || {}) },
              body: method === "POST" ? JSON.stringify({ phone: ctx.phone, contactId: ctx.contactId, message: ctx.messageContent }) : undefined,
              signal: AbortSignal.timeout(5000),
            }).catch(() => {});
          }
        } catch {}
        currentBlockId = block.nextBlockId || null;
        break;
      }
      case "queue_entry": {
        const slaMin = cfg.slaMinutes || 60;
        await storage.enterQueue(ctx.contactId, slaMin);
        const updated = await storage.getUnifiedContact(ctx.contactId);
        if (updated?.slaDeadline) {
          jobQueue.add({
            type: "check_sla",
            payload: { contactId: ctx.contactId, userId: ctx.userId },
            runAt: new Date(updated.slaDeadline).getTime(),
          });
        }
        await storage.updateUnifiedContact(ctx.contactId, { activeFlowId: null });
        log(`Block executor: queue_entry — contact ${ctx.contactId} entered queue (SLA: ${slaMin}min)`, "msg-processor");
        currentBlockId = null;
        break;
      }
      case "resolve": {
        await storage.resolveContact(ctx.contactId, ctx.userId);
        await storage.updateUnifiedContact(ctx.contactId, { activeFlowId: null });
        log(`Block executor: resolve — contact ${ctx.contactId} resolved`, "msg-processor");
        currentBlockId = null;
        break;
      }
      case "update_lead": {
        const updates: Record<string, unknown> = {};
        if (cfg.leadStage) updates.pipelineStage = cfg.leadStage;
        if (cfg.leadTemperature) updates.temperature = cfg.leadTemperature;
        if (cfg.leadTag) updates.tags = cfg.leadTag;
        if (cfg.leadScore !== undefined) updates.score = cfg.leadScore;
        if (Object.keys(updates).length > 0) {
          await storage.updateUnifiedContact(ctx.contactId, updates);
        }
        currentBlockId = block.nextBlockId || null;
        break;
      }
      default:
        currentBlockId = block.nextBlockId || null;
        break;
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

      try {
        const pendingDelivery = await storage.findPendingDeliveryByContact(crmContact.id);
        if (pendingDelivery) {
          await storage.updateCampaignDelivery(pendingDelivery.id, {
            status: "replied",
            repliedAt: new Date(),
          });
          await db.update(campaignsTable)
            .set({ repliedCount: sqlExpr`COALESCE(${campaignsTable.repliedCount}, 0) + 1` })
            .where(eq(campaignsTable.id, pendingDelivery.campaignId));
        }
      } catch (trackErr) {
        console.error("[Campaign Reply Tracking]", trackErr);
      }

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

          const flowBlocks = automationFlow.blocks as import("@workspace/db").FlowBlock[] | null;

          if (flowBlocks && flowBlocks.length > 0) {
            await executeFlowBlocks(flowBlocks, {
              userId, phone, messageContent, conversationId: conversation.id,
              channel, channelMetadata, contactId: crmContact.id, crmContact,
              intentResult, now, delay,
            });
            log(`Automation: executed flow blocks for ${phone} (${flowBlocks.length} blocks)`, "msg-processor");
          } else {

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
          } // close else for blocks check

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
