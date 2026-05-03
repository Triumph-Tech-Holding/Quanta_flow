import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type IntentType = "compra_quente" | "duvida" | "reclamacao" | "suporte" | "elogio" | "indefinido";
export type Temperature = "frio" | "morno" | "quente";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  suggestedTemperature: Temperature;
  scoreAdjustment: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `Você é um classificador de intenção de mensagens para um CRM de vendas brasileiro.

Analise a mensagem do cliente e classifique:

INTENT (intenção):
- compra_quente: Cliente demonstra forte interesse de compra, pede preço, quer comprar, solicita proposta
- duvida: Perguntas sobre produto/serviço, como funciona, disponibilidade
- reclamacao: Insatisfação, problema com produto/serviço, pedido de reembolso
- suporte: Precisa de ajuda técnica, problema de uso, configuração
- elogio: Feedback positivo, agradecimento, satisfação
- indefinido: Mensagem genérica, saudação simples, não classificável

TEMPERATURE (temperatura do lead):
- quente: Alta probabilidade de compra (interesse direto, pedido de preço, urgência)
- morno: Interesse moderado (perguntas, comparações, avaliando opções)
- frio: Baixo interesse imediato (saudação, informação geral, reclamação)

SCORE_ADJUSTMENT (ajuste de pontuação -10 a +20):
- compra_quente: +15 a +20
- duvida: +5 a +10
- elogio: +5
- suporte: +2
- reclamacao: -5 a -10
- indefinido: 0

Responda APENAS em JSON válido:
{"intent": "...", "confidence": 0.0-1.0, "suggestedTemperature": "...", "scoreAdjustment": N, "reasoning": "breve explicação"}`;

export async function detectIntent(messageContent: string): Promise<IntentResult> {
  try {
    if (!messageContent || messageContent.trim().length < 2) {
      return {
        intent: "indefinido",
        confidence: 1.0,
        suggestedTemperature: "frio",
        scoreAdjustment: 0,
        reasoning: "Mensagem muito curta para classificar",
      };
    }

    const mediaPatterns = ["[Áudio]", "[Vídeo]", "[Documento]", "[Mídia]", "[Mensagem]", "[Imagem]"];
    if (mediaPatterns.some(p => messageContent.includes(p))) {
      return {
        intent: "indefinido",
        confidence: 0.5,
        suggestedTemperature: "morno",
        scoreAdjustment: 1,
        reasoning: "Mídia recebida - necessário análise manual",
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: messageContent },
      ],
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(raw);

    const validIntents: IntentType[] = ["compra_quente", "duvida", "reclamacao", "suporte", "elogio", "indefinido"];
    const validTemps: Temperature[] = ["frio", "morno", "quente"];

    return {
      intent: validIntents.includes(parsed.intent) ? parsed.intent : "indefinido",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      suggestedTemperature: validTemps.includes(parsed.suggestedTemperature) ? parsed.suggestedTemperature : "frio",
      scoreAdjustment: Math.max(-10, Math.min(20, Number(parsed.scoreAdjustment) || 0)),
      reasoning: String(parsed.reasoning || ""),
    };
  } catch (error) {
    console.error("Intent detection error:", error);
    return {
      intent: "indefinido",
      confidence: 0,
      suggestedTemperature: "frio",
      scoreAdjustment: 0,
      reasoning: `Erro na classificação: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

export async function processMessageIntent(
  messageContent: string,
  contactId: string,
  userId: string,
  storage: {
    getUnifiedContact: (id: string) => Promise<any>;
    updateUnifiedContact: (id: string, data: any) => Promise<any>;
    createOmnichannelMessage: (msg: any) => Promise<any>;
  }
): Promise<IntentResult | null> {
  try {
    const result = await detectIntent(messageContent);

    if (result.intent === "indefinido" && result.confidence === 0) {
      return result;
    }

    const contact = await storage.getUnifiedContact(contactId);
    if (!contact) return result;

    const updateData: Record<string, any> = {
      lastIntent: result.intent,
      lastContactAt: new Date(),
    };

    if (result.confidence >= 0.6) {
      updateData.temperature = result.suggestedTemperature;
    }

    const newScore = Math.max(0, Math.min(100, (contact.score || 0) + result.scoreAdjustment));
    updateData.score = newScore;

    if (result.intent === "compra_quente" && result.confidence >= 0.7) {
      const currentStage = contact.pipelineStage;
      if (currentStage === "novo") {
        updateData.pipelineStage = "qualificado";
      }
    }

    await storage.updateUnifiedContact(contactId, updateData);

    return result;
  } catch (error) {
    console.error("Process message intent error:", error);
    return null;
  }
}
