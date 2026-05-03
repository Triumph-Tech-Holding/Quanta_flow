import OpenAI from "openai";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { unifiedContacts, omnichannelMessages, learningTracks } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type ConversionProbability = "Alta" | "Media" | "Baixa";

export type InsightType =
  | "lead_estagnado"
  | "alta_conversao"
  | "sla_risco"
  | "reengajamento"
  | "oportunidade";

export type ActionType =
  | "disparar_microlearning"
  | "mover_pipeline"
  | "enviar_mensagem"
  | "atribuir_agente"
  | "criar_followup";

export interface ISuggestedAction {
  type: ActionType;
  label: string;
  payload?: Record<string, unknown>;
}

export interface IInsightResponse {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  type: InsightType;
  severity: "alta" | "media" | "baixa";
  title: string;
  description: string;
  hoursSinceLastContact: number | null;
  score: number;
  temperature: string;
  lastIntent: string | null;
  pipelineStage: string;
  prediction?: IPredictionResponse;
  suggestedActions: ISuggestedAction[];
  generatedAt: string;
}

export interface IPredictionResponse {
  probability: ConversionProbability;
  confidence: number;
  reasoning: string;
}

export interface IBrainSummary {
  totalInsights: number;
  byType: Record<InsightType, number>;
  bySeverity: Record<"alta" | "media" | "baixa", number>;
  generatedAt: string;
}

const STAGNANT_HOURS = 48;
const HOT_LEAD_SCORE = 70;

const STAGE_NEXT: Record<string, { key: string; label: string }> = {
  novo:        { key: "qualificado",    label: "Qualificado" },
  qualificado: { key: "proposta",       label: "Proposta" },
  proposta:    { key: "negociacao",     label: "Negociação" },
  negociacao:  { key: "fechado_ganho",  label: "Fechado (Ganho)" },
};

export class IABrainService {
  /**
   * Busca leads estagnados — quentes ou com score alto que não recebem contato há > 48h.
   */
  async findStagnantLeads(userId: string): Promise<typeof unifiedContacts.$inferSelect[]> {
    const cutoff = new Date(Date.now() - STAGNANT_HOURS * 60 * 60 * 1000);

    return db
      .select()
      .from(unifiedContacts)
      .where(
        and(
          eq(unifiedContacts.userId, userId),
          or(
            eq(unifiedContacts.temperature, "quente"),
            gte(unifiedContacts.score, HOT_LEAD_SCORE)
          )!,
          or(
            lt(unifiedContacts.lastContactAt, cutoff),
            sql`${unifiedContacts.lastContactAt} IS NULL`
          )!
        )
      )
      .orderBy(desc(unifiedContacts.score))
      .limit(50);
  }

