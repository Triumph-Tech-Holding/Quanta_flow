import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, integer, real, jsonb } from "drizzle-orm/pg-core";
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

export const whatsappProviderEnum = pgEnum("whatsapp_provider", ["zapi", "baileys", "evolution", "none"]);

export const evolutionConfigs = pgTable("evolution_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  evolutionUrl: text("evolution_url").notNull(),
  globalToken: text("global_token").notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }),
  status: instanceStatusEnum("status").notNull().default("disconnected"),
  webhookUrl: text("webhook_url"),
  activeProvider: whatsappProviderEnum("active_provider").default("zapi"),
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
  channel: varchar("channel", { length: 20 }).default("whatsapp"),
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
  assignedToUserId: varchar("assigned_to_user_id", { length: 36 }).references(() => users.id),
  queueStatus: varchar("queue_status", { length: 20 }),
  queueEnteredAt: timestamp("queue_entered_at"),
  assignedAt: timestamp("assigned_at"),
  slaDeadline: timestamp("sla_deadline"),
  slaBreached: boolean("sla_breached").default(false),
  activeFlowId: varchar("active_flow_id", { length: 36 }),
  aiSummary: text("ai_summary"),
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

// ==================== Agent Assignments ====================

export const agentAssignments = pgTable("agent_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id", { length: 36 }).notNull().references(() => unifiedContacts.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 36 }).notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 36 }).references(() => users.id),
  notes: text("notes"),
});

// ==================== Learning Tracks & Deliveries ====================

