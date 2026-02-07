import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { boolean } from "drizzle-orm/pg-core";

export const tipoAtorEnum = pgEnum("tipo_ator", ["consumidor", "agente_fidelizacao", "lojista", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "suspended"]);
export const leadStatusEnum = pgEnum("lead_status", ["novo", "contatado", "qualificado", "convertido"]);
export const instanceStatusEnum = pgEnum("instance_status", ["disconnected", "connecting", "connected"]);
export const messageDirectionEnum = pgEnum("message_direction", ["incoming", "outgoing"]);
export const settingTypeEnum = pgEnum("setting_type", ["api_key", "url", "token", "id", "secret"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  tipoAtor: tipoAtorEnum("tipo_ator").notNull().default("consumidor"),
  nome: varchar("nome", { length: 255 }).notNull(),
  telefone: varchar("telefone", { length: 20 }),
  status: userStatusEnum("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  donoId: varchar("dono_id", { length: 36 }).notNull().references(() => users.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  status: leadStatusEnum("status").notNull().default("novo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiConfigs = pgTable("api_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  apiName: varchar("api_name", { length: 50 }).notNull(),
  apiKey: text("api_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evolutionConfigs = pgTable("evolution_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  evolutionUrl: text("evolution_url").notNull(),
  globalToken: text("global_token").notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }),
  status: instanceStatusEnum("status").notNull().default("disconnected"),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  leadId: varchar("lead_id", { length: 36 }).references(() => leads.id),
  remoteJid: varchar("remote_jid", { length: 100 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: varchar("unread_count", { length: 10 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  messageId: varchar("message_id", { length: 100 }),
  direction: messageDirectionEnum("direction").notNull(),
  content: text("content").notNull(),
  mediaType: varchar("media_type", { length: 50 }),
  mediaUrl: text("media_url"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const registerUserSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const loginUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiConfigSchema = createInsertSchema(apiConfigs).omit({
  id: true,
  createdAt: true,
});

export const updateLeadSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  status: z.enum(["novo", "contatado", "qualificado", "convertido"]).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type ApiConfig = typeof apiConfigs.$inferSelect;
export type UpdateLead = z.infer<typeof updateLeadSchema>;

export const insertEvolutionConfigSchema = createInsertSchema(evolutionConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  instanceId: true,
  webhookUrl: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const connectEvolutionSchema = z.object({
  evolutionUrl: z.string().url("URL inválida"),
  globalToken: z.string().min(1, "Token obrigatório"),
});

export const connectZApiSchema = z.object({
  instanceId: z.string().min(1, "ID da instância obrigatório"),
  token: z.string().min(1, "Token obrigatório"),
  clientToken: z.string().min(1, "Client-Token obrigatório"),
});

export type InsertEvolutionConfig = z.infer<typeof insertEvolutionConfigSchema>;
export type EvolutionConfig = typeof evolutionConfigs.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  type: settingTypeEnum("type").notNull().default("api_key"),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  description: varchar("description", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  isEncrypted: boolean("is_encrypted").notNull().default(true),
  lastUpdatedBy: varchar("last_updated_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const settingsAudit = pgTable("settings_audit", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  action: varchar("action", { length: 20 }).notNull(),
  changedBy: varchar("changed_by", { length: 36 }).notNull().references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSettingSchema = z.object({
  value: z.string().optional(),
  type: z.enum(["api_key", "url", "token", "id", "secret"]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
export type UpdateSetting = z.infer<typeof updateSettingSchema>;
export type SettingsAudit = typeof settingsAudit.$inferSelect;

export const roles = pgTable("roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  resource: varchar("resource", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id", { length: 36 }).notNull().references(() => roles.id),
  permissionId: varchar("permission_id", { length: 36 }).notNull().references(() => permissions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  roleId: varchar("role_id", { length: 36 }).notNull().references(() => roles.id),
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 50 }).notNull(),
  resourceId: varchar("resource_id", { length: 36 }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== OMNICHANNEL CRM ====================

export const channelTypeEnum = pgEnum("channel_type", [
  "whatsapp", "instagram", "facebook", "linkedin", "youtube", "tiktok", "x", "email", "sms"
]);

export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "novo", "qualificado", "proposta", "negociacao", "fechado_ganho", "fechado_perdido"
]);

export const leadTemperatureEnum = pgEnum("lead_temperature", [
  "frio", "morno", "quente"
]);

export const intentTypeEnum = pgEnum("intent_type", [
  "compra_quente", "duvida", "reclamacao", "suporte", "elogio", "indefinido"
]);

export const channels = pgTable("channels", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  type: channelTypeEnum("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  config: text("config"),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const unifiedContacts = pgTable("unified_contacts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 50 }),
  avatarUrl: text("avatar_url"),
  pipelineStage: pipelineStageEnum("pipeline_stage").notNull().default("novo"),
  temperature: leadTemperatureEnum("temperature").notNull().default("frio"),
  lastIntent: intentTypeEnum("last_intent").default("indefinido"),
  notes: text("notes"),
  tags: text("tags"),
  score: integer("score").notNull().default(0),
  lastContactAt: timestamp("last_contact_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactIdentifiers = pgTable("contact_identifiers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  unifiedContactId: varchar("unified_contact_id", { length: 36 }).notNull().references(() => unifiedContacts.id, { onDelete: "cascade" }),
  channelType: channelTypeEnum("channel_type").notNull(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  profileUrl: text("profile_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const omnichannelMessages = pgTable("omnichannel_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  unifiedContactId: varchar("unified_contact_id", { length: 36 }).notNull().references(() => unifiedContacts.id, { onDelete: "cascade" }),
  channelType: channelTypeEnum("channel_type").notNull(),
  direction: messageDirectionEnum("direction").notNull(),
  content: text("content").notNull(),
  mediaType: varchar("media_type", { length: 50 }),
  mediaUrl: text("media_url"),
  externalMessageId: varchar("external_message_id", { length: 200 }),
  detectedIntent: intentTypeEnum("detected_intent"),
  intentConfidence: varchar("intent_confidence", { length: 10 }),
  metadata: text("metadata"),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  stage: pipelineStageEnum("stage").notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#00A86B"),
  order: integer("order").notNull().default(0),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== Omnichannel Schemas & Types ====================

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertUnifiedContactSchema = createInsertSchema(unifiedContacts).omit({
  id: true, createdAt: true, updatedAt: true, score: true,
});

export const updateUnifiedContactSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  pipelineStage: z.enum(["novo", "qualificado", "proposta", "negociacao", "fechado_ganho", "fechado_perdido"]).optional(),
  temperature: z.enum(["frio", "morno", "quente"]).optional(),
  lastIntent: z.enum(["compra_quente", "duvida", "reclamacao", "suporte", "elogio", "indefinido"]).optional(),
  notes: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  score: z.number().optional(),
});

export const insertContactIdentifierSchema = createInsertSchema(contactIdentifiers).omit({
  id: true, createdAt: true,
});

export const insertOmnichannelMessageSchema = createInsertSchema(omnichannelMessages).omit({
  id: true, createdAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true, createdAt: true,
});

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type UnifiedContact = typeof unifiedContacts.$inferSelect;
export type InsertUnifiedContact = z.infer<typeof insertUnifiedContactSchema>;
export type UpdateUnifiedContact = z.infer<typeof updateUnifiedContactSchema>;
export type ContactIdentifier = typeof contactIdentifiers.$inferSelect;
export type InsertContactIdentifier = z.infer<typeof insertContactIdentifierSchema>;
export type OmnichannelMessage = typeof omnichannelMessages.$inferSelect;
export type InsertOmnichannelMessage = z.infer<typeof insertOmnichannelMessageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
