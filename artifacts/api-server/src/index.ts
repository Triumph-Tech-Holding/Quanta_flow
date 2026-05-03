import { createApp, log } from "./app";
import { db } from "./db";
import { users, roles, permissions, rolePermissions, userRoles, flowTemplates, documentationVersions, projectStatusItems } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jobQueue } from "./jobQueue";
import { startLearningWorker } from "./learningWorker";
import { startCampaignWorker } from "./campaignWorker";
import { startBrainWorker } from "./services/brainWorker";

export { log };

const RBAC_SEED = {
  roles: [
    { name: "super_admin", description: "Acesso total ao sistema" },
    { name: "admin", description: "Gerente com acesso limitado" },
    { name: "user", description: "Atendente com acesso básico" },
  ],
  permissions: [
    { name: "view_settings", resource: "settings", action: "view", description: "Visualizar configurações" },
    { name: "edit_settings", resource: "settings", action: "edit", description: "Editar configurações" },
    { name: "delete_settings", resource: "settings", action: "delete", description: "Deletar configurações" },
    { name: "view_users", resource: "users", action: "view", description: "Visualizar usuários" },
    { name: "create_users", resource: "users", action: "create", description: "Criar usuários" },
    { name: "edit_users", resource: "users", action: "edit", description: "Editar usuários" },
    { name: "delete_users", resource: "users", action: "delete", description: "Deletar usuários" },
    { name: "view_audit_logs", resource: "audit_logs", action: "view", description: "Visualizar logs" },
    { name: "export_audit_logs", resource: "audit_logs", action: "export", description: "Exportar logs" },
    { name: "view_inbox", resource: "inbox", action: "view", description: "Visualizar inbox" },
    { name: "edit_inbox", resource: "inbox", action: "edit", description: "Editar inbox" },
    { name: "view_leads", resource: "leads", action: "view", description: "Visualizar leads" },
    { name: "create_leads", resource: "leads", action: "create", description: "Criar leads" },
    { name: "edit_leads", resource: "leads", action: "edit", description: "Editar leads" },
    { name: "view_api_configs", resource: "api_configs", action: "view", description: "Visualizar APIs" },
    { name: "edit_api_configs", resource: "api_configs", action: "edit", description: "Editar APIs" },
    { name: "manage_roles", resource: "roles", action: "manage", description: "Gerenciar roles" },
    { name: "assign_roles", resource: "roles", action: "assign", description: "Atribuir roles" },
  ],
  rolePermissions: {
    super_admin: "all",
    admin: [
      "view_settings", "edit_settings",
      "view_users", "create_users", "edit_users",
      "view_audit_logs",
      "view_inbox", "edit_inbox",
      "view_leads", "create_leads", "edit_leads",
    ],
    user: [
      "view_inbox", "edit_inbox",
      "view_leads", "create_leads", "edit_leads",
    ],
  } as Record<string, string | string[]>,
};

async function ensureRBAC() {
  try {
    const existingRoles = await db.select({ name: roles.name }).from(roles);
    if (existingRoles.length >= 3) {
      log(`RBAC seed OK (${existingRoles.length} roles)`, "seed");
      return;
    }

    for (const r of RBAC_SEED.roles) {
      const exists = existingRoles.find((er) => er.name === r.name);
      if (!exists) {
        await db.insert(roles).values(r);
      }
    }

    const existingPerms = await db.select({ name: permissions.name }).from(permissions);
    for (const p of RBAC_SEED.permissions) {
      const exists = existingPerms.find((ep) => ep.name === p.name);
      if (!exists) {
        await db.insert(permissions).values(p);
      }
    }

    const allRoles = await db.select().from(roles);
    const allPerms = await db.select().from(permissions);
    const existingRP = await db.select().from(rolePermissions);

    for (const [roleName, permList] of Object.entries(RBAC_SEED.rolePermissions)) {
      const role = allRoles.find((r) => r.name === roleName);
      if (!role) continue;
      const assignPerms = permList === "all" ? allPerms : allPerms.filter((p) => (permList as string[]).includes(p.name));
      for (const perm of assignPerms) {
        const exists = existingRP.find((rp) => rp.roleId === role.id && rp.permissionId === perm.id);
        if (!exists) {
          await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id });
        }
      }
    }

    log(`RBAC seed completed (${RBAC_SEED.roles.length} roles, ${RBAC_SEED.permissions.length} permissions)`, "seed");
  } catch (err) {
    console.error("Error seeding RBAC:", err);
  }
}

async function ensureAdminUser() {
  try {
    const existing = await db
      .select({ id: users.id, tipoAtor: users.tipoAtor })
      .from(users)
      .where(eq(users.email, "admin@quantaflow.com"))
      .limit(1);

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await db.insert(users).values({
        email: "admin@quantaflow.com",
        password: hashedPassword,
        nome: "Admin",
        tipoAtor: "admin",
        status: "active",
        tokenVersion: 0,
        mustChangePassword: true,
      });
      log("Admin user created: admin@quantaflow.com", "seed");
    } else {
      log(`Admin user exists (id: ${existing[0].id})`, "seed");
    }
  } catch (err) {
    console.error("Error ensuring admin user:", err);
  }
}

