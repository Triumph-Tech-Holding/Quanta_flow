import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, leads, apiConfigs, type User, type Lead, type ApiConfig, type InsertUser, type InsertLead, type InsertApiConfig } from "@shared/schema";

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
}

export const storage = new DatabaseStorage();
