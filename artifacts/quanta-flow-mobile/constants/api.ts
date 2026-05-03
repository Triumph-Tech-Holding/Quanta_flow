import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "qf.token";
const WORKSPACE_KEY = "qf.workspaceId";

const memoryStore: Record<string, string> = {};

async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStore[key] ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function storeSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    else memoryStore[key] = value;
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storeDel(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    else delete memoryStore[key];
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  get: () => storeGet(TOKEN_KEY),
  set: (v: string) => storeSet(TOKEN_KEY, v),
  clear: () => storeDel(TOKEN_KEY),
};

export const workspaceStore = {
  get: () => storeGet(WORKSPACE_KEY),
  set: (v: string) => storeSet(WORKSPACE_KEY, v),
  clear: () => storeDel(WORKSPACE_KEY),
};

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  if (opts.auth !== false) {
    const token = await tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    const ws = await workspaceStore.get();
    if (ws) headers["x-workspace-id"] = ws;
  }
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && "message" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).message)
        : null) || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}
