import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { db } from "../db";
import {
  scoreRules,
  contactScoreEvents,
  learningPoints,
  learningBadges,
  learningCompletions,
  learningDeliveries,
  unifiedContacts,
  omnichannelMessages,
  landingPageEvents,
  landingPageSubmissions,
  type ScoreRule,
} from "@workspace/db";
import { and, eq, desc, sql as sqlExpr, gte } from "drizzle-orm";
import { ensureDefaultScoreRules, recomputeContactScore, awardScoreEvent, getRecentScoreEvents, getWorkspaceScoreSummary } from "../services/scoreEngine";

interface AuthRequest extends Request {
  user?: { userId: string; email: string; tokenVersion: number; workspaceId?: string };
  workspaceId?: string;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.workspaceId) return res.status(401).json({ message: "Não autenticado" });
  return next();
}

const updateRuleSchema = z.object({
  points: z.number().int().min(-100).max(100).optional(),
  hotThreshold: z.number().int().min(0).max(1000).optional(),
  warmThreshold: z.number().int().min(0).max(1000).optional(),
  coolDownDays: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().optional(),
});

const completeSchema = z.object({
  contactId: z.string().min(1),
  trackId: z.string().min(1),
  deliveryId: z.string().optional(),
  durationSeconds: z.number().int().min(0).max(86400).default(0),
});

