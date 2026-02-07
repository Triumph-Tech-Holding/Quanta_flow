import { eq, desc, and, or, ilike } from "drizzle-orm";
import { db } from "./db";
import { 
  users, leads, apiConfigs, evolutionConfigs, conversations, messages,
  unifiedContacts, contactIdentifiers, omnichannelMessages, pipelineStages, channels,
  type User, type Lead, type ApiConfig, type InsertUser, type InsertLead, type InsertApiConfig,
  type EvolutionConfig, type InsertEvolutionConfig, type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type UnifiedContact, type InsertUnifiedContact, type UpdateUnifiedContact,
  type ContactIdentifier, type InsertContactIdentifier,
  type OmnichannelMessage, type InsertOmnichannelMessage,
  type PipelineStage, type InsertPipelineStage,
  type Channel, type InsertChannel
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  incrementTokenVersion(id: string): Promise<User | undefined>;
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
  // Omnichannel CRM
  getUnifiedContactsByUser(userId: string): Promise<UnifiedContact[]>;
  getUnifiedContactsByStage(userId: string, stage: string): Promise<UnifiedContact[]>;
  getUnifiedContact(id: string): Promise<UnifiedContact | undefined>;
  findUnifiedContactByIdentifier(userId: string, channelType: string, identifier: string): Promise<UnifiedContact | undefined>;
  findUnifiedContactByPhoneOrEmail(userId: string, phone?: string, email?: string): Promise<UnifiedContact | undefined>;
  createUnifiedContact(contact: InsertUnifiedContact): Promise<UnifiedContact>;
  updateUnifiedContact(id: string, data: UpdateUnifiedContact): Promise<UnifiedContact | undefined>;
  deleteUnifiedContact(id: string): Promise<boolean>;
  getContactIdentifiers(unifiedContactId: string): Promise<ContactIdentifier[]>;
  createContactIdentifier(identifier: InsertContactIdentifier): Promise<ContactIdentifier>;
  deleteContactIdentifier(id: string): Promise<boolean>;
  getOmnichannelMessages(unifiedContactId: string, limit?: number): Promise<OmnichannelMessage[]>;
  createOmnichannelMessage(message: InsertOmnichannelMessage): Promise<OmnichannelMessage>;
  getPipelineStages(userId: string): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  getPipelineSummary(userId: string): Promise<{ stage: string; count: number }[]>;
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

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async incrementTokenVersion(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const [updated] = await db
      .update(users)
      .set({ tokenVersion: user.tokenVersion + 1, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
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

  // ==================== Omnichannel CRM ====================

  async getUnifiedContactsByUser(userId: string): Promise<UnifiedContact[]> {
    return db.select().from(unifiedContacts)
      .where(eq(unifiedContacts.userId, userId))
      .orderBy(desc(unifiedContacts.updatedAt));
  }

  async getUnifiedContactsByStage(userId: string, stage: string): Promise<UnifiedContact[]> {
    return db.select().from(unifiedContacts)
      .where(and(
        eq(unifiedContacts.userId, userId),
        eq(unifiedContacts.pipelineStage, stage as any)
      ))
      .orderBy(desc(unifiedContacts.updatedAt));
  }

  async getUnifiedContact(id: string): Promise<UnifiedContact | undefined> {
    const [contact] = await db.select().from(unifiedContacts)
      .where(eq(unifiedContacts.id, id)).limit(1);
    return contact;
  }

  async findUnifiedContactByIdentifier(userId: string, channelType: string, identifier: string): Promise<UnifiedContact | undefined> {
    const [result] = await db.select({ contact: unifiedContacts })
      .from(unifiedContacts)
      .innerJoin(contactIdentifiers, eq(unifiedContacts.id, contactIdentifiers.unifiedContactId))
      .where(and(
        eq(unifiedContacts.userId, userId),
        eq(contactIdentifiers.channelType, channelType as any),
        eq(contactIdentifiers.identifier, identifier)
      ))
      .limit(1);
    return result?.contact;
  }

  async findUnifiedContactByPhoneOrEmail(userId: string, phone?: string, email?: string): Promise<UnifiedContact | undefined> {
    if (!phone && !email) return undefined;
    const conditions = [eq(unifiedContacts.userId, userId)];
    const orConditions = [];
    if (phone) orConditions.push(eq(unifiedContacts.telefone, phone));
    if (email) orConditions.push(ilike(unifiedContacts.email, email));
    if (orConditions.length > 0) {
      conditions.push(or(...orConditions)!);
    }
    const [contact] = await db.select().from(unifiedContacts)
      .where(and(...conditions))
      .limit(1);
    return contact;
  }

  async createUnifiedContact(contact: InsertUnifiedContact): Promise<UnifiedContact> {
    const [newContact] = await db.insert(unifiedContacts).values(contact).returning();
    return newContact;
  }

  async updateUnifiedContact(id: string, data: UpdateUnifiedContact): Promise<UnifiedContact | undefined> {
    const [updated] = await db.update(unifiedContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, id))
      .returning();
    return updated;
  }

  async deleteUnifiedContact(id: string): Promise<boolean> {
    const result = await db.delete(unifiedContacts).where(eq(unifiedContacts.id, id)).returning();
    return result.length > 0;
  }

  async getContactIdentifiers(unifiedContactId: string): Promise<ContactIdentifier[]> {
    return db.select().from(contactIdentifiers)
      .where(eq(contactIdentifiers.unifiedContactId, unifiedContactId));
  }

  async createContactIdentifier(identifier: InsertContactIdentifier): Promise<ContactIdentifier> {
    const [newIdentifier] = await db.insert(contactIdentifiers).values(identifier).returning();
    return newIdentifier;
  }

  async deleteContactIdentifier(id: string): Promise<boolean> {
    const result = await db.delete(contactIdentifiers).where(eq(contactIdentifiers.id, id)).returning();
    return result.length > 0;
  }

  async getOmnichannelMessages(unifiedContactId: string, limit = 50): Promise<OmnichannelMessage[]> {
    return db.select().from(omnichannelMessages)
      .where(eq(omnichannelMessages.unifiedContactId, unifiedContactId))
      .orderBy(desc(omnichannelMessages.timestamp))
      .limit(limit);
  }

  async createOmnichannelMessage(message: InsertOmnichannelMessage): Promise<OmnichannelMessage> {
    const [newMessage] = await db.insert(omnichannelMessages).values(message).returning();
    return newMessage;
  }

  async getPipelineStages(userId: string): Promise<PipelineStage[]> {
    return db.select().from(pipelineStages)
      .where(eq(pipelineStages.userId, userId))
      .orderBy(pipelineStages.order);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [newStage] = await db.insert(pipelineStages).values(stage).returning();
    return newStage;
  }

  async getPipelineSummary(userId: string): Promise<{ stage: string; count: number }[]> {
    const contacts = await this.getUnifiedContactsByUser(userId);
    const stageCounts: Record<string, number> = {};
    for (const contact of contacts) {
      stageCounts[contact.pipelineStage] = (stageCounts[contact.pipelineStage] || 0) + 1;
    }
    return Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }));
  }
}

export const storage = new DatabaseStorage();
