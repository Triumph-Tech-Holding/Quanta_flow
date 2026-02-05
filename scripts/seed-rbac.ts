import { db } from "../server/db";
import { roles, permissions, rolePermissions, userRoles, users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ROLES_DATA = [
  { name: "super_admin", description: "Acesso total ao sistema" },
  { name: "admin", description: "Gerente com acesso limitado" },
  { name: "user", description: "Atendente com acesso básico" },
];

const PERMISSIONS_DATA = [
  { name: "view_settings", description: "Visualizar configurações", resource: "settings", action: "view" },
  { name: "edit_settings", description: "Editar configurações", resource: "settings", action: "update" },
  { name: "delete_settings", description: "Deletar configurações", resource: "settings", action: "delete" },
  { name: "view_users", description: "Visualizar usuários", resource: "users", action: "view" },
  { name: "create_users", description: "Criar usuários", resource: "users", action: "create" },
  { name: "edit_users", description: "Editar usuários", resource: "users", action: "update" },
  { name: "delete_users", description: "Deletar usuários", resource: "users", action: "delete" },
  { name: "view_audit_logs", description: "Visualizar logs de auditoria", resource: "audit_logs", action: "view" },
  { name: "export_audit_logs", description: "Exportar logs de auditoria", resource: "audit_logs", action: "export" },
  { name: "view_inbox", description: "Visualizar inbox", resource: "inbox", action: "view" },
  { name: "edit_inbox", description: "Gerenciar inbox", resource: "inbox", action: "update" },
  { name: "view_leads", description: "Visualizar leads", resource: "leads", action: "view" },
  { name: "create_leads", description: "Criar leads", resource: "leads", action: "create" },
  { name: "edit_leads", description: "Editar leads", resource: "leads", action: "update" },
  { name: "view_api_configs", description: "Visualizar configs de API", resource: "api_configs", action: "view" },
  { name: "edit_api_configs", description: "Editar configs de API", resource: "api_configs", action: "update" },
  { name: "manage_roles", description: "Gerenciar roles", resource: "roles", action: "manage" },
  { name: "assign_roles", description: "Atribuir roles a usuários", resource: "roles", action: "assign" },
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  super_admin: [
    "view_settings", "edit_settings", "delete_settings",
    "view_users", "create_users", "edit_users", "delete_users",
    "view_audit_logs", "export_audit_logs",
    "view_inbox", "edit_inbox",
    "view_leads", "create_leads", "edit_leads",
    "view_api_configs", "edit_api_configs",
    "manage_roles", "assign_roles",
  ],
  admin: [
    "view_users", "create_users", "edit_users",
    "view_audit_logs",
    "view_inbox", "edit_inbox",
    "view_leads", "create_leads", "edit_leads",
  ],
  user: [
    "view_inbox", "edit_inbox",
    "view_leads", "create_leads", "edit_leads",
  ],
};

async function seed() {
  console.log("Seeding RBAC tables...");

  const createdRoles: Record<string, string> = {};
  for (const role of ROLES_DATA) {
    const existing = await db.select().from(roles).where(eq(roles.name, role.name)).limit(1);
    if (existing.length > 0) {
      createdRoles[role.name] = existing[0].id;
      console.log(`Role '${role.name}' already exists (${existing[0].id})`);
    } else {
      const [created] = await db.insert(roles).values(role).returning();
      createdRoles[role.name] = created.id;
      console.log(`Created role: ${role.name} (${created.id})`);
    }
  }

  const createdPermissions: Record<string, string> = {};
  for (const perm of PERMISSIONS_DATA) {
    const existing = await db.select().from(permissions).where(eq(permissions.name, perm.name)).limit(1);
    if (existing.length > 0) {
      createdPermissions[perm.name] = existing[0].id;
    } else {
      const [created] = await db.insert(permissions).values(perm).returning();
      createdPermissions[perm.name] = created.id;
      console.log(`Created permission: ${perm.name}`);
    }
  }

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = createdRoles[roleName];
    for (const permName of permNames) {
      const permId = createdPermissions[permName];
      const existing = await db.select().from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
        .limit(100);
      const alreadyLinked = existing.find(rp => rp.permissionId === permId);
      if (!alreadyLinked) {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId });
      }
    }
    console.log(`Linked ${permNames.length} permissions to role: ${roleName}`);
  }

  const adminEmail = "admin@quantaflow.com";
  let adminUser = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (adminUser.length === 0) {
    const hashedPassword = await bcrypt.hash("Pripret7", 10);
    const [created] = await db.insert(users).values({
      email: adminEmail,
      password: hashedPassword,
      nome: "Admin User",
      tipoAtor: "admin",
      telefone: "(11) 99999-9999",
      status: "active",
      mustChangePassword: false,
      tokenVersion: 1,
    }).returning();
    adminUser = [created];
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const superAdminRoleId = createdRoles["super_admin"];
  const existingUserRole = await db.select().from(userRoles)
    .where(eq(userRoles.userId, adminUser[0].id))
    .limit(10);
  const alreadyAssigned = existingUserRole.find(ur => ur.roleId === superAdminRoleId);
  if (!alreadyAssigned) {
    await db.insert(userRoles).values({
      userId: adminUser[0].id,
      roleId: superAdminRoleId,
      assignedBy: adminUser[0].id,
    });
    console.log(`Assigned super_admin role to ${adminEmail}`);
  } else {
    console.log(`Admin already has super_admin role`);
  }

  console.log("RBAC seed completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
