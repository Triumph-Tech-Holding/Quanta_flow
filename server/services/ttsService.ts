import OpenAI from "openai";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function generateAgentTts(agentId: string, text: string): Promise<Buffer | null> {
  const agent = await storage.getAiAgent(agentId);
  if (!agent) return null;

  const voice = (agent.ttsVoice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer") || "nova";

  const ttsResponse = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text.slice(0, 4096),
  });

  return Buffer.from(await ttsResponse.arrayBuffer());
}

export async function generateEscalationSummary(messageContent: string, agentName: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente que gera resumos breves para handoff de atendimento. O agente IA "${agentName}" está transferindo a conversa para um atendente humano. Gere um resumo conciso (2-3 frases) do contexto e motivo da escalação para que o atendente humano possa continuar o atendimento de forma eficiente.`,
        },
        { role: "user", content: `Mensagem do cliente que disparou a escalação: "${messageContent}"\n\nGere um resumo breve para o atendente humano.` },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || "";
  } catch {
    return "";
  }
}
