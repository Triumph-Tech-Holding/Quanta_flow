import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userRoles, rolePermissions, permissions, roles, users } from "@shared/schema";
import { eq } from "drizzle-orm";

const ALL_PERMISSIONS = [
  "view_settings", "edit_settings", "delete_settings",
  "view_users", "create_users", "edit_users", "delete_users",
  "view_audit_logs", "export_audit_logs",
  "view_inbox", "edit_inbox",
  "view_leads", "create_leads", "edit_leads",
  "view_api_configs", "edit_api_configs",
  "manage_roles", "assign_roles",
];

interface RBACRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tokenVersion: number;
    roles?: string[];
    permissions?: string[];
  };
}

async function isAdminUser(userId: string): Promise<boolean> {
  const user = await db
    .select({ tipoAtor: users.tipoAtor })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user.length > 0 && user[0].tipoAtor === "admin";
}

export async function getUserRolesAndPermissions(userId: string): Promise<{
  roles: string[];
  permissions: string[];
}> {
  const userRoleRows = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const roleNames = userRoleRows.map((r) => r.roleName);

  if (roleNames.length === 0) {
    const admin = await isAdminUser(userId);
    if (admin) {
      return { roles: ["super_admin"], permissions: [...ALL_PERMISSIONS] };
    }
    return { roles: [], permissions: [] };
  }

  let allPermNames: string[] = [];
  for (const roleName of roleNames) {
    const roleRow = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (roleRow.length > 0) {
      const perms = await db
        .select({ permName: permissions.name })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleRow[0].id));

      allPermNames.push(...perms.map((p) => p.permName));
    }
  }

  const uniquePerms = Array.from(new Set(allPermNames));

  if (uniquePerms.length === 0) {
    const admin = await isAdminUser(userId);
    if (admin) {
      return { roles: roleNames, permissions: [...ALL_PERMISSIONS] };
    }
  }

  return { roles: roleNames, permissions: uniquePerms };
}

export function checkPermission(requiredPermission: string) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const { permissions: userPerms, roles: userRolesList } = await getUserRolesAndPermissions(req.user.userId);

      if (userPerms.includes(requiredPermission)) {
        req.user.permissions = userPerms;
        req.user.roles = userRolesList;
        return next();
      }

      const admin = await isAdminUser(req.user.userId);
      if (admin) {
        req.user.permissions = [...ALL_PERMISSIONS];
        req.user.roles = userRolesList.length > 0 ? userRolesList : ["super_admin"];
        return next();
      }

      await logUnauthorizedAccess(req, requiredPermission);
      return res.status(403).json({
        message: "Acesso negado. Permissão insuficiente.",
        required: requiredPermission,
      });
    } catch (error) {
      console.error("[rbac] Error checking permission:", error);
      return res.status(500).json({ message: "Erro ao verificar permissões" });
    }
  };
}

export function checkRole(requiredRole: string | string[]) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const { roles: userRoleNames } = await getUserRolesAndPermissions(req.user.userId);
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

      if (requiredRoles.some(r => userRoleNames.includes(r))) {
        req.user.roles = userRoleNames;
        return next();
      }

      const admin = await isAdminUser(req.user.userId);
      if (admin) {
        req.user.roles = ["super_admin"];
        return next();
      }

      await logUnauthorizedAccess(req, `role:${requiredRoles.join(",")}`);
      return res.status(403).json({
        message: "Acesso negado. Role insuficiente.",
        required: requiredRole,
      });
    } catch (error) {
      console.error("[rbac] Error checking role:", error);
      return res.status(500).json({ message: "Erro ao verificar role" });
    }
  };
}

async function logUnauthorizedAccess(req: RBACRequest, requiredPermission: string) {
  try {
    const { auditLogs } = await import("@shared/schema");
    await db.insert(auditLogs).values({
      userId: req.user!.userId,
      action: "unauthorized_access_attempt",
      resource: requiredPermission,
      ipAddress: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });
  } catch (err) {
    console.error("[rbac] Failed to log unauthorized access:", err);
  }
}
