import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { 
  users, leads, apiConfigs, evolutionConfigs, conversations, messages,
  type User, type Lead, type ApiConfig, type InsertUser, type InsertLead, type InsertApiConfig,
  type EvolutionConfig, type InsertEvolutionConfig, type Conversation, type InsertConversation,
  type Message, type InsertMessage
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getLeadsByOwner(ownerId: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  getApiConfigsByUser(userId: string): Promise<ApiConfig[]>;
  createApiConfig(config: InsertApiConfig): Promise<ApiConfig>;
  deleteApiConfig(id: string): Promise<boolean>;
  getEvolutionConfig(userId: string): Promise<EvolutionConfig | undefined>;
  createEvolutionConfig(config: InsertEvolutionConfig): Promise<EvolutionConfig>;
  updateEvolutionConfig(userId: string, data: Partial<EvolutionConfig>): Promise<EvolutionConfig | undefined>;
  deleteEvolutionConfig(userId: string): Promise<boolean>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByRemoteJid(userId: string, remoteJid: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getLeadsByOwner(ownerId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.donoId, ownerId));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, leadData: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set({ ...leadData, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  async getApiConfigsByUser(userId: string): Promise<ApiConfig[]> {
    return db.select().from(apiConfigs).where(eq(apiConfigs.userId, userId));
  }

  async createApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const [newConfig] = await db.insert(apiConfigs).values(config).returning();
    return newConfig;
  }

  async deleteApiConfig(id: string): Promise<boolean> {
    const result = await db.delete(apiConfigs).where(eq(apiConfigs.id, id)).returning();
    return result.length > 0;
  }

  async getEvolutionConfig(userId: string): Promise<EvolutionConfig | undefined> {
    const [config] = await db.select().from(evolutionConfigs).where(eq(evolutionConfigs.userId, userId)).limit(1);
    return config;
  }

  async createEvolutionConfig(config: InsertEvolutionConfig): Promise<EvolutionConfig> {
    const [newConfig] = await db.insert(evolutionConfigs).values(config).returning();
    return newConfig;
  }

  async updateEvolutionConfig(userId: string, data: Partial<EvolutionConfig>): Promise<EvolutionConfig | undefined> {
    const [updated] = await db
      .update(evolutionConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(evolutionConfigs.userId, userId))
      .returning();
    return updated;
  }

  async deleteEvolutionConfig(userId: string): Promise<boolean> {
    const result = await db.delete(evolutionConfigs).where(eq(evolutionConfigs.userId, userId)).returning();
    return result.length > 0;
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return conversation;
  }

  async getConversationByRemoteJid(userId: string, remoteJid: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.remoteJid, remoteJid)))
      .limit(1);
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations).values(conversation).returning();
    return newConversation;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();
