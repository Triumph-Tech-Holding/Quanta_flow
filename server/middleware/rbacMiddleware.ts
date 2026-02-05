import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userRoles, rolePermissions, permissions, roles } from "@shared/schema";
import { eq } from "drizzle-orm";

interface RBACRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tokenVersion: number;
    roles?: string[];
    permissions?: string[];
  };
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
    return { roles: [], permissions: [] };
  }

  const roleIds = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, roleNames[0]));

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

  return { roles: roleNames, permissions: uniquePerms };
}

export function checkPermission(requiredPermission: string) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const { permissions: userPerms } = await getUserRolesAndPermissions(req.user.userId);

      if (!userPerms.includes(requiredPermission)) {
        await logUnauthorizedAccess(req, requiredPermission);
        return res.status(403).json({
          message: "Acesso negado. Permissão insuficiente.",
          required: requiredPermission,
        });
      }

      req.user.permissions = userPerms;
      next();
    } catch (error) {
      console.error("[rbac] Error checking permission:", error);
      return res.status(500).json({ message: "Erro ao verificar permissões" });
    }
  };
}

export function checkRole(requiredRole: string) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const { roles: userRoleNames } = await getUserRolesAndPermissions(req.user.userId);

      if (!userRoleNames.includes(requiredRole)) {
        await logUnauthorizedAccess(req, `role:${requiredRole}`);
        return res.status(403).json({
          message: "Acesso negado. Role insuficiente.",
          required: requiredRole,
        });
      }

      req.user.roles = userRoleNames;
      next();
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
