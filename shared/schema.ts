import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { boolean } from "drizzle-orm/pg-core";

export const tipoAtorEnum = pgEnum("tipo_ator", ["consumidor", "agente_fidelizacao", "lojista", "admin"]);
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
  contactPhone: varchar("contact_phone", { length: 20 }),
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
