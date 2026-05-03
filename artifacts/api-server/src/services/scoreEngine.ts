import { eq, and, desc, sql as sqlExpr, gte } from "drizzle-orm";
import { db } from "../db";
import {
  contactScoreEvents,
  scoreRules,
  unifiedContacts,
  type InsertContactScoreEvent,
  type ScoreRule,
} from "@workspace/db";

const DEFAULT_RULES: Array<Pick<ScoreRule, "eventType" | "points">> = [
  { eventType: "message_received", points: 2 },
  { eventType: "message_replied", points: 5 },
  { eventType: "link_clicked", points: 4 },
  { eventType: "form_submitted", points: 15 },
  { eventType: "cta_clicked", points: 3 },
  { eventType: "page_viewed", points: 1 },
  { eventType: "learning_delivered", points: 2 },
  { eventType: "learning_completed", points: 10 },
  { eventType: "deal_won", points: 50 },
  { eventType: "deal_lost", points: -20 },
  { eventType: "manual_adjust", points: 0 },
];

const DEFAULT_HOT = 80;
const DEFAULT_WARM = 40;
const DEFAULT_COOLDOWN_DAYS = 14;

let warnedRuleLookup = false;

export async function ensureDefaultScoreRules(workspaceId: string): Promise<ScoreRule[]> {
  const existing = await db.select().from(scoreRules).where(eq(scoreRules.workspaceId, workspaceId));
  const map = new Map(existing.map((r) => [r.eventType, r]));
  const toInsert = DEFAULT_RULES.filter((d) => !map.has(d.eventType)).map((d) => ({
    workspaceId,
    eventType: d.eventType,
    points: d.points,
    hotThreshold: DEFAULT_HOT,
    warmThreshold: DEFAULT_WARM,
    coolDownDays: DEFAULT_COOLDOWN_DAYS,
    isActive: true,
  }));
  if (toInsert.length > 0) {
    await db.insert(scoreRules).values(toInsert).onConflictDoNothing();
    return db.select().from(scoreRules).where(eq(scoreRules.workspaceId, workspaceId));
  }
  return existing;
}

async function getRuleForEvent(workspaceId: string, eventType: ScoreRule["eventType"]): Promise<ScoreRule | undefined> {
  try {
    const [r] = await db.select().from(scoreRules)
      .where(and(eq(scoreRules.workspaceId, workspaceId), eq(scoreRules.eventType, eventType)))
      .limit(1);
    if (r) return r;
    const seeded = await ensureDefaultScoreRules(workspaceId);
    return seeded.find((s) => s.eventType === eventType);
  } catch (err) {
    if (!warnedRuleLookup) {
      warnedRuleLookup = true;
      console.error("scoreEngine: rule lookup failed", err);
    }
    return undefined;
  }
}

function tempFromScore(score: number, rule: ScoreRule | undefined): "frio" | "morno" | "quente" {
  const hot = rule?.hotThreshold ?? DEFAULT_HOT;
  const warm = rule?.warmThreshold ?? DEFAULT_WARM;
  if (score >= hot) return "quente";
  if (score >= warm) return "morno";
  return "frio";
}

export async function recomputeContactScore(contactId: string): Promise<{ score: number; temperature: "frio" | "morno" | "quente" } | null> {
  const [c] = await db.select().from(unifiedContacts).where(eq(unifiedContacts.id, contactId)).limit(1);
  if (!c || !c.workspaceId) return null;
  const rule = await getRuleForEvent(c.workspaceId, "form_submitted");
  const cooldownDays = rule?.coolDownDays ?? DEFAULT_COOLDOWN_DAYS;
  const since = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sqlExpr`
    SELECT COALESCE(SUM(points), 0)::int AS total
    FROM contact_score_events
    WHERE contact_id = ${contactId} AND created_at >= ${since.toISOString()}
  `);
  const score = Math.max(0, Math.min(100, Number((rows.rows[0] as any)?.total ?? 0)));
  const temperature = tempFromScore(score, rule);
  await db.update(unifiedContacts)
    .set({ score, temperature, updatedAt: new Date() })
    .where(eq(unifiedContacts.id, contactId));
  return { score, temperature };
}

interface AwardOpts {
  workspaceId: string;
  contactId: string;
  eventType: ScoreRule["eventType"];
  channel?: InsertContactScoreEvent["channel"];
  source?: string;
  refId?: string;
  metadata?: Record<string, unknown>;
  pointsOverride?: number;
}

export async function awardScoreEvent(opts: AwardOpts): Promise<void> {
  const rule = await getRuleForEvent(opts.workspaceId, opts.eventType);
  if (rule && rule.isActive === false) return;
  const points = opts.pointsOverride ?? rule?.points ?? 0;
  if (points === 0 && opts.eventType !== "manual_adjust") {
    // Still record event for timeline, but no score change
  }
  await db.insert(contactScoreEvents).values({
    workspaceId: opts.workspaceId,
    contactId: opts.contactId,
    eventType: opts.eventType,
    points,
    channel: opts.channel ?? null,
    source: opts.source ?? null,
    refId: opts.refId ?? null,
    metadata: (opts.metadata ?? null) as Record<string, unknown> | null,
  });
  await recomputeContactScore(opts.contactId);
}

export async function getRecentScoreEvents(contactId: string, limit = 50) {
  return db.select().from(contactScoreEvents)
    .where(eq(contactScoreEvents.contactId, contactId))
    .orderBy(desc(contactScoreEvents.createdAt))
    .limit(limit);
}

export async function getWorkspaceScoreSummary(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sqlExpr`
    SELECT event_type, COUNT(*)::int AS count, COALESCE(SUM(points),0)::int AS points
    FROM contact_score_events
    WHERE workspace_id = ${workspaceId} AND created_at >= ${since.toISOString()}
    GROUP BY event_type
    ORDER BY count DESC
  `);
  return rows.rows.map((r: any) => ({ eventType: String(r.event_type), count: Number(r.count), points: Number(r.points) }));
}