export const learningTracks = pgTable("learning_tracks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  stageOrIntent: varchar("stage_or_intent", { length: 100 }).notNull(),
  stepOrder: integer("step_order").notNull().default(0),
  delayHours: real("delay_hours").notNull().default(0),
  contentType: varchar("content_type", { length: 20 }).notNull().default("texto"),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learningDeliveries = pgTable("learning_deliveries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id", { length: 36 }).notNull().references(() => unifiedContacts.id, { onDelete: "cascade" }),
  trackId: varchar("track_id", { length: 36 }).notNull().references(() => learningTracks.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== Quick Replies & Automation Flows ====================

export const quickReplies = pgTable("quick_replies", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  shortcut: varchar("shortcut", { length: 50 }).notNull(),
  response: text("response").notNull(),
  category: varchar("category", { length: 50 }).default("geral"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationFlows = pgTable("automation_flows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  triggerKeywords: text("trigger_keywords").notNull(),
  responseTemplate: text("response_template").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  systemPrompt: text("system_prompt"),
  initialMessage: text("initial_message"),
  temperature: real("temperature").default(0.4),
  responseDelay: integer("response_delay").default(10),
  inactivityTimeout: integer("inactivity_timeout").default(10),
  successCondition: text("success_condition"),
  interruptCondition: text("interrupt_condition"),
  summaryEnabled: boolean("summary_enabled").default(false),
  summaryFields: text("summary_fields"),
  steps: jsonb("steps").$type<Array<{ order: number; message: string; delaySeconds: number }>>(),
  conditionalExits: jsonb("conditional_exits").$type<Array<{ condition: string; label: string; targetFlowId: string; triggerKeywords: string[] }>>(),
  agentId: varchar("agent_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const brandingConfig = pgTable("branding_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  companyName: varchar("company_name", { length: 255 }),
  primaryColor: varchar("primary_color", { length: 20 }).default("#00A86B"),
  secondaryColor: varchar("secondary_color", { length: 20 }).default("#1B3A57"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  defaultSlaMinutes: integer("default_sla_minutes").default(60),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  assignedToUserId: z.string().optional().nullable(),
  queueStatus: z.enum(["waiting", "assigned", "resolved"]).optional().nullable(),
  queueEnteredAt: z.string().optional().nullable(),
  assignedAt: z.string().optional().nullable(),
  slaDeadline: z.string().optional().nullable(),
  slaBreached: z.boolean().optional().nullable(),
  activeFlowId: z.string().optional().nullable(),
  aiSummary: z.string().optional().nullable(),
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

// ==================== Quick Replies & Automation & Branding Schemas ====================

export const insertQuickReplySchema = createInsertSchema(quickReplies).omit({
  id: true, createdAt: true,
});

export const updateQuickReplySchema = z.object({
  shortcut: z.string().min(1).optional(),
  response: z.string().min(1).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const insertAutomationFlowSchema = createInsertSchema(automationFlows).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const updateAutomationFlowSchema = z.object({
  name: z.string().min(1).optional(),
  triggerKeywords: z.string().optional(),
  responseTemplate: z.string().optional(),
  isActive: z.boolean().optional(),
  systemPrompt: z.string().optional().nullable(),
  initialMessage: z.string().optional().nullable(),
  temperature: z.number().min(0).max(1).optional().nullable(),
  responseDelay: z.number().int().min(0).optional().nullable(),
  inactivityTimeout: z.number().int().min(0).optional().nullable(),
  successCondition: z.string().optional().nullable(),
  interruptCondition: z.string().optional().nullable(),
  summaryEnabled: z.boolean().optional().nullable(),
  summaryFields: z.string().optional().nullable(),
  steps: z.array(z.object({
    order: z.number().int(),
    message: z.string(),
    delaySeconds: z.number().int().min(0),
  })).optional().nullable(),
  conditionalExits: z.array(z.object({
    condition: z.string(),
    label: z.string(),
    targetFlowId: z.string(),
    triggerKeywords: z.array(z.string()),
  })).optional().nullable(),
  agentId: z.string().optional().nullable(),
});

export const insertBrandingConfigSchema = createInsertSchema(brandingConfig).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const updateBrandingConfigSchema = z.object({
  companyName: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
  defaultSlaMinutes: z.number().int().min(1).optional().nullable(),
});

export const insertAgentAssignmentSchema = createInsertSchema(agentAssignments).omit({
  id: true, assignedAt: true,
});

export const insertLearningTrackSchema = createInsertSchema(learningTracks).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const updateLearningTrackSchema = z.object({
  stageOrIntent: z.string().optional(),
  stepOrder: z.number().int().optional(),
  delayHours: z.number().min(0).optional(),
  contentType: z.enum(["texto", "video", "link"]).optional(),
  content: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const insertLearningDeliverySchema = createInsertSchema(learningDeliveries).omit({
  id: true, createdAt: true,
});

// ─── Sprint 5: Outbound Webhooks ─────────────────────────────────────────────

export const outboundWebhooks = pgTable("outbound_webhooks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  secret: text("secret"),
  lastStatus: text("last_status"),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOutboundWebhookSchema = createInsertSchema(outboundWebhooks).omit({
  id: true, createdAt: true, lastStatus: true, lastTriggeredAt: true,
});

export const updateOutboundWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  secret: z.string().optional().nullable(),
});

// ─── Sprint 5: Google Sheets Integrations ────────────────────────────────────

export const sheetIntegrations = pgTable("sheet_integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  name: text("name").notNull(),
  spreadsheetId: text("spreadsheet_id").notNull(),
  sheetName: text("sheet_name").notNull().default("Leads"),
  triggerEvent: text("trigger_event").notNull(),
  columnMapping: jsonb("column_mapping").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  googleToken: text("google_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSheetIntegrationSchema = createInsertSchema(sheetIntegrations).omit({
  id: true, createdAt: true, updatedAt: true, googleToken: true,
});

export const updateSheetIntegrationSchema = z.object({
  name: z.string().optional(),
  spreadsheetId: z.string().optional(),
  sheetName: z.string().optional(),
  triggerEvent: z.string().optional(),
  columnMapping: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Sprint 5: Email Configs ──────────────────────────────────────────────────

export const emailConfigs = pgTable("email_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpUser: text("smtp_user").notNull(),
  smtpPass: text("smtp_pass").notNull(),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailConfigSchema = createInsertSchema(emailConfigs).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const updateEmailConfigSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  imapHost: z.string().optional().nullable(),
  imapPort: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type QuickReply = typeof quickReplies.$inferSelect;
export type InsertQuickReply = z.infer<typeof insertQuickReplySchema>;
export type UpdateQuickReply = z.infer<typeof updateQuickReplySchema>;
export type AutomationFlow = typeof automationFlows.$inferSelect;
export type InsertAutomationFlow = z.infer<typeof insertAutomationFlowSchema>;
export type UpdateAutomationFlow = z.infer<typeof updateAutomationFlowSchema>;
export type BrandingConfig = typeof brandingConfig.$inferSelect;
export type InsertBrandingConfig = z.infer<typeof insertBrandingConfigSchema>;
export type UpdateBrandingConfig = z.infer<typeof updateBrandingConfigSchema>;
export type AgentAssignment = typeof agentAssignments.$inferSelect;
export type InsertAgentAssignment = z.infer<typeof insertAgentAssignmentSchema>;
export type LearningTrack = typeof learningTracks.$inferSelect;
export type InsertLearningTrack = z.infer<typeof insertLearningTrackSchema>;
export type UpdateLearningTrack = z.infer<typeof updateLearningTrackSchema>;
export type LearningDelivery = typeof learningDeliveries.$inferSelect;
export type InsertLearningDelivery = z.infer<typeof insertLearningDeliverySchema>;
export type OutboundWebhook = typeof outboundWebhooks.$inferSelect;
export type InsertOutboundWebhook = z.infer<typeof insertOutboundWebhookSchema>;
export type UpdateOutboundWebhook = z.infer<typeof updateOutboundWebhookSchema>;
export type SheetIntegration = typeof sheetIntegrations.$inferSelect;
export type InsertSheetIntegration = z.infer<typeof insertSheetIntegrationSchema>;
export type UpdateSheetIntegration = z.infer<typeof updateSheetIntegrationSchema>;
export type EmailConfig = typeof emailConfigs.$inferSelect;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type UpdateEmailConfig = z.infer<typeof updateEmailConfigSchema>;

// ==================== AI Agents ====================

export const aiAgents = pgTable("ai_agents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  model: varchar("model", { length: 50 }).notNull().default("gpt-4o-mini"),
  temperature: real("temperature").notNull().default(0.7),
  tone: varchar("tone", { length: 50 }).notNull().default("amigavel"),
  language: varchar("language", { length: 20 }).notNull().default("pt-BR"),
  specialty: varchar("specialty", { length: 50 }).notNull().default("generico"),
  systemPrompt: text("system_prompt").notNull(),
  ttsVoice: varchar("tts_voice", { length: 30 }).default("nova"),
  tools: jsonb("tools").$type<string[]>().default([]),
  escalationRules: jsonb("escalation_rules").$type<{ keywords: string[]; message: string }>(),
  maxTokens: integer("max_tokens").default(500),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  name: z.string().min(1),
  model: z.enum(["gpt-4o", "gpt-4o-mini"]).default("gpt-4o-mini"),
  temperature: z.number().min(0).max(1).default(0.7),
  tone: z.enum(["formal", "amigavel", "direto", "consultivo", "empatico"]).default("amigavel"),
  language: z.enum(["pt-BR", "en-US", "es-ES"]).default("pt-BR"),
  specialty: z.enum(["vendas", "suporte", "sac", "cobranca", "onboarding", "generico"]).default("generico"),
  ttsVoice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().nullable(),
  maxTokens: z.number().int().min(50).max(4000).default(500),
  escalationRules: z.object({
    keywords: z.array(z.string()),
    message: z.string(),
  }).optional().nullable(),
});

export const updateAiAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  model: z.enum(["gpt-4o", "gpt-4o-mini"]).optional(),
  temperature: z.number().min(0).max(1).optional(),
  tone: z.enum(["formal", "amigavel", "direto", "consultivo", "empatico"]).optional(),
  language: z.enum(["pt-BR", "en-US", "es-ES"]).optional(),
  specialty: z.enum(["vendas", "suporte", "sac", "cobranca", "onboarding", "generico"]).optional(),
  systemPrompt: z.string().min(1).optional(),
  ttsVoice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
  tools: z.array(z.string()).optional(),
  escalationRules: z.object({
    keywords: z.array(z.string()),
    message: z.string(),
  }).optional().nullable(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
  isActive: z.boolean().optional(),
});

export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type UpdateAiAgent = z.infer<typeof updateAiAgentSchema>;

// ==================== Documentation Versions ====================

export const documentationVersions = pgTable("documentation_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  version: varchar("version", { length: 20 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content").notNull(),
  format: varchar("format", { length: 20 }).default("markdown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDocumentationVersionSchema = createInsertSchema(documentationVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DocumentationVersion = typeof documentationVersions.$inferSelect;
export type InsertDocumentationVersion = z.infer<typeof insertDocumentationVersionSchema>;
