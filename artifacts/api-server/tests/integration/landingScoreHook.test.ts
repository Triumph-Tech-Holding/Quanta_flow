import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getTestApp } from "../helpers/app";
import { db } from "../../src/db";
import { landingPages, unifiedContacts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestWorkspaceAndAdmin, cleanupTestWorkspace, type TestContext } from "../helpers/factory";

describe("landing → score hook", () => {
  let ctx: TestContext;
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let pageSlug: string;

  beforeAll(async () => {
    app = await getTestApp();
    ctx = await createTestWorkspaceAndAdmin("lp");
    pageSlug = `lp-test-${Date.now()}`;
    const blocks = [
      {
        id: "form-1",
        type: "form",
        props: {
          title: "Form",
          submitLabel: "Enviar",
          successMessage: "Ok",
          fields: [
            { id: "n", type: "text", name: "nome", label: "Nome", required: true },
            { id: "p", type: "phone", name: "telefone", label: "Tel", required: true },
          ],
        },
      },
    ];
    await db.insert(landingPages).values({
      workspaceId: ctx.workspaceId,
      ownerUserId: ctx.userId,
      name: "Test LP",
      slug: pageSlug,
      status: "published",
      draftBlocks: blocks as object,
      publishedBlocks: blocks as object,
      publishedVersion: 1,
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(landingPages).where(eq(landingPages.slug, pageSlug));
    await cleanupTestWorkspace(ctx);
  });

  it("public submit creates contact and awards form_submitted score", async () => {
    const phone = `+5511${Math.floor(Math.random() * 1_000_000_000)}`;
    const res = await request(app)
      .post(`/api/public/landing/${pageSlug}/submit`)
      .send({ values: { nome: "Lead Teste", telefone: phone } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Wait briefly for async score recompute
    await new Promise((r) => setTimeout(r, 200));

    const contacts = await db.select().from(unifiedContacts)
      .where(eq(unifiedContacts.workspaceId, ctx.workspaceId));
    expect(contacts.length).toBeGreaterThan(0);
    const lead = contacts[0]!;
    // form_submitted default = 15 → score should be at least 15
    expect(lead.score).toBeGreaterThanOrEqual(15);
  });
});
