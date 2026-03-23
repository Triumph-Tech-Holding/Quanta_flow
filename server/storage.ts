import { eq, desc, and, or, ilike, asc, sql as sqlExpr, gte, isNotNull, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import { 
  users, leads, apiConfigs, evolutionConfigs, conversations, messages,
  unifiedContacts, contactIdentifiers, omnichannelMessages, pipelineStages, channels,
  quickReplies, automationFlows, brandingConfig, userRoles, roles,
  agentAssignments, learningTracks, learningDeliveries,
  outboundWebhooks, sheetIntegrations, emailConfigs, documentationVersions,
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
  type BrandingConfig, type InsertBrandingConfig, type UpdateBrandingConfig,
  type AgentAssignment, type InsertAgentAssignment,
  type LearningTrack, type InsertLearningTrack, type UpdateLearningTrack,
  type LearningDelivery, type InsertLearningDelivery,
  type OutboundWebhook, type InsertOutboundWebhook, type UpdateOutboundWebhook,
  type SheetIntegration, type InsertSheetIntegration, type UpdateSheetIntegration,
  type EmailConfig, type InsertEmailConfig, type UpdateEmailConfig,
  type DocumentationVersion, type InsertDocumentationVersion,
  type AiAgent, type InsertAiAgent, type UpdateAiAgent,
  aiAgents,
  campaigns, campaignDeliveries, messageTemplates,
  type Campaign, type InsertCampaign, type UpdateCampaign,
  type CampaignDelivery,
  type MessageTemplate, type InsertMessageTemplate, type UpdateMessageTemplate,
  socialProjects, contentAssets, publicationSchedules,
  type SocialProject, type InsertSocialProject, type UpdateSocialProject,
  type ContentAsset, type InsertContentAsset, type UpdateContentAsset,
  type PublicationSchedule, type InsertPublicationSchedule,
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
  getFlowByShareToken(token: string): Promise<AutomationFlow | undefined>;
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
  // Documentation Versions
  getDocumentationVersions(userId: string): Promise<DocumentationVersion[]>;
  getDocumentationVersion(id: string): Promise<DocumentationVersion | undefined>;
  createDocumentationVersion(data: InsertDocumentationVersion): Promise<DocumentationVersion>;
  deleteDocumentationVersion(id: string): Promise<boolean>;
  // AI Agents
  getAiAgentsByUser(userId: string): Promise<AiAgent[]>;
  getAiAgent(id: string): Promise<AiAgent | undefined>;
  createAiAgent(data: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, data: UpdateAiAgent): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<boolean>;
  // Campaigns
  getCampaignsByUser(userId: string): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaignByShareToken(token: string): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, data: UpdateCampaign): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  getCampaignDeliveries(campaignId: string): Promise<CampaignDelivery[]>;
  createCampaignDelivery(data: { campaignId: string; contactId: string; channel: string }): Promise<CampaignDelivery>;
  updateCampaignDelivery(id: string, data: Partial<CampaignDelivery>): Promise<CampaignDelivery | undefined>;
  getPendingDeliveries(campaignId: string, limit: number): Promise<CampaignDelivery[]>;
  getCampaignMetrics(campaignId: string): Promise<{ total: number; sent: number; delivered: number; replied: number; converted: number; failed: number }>;
  findPendingDeliveryByContact(contactId: string): Promise<CampaignDelivery | undefined>;
  // Message Templates
  getMessageTemplatesByUser(userId: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, data: UpdateMessageTemplate): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string): Promise<boolean>;
  // Social/Ads
  getSocialProjects(userId: string): Promise<SocialProject[]>;
  getSocialProject(id: string, userId: string): Promise<SocialProject | undefined>;
  createSocialProject(data: InsertSocialProject): Promise<SocialProject>;
  updateSocialProject(id: string, userId: string, data: UpdateSocialProject): Promise<SocialProject | undefined>;
  deleteSocialProject(id: string, userId: string): Promise<boolean>;
  getContentAssets(filters?: { userId?: string; projectId?: string; status?: string; channel?: string }): Promise<ContentAsset[]>;
  getContentAsset(id: string): Promise<ContentAsset | undefined>;
  createContentAsset(data: InsertContentAsset): Promise<ContentAsset>;
  updateContentAsset(id: string, data: UpdateContentAsset): Promise<ContentAsset | undefined>;
  deleteContentAsset(id: string): Promise<boolean>;
  getCalendarAssets(month: string, userId: string): Promise<ContentAsset[]>;
  countAssetsPerProject(userId: string): Promise<{ projectId: string; count: number }[]>;
  getSocialStats(userId: string): Promise<{ total: number; byStatus: Record<string, number>; byChannel: Record<string, number> }>;
  getPublicationSchedulesByAsset(assetId: string): Promise<PublicationSchedule[]>;
  getPublicationSchedule(id: string): Promise<PublicationSchedule | undefined>;
  createPublicationSchedule(data: InsertPublicationSchedule): Promise<PublicationSchedule>;
  updatePublicationSchedule(id: string, status: "planned" | "sent" | "manual"): Promise<PublicationSchedule | undefined>;
  deletePublicationSchedule(id: string): Promise<boolean>;
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

  async getFlowByShareToken(token: string): Promise<AutomationFlow | undefined> {
    const [flow] = await db.select().from(automationFlows)
      .where(eq(automationFlows.shareToken, token)).limit(1);
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

  // ==================== Queue Management ====================

  async getQueueContacts(userId: string): Promise<UnifiedContact[]> {
    return db.select().from(unifiedContacts)
      .where(and(
        eq(unifiedContacts.userId, userId),
        inArray(unifiedContacts.queueStatus, ["waiting", "assigned"]),
      ))
      .orderBy(asc(unifiedContacts.queueEnteredAt));
  }

  async enterQueue(contactId: string, slaMinutes: number = 60): Promise<UnifiedContact | undefined> {
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + slaMinutes * 60 * 1000);
    const [updated] = await db.update(unifiedContacts)
      .set({ queueStatus: "waiting", queueEnteredAt: now, slaDeadline, slaBreached: false, updatedAt: now })
      .where(eq(unifiedContacts.id, contactId))
      .returning();
    return updated;
  }

  async assignContactToAgent(contactId: string, agentId: string): Promise<UnifiedContact | undefined> {
    const now = new Date();
    const [updated] = await db.update(unifiedContacts)
      .set({ queueStatus: "assigned", assignedAt: now, assignedToUserId: agentId, updatedAt: now })
      .where(eq(unifiedContacts.id, contactId))
      .returning();
    if (updated) {
      await db.insert(agentAssignments).values({ contactId, agentId, assignedAt: now });
    }
    return updated;
  }

  async resolveContact(contactId: string, resolvedBy: string): Promise<UnifiedContact | undefined> {
    const now = new Date();
    const [updated] = await db.update(unifiedContacts)
      .set({ queueStatus: "resolved", updatedAt: now })
      .where(eq(unifiedContacts.id, contactId))
      .returning();
    if (updated) {
      await db.update(agentAssignments)
        .set({ resolvedAt: now, resolvedBy })
        .where(and(
          eq(agentAssignments.contactId, contactId),
          sqlExpr`${agentAssignments.resolvedAt} IS NULL`,
        ));
    }
    return updated;
  }

  async markSlaBreached(contactId: string): Promise<void> {
    await db.update(unifiedContacts)
      .set({ slaBreached: true, updatedAt: new Date() })
      .where(eq(unifiedContacts.id, contactId));
  }

  // ==================== Learning Tracks ====================

  async getLearningTracksByUser(userId: string): Promise<LearningTrack[]> {
    return db.select().from(learningTracks)
      .where(eq(learningTracks.userId, userId))
      .orderBy(asc(learningTracks.stageOrIntent), asc(learningTracks.stepOrder));
  }

  async getLearningTracksByStageOrIntent(userId: string, stageOrIntent: string): Promise<LearningTrack[]> {
    return db.select().from(learningTracks)
      .where(and(
        eq(learningTracks.userId, userId),
        eq(learningTracks.stageOrIntent, stageOrIntent),
        eq(learningTracks.isActive, true),
      ))
      .orderBy(asc(learningTracks.stepOrder));
  }

  async createLearningTrack(data: InsertLearningTrack): Promise<LearningTrack> {
    const [track] = await db.insert(learningTracks).values(data).returning();
    return track;
  }

  async updateLearningTrack(id: string, data: UpdateLearningTrack): Promise<LearningTrack | undefined> {
    const [updated] = await db.update(learningTracks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(learningTracks.id, id))
      .returning();
    return updated;
  }

  async deleteLearningTrack(id: string): Promise<boolean> {
    const result = await db.delete(learningTracks).where(eq(learningTracks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveLearningContacts(userId: string, sinceHours: number = 48): Promise<UnifiedContact[]> {
    const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return db.select().from(unifiedContacts)
      .where(and(
        eq(unifiedContacts.userId, userId),
        isNotNull(unifiedContacts.lastContactAt),
        gte(unifiedContacts.lastContactAt, cutoff),
      ));
  }

  async getLearningDeliveriesForContact(contactId: string, trackId: string): Promise<LearningDelivery[]> {
    return db.select().from(learningDeliveries)
      .where(and(
        eq(learningDeliveries.contactId, contactId),
        eq(learningDeliveries.trackId, trackId),
      ));
  }

  async createLearningDelivery(data: InsertLearningDelivery): Promise<LearningDelivery> {
    const [delivery] = await db.insert(learningDeliveries).values(data).returning();
    return delivery;
  }

  async updateLearningDelivery(id: string, data: Partial<LearningDelivery>): Promise<void> {
    await db.update(learningDeliveries).set(data).where(eq(learningDeliveries.id, id));
  }

  // ==================== Outbound Webhooks ====================

  async getOutboundWebhooks(userId: string): Promise<OutboundWebhook[]> {
    return db.select().from(outboundWebhooks)
      .where(eq(outboundWebhooks.userId, userId))
      .orderBy(desc(outboundWebhooks.createdAt));
  }

  async getOutboundWebhook(id: string): Promise<OutboundWebhook | undefined> {
    const [wh] = await db.select().from(outboundWebhooks).where(eq(outboundWebhooks.id, id));
    return wh;
  }

  async createOutboundWebhook(data: InsertOutboundWebhook): Promise<OutboundWebhook> {
    const [wh] = await db.insert(outboundWebhooks).values(data).returning();
    return wh;
  }

  async updateOutboundWebhook(id: string, data: UpdateOutboundWebhook): Promise<OutboundWebhook | undefined> {
    const [wh] = await db.update(outboundWebhooks).set(data).where(eq(outboundWebhooks.id, id)).returning();
    return wh;
  }

  async deleteOutboundWebhook(id: string): Promise<boolean> {
    const result = await db.delete(outboundWebhooks).where(eq(outboundWebhooks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateOutboundWebhookStatus(id: string, status: string): Promise<void> {
    await db.update(outboundWebhooks)
      .set({ lastStatus: status, lastTriggeredAt: new Date() })
      .where(eq(outboundWebhooks.id, id));
  }

  // ==================== Sheet Integrations ====================

  async getSheetIntegrations(userId: string): Promise<SheetIntegration[]> {
    return db.select().from(sheetIntegrations)
      .where(eq(sheetIntegrations.userId, userId))
      .orderBy(desc(sheetIntegrations.createdAt));
  }

  async getSheetIntegration(id: string): Promise<SheetIntegration | undefined> {
    const [si] = await db.select().from(sheetIntegrations).where(eq(sheetIntegrations.id, id));
    return si;
  }

  async createSheetIntegration(data: InsertSheetIntegration): Promise<SheetIntegration> {
    const [si] = await db.insert(sheetIntegrations).values(data).returning();
    return si;
  }

  async updateSheetIntegration(id: string, data: UpdateSheetIntegration & { googleToken?: string }): Promise<SheetIntegration | undefined> {
    const [si] = await db.update(sheetIntegrations).set({ ...data, updatedAt: new Date() }).where(eq(sheetIntegrations.id, id)).returning();
    return si;
  }

  async deleteSheetIntegration(id: string): Promise<boolean> {
    const result = await db.delete(sheetIntegrations).where(eq(sheetIntegrations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveSheetIntegrationsForEvent(userId: string, event: string): Promise<SheetIntegration[]> {
    return db.select().from(sheetIntegrations)
      .where(and(
        eq(sheetIntegrations.userId, userId),
        eq(sheetIntegrations.isActive, true),
        eq(sheetIntegrations.triggerEvent, event),
      ));
  }

  // ==================== Email Configs ====================

  async getEmailConfig(userId: string): Promise<EmailConfig | undefined> {
    const [cfg] = await db.select().from(emailConfigs)
      .where(eq(emailConfigs.userId, userId))
      .limit(1);
    return cfg;
  }

  async upsertEmailConfig(userId: string, data: InsertEmailConfig): Promise<EmailConfig> {
    const existing = await this.getEmailConfig(userId);
    if (existing) {
      const [cfg] = await db.update(emailConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(emailConfigs.userId, userId))
        .returning();
      return cfg;
    }
    const [cfg] = await db.insert(emailConfigs).values({ ...data, userId }).returning();
    return cfg;
  }

  // ==================== Documentation Versions ====================

  async getDocumentationVersions(userId: string): Promise<DocumentationVersion[]> {
    return db.select().from(documentationVersions)
      .where(eq(documentationVersions.userId, userId))
      .orderBy(desc(documentationVersions.createdAt));
  }

  async getDocumentationVersion(id: string): Promise<DocumentationVersion | undefined> {
    const [doc] = await db.select().from(documentationVersions)
      .where(eq(documentationVersions.id, id)).limit(1);
    return doc;
  }

  async createDocumentationVersion(data: InsertDocumentationVersion): Promise<DocumentationVersion> {
    const [doc] = await db.insert(documentationVersions).values(data).returning();
    return doc;
  }

  async deleteDocumentationVersion(id: string): Promise<boolean> {
    const result = await db.delete(documentationVersions).where(eq(documentationVersions.id, id)).returning();
    return result.length > 0;
  }

  // ==================== AI Agents ====================

  async getAiAgentsByUser(userId: string): Promise<AiAgent[]> {
    return db.select().from(aiAgents)
      .where(eq(aiAgents.userId, userId))
      .orderBy(desc(aiAgents.updatedAt));
  }

  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents)
      .where(eq(aiAgents.id, id)).limit(1);
    return agent;
  }

  async createAiAgent(data: InsertAiAgent): Promise<AiAgent> {
    const [agent] = await db.insert(aiAgents).values(data).returning();
    return agent;
  }

  async updateAiAgent(id: string, data: UpdateAiAgent): Promise<AiAgent | undefined> {
    const [agent] = await db.update(aiAgents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiAgents.id, id))
      .returning();
    return agent;
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    const result = await db.delete(aiAgents).where(eq(aiAgents.id, id)).returning();
    return result.length > 0;
  }

  // ==================== Campaigns ====================

  async getCampaignsByUser(userId: string): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.updatedAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return c;
  }

  async getCampaignByShareToken(token: string): Promise<Campaign | undefined> {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.shareToken, token)).limit(1);
    return c;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [c] = await db.insert(campaigns).values(data).returning();
    return c;
  }

  async updateCampaign(id: string, data: UpdateCampaign): Promise<Campaign | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.segmentFilter !== undefined) updateData.segmentFilter = data.segmentFilter;
    if (data.channels !== undefined) updateData.channels = data.channels;
    if (data.contentType !== undefined) updateData.contentType = data.contentType;
    if (data.messages !== undefined) updateData.messages = data.messages;
    if (data.agentId !== undefined) updateData.agentId = data.agentId;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.rateLimit !== undefined) updateData.rateLimit = data.rateLimit;
    if (data.allowedHours !== undefined) updateData.allowedHours = data.allowedHours;

    const [c] = await db.update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();
    return c;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  }

  async getCampaignDeliveries(campaignId: string): Promise<CampaignDelivery[]> {
    return db.select().from(campaignDeliveries)
      .where(eq(campaignDeliveries.campaignId, campaignId))
      .orderBy(desc(campaignDeliveries.createdAt));
  }

  async createCampaignDelivery(data: { campaignId: string; contactId: string; channel: string }): Promise<CampaignDelivery> {
    const [d] = await db.insert(campaignDeliveries).values(data).returning();
    return d;
  }

  async updateCampaignDelivery(id: string, data: Partial<CampaignDelivery>): Promise<CampaignDelivery | undefined> {
    const [d] = await db.update(campaignDeliveries)
      .set(data)
      .where(eq(campaignDeliveries.id, id))
      .returning();
    return d;
  }

  async getPendingDeliveries(campaignId: string, limit: number): Promise<CampaignDelivery[]> {
    return db.select().from(campaignDeliveries)
      .where(and(
        eq(campaignDeliveries.campaignId, campaignId),
        eq(campaignDeliveries.status, "pending"),
      ))
      .orderBy(asc(campaignDeliveries.createdAt))
      .limit(limit);
  }

  async getCampaignMetrics(campaignId: string): Promise<{ total: number; sent: number; delivered: number; replied: number; converted: number; failed: number }> {
    const deliveries = await db.select().from(campaignDeliveries)
      .where(eq(campaignDeliveries.campaignId, campaignId));
    return {
      total: deliveries.length,
      sent: deliveries.filter(d => d.status !== "pending").length,
      delivered: deliveries.filter(d => ["delivered", "read", "replied", "converted"].includes(d.status)).length,
      replied: deliveries.filter(d => ["replied", "converted"].includes(d.status)).length,
      converted: deliveries.filter(d => d.status === "converted").length,
      failed: deliveries.filter(d => d.status === "failed").length,
    };
  }

  async findPendingDeliveryByContact(contactId: string): Promise<CampaignDelivery | undefined> {
    const [d] = await db.select().from(campaignDeliveries)
      .where(and(
        eq(campaignDeliveries.contactId, contactId),
        inArray(campaignDeliveries.status, ["pending", "sent", "delivered", "read"]),
      ))
      .orderBy(desc(campaignDeliveries.createdAt))
      .limit(1);
    return d;
  }

  // ==================== Message Templates ====================

  async getMessageTemplatesByUser(userId: string): Promise<MessageTemplate[]> {
    return db.select().from(messageTemplates)
      .where(eq(messageTemplates.userId, userId))
      .orderBy(desc(messageTemplates.updatedAt));
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const [t] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
    return t;
  }

  async createMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const [t] = await db.insert(messageTemplates).values(data).returning();
    return t;
  }

  async updateMessageTemplate(id: string, data: UpdateMessageTemplate): Promise<MessageTemplate | undefined> {
    const [t] = await db.update(messageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return t;
  }

  async deleteMessageTemplate(id: string): Promise<boolean> {
    const result = await db.delete(messageTemplates).where(eq(messageTemplates.id, id)).returning();
    return result.length > 0;
  }

  // ==================== Social/Ads ====================

  async getSocialProjects(userId: string): Promise<SocialProject[]> {
    return db.select().from(socialProjects)
      .where(eq(socialProjects.userId, userId))
      .orderBy(desc(socialProjects.createdAt));
  }

  async getSocialProject(id: string, userId: string): Promise<SocialProject | undefined> {
    const [p] = await db.select().from(socialProjects)
      .where(and(eq(socialProjects.id, id), eq(socialProjects.userId, userId)))
      .limit(1);
    return p;
  }

  async createSocialProject(data: InsertSocialProject): Promise<SocialProject> {
    const [p] = await db.insert(socialProjects).values(data).returning();
    return p;
  }

  async updateSocialProject(id: string, userId: string, data: UpdateSocialProject): Promise<SocialProject | undefined> {
    const [p] = await db.update(socialProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(socialProjects.id, id), eq(socialProjects.userId, userId)))
      .returning();
    return p;
  }

  async deleteSocialProject(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(socialProjects)
      .where(and(eq(socialProjects.id, id), eq(socialProjects.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getContentAssets(filters?: { userId?: string; projectId?: string; status?: string; channel?: string }): Promise<ContentAsset[]> {
    type SocialStatus = "draft" | "approved" | "scheduled" | "published";
    type SocialChannel = "instagram" | "tiktok" | "youtube" | "linkedin" | "blog" | "whatsapp";
    const conditions = [];
    if (filters?.userId) conditions.push(eq(contentAssets.userId, filters.userId));
    if (filters?.projectId) conditions.push(eq(contentAssets.projectId, filters.projectId));
    if (filters?.status) conditions.push(eq(contentAssets.status, filters.status as SocialStatus));
    if (filters?.channel) conditions.push(eq(contentAssets.channel, filters.channel as SocialChannel));
    const query = conditions.length > 0
      ? db.select().from(contentAssets).where(and(...conditions)).orderBy(desc(contentAssets.createdAt))
      : db.select().from(contentAssets).orderBy(desc(contentAssets.createdAt));
    return query;
  }

  async getContentAsset(id: string): Promise<ContentAsset | undefined> {
    const [a] = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).limit(1);
    return a;
  }

  async createContentAsset(data: InsertContentAsset): Promise<ContentAsset> {
    const [a] = await db.insert(contentAssets).values(data).returning();
    return a;
  }

  async updateContentAsset(id: string, data: UpdateContentAsset): Promise<ContentAsset | undefined> {
    const setValues: {
      status?: "draft" | "approved" | "scheduled" | "published";
      notes?: string | null;
      utmLink?: string | null;
      formats?: { headlines?: string[]; article?: string; podcastScript?: string; reelScript?: string; liveScript?: string; socialAds?: string; audioUrl?: string } | null;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (data.status !== undefined) setValues.status = data.status;
    if (data.notes !== undefined) setValues.notes = data.notes;
    if (data.utmLink !== undefined) setValues.utmLink = data.utmLink;
    if (data.formats !== undefined) setValues.formats = data.formats;
    if (data.scheduledAt !== undefined) setValues.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.publishedAt !== undefined) setValues.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    const [a] = await db.update(contentAssets)
      .set(setValues)
      .where(eq(contentAssets.id, id))
      .returning();
    return a;
  }

  async deleteContentAsset(id: string): Promise<boolean> {
    const result = await db.delete(contentAssets).where(eq(contentAssets.id, id)).returning();
    return result.length > 0;
  }

  async getCalendarAssets(month: string, userId: string): Promise<ContentAsset[]> {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 1);
    return db.select().from(contentAssets)
      .where(and(
        eq(contentAssets.userId, userId),
        isNotNull(contentAssets.scheduledAt),
        gte(contentAssets.scheduledAt, start),
        lte(contentAssets.scheduledAt, end),
      ))
      .orderBy(asc(contentAssets.scheduledAt));
  }

  async countAssetsPerProject(userId: string): Promise<{ projectId: string; count: number }[]> {
    const rows = await db.select({
      projectId: contentAssets.projectId,
      count: sqlExpr<number>`count(*)::int`,
    })
      .from(contentAssets)
      .where(eq(contentAssets.userId, userId))
      .groupBy(contentAssets.projectId);
    return rows.filter(r => r.projectId !== null) as { projectId: string; count: number }[];
  }

  async getSocialStats(userId: string): Promise<{ total: number; byStatus: Record<string, number>; byChannel: Record<string, number> }> {
    const all = await db.select({
      status: contentAssets.status,
      channel: contentAssets.channel,
    }).from(contentAssets).where(eq(contentAssets.userId, userId));
    const byStatus: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    for (const row of all) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byChannel[row.channel] = (byChannel[row.channel] || 0) + 1;
    }
    return { total: all.length, byStatus, byChannel };
  }

  async getPublicationSchedulesByAsset(assetId: string): Promise<PublicationSchedule[]> {
    return db.select().from(publicationSchedules)
      .where(eq(publicationSchedules.assetId, assetId))
      .orderBy(asc(publicationSchedules.scheduledTime));
  }

  async getPublicationSchedule(id: string): Promise<PublicationSchedule | undefined> {
    const [s] = await db.select().from(publicationSchedules).where(eq(publicationSchedules.id, id));
    return s;
  }

  async createPublicationSchedule(data: InsertPublicationSchedule): Promise<PublicationSchedule> {
    const [s] = await db.insert(publicationSchedules).values(data).returning();
    return s;
  }

  async updatePublicationSchedule(id: string, status: "planned" | "sent" | "manual"): Promise<PublicationSchedule | undefined> {
    const [s] = await db.update(publicationSchedules)
      .set({ status })
      .where(eq(publicationSchedules.id, id))
      .returning();
    return s;
  }

  async deletePublicationSchedule(id: string): Promise<boolean> {
    const result = await db.delete(publicationSchedules).where(eq(publicationSchedules.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