  /**
   * Predição de conversão via OpenAI a partir do histórico de mensagens.
   */
  async predictConversion(contactId: string): Promise<IPredictionResponse> {
    try {
      const messages = await db
        .select()
        .from(omnichannelMessages)
        .where(eq(omnichannelMessages.unifiedContactId, contactId))
        .orderBy(desc(omnichannelMessages.timestamp))
        .limit(20);

      if (messages.length === 0) {
        return {
          probability: "Baixa",
          confidence: 0.3,
          reasoning: "Sem histórico de conversa registrado",
        };
      }

      const history = messages
        .reverse()
        .map((m) => `[${m.direction === "incoming" ? "Cliente" : "Atendente"}] ${m.content}`)
        .join("\n")
        .slice(0, 3500);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é um analista sênior de vendas B2C/B2B brasileiro. Analise a conversa e retorne APENAS um JSON com:
{"probability":"Alta"|"Media"|"Baixa","confidence":0.0-1.0,"reasoning":"justificativa em 1 linha (máx 140 caracteres)"}
Considere: tom do cliente, perguntas de fechamento, objeções, urgência, histórico de respostas.`,
          },
          { role: "user", content: `Histórico:\n${history}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      const probability: ConversionProbability =
        parsed.probability === "Alta" || parsed.probability === "Media" || parsed.probability === "Baixa"
          ? parsed.probability
          : "Baixa";

      return {
        probability,
        confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 200) : "Sem justificativa disponível",
      };
    } catch (error: any) {
      console.error("[ia-brain] predictConversion failed:", error?.message || error);
      return {
        probability: "Baixa",
        confidence: 0.0,
        reasoning: "Erro ao consultar IA — usando fallback heurístico",
      };
    }
  }

  /**
   * Gera ações sugeridas para um lead com base no estado dele e nas trilhas disponíveis.
   */
  async buildSuggestedActions(
    contact: typeof unifiedContacts.$inferSelect,
    userId: string
  ): Promise<ISuggestedAction[]> {
    const actions: ISuggestedAction[] = [];

    // 1. Microlearning de reengajamento (se houver trilha cadastrada)
    try {
      const tracks = await db
        .select()
        .from(learningTracks)
        .where(
          and(
            eq(learningTracks.userId, userId),
            eq(learningTracks.isActive, true)
          )
        )
        .limit(5);

      if (tracks.length > 0) {
        const track = tracks[0];
        actions.push({
          type: "disparar_microlearning",
          label: `Disparar trilha de Microlearning de reengajamento (${track.stageOrIntent})`,
          payload: { trackId: track.id, stageOrIntent: track.stageOrIntent },
        });
      } else {
        actions.push({
          type: "disparar_microlearning",
          label: "Disparar trilha de Microlearning de reengajamento",
        });
      }
    } catch {
      // ignora
    }

    // 2. Mover pipeline (se score >= 70 e ainda em fase inicial)
    const stage = (contact.pipelineStage || "novo").toLowerCase();
    const next = STAGE_NEXT[stage];
    if (next && (contact.score >= HOT_LEAD_SCORE || contact.temperature === "quente")) {
      actions.push({
        type: "mover_pipeline",
        label: `Mover lead manualmente para o pipeline '${next.label}'`,
        payload: { fromStage: stage, toStage: next.key },
      });
    }

    // 3. Enviar mensagem de retomada
    actions.push({
      type: "enviar_mensagem",
      label: `Enviar mensagem personalizada para ${contact.nome.split(" ")[0]}`,
      payload: { contactId: contact.id, channel: "whatsapp" },
    });

    // 4. Atribuir agente se não tem dono
    if (!contact.assignedToUserId) {
      actions.push({
        type: "atribuir_agente",
        label: "Atribuir a um agente da fila (round-robin)",
        payload: { contactId: contact.id },
      });
    }

    return actions;
  }

  /**
   * Pipeline principal: gera todos os insights para o usuário.
   */
  async generateInsights(userId: string, opts: { withPrediction?: boolean } = {}): Promise<IInsightResponse[]> {
    const { withPrediction = false } = opts;
    const stagnant = await this.findStagnantLeads(userId);

    const results: IInsightResponse[] = [];
    const now = Date.now();
    const generatedAt = new Date().toISOString();

    for (const c of stagnant) {
      const hoursSince = c.lastContactAt
        ? Math.round((now - new Date(c.lastContactAt).getTime()) / (60 * 60 * 1000))
        : null;

      const isHot = c.temperature === "quente";
      const highScore = c.score >= HOT_LEAD_SCORE;
      const type: InsightType = isHot ? "lead_estagnado" : "alta_conversao";
      const severity: "alta" | "media" | "baixa" =
        isHot && highScore ? "alta" : isHot || highScore ? "media" : "baixa";

      const description = hoursSince
        ? `Lead ${isHot ? "QUENTE" : `com score ${c.score}`} sem contato há ${hoursSince}h. Risco de esfriamento.`
        : `Lead ${isHot ? "QUENTE" : `com score ${c.score}`} nunca foi contatado. Ação imediata recomendada.`;

      const insight: IInsightResponse = {
        id: `ins_${c.id}_${now}`,
        contactId: c.id,
        contactName: c.nome,
        contactPhone: c.telefone,
        type,
        severity,
        title: isHot ? "Lead quente estagnado" : "Lead com alto score sem contato",
        description,
        hoursSinceLastContact: hoursSince,
        score: c.score,
        temperature: c.temperature,
        lastIntent: c.lastIntent,
        pipelineStage: c.pipelineStage,
        suggestedActions: await this.buildSuggestedActions(c, userId),
        generatedAt,
      };

      if (withPrediction) {
        insight.prediction = await this.predictConversion(c.id);
      }

      results.push(insight);
    }

    // ordena por severidade depois por score
    const sevWeight = { alta: 3, media: 2, baixa: 1 };
    results.sort((a, b) => sevWeight[b.severity] - sevWeight[a.severity] || b.score - a.score);

    return results;
  }

  summarize(insights: IInsightResponse[]): IBrainSummary {
    const byType = { lead_estagnado: 0, alta_conversao: 0, sla_risco: 0, reengajamento: 0, oportunidade: 0 } as Record<InsightType, number>;
    const bySeverity = { alta: 0, media: 0, baixa: 0 } as Record<"alta" | "media" | "baixa", number>;
    for (const i of insights) {
      byType[i.type] = (byType[i.type] || 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
    }
    return {
      totalInsights: insights.length,
      byType,
      bySeverity,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const iaBrainService = new IABrainService();
