import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, UserPlus, Loader2, Eye, EyeOff } from "lucide-react";

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

function getRoleDescription(role: string) {
  switch (role) {
    case "super_admin":
      return "Acesso total ao sistema";
    case "admin":
      return "Gerente com acesso limitado";
    case "user":
      return "Atendente com acesso básico";
    default:
      return "";
  }
}

export default function AdminUsers() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editRole, setEditRole] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createNome, setCreateNome] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: rolesData = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    enabled: hasPermission("manage_roles") || hasPermission("assign_roles") || hasPermission("create_users"),
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

  const createUserMutation = useMutation({
    mutationFn: async (data: { nome: string; email: string; password: string; roleId?: string }) => {
      const response = await apiRequest("POST", "/api/admin/users", data);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erro ao criar colaborador");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowCreateDialog(false);
      resetCreateForm();
      toast({ title: "Colaborador adicionado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  function resetCreateForm() {
    setCreateNome("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("");
    setShowPassword(false);
  }

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

  const handleCreate = () => {
    if (!createNome.trim() || !createEmail.trim() || !createPassword.trim()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (createPassword.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    const selectedRole = rolesData.find((r) => r.name === createRole);
    if (!selectedRole) {
      toast({ title: "Selecione o nível de acesso", variant: "destructive" });
      return;
    }

    createUserMutation.mutate({
      nome: createNome.trim(),
      email: createEmail.trim().toLowerCase(),
      password: createPassword,
      roleId: selectedRole.id,
    });
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
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {users.length} colaborador{users.length !== 1 ? "es" : ""}
                  </span>
                </div>
                {hasPermission("create_users") && (
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    data-testid="button-add-collaborator"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar Colaborador
                  </Button>
                )}
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
                              {u.mustChangePassword && (
                                <Badge variant="secondary" className="text-xs">
                                  Senha temporária
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-email-${u.id}`}>{u.email}</p>
                            {u.telefone && (
                              <p className="text-xs text-muted-foreground">{u.telefone}</p>
                            )}
                            {u.roles[0] && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {getRoleDescription(u.roles[0])}
                              </p>
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
                <Label className="text-sm font-medium mb-1 block">Status</Label>
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
                  <Label className="text-sm font-medium mb-1 block">Nível de Acesso</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {getRoleLabel(r.name)} — {getRoleDescription(r.name)}
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

      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetCreateForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-nome" className="text-sm font-medium mb-1 block">Nome *</Label>
              <Input
                id="create-nome"
                placeholder="Nome completo"
                value={createNome}
                onChange={(e) => setCreateNome(e.target.value)}
                data-testid="input-create-nome"
              />
            </div>
            <div>
              <Label htmlFor="create-email" className="text-sm font-medium mb-1 block">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="email@exemplo.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                data-testid="input-create-email"
              />
            </div>
            <div>
              <Label htmlFor="create-password" className="text-sm font-medium mb-1 block">Senha temporária *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  data-testid="input-create-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O colaborador precisará trocar a senha no primeiro acesso.
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Nível de Acesso *</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue placeholder="Selecione o nível de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {rolesData.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {getRoleLabel(r.name)} — {getRoleDescription(r.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }} data-testid="button-cancel-create">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createUserMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
