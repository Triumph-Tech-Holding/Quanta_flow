import { useRouter, useSegments } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, apiFetch, tokenStore, workspaceStore } from "@/constants/api";

export type User = {
  id: string;
  email: string;
  nome?: string;
  tipoAtor?: string;
  currentWorkspaceId?: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  role?: string;
};

type WorkspacesResponse = {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function normalizeWorkspacesResponse(res: unknown): WorkspacesResponse {
  if (Array.isArray(res)) {
    return { workspaces: res as Workspace[], currentWorkspaceId: null };
  }
  const obj = (res ?? {}) as { workspaces?: Workspace[]; currentWorkspaceId?: string | null };
  return {
    workspaces: Array.isArray(obj.workspaces) ? obj.workspaces : [],
    currentWorkspaceId: obj.currentWorkspaceId ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);

  const setActiveWorkspace = useCallback(async (id: string | null) => {
    if (id) {
      await workspaceStore.set(id);
    } else {
      await workspaceStore.clear();
    }
    setWorkspaceIdState(id);
  }, []);

  const refreshWorkspaces = useCallback(async (): Promise<string | null> => {
    try {
      const res = await apiFetch<unknown>("/api/workspaces");
      const { workspaces: list, currentWorkspaceId } = normalizeWorkspacesResponse(res);
      setWorkspaces(list);
      return currentWorkspaceId;
    } catch {
      setWorkspaces([]);
      return null;
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
      const stored = await workspaceStore.get();
      const remoteCurrent = await refreshWorkspaces();
      const resolved = stored ?? remoteCurrent ?? me.currentWorkspaceId ?? null;
      await setActiveWorkspace(resolved);
    } catch {
      await tokenStore.clear();
      await workspaceStore.clear();
      setUser(null);
      setWorkspaceIdState(null);
    } finally {
      setReady(true);
    }
  }, [refreshWorkspaces, setActiveWorkspace]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      if (!res?.token) throw new ApiError(500, "Login não retornou token");
      await tokenStore.set(res.token);
      setUser(res.user);
      const remoteCurrent = await refreshWorkspaces();
      const resolved = res.user?.currentWorkspaceId ?? remoteCurrent ?? null;
      await setActiveWorkspace(resolved);
    },
    [refreshWorkspaces, setActiveWorkspace]
  );

  const logout = useCallback(async () => {
    await tokenStore.clear();
    await workspaceStore.clear();
    setUser(null);
    setWorkspaces([]);
    setWorkspaceIdState(null);
  }, []);

  const switchWorkspace = useCallback(
    async (id: string) => {
      const res = await apiFetch<{ token?: string; workspaceId?: string }>(
        `/api/workspaces/${id}/switch`,
        { method: "POST" }
      );
      if (res?.token) await tokenStore.set(res.token);
      await setActiveWorkspace(id);
    },
    [setActiveWorkspace]
  );

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
