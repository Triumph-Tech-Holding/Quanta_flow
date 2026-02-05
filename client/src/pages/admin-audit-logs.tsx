import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface AuditResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    update_user: "Atualizou usuário",
    unauthorized_access_attempt: "Tentativa de acesso não autorizado",
    create_setting: "Criou configuração",
    update_setting: "Atualizou configuração",
    delete_setting: "Deletou configuração",
    login: "Login",
    logout: "Logout",
  };
  return labels[action] || action;
}

function getResourceLabel(resource: string) {
  const labels: Record<string, string> = {
    users: "Usuários",
    settings: "Configurações",
    roles: "Roles",
    leads: "Leads",
    inbox: "Inbox",
    audit_logs: "Audit Logs",
  };
  return labels[resource] || resource;
}

function getActionColor(action: string) {
  if (action.includes("unauthorized") || action.includes("delete")) return "destructive";
  if (action.includes("create")) return "default";
  if (action.includes("update")) return "secondary";
  return "outline";
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAuditLogs() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/audit-logs", page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !hasPermission("view_audit_logs")) {
    return <Redirect to="/dashboard" />;
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold">Logs de Auditoria</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {data?.total || 0} registro{(data?.total || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {data?.logs.map((log) => (
                    <Card key={log.id} data-testid={`card-log-${log.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant={getActionColor(log.action) as any}
                                className="text-xs"
                                data-testid={`badge-action-${log.id}`}
                              >
                                {getActionLabel(log.action)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {getResourceLabel(log.resource)}
                              </Badge>
                            </div>
                            <p className="text-sm">
                              <span className="font-medium">{log.userName || log.userEmail || "Sistema"}</span>
                              {log.resourceId && (
                                <span className="text-muted-foreground"> - ID: {log.resourceId.slice(0, 8)}...</span>
                              )}
                            </p>
                            {log.ipAddress && (
                              <p className="text-xs text-muted-foreground">IP: {log.ipAddress}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-date-${log.id}`}>
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {data?.logs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum log de auditoria encontrado.
                    </div>
                  )}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
