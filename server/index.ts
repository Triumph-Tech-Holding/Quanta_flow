import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initializeSocket } from "./socket";
import { db } from "./db";
import { users, roles, permissions, rolePermissions, userRoles } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { jobQueue } from "./jobQueue";
import { startLearningWorker } from "./learningWorker";

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
        mustChangePassword: false,
      });
      log("Admin user created: admin@quantaflow.com", "seed");
    } else {
      log(`Admin user exists (id: ${existing[0].id})`, "seed");
    }
  } catch (err) {
    console.error("Error ensuring admin user:", err);
  }
}

const app = express();
const httpServer = createServer(app);

initializeSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureRBAC();
  await ensureAdminUser();
  jobQueue.start();
  startLearningWorker();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