export function registerScoreAndGamificationRoutes(app: Express, authenticateToken: any) {
  // ===== Score Rules CRUD =====
  app.get("/api/score-rules", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const rules = await ensureDefaultScoreRules(req.workspaceId!);
      return res.json(rules);
    } catch (err) {
      (req as any).log?.error?.({ err }, "list score rules failed");
      return res.status(500).json({ message: "Erro ao listar regras" });
    }
  });

  app.patch("/api/score-rules/:id", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const body = updateRuleSchema.parse(req.body ?? {});
      const [r] = await db.update(scoreRules)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(scoreRules.id, id), eq(scoreRules.workspaceId, req.workspaceId!)))
        .returning();
      if (!r) return res.status(404).json({ message: "Regra não encontrada" });
      return res.json(r);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      return res.status(500).json({ message: "Erro ao atualizar regra" });
    }
  });

  // ===== Score events / timeline / recompute =====
  app.get("/api/contacts/:id/score-events", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });
      const events = await getRecentScoreEvents(id, 100);
      return res.json(events);
    } catch (err) {
      return res.status(500).json({ message: "Erro ao listar eventos" });
    }
  });

  app.get("/api/contacts/:id/timeline", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });

      const messages = await db.select().from(omnichannelMessages)
        .where(eq(omnichannelMessages.unifiedContactId, id))
        .orderBy(desc(omnichannelMessages.timestamp))
        .limit(80);
      const events = await db.select().from(contactScoreEvents)
        .where(eq(contactScoreEvents.contactId, id))
        .orderBy(desc(contactScoreEvents.createdAt))
        .limit(80);
      const submissions = await db.select().from(landingPageSubmissions)
        .where(eq(landingPageSubmissions.contactId, id))
        .orderBy(desc(landingPageSubmissions.createdAt))
        .limit(20);
      const learnings = await db.select().from(learningCompletions)
        .where(eq(learningCompletions.contactId, id))
        .orderBy(desc(learningCompletions.completedAt))
        .limit(40);

      const timeline = [
        ...messages.map((m) => ({ kind: "message" as const, at: m.timestamp, channel: m.channelType, direction: m.direction, content: m.content, intent: m.detectedIntent ?? null })),
        ...events.map((e) => ({ kind: "score" as const, at: e.createdAt, eventType: e.eventType, points: e.points, source: e.source ?? null, channel: e.channel ?? null })),
        ...submissions.map((s) => ({ kind: "landing_submit" as const, at: s.createdAt, payload: s.payload, utm: s.utm })),
        ...learnings.map((l) => ({ kind: "learning_complete" as const, at: l.completedAt, trackId: l.trackId, durationSeconds: l.durationSeconds })),
      ].sort((a, b) => new Date(b.at as Date).getTime() - new Date(a.at as Date).getTime()).slice(0, 200);

      return res.json({ contact: { id: c.id, score: c.score, temperature: c.temperature, lastIntent: c.lastIntent }, timeline });
    } catch (err) {
      (req as any).log?.error?.({ err }, "timeline failed");
      return res.status(500).json({ message: "Erro ao montar timeline" });
    }
  });

  app.post("/api/contacts/:id/score/recompute", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });
      const result = await recomputeContactScore(id);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ message: "Erro ao recalcular score" });
    }
  });

  app.post("/api/contacts/:id/score/manual", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const body = z.object({ points: z.number().int().min(-50).max(50), reason: z.string().max(120).optional() }).parse(req.body ?? {});
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });
      await awardScoreEvent({
        workspaceId: req.workspaceId!,
        contactId: id,
        eventType: "manual_adjust",
        source: body.reason ?? "manual",
        pointsOverride: body.points,
      });
      return res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      return res.status(500).json({ message: "Erro ao ajustar score" });
    }
  });

  // ===== Operação dashboard summary =====
  app.get("/api/ops/summary", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const wsId = req.workspaceId!;

      const scoreSummary = await getWorkspaceScoreSummary(wsId, days);

      const slaRows = await db.execute(sqlExpr`
        SELECT
          COUNT(*) FILTER (WHERE sla_breached = false)::int AS within_sla,
          COUNT(*) FILTER (WHERE sla_breached = true)::int AS breached,
          COUNT(*)::int AS total
        FROM unified_contacts
        WHERE workspace_id = ${wsId} AND created_at >= ${since.toISOString()}
      `);
      const sla = slaRows.rows[0] as any;

      const tempRows = await db.execute(sqlExpr`
        SELECT temperature, COUNT(*)::int AS count
        FROM unified_contacts
        WHERE workspace_id = ${wsId}
        GROUP BY temperature
      `);

      const learningRows = await db.execute(sqlExpr`
        SELECT
          (SELECT COUNT(*)::int FROM learning_deliveries d
            JOIN unified_contacts c ON c.id = d.contact_id
            WHERE c.workspace_id = ${wsId} AND d.created_at >= ${since.toISOString()}) AS delivered,
          (SELECT COUNT(*)::int FROM learning_completions
            WHERE workspace_id = ${wsId} AND completed_at >= ${since.toISOString()}) AS completed,
          (SELECT COALESCE(SUM(points),0)::int FROM learning_points
            WHERE workspace_id = ${wsId} AND created_at >= ${since.toISOString()}) AS points,
          (SELECT COALESCE(SUM(duration_seconds),0)::int FROM learning_points
            WHERE workspace_id = ${wsId} AND created_at >= ${since.toISOString()}) AS seconds
      `);
      const lr = learningRows.rows[0] as any;
      const minutes = Math.max(1, Math.round(Number(lr?.seconds ?? 0) / 60));
      const rpm = Number(lr?.points ?? 0) / minutes;

      return res.json({
        days,
        sla: {
          withinSla: Number(sla?.within_sla ?? 0),
          breached: Number(sla?.breached ?? 0),
          total: Number(sla?.total ?? 0),
          pct: sla?.total ? Math.round((Number(sla.within_sla) / Number(sla.total)) * 100) : null,
        },
        temperatures: tempRows.rows.map((r: any) => ({ temperature: String(r.temperature), count: Number(r.count) })),
        learning: {
          delivered: Number(lr?.delivered ?? 0),
          completed: Number(lr?.completed ?? 0),
          points: Number(lr?.points ?? 0),
          minutes,
          rpm: Math.round(rpm * 100) / 100,
        },
        scoreEvents: scoreSummary,
      });
    } catch (err) {
      (req as any).log?.error?.({ err }, "ops summary failed");
      return res.status(500).json({ message: "Erro ao gerar resumo" });
    }
  });

  // ===== Leaderboard =====
  app.get("/api/leaderboard", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const days = Math.min(180, Math.max(1, Number(req.query.days ?? 30)));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const wsId = req.workspaceId!;

      const rows = await db.execute(sqlExpr`
        SELECT
          c.id AS contact_id,
          c.nome AS nome,
          c.avatar_url AS avatar_url,
          COALESCE(SUM(lp.points), 0)::int AS points,
          COALESCE(SUM(lp.duration_seconds), 0)::int AS seconds,
          COUNT(DISTINCT lc.id)::int AS completions,
          COUNT(DISTINCT lb.id)::int AS badges
        FROM unified_contacts c
        LEFT JOIN learning_points lp ON lp.contact_id = c.id AND lp.created_at >= ${since.toISOString()}
        LEFT JOIN learning_completions lc ON lc.contact_id = c.id AND lc.completed_at >= ${since.toISOString()}
        LEFT JOIN learning_badges lb ON lb.contact_id = c.id
        WHERE c.workspace_id = ${wsId}
        GROUP BY c.id, c.nome, c.avatar_url
        HAVING COALESCE(SUM(lp.points), 0) > 0
        ORDER BY points DESC, completions DESC
        LIMIT ${limit}
      `);
      const leaders = rows.rows.map((r: any, idx: number) => {
        const pts = Number(r.points);
        const mins = Math.max(1, Math.round(Number(r.seconds) / 60));
        return {
          rank: idx + 1,
          contactId: String(r.contact_id),
          nome: String(r.nome),
          avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
          points: pts,
          completions: Number(r.completions),
          badges: Number(r.badges),
          minutes: mins,
          rpm: Math.round((pts / mins) * 100) / 100,
        };
      });
      return res.json({ days, leaders });
    } catch (err) {
      (req as any).log?.error?.({ err }, "leaderboard failed");
      return res.status(500).json({ message: "Erro ao gerar ranking" });
    }
  });

  // ===== Microlearning: marcar pílula como concluída =====
  app.post("/api/learning/complete", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = completeSchema.parse(req.body ?? {});
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, body.contactId), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });

      const POINTS = 10;
      const inserted = await db.insert(learningCompletions).values({
        workspaceId: req.workspaceId!,
        contactId: body.contactId,
        trackId: body.trackId,
        deliveryId: body.deliveryId ?? null,
        durationSeconds: body.durationSeconds,
      }).onConflictDoNothing().returning();

      if (inserted.length > 0) {
        await db.insert(learningPoints).values({
          workspaceId: req.workspaceId!,
          contactId: body.contactId,
          trackId: body.trackId,
          deliveryId: body.deliveryId ?? null,
          points: POINTS,
          reason: "completed",
          durationSeconds: body.durationSeconds,
        });
        await awardScoreEvent({
          workspaceId: req.workspaceId!,
          contactId: body.contactId,
          eventType: "learning_completed",
          source: "microlearning",
          refId: body.trackId,
        });

        // Auto-badges
        const [completedRow] = await db.execute(sqlExpr`
          SELECT COUNT(*)::int AS n FROM learning_completions
          WHERE contact_id = ${body.contactId}
        `).then((r) => r.rows as any[]);
        const total = Number(completedRow?.n ?? 0);
        const badgeFor = (n: number): { code: string; label: string } | null => {
          if (n === 1) return { code: "first_step", label: "Primeiro passo" };
          if (n === 5) return { code: "five_pulses", label: "5 pílulas concluídas" };
          if (n === 25) return { code: "quarter_century", label: "25 pílulas" };
          if (n === 100) return { code: "centurion", label: "100 pílulas" };
          return null;
        };
        const b = badgeFor(total);
        if (b) {
          await db.insert(learningBadges).values({
            workspaceId: req.workspaceId!,
            contactId: body.contactId,
            code: b.code,
            label: b.label,
          }).onConflictDoNothing();
        }
      }

      return res.json({ ok: true, awarded: inserted.length > 0 });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.issues[0]?.message || "Dados inválidos" });
      (req as any).log?.error?.({ err }, "learning complete failed");
      return res.status(500).json({ message: "Erro ao registrar conclusão" });
    }
  });

  app.get("/api/contacts/:id/learning-stats", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });

      const ptsRows = await db.execute(sqlExpr`
        SELECT COALESCE(SUM(points),0)::int AS points,
               COALESCE(SUM(duration_seconds),0)::int AS seconds
        FROM learning_points WHERE contact_id = ${id}
      `);
      const compRows = await db.execute(sqlExpr`
        SELECT COUNT(*)::int AS n FROM learning_completions WHERE contact_id = ${id}
      `);
      const badges = await db.select().from(learningBadges).where(eq(learningBadges.contactId, id));

      const points = Number((ptsRows.rows[0] as any)?.points ?? 0);
      const seconds = Number((ptsRows.rows[0] as any)?.seconds ?? 0);
      const minutes = Math.max(1, Math.round(seconds / 60));
      return res.json({
        points,
        completions: Number((compRows.rows[0] as any)?.n ?? 0),
        minutes,
        rpm: Math.round((points / minutes) * 100) / 100,
        badges,
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao carregar stats" });
    }
  });

  // ===== 7-11-4 indicator =====
  app.get("/api/contacts/:id/seven-eleven-four", authenticateToken, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const [c] = await db.select().from(unifiedContacts)
        .where(and(eq(unifiedContacts.id, id), eq(unifiedContacts.workspaceId, req.workspaceId!)))
        .limit(1);
      if (!c) return res.status(404).json({ message: "Contato não encontrado" });

      const learnSec = await db.execute(sqlExpr`
        SELECT COALESCE(SUM(duration_seconds),0)::int AS s FROM learning_points WHERE contact_id = ${id}
      `);
      const msgRows = await db.execute(sqlExpr`
        SELECT COUNT(*)::int AS touches, COUNT(DISTINCT channel_type)::int AS channels
        FROM omnichannel_messages WHERE unified_contact_id = ${id}
      `);
      const landingRows = await db.execute(sqlExpr`
        SELECT COUNT(*)::int AS submits FROM landing_page_submissions WHERE contact_id = ${id}
      `);

      const seconds = Number((learnSec.rows[0] as any)?.s ?? 0);
      const hoursOfContent = Math.round((seconds / 3600) * 100) / 100;
      const baseTouches = Number((msgRows.rows[0] as any)?.touches ?? 0);
      const submits = Number((landingRows.rows[0] as any)?.submits ?? 0);
      const touches = baseTouches + submits;
      const channels = Number((msgRows.rows[0] as any)?.channels ?? 0);

      const status = (val: number, target: number): "red" | "yellow" | "green" => {
        if (val >= target) return "green";
        if (val >= target * 0.5) return "yellow";
        return "red";
      };

      return res.json({
        hoursOfContent,
        touches,
        channels,
        targets: { hours: 7, touches: 11, channels: 4 },
        status: {
          hours: status(hoursOfContent, 7),
          touches: status(touches, 11),
          channels: status(channels, 4),
        },
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao calcular 7-11-4" });
    }
  });
}
