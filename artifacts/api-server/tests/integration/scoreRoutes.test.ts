import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getTestApp } from "../helpers/app";
import { createTestWorkspaceAndAdmin, createTestContact, createTestLearningTrack, cleanupTestWorkspace, type TestContext } from "../helpers/factory";

describe("score & gamification routes", () => {
  let ctx: TestContext;
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let contactId: string;

  beforeAll(async () => {
    app = await getTestApp();
    ctx = await createTestWorkspaceAndAdmin("sr");
    contactId = await createTestContact(ctx.workspaceId, ctx.userId);
  });

  afterAll(async () => {
    await cleanupTestWorkspace(ctx);
  });

  it("GET /api/score-rules returns 401 without token", async () => {
    const res = await request(app).get("/api/score-rules");
    expect(res.status).toBe(401);
  });

  it("GET /api/score-rules seeds and returns 11 rules", async () => {
    const res = await request(app)
      .get("/api/score-rules")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(11);
  });

  it("PATCH /api/score-rules/:id updates points", async () => {
    const list = await request(app).get("/api/score-rules").set("Authorization", `Bearer ${ctx.token}`);
    const formRule = list.body.find((r: any) => r.eventType === "form_submitted");
    expect(formRule).toBeTruthy();
    const res = await request(app)
      .patch(`/api/score-rules/${formRule.id}`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ points: 25, hotThreshold: 90 });
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(25);
    expect(res.body.hotThreshold).toBe(90);
  });

  it("POST /api/contacts/:id/score/manual adds points and updates contact", async () => {
    const res = await request(app)
      .post(`/api/contacts/${contactId}/score/manual`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ points: 30, reason: "VIP" });
    expect(res.status).toBe(200);

    const events = await request(app)
      .get(`/api/contacts/${contactId}/score-events`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(events.status).toBe(200);
    expect(events.body.length).toBeGreaterThan(0);
  });

  it("POST /api/contacts/:id/score/manual rejects out-of-range", async () => {
    const res = await request(app)
      .post(`/api/contacts/${contactId}/score/manual`)
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ points: 9999 });
    expect(res.status).toBe(400);
  });

  it("GET /api/contacts/:id/timeline returns kinds", async () => {
    const res = await request(app)
      .get(`/api/contacts/${contactId}/timeline`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body.contact.id).toBe(contactId);
    expect(Array.isArray(res.body.timeline)).toBe(true);
  });

  it("POST /api/learning/complete awards points and badge", async () => {
    const trackId = await createTestLearningTrack(ctx.userId);
    const res = await request(app)
      .post("/api/learning/complete")
      .set("Authorization", `Bearer ${ctx.token}`)
      .send({ contactId, trackId, durationSeconds: 120 });
    expect(res.status).toBe(200);
  });

  it("GET /api/leaderboard returns leaders array", async () => {
    const res = await request(app)
      .get("/api/leaderboard?days=30")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaders");
    expect(Array.isArray(res.body.leaders)).toBe(true);
  });

  it("GET /api/ops/summary returns aggregations", async () => {
    const res = await request(app)
      .get("/api/ops/summary?days=30")
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sla");
    expect(res.body).toHaveProperty("learning");
    expect(res.body).toHaveProperty("scoreEvents");
  });

  it("GET /api/contacts/:id/seven-eleven-four returns targets", async () => {
    const res = await request(app)
      .get(`/api/contacts/${contactId}/seven-eleven-four`)
      .set("Authorization", `Bearer ${ctx.token}`);
    expect(res.status).toBe(200);
    expect(res.body.targets).toEqual({ hours: 7, touches: 11, channels: 4 });
    expect(res.body.status).toHaveProperty("hours");
  });
});
