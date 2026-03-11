import { storage } from "../storage";
import { emitMessageReceived } from "../socket";
import { processMessageIntent } from "./intentService";
import { getWhatsAppProvider } from "./whatsappProvider";
import { log } from "../index";

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

      // TAREFA 1: Conectar automação ao webhook
      try {
        const automationFlow = await storage.findMatchingAutomationFlow(userId, messageContent);
        if (automationFlow && automationFlow.isActive) {
          const provider = await getWhatsAppProvider(userId);
          const responseText = automationFlow.responseTemplate;
          
          try {
            const result = await provider.sendMessage(phone, responseText);
            log(`[${provider}] Auto-response sent: ${result.messageId} to ${phone}`, "msg-processor");

            // Salvar resposta automática como mensagem outgoing
            await storage.createMessage({
              conversationId: conversation.id,
              userId,
              messageId: `auto_${result.messageId}`,
              direction: "outgoing",
              content: responseText,
              timestamp: new Date(),
            });
          } catch (sendErr) {
            log(`Failed to send auto-response: ${sendErr instanceof Error ? sendErr.message : "unknown error"}`, "msg-processor");
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
