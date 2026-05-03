import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../src/db";
import { contactScoreEvents, scoreRules, unifiedContacts } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ensureDefaultScoreRules,
  awardScoreEvent,
  recomputeContactScore,
  getRecentScoreEvents,
} from "../../src/services/scoreEngine";
import { createTestWorkspaceAndAdmin, createTestContact, cleanupTestWorkspace, type TestContext } from "../helpers/factory";

describe("scoreEngine", () => {
  let ctx: TestContext;
  let contactId: string;

  beforeAll(async () => {
    ctx = await createTestWorkspaceAndAdmin("se");
    contactId = await createTestContact(ctx.workspaceId, ctx.userId);
  });

  afterAll(async () => {
    await cleanupTestWorkspace(ctx);
  });

  it("seeds 11 default rules per workspace", async () => {
    const rules = await ensureDefaultScoreRules(ctx.workspaceId);
    expect(rules.length).toBe(11);
    const formRule = rules.find((r) => r.eventType === "form_submitted");
    expect(formRule?.points).toBe(15);
    expect(formRule?.hotThreshold).toBe(80);
    expect(formRule?.warmThreshold).toBe(40);
    expect(formRule?.coolDownDays).toBe(14);
  });

  it("seed is idempotent", async () => {
    const a = await ensureDefaultScoreRules(ctx.workspaceId);
    const b = await ensureDefaultScoreRules(ctx.workspaceId);
    expect(a.length).toBe(b.length);
    const total = await db.select().from(scoreRules).where(eq(scoreRules.workspaceId, ctx.workspaceId));
    expect(total.length).toBe(11);
  });

  it("award + recompute updates contact score and temperature", async () => {
    await awardScoreEvent({
      workspaceId: ctx.workspaceId,
      contactId,
      eventType: "form_submitted",
      source: "unit-test",
    });
    const events = await getRecentScoreEvents(contactId, 10);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.points).toBe(15);

    const [c] = await db.select().from(unifiedContacts).where(eq(unifiedContacts.id, contactId));
    expect(c!.score).toBe(15);
    expect(c!.temperature).toBe("frio"); // 15 < 40
  });

  it("crosses morno threshold at 40+", async () => {
    // Add deal_won (+50) → total = 65 → morno
    await awardScoreEvent({
      workspaceId: ctx.workspaceId,
      contactId,
      eventType: "deal_won",
      source: "unit-test",
    });
    const r = await recomputeContactScore(contactId);
    expect(r?.score).toBe(65);
    expect(r?.temperature).toBe("morno");
  });

  it("clamps score at 100 (quente)", async () => {
    // Add another deal_won → would be 115 but clamped to 100 → quente
    await awardScoreEvent({
      workspaceId: ctx.workspaceId,
      contactId,
      eventType: "deal_won",
      source: "unit-test-clamp",
    });
    const r = await recomputeContactScore(contactId);
    expect(r?.score).toBe(100);
    expect(r?.temperature).toBe("quente");
  });

  it("clamps score at 0 with negative events", async () => {
    const c2 = await createTestContact(ctx.workspaceId, ctx.userId, "Negativo");
    await awardScoreEvent({ workspaceId: ctx.workspaceId, contactId: c2, eventType: "deal_lost", source: "u" });
    const r = await recomputeContactScore(c2);
    expect(r?.score).toBe(0);
    expect(r?.temperature).toBe("frio");
  });
});