const FLOW_TEMPLATE_SEEDS = [
  {
    id: "tpl_welcome",
    name: "Boas-vindas",
    description: "Fluxo de boas-vindas para novos contatos",
    category: "onboarding",
    blocks: [
      { id: "b1", type: "text", label: "Saudação", config: { message: "Olá {nome}! 👋 Seja bem-vindo(a)! Como posso te ajudar hoje?" }, position: { x: 250, y: 50 }, nextBlockId: "b2" },
      { id: "b2", type: "delay", label: "Aguardar resposta", config: { delaySeconds: 60, delayUnit: "seconds" }, position: { x: 250, y: 200 }, nextBlockId: "b3" },
      { id: "b3", type: "text", label: "Follow-up", config: { message: "Estou aqui se precisar de algo! 😊" }, position: { x: 250, y: 350 }, nextBlockId: null },
    ],
  },
];

async function seedFlowTemplates() {
  try {
    const existing = await db.select({ id: flowTemplates.id }).from(flowTemplates);
    const existingIds = new Set(existing.map((t) => t.id));
    for (const tpl of FLOW_TEMPLATE_SEEDS) {
      if (!existingIds.has(tpl.id)) {
        await db.insert(flowTemplates).values(tpl);
      }
    }
    log(`Flow templates seed OK (${FLOW_TEMPLATE_SEEDS.length} templates)`, "seed");
  } catch (err) {
    console.error("Error seeding flow templates:", err);
  }
}

async function migrateWorkspaces() {
  try {
    await db.execute(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_plan') THEN
          CREATE TYPE workspace_plan AS ENUM ('free', 'pro', 'business', 'enterprise');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_member_role') THEN
          CREATE TYPE workspace_member_role AS ENUM ('owner', 'admin', 'member');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(80) NOT NULL UNIQUE,
        owner_user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        plan workspace_plan NOT NULL DEFAULT 'free',
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_member_role NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(workspace_id, user_id)
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workspace_id VARCHAR(36);
      ALTER TABLE unified_contacts ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);
      ALTER TABLE automation_flows ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);

      CREATE INDEX IF NOT EXISTS idx_unified_contacts_workspace ON unified_contacts(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_automation_flows_workspace ON automation_flows(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
    `);
    log("Workspaces migration OK", "seed");
  } catch (err) {
    console.error("Error migrating workspaces:", err);
  }
}

async function backfillWorkspaces() {
  try {
    const { sql } = await import("drizzle-orm");
    const usersWithoutWorkspace = await db.execute<{ id: string; nome: string; email: string }>(
      sql`SELECT id, nome, email FROM users WHERE current_workspace_id IS NULL`
    );

    const rows: any[] = (usersWithoutWorkspace as any).rows || (usersWithoutWorkspace as any) || [];
    if (!rows.length) {
      log("Workspaces backfill OK (nothing to backfill)", "seed");
      return;
    }

    for (const u of rows) {
      const baseSlug = (u.email || u.nome || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "workspace";
      const slug = `${baseSlug}-${u.id.slice(0, 6)}`;
      const wsName = `${u.nome || "Meu"} Workspace`;

      const existing = await db.execute<{ id: string }>(
        sql`SELECT id FROM workspaces WHERE owner_user_id = ${u.id} LIMIT 1`
      );
      const existingRows: any[] = (existing as any).rows || (existing as any) || [];
      let workspaceId: string;

      if (existingRows.length > 0) {
        workspaceId = existingRows[0].id;
      } else {
        const created = await db.execute<{ id: string }>(
          sql`INSERT INTO workspaces (name, slug, owner_user_id, plan)
              VALUES (${wsName}, ${slug}, ${u.id}, 'free')
              RETURNING id`
        );
        const createdRows: any[] = (created as any).rows || (created as any) || [];
        workspaceId = createdRows[0].id;
      }

      await db.execute(
        sql`INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES (${workspaceId}, ${u.id}, 'owner')
            ON CONFLICT (workspace_id, user_id) DO NOTHING`
      );

      await db.execute(sql`UPDATE users SET current_workspace_id = ${workspaceId} WHERE id = ${u.id}`);
    }
    log(`Workspaces backfill OK (${rows.length} users)`, "seed");
  } catch (err) {
    console.error("Error backfilling workspaces:", err);
  }
}

(async () => {
  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  const { httpServer } = await createApp();

  await ensureRBAC();
  await ensureAdminUser();
  await seedFlowTemplates();
  await migrateWorkspaces();
  await backfillWorkspaces();

  jobQueue.start();
  startLearningWorker();
  startCampaignWorker();
  startBrainWorker();

  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
