import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, Users, Loader2 } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  nome: string;
  tipoAtor: string;
  telefone: string | null;
  status: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: { name: string; description: string | null }[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "suspended":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Ativo";
    case "inactive":
      return "Inativo";
    case "suspended":
      return "Suspenso";
    default:
      return status;
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "user":
      return "Usuário";
    default:
      return role;
  }
}

export default function AdminUsers() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editRole, setEditRole] = useState("");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: rolesData = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    enabled: hasPermission("manage_roles"),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Record<string, any> }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: "Usuário atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar usuário", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !hasPermission("view_users")) {
    return <Redirect to="/dashboard" />;
  }

  const handleEdit = (u: AdminUser) => {
    setEditingUser(u);
    setEditStatus(u.status);
    setEditRole(u.roles[0] || "");
  };

  const handleSave = () => {
    if (!editingUser) return;

    const data: Record<string, any> = {};
    if (editStatus !== editingUser.status) data.status = editStatus;

    const selectedRole = rolesData.find((r) => r.name === editRole);
    if (selectedRole && editRole !== editingUser.roles[0]) {
      data.roleId = selectedRole.id;
    }

    updateUserMutation.mutate({ userId: editingUser.id, data });
  };

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
              <h1 className="text-lg font-semibold">Gestão de Usuários</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {users.length} usuário{users.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {users.map((u) => (
                    <Card key={u.id} data-testid={`card-user-${u.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" data-testid={`text-name-${u.id}`}>{u.nome}</span>
                              <Badge
                                variant={getStatusColor(u.status) as any}
                                className="text-xs"
                                data-testid={`badge-status-${u.id}`}
                              >
                                {getStatusLabel(u.status)}
                              </Badge>
                              {u.roles.map((r) => (
                                <Badge key={r} variant="outline" className="text-xs" data-testid={`badge-role-${u.id}`}>
                                  {getRoleLabel(r)}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-email-${u.id}`}>{u.email}</p>
                            {u.telefone && (
                              <p className="text-xs text-muted-foreground">{u.telefone}</p>
                            )}
                          </div>
                          {hasPermission("edit_users") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(u)}
                              data-testid={`button-edit-${u.id}`}
                            >
                              Editar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Nome</p>
                <p className="text-sm text-muted-foreground">{editingUser.nome}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Email</p>
                <p className="text-sm text-muted-foreground">{editingUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasPermission("assign_roles") && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Role</label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {getRoleLabel(r.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
