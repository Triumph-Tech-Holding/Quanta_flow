import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getTestApp } from "../helpers/app";
import { createTestWorkspaceAndAdmin, cleanupTestWorkspace, type TestContext } from "../helpers/factory";

describe("auth flow", () => {
  let ctx: TestContext;
  let app: Awaited<ReturnType<typeof getTestApp>>;

  beforeAll(async () => {
    app = await getTestApp();
    ctx = await createTestWorkspaceAndAdmin("auth");
  });

  afterAll(async () => {
    await cleanupTestWorkspace(ctx);
  });

  it("GET /api/healthz returns ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/auth/login succeeds with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ctx.email, password: ctx.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(ctx.email);
  });

  it("POST /api/auth/login rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ctx.email, password: "wrong-password" });
    expect([400, 401]).toContain(res.status);
  });
});
