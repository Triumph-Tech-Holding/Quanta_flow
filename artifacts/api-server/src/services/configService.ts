import { db } from "../db";
import { settings, settingsAudit } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.SESSION_SECRET || "default-encryption-key-32chars!!";
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  value: string;
  expiresAt: number;
  decrypted: string;
}

const cache = new Map<string, CacheEntry>();
let lastCacheRefresh = 0;

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText;
  }
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}

async function getSetting(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[config] Cache hit for ${key}`);
    return cached.decrypted;
  }

  try {
    const result = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.isActive, true)))
      .limit(1);

    if (result.length === 0) {
      console.log(`[config] Setting not found: ${key}`);
      return cached?.decrypted || null;
    }

    const setting = result[0];
    const decryptedValue = setting.isEncrypted ? decrypt(setting.value) : setting.value;

    cache.set(key, {
      value: setting.value,
      expiresAt: Date.now() + CACHE_TTL,
      decrypted: decryptedValue,
    });

    console.log(`[config] Loaded from DB: ${key}`);
    return decryptedValue;
  } catch (error) {
    console.error(`[config] DB error for ${key}:`, error);
    if (cached) {
      console.log(`[config] Using cached fallback for ${key}`);
      return cached.decrypted;
    }
    return null;
  }
}

async function getAllSettings(): Promise<typeof settings.$inferSelect[]> {
  try {
    const result = await db.select().from(settings).where(eq(settings.isActive, true));
    return result;
  } catch (error) {
    console.error("[config] Error fetching all settings:", error);
    return [];
  }
}

async function getAllSettingsForAdmin(): Promise<Array<typeof settings.$inferSelect & { maskedValue: string }>> {
  try {
    const result = await db.select().from(settings);
    return result.map((s) => ({
      ...s,
      maskedValue: s.isEncrypted ? maskValue(decrypt(s.value)) : maskValue(s.value),
    }));
  } catch (error) {
    console.error("[config] Error fetching settings for admin:", error);
    return [];
  }
}

async function getSettingByKey(key: string): Promise<typeof settings.$inferSelect | null> {
  try {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error(`[config] Error fetching setting ${key}:`, error);
    return null;
  }
}

async function createSetting(
  data: {
    key: string;
    value: string;
    type?: "api_key" | "url" | "token" | "id" | "secret";
    category?: string;
    description?: string;
    isActive?: boolean;
    isEncrypted?: boolean;
  },
  userId: string
): Promise<typeof settings.$inferSelect | null> {
  try {
    const encryptedValue = data.isEncrypted !== false ? encrypt(data.value) : data.value;

    const result = await db
      .insert(settings)
      .values({
        key: data.key,
        value: encryptedValue,
        type: data.type || "api_key",
        category: data.category || "general",
        description: data.description,
        isActive: data.isActive ?? true,
        isEncrypted: data.isEncrypted ?? true,
        lastUpdatedBy: userId,
      })
      .returning();

    await db.insert(settingsAudit).values({
      settingKey: data.key,
      oldValue: null,
      newValue: "[ENCRYPTED]",
      action: "create",
      changedBy: userId,
    });

    invalidateCache(data.key);
    console.log(`[config] Created setting: ${data.key}`);
    return result[0];
  } catch (error) {
    console.error(`[config] Error creating setting ${data.key}:`, error);
    return null;
  }
}

async function updateSetting(
  key: string,
  data: {
    value?: string;
    type?: "api_key" | "url" | "token" | "id" | "secret";
    category?: string;
    description?: string;
    isActive?: boolean;
  },
  userId: string
): Promise<typeof settings.$inferSelect | null> {
  try {
    const existing = await getSettingByKey(key);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      lastUpdatedBy: userId,
    };

    if (data.value !== undefined) {
      updateData.value = existing.isEncrypted ? encrypt(data.value) : data.value;
    }
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const result = await db
      .update(settings)
      .set(updateData)
      .where(eq(settings.key, key))
      .returning();

    await db.insert(settingsAudit).values({
      settingKey: key,
      oldValue: "[ENCRYPTED]",
      newValue: "[ENCRYPTED]",
      action: "update",
      changedBy: userId,
    });

    invalidateCache(key);
    console.log(`[config] Updated setting: ${key}`);
    return result[0];
  } catch (error) {
    console.error(`[config] Error updating setting ${key}:`, error);
    return null;
  }
}

async function deleteSetting(key: string, userId: string): Promise<boolean> {
  try {
    await db.insert(settingsAudit).values({
      settingKey: key,
      oldValue: "[ENCRYPTED]",
      newValue: null,
      action: "delete",
      changedBy: userId,
    });

    await db.delete(settings).where(eq(settings.key, key));
    invalidateCache(key);
    console.log(`[config] Deleted setting: ${key}`);
    return true;
  } catch (error) {
    console.error(`[config] Error deleting setting ${key}:`, error);
    return false;
  }
}

function invalidateCache(key: string): void {
  cache.delete(key);
  console.log(`[config] Cache invalidated for: ${key}`);
}

async function refreshCache(): Promise<void> {
  try {
    cache.clear();
    const allSettings = await getAllSettings();
    
    for (const setting of allSettings) {
      const decryptedValue = setting.isEncrypted ? decrypt(setting.value) : setting.value;
      cache.set(setting.key, {
        value: setting.value,
        expiresAt: Date.now() + CACHE_TTL,
        decrypted: decryptedValue,
      });
    }
    
    lastCacheRefresh = Date.now();
    console.log(`[config] Cache refreshed with ${allSettings.length} settings`);
  } catch (error) {
    console.error("[config] Error refreshing cache:", error);
  }
}

async function getSettingsAudit(key?: string): Promise<typeof settingsAudit.$inferSelect[]> {
  try {
    if (key) {
      return await db
        .select()
        .from(settingsAudit)
        .where(eq(settingsAudit.settingKey, key))
        .orderBy(settingsAudit.changedAt);
    }
    return await db.select().from(settingsAudit).orderBy(settingsAudit.changedAt);
  } catch (error) {
    console.error("[config] Error fetching audit:", error);
    return [];
  }
}

async function validateCredential(
  type: string,
  key: string,
  value: string
): Promise<{ valid: boolean; message: string }> {
  try {
    if (type === "url") {
      new URL(value);
      return { valid: true, message: "URL válida" };
    }

    if (key.includes("evolution") || key.includes("z_api")) {
      if (value.length < 10) {
        return { valid: false, message: "Token muito curto" };
      }
      return { valid: true, message: "Formato válido" };
    }

    if (key.includes("openai")) {
      if (!value.startsWith("sk-")) {
        return { valid: false, message: "Chave OpenAI deve começar com sk-" };
      }
      return { valid: true, message: "Formato válido" };
    }

    return { valid: true, message: "Validação básica OK" };
  } catch (error) {
    return { valid: false, message: `Erro de validação: ${error}` };
  }
}

export const configService = {
  getSetting,
  getAllSettings,
  getAllSettingsForAdmin,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
  invalidateCache,
  refreshCache,
  getSettingsAudit,
  validateCredential,
  encrypt,
  decrypt,
  maskValue,
};
