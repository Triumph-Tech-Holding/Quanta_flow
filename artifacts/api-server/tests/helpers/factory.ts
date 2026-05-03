import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../src/db";
import { users, workspaces, workspaceMembers, unifiedContacts, learningTracks } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET!;

export interface TestContext {
  workspaceId: string;
  userId: string;
  email: string;
  password: string;
  token: string;
}

export async function createTestWorkspaceAndAdmin(suffix = randomUUID().slice(0, 8)): Promise<TestContext> {
  const email = `test-${suffix}-${Date.now()}@vitest.local`;
  const password = "Test@1234";
  const hashed = await bcrypt.hash(password, 10);

  const [u] = await db.insert(users).values({
    email,
    password: hashed,
    nome: `Test User ${suffix}`,
    tipoAtor: "admin",
    status: "active",
    tokenVersion: 1,
    mustChangePassword: false,
  }).returning();

  const [ws] = await db.insert(workspaces).values({
    name: `Test Workspace ${suffix}`,
    slug: `test-ws-${suffix}-${Date.now()}`.slice(0, 80),
    ownerUserId: u.id,
    plan: "pro",
  }).returning();

  await db.update(users).set({ currentWorkspaceId: ws.id }).where(eq(users.id, u.id));

  await db.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId: u.id,
    role: "owner",
  });

  const token = jwt.sign(
    { userId: u.id, email: u.email, tokenVersion: u.tokenVersion, workspaceId: ws.id },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { workspaceId: ws.id, userId: u.id, email, password, token };
}

export async function createTestContact(workspaceId: string, userId: string, nome = "Contato Teste"): Promise<string> {
  const [c] = await db.insert(unifiedContacts).values({
    workspaceId,
    userId,
    nome,
    telefone: `+5511${Math.floor(Math.random() * 1_000_000_000)}`,
    score: 0,
    temperature: "frio",
  }).returning();
  return c.id;
}

export async function createTestLearningTrack(userId: string, stage = "novo"): Promise<string> {
  const [t] = await db.insert(learningTracks).values({
    userId,
    stageOrIntent: stage,
    stepOrder: 1,
    delayHours: 0,
    contentType: "texto",
    content: "Conteúdo de teste",
    isActive: true,
  }).returning();
  return t.id;
}

export async function cleanupTestWorkspace(ctx: TestContext): Promise<void> {
  await db.delete(unifiedContacts).where(eq(unifiedContacts.workspaceId, ctx.workspaceId));
  await db.delete(learningTracks).where(eq(learningTracks.userId, ctx.userId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, ctx.workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, ctx.workspaceId));
  await db.delete(users).where(eq(users.id, ctx.userId));
}
