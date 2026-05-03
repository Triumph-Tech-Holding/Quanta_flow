import { useRouter, useSegments } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, apiFetch, tokenStore, workspaceStore } from "@/constants/api";

export type User = {
  id: string;
  email: string;
  nome?: string;
  tipoAtor?: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan?: string;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await apiFetch<Workspace[]>("/api/workspaces");
      setWorkspaces(Array.isArray(list) ? list : []);
    } catch {
      setWorkspaces([]);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }
      const me = await apiFetch<User>("/api/auth/me");
      setUser(me);
      const ws = await workspaceStore.get();
      setWorkspaceId(ws);
      await refreshWorkspaces();
    } catch {
      await tokenStore.clear();
      await workspaceStore.clear();
      setUser(null);
      setWorkspaceId(null);
    } finally {
      setReady(true);
    }
  }, [refreshWorkspaces]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User; workspaceId?: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          auth: false,
        }
      );
      if (!res?.token) throw new ApiError(500, "Login não retornou token");
      await tokenStore.set(res.token);
      if (res.workspaceId) {
        await workspaceStore.set(res.workspaceId);
        setWorkspaceId(res.workspaceId);
      }
      setUser(res.user);
      await refreshWorkspaces();
    },
    [refreshWorkspaces]
  );

  const logout = useCallback(async () => {
    await tokenStore.clear();
    await workspaceStore.clear();
    setUser(null);
    setWorkspaces([]);
    setWorkspaceId(null);
  }, []);

  const switchWorkspace = useCallback(async (id: string) => {
    const res = await apiFetch<{ token?: string; workspaceId?: string }>(
      `/api/workspaces/${id}/switch`,
      { method: "POST" }
    );
    if (res?.token) await tokenStore.set(res.token);
    await workspaceStore.set(id);
    setWorkspaceId(id);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, user, workspaces, workspaceId, login, logout, switchWorkspace, refreshWorkspaces }),
    [ready, user, workspaces, workspaceId, login, logout, switchWorkspace, refreshWorkspaces]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useAuthRedirect() {
  const { ready, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "login";
    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [ready, user, segments, router]);
}
