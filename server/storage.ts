import { eq, desc, and, or, ilike, asc, sql as sqlExpr } from "drizzle-orm";
import { db } from "./db";
import { 
  users, leads, apiConfigs, evolutionConfigs, conversations, messages,
  unifiedContacts, contactIdentifiers, omnichannelMessages, pipelineStages, channels,
  quickReplies, automationFlows, brandingConfig, userRoles, roles,
  type User, type Lead, type ApiConfig, type InsertUser, type InsertLead, type InsertApiConfig,
  type EvolutionConfig, type InsertEvolutionConfig, type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type UnifiedContact, type InsertUnifiedContact, type UpdateUnifiedContact,
  type ContactIdentifier, type InsertContactIdentifier,
  type OmnichannelMessage, type InsertOmnichannelMessage,
  type PipelineStage, type InsertPipelineStage,
  type Channel, type InsertChannel,
  type QuickReply, type InsertQuickReply, type UpdateQuickReply,
  type AutomationFlow, type InsertAutomationFlow, type UpdateAutomationFlow,
  type BrandingConfig, type InsertBrandingConfig, type UpdateBrandingConfig
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
  getDashboardStats(userId: string): Promise<{
    totalContacts: number;
    temperatureCounts: { frio: number; morno: number; quente: number };
    pipelineCounts: Record<string, number>;
    avgScore: number;
    recentContacts: UnifiedContact[];
    intentCounts: Record<string, number>;
    hotLeads: UnifiedContact[];
  }>;
  // Quick Replies
  getQuickRepliesByUser(userId: string): Promise<QuickReply[]>;
  getQuickReply(id: string): Promise<QuickReply | undefined>;
  createQuickReply(data: InsertQuickReply): Promise<QuickReply>;
  updateQuickReply(id: string, data: UpdateQuickReply): Promise<QuickReply | undefined>;
  deleteQuickReply(id: string): Promise<boolean>;
  // Automation Flows
  getAutomationFlowsByUser(userId: string): Promise<AutomationFlow[]>;
  getAutomationFlow(id: string): Promise<AutomationFlow | undefined>;
  createAutomationFlow(data: InsertAutomationFlow): Promise<AutomationFlow>;
  updateAutomationFlow(id: string, data: UpdateAutomationFlow): Promise<AutomationFlow | undefined>;
  deleteAutomationFlow(id: string): Promise<boolean>;
  findMatchingAutomationFlow(userId: string, message: string): Promise<AutomationFlow | undefined>;
  // Branding
  getBrandingConfig(userId: string): Promise<BrandingConfig | undefined>;
  upsertBrandingConfig(userId: string, data: UpdateBrandingConfig): Promise<BrandingConfig>;
  // Agent Assignment
  getActiveAgents(): Promise<User[]>;
  assignContactToUser(contactId: string, assignedToUserId: string | null): Promise<UnifiedContact | undefined>;
  autoAssignContact(ownerUserId: string, contactId: string): Promise<UnifiedContact | undefined>;
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

  async getDashboardStats(userId: string) {
    const contacts = await this.getUnifiedContactsByUser(userId);
    const totalContacts = contacts.length;

    const temperatureCounts = { frio: 0, morno: 0, quente: 0 };
    const pipelineCounts: Record<string, number> = {};
    const intentCounts: Record<string, number> = {};
    let totalScore = 0;

    for (const c of contacts) {
      if (c.temperature in temperatureCounts) {
        temperatureCounts[c.temperature as keyof typeof temperatureCounts]++;
      }
      pipelineCounts[c.pipelineStage] = (pipelineCounts[c.pipelineStage] || 0) + 1;
      if (c.lastIntent) {
        intentCounts[c.lastIntent] = (intentCounts[c.lastIntent] || 0) + 1;
      }
      totalScore += c.score;
    }

    const avgScore = totalContacts > 0 ? Math.round(totalScore / totalContacts) : 0;

    const recentContacts = [...contacts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const hotLeads = contacts
      .filter(c => c.temperature === "quente")
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      totalContacts,
      temperatureCounts,
      pipelineCounts,
      avgScore,
      recentContacts,
      intentCounts,
      hotLeads,
    };
  }

  // ==================== Quick Replies ====================

  async getQuickRepliesByUser(userId: string): Promise<QuickReply[]> {
    return db.select().from(quickReplies)
      .where(eq(quickReplies.userId, userId))
      .orderBy(quickReplies.shortcut);
  }

  async getQuickReply(id: string): Promise<QuickReply | undefined> {
    const [reply] = await db.select().from(quickReplies)
      .where(eq(quickReplies.id, id)).limit(1);
    return reply;
  }

  async createQuickReply(data: InsertQuickReply): Promise<QuickReply> {
    const [reply] = await db.insert(quickReplies).values(data).returning();
    return reply;
  }

  async updateQuickReply(id: string, data: UpdateQuickReply): Promise<QuickReply | undefined> {
    const [updated] = await db.update(quickReplies)
      .set(data)
      .where(eq(quickReplies.id, id))
      .returning();
    return updated;
  }

  async deleteQuickReply(id: string): Promise<boolean> {
    const result = await db.delete(quickReplies).where(eq(quickReplies.id, id)).returning();
    return result.length > 0;
  }

  // ==================== Automation Flows ====================

  async getAutomationFlowsByUser(userId: string): Promise<AutomationFlow[]> {
    return db.select().from(automationFlows)
      .where(eq(automationFlows.userId, userId))
      .orderBy(desc(automationFlows.updatedAt));
  }

  async getAutomationFlow(id: string): Promise<AutomationFlow | undefined> {
    const [flow] = await db.select().from(automationFlows)
      .where(eq(automationFlows.id, id)).limit(1);
    return flow;
  }

  async createAutomationFlow(data: InsertAutomationFlow): Promise<AutomationFlow> {
    const [flow] = await db.insert(automationFlows).values(data).returning();
    return flow;
  }

  async updateAutomationFlow(id: string, data: UpdateAutomationFlow): Promise<AutomationFlow | undefined> {
    const [updated] = await db.update(automationFlows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationFlows.id, id))
      .returning();
    return updated;
  }

  async deleteAutomationFlow(id: string): Promise<boolean> {
    const result = await db.delete(automationFlows).where(eq(automationFlows.id, id)).returning();
    return result.length > 0;
  }

  async findMatchingAutomationFlow(userId: string, message: string): Promise<AutomationFlow | undefined> {
    const flows = await db.select().from(automationFlows)
      .where(and(
        eq(automationFlows.userId, userId),
        eq(automationFlows.isActive, true)
      ));
    const lowerMsg = message.toLowerCase();
    for (const flow of flows) {
      const keywords = flow.triggerKeywords.split(",").map(k => k.trim().toLowerCase());
      if (keywords.some(kw => kw && lowerMsg.includes(kw))) {
        return flow;
      }
    }
    return undefined;
  }

  // ==================== Branding Config ====================

  async getBrandingConfig(userId: string): Promise<BrandingConfig | undefined> {
    const [config] = await db.select().from(brandingConfig)
      .where(eq(brandingConfig.userId, userId)).limit(1);
    return config;
  }

  async upsertBrandingConfig(userId: string, data: UpdateBrandingConfig): Promise<BrandingConfig> {
    const existing = await this.getBrandingConfig(userId);
    if (existing) {
      const [updated] = await db.update(brandingConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(brandingConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(brandingConfig)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  // ==================== Agent Assignment ====================

  async getActiveAgents(): Promise<User[]> {
    return db.select().from(users)
      .where(eq(users.status, "active"))
      .orderBy(asc(users.nome));
  }

  async assignContactToUser(contactId: string, assignedToUserId: string | null): Promise<UnifiedContact | undefined> {
    const [updated] = await db.update(unifiedContacts)
      .set({ assignedToUserId, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, contactId))
      .returning();
    return updated;
  }

  async autoAssignContact(ownerUserId: string, contactId: string): Promise<UnifiedContact | undefined> {
    try {
      const agents = await this.getActiveAgents();
      if (!agents.length) return undefined;

      const countRows = await db
        .select({
          userId: unifiedContacts.assignedToUserId,
          count: sqlExpr<number>`count(*)::int`,
        })
        .from(unifiedContacts)
        .where(and(
          eq(unifiedContacts.userId, ownerUserId),
        ))
        .groupBy(unifiedContacts.assignedToUserId);

      const assignedCounts = new Map<string, number>();
      for (const row of countRows) {
        if (row.userId) assignedCounts.set(row.userId, row.count);
      }

      let minCount = Infinity;
      let chosenAgent: User | null = null;

      for (const agent of agents) {
        const count = assignedCounts.get(agent.id) || 0;
        if (count < minCount) {
          minCount = count;
          chosenAgent = agent;
        }
      }

      if (!chosenAgent) return undefined;
      return this.assignContactToUser(contactId, chosenAgent.id);
    } catch {
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();
