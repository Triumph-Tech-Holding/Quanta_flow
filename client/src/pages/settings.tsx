import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, History, Settings as SettingsIcon } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string | null;
  isActive: boolean;
  isEncrypted: boolean;
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

interface SettingFormData {
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
  isActive: boolean;
  isEncrypted: boolean;
}

const CATEGORIES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ai", label: "Inteligência Artificial" },
  { value: "integrations", label: "Integrações" },
  { value: "general", label: "Geral" },
];

const TYPES = [
  { value: "api_key", label: "Chave de API" },
  { value: "url", label: "URL" },
  { value: "token", label: "Token" },
  { value: "id", label: "ID" },
  { value: "secret", label: "Segredo" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);
  const [deletingSetting, setDeletingSetting] = useState<Setting | null>(null);
  const [showValue, setShowValue] = useState<string | null>(null);
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [loadingValue, setLoadingValue] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingFormData>({
    key: "",
    value: "",
    type: "api_key",
    category: "general",
    description: "",
    isActive: true,
    isEncrypted: true,
  });

  useSocket();

  const { data: settings = [], isLoading, refetch } = useQuery<Setting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const createMutation = useMutation({
    mutationFn: (data: SettingFormData) => apiRequest("POST", "/api/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Configuração criada com sucesso" });
      closeModal();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar configuração", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Partial<SettingFormData> }) =>
      apiRequest("PUT", `/api/admin/settings/${key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Configuração atualizada com sucesso" });
      closeModal();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar configuração", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => apiRequest("DELETE", `/api/admin/settings/${key}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Configuração deletada com sucesso" });
      setIsDeleteDialogOpen(false);
      setDeletingSetting(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao deletar configuração", description: error.message, variant: "destructive" });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/settings/refresh"),
    onSuccess: () => {
      refetch();
      toast({ title: "Cache atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar cache", description: error.message, variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest("POST", `/api/admin/settings/${key}/validate`, { value });
      return response.json() as Promise<{ valid: boolean; message: string }>;
    },
    onSuccess: (data: { valid: boolean; message: string }) => {
      if (data.valid) {
        toast({ title: "Validação bem-sucedida", description: data.message });
      } else {
        toast({ title: "Validação falhou", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro na validação", description: error.message, variant: "destructive" });
    },
  });

  const filteredSettings = selectedCategory === "all"
    ? settings
    : settings.filter((s) => s.category === selectedCategory);

  const openCreateModal = () => {
    setEditingSetting(null);
    setFormData({
      key: "",
      value: "",
      type: "api_key",
      category: "general",
      description: "",
      isActive: true,
      isEncrypted: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (setting: Setting) => {
    setEditingSetting(setting);
    setFormData({
      key: setting.key,
      value: "",
      type: setting.type,
      category: setting.category,
      description: setting.description || "",
      isActive: setting.isActive,
      isEncrypted: setting.isEncrypted,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSetting(null);
    setFormData({
      key: "",
      value: "",
      type: "api_key",
      category: "general",
      description: "",
      isActive: true,
      isEncrypted: true,
    });
  };

  const handleSubmit = () => {
    if (editingSetting) {
      const updateData: Partial<SettingFormData> = {
        type: formData.type as "api_key" | "url" | "token" | "id" | "secret",
        category: formData.category,
        description: formData.description,
        isActive: formData.isActive,
      };
      if (formData.value) {
        updateData.value = formData.value;
      }
      updateMutation.mutate({ key: editingSetting.key, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (setting: Setting) => {
    setDeletingSetting(setting);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingSetting) {
      deleteMutation.mutate(deletingSetting.key);
    }
  };

  const handleValidate = () => {
    if (editingSetting && formData.value) {
      validateMutation.mutate({ key: editingSetting.key, value: formData.value });
    }
  };

  const fetchDecryptedValue = async (key: string) => {
    if (decryptedValues[key]) {
      setShowValue(key);
      return;
    }
    
    setLoadingValue(key);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/settings/${key}/value`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDecryptedValues((prev) => ({ ...prev, [key]: data.value }));
        setShowValue(key);
      } else {
        toast({ title: "Erro ao buscar valor", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao buscar valor", variant: "destructive" });
    } finally {
      setLoadingValue(null);
    }
  };

  const toggleShowValue = (key: string) => {
    if (showValue === key) {
      setShowValue(null);
    } else {
      fetchDecryptedValue(key);
    }
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getTypeLabel = (type: string) => {
    return TYPES.find((t) => t.value === type)?.label || type;
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold">Configurações</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-muted-foreground">
              Gerencie as credenciais e configurações das APIs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-cache"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Atualizar Cache
            </Button>
            <Button onClick={openCreateModal} data-testid="button-add-setting">
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </div>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList data-testid="tabs-categories">
            <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} data-testid={`tab-${cat.value}`}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações</CardTitle>
                <CardDescription>
                  {filteredSettings.length} configuração(ões) encontrada(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : filteredSettings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma configuração encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chave</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSettings.map((setting) => (
                        <TableRow key={setting.id} data-testid={`row-setting-${setting.key}`}>
                          <TableCell className="font-mono text-sm">{setting.key}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {showValue === setting.key && decryptedValues[setting.key]
                                  ? decryptedValues[setting.key]
                                  : "••••••••"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleShowValue(setting.key)}
                                disabled={loadingValue === setting.key}
                                data-testid={`button-toggle-value-${setting.key}`}
                              >
                                {loadingValue === setting.key ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : showValue === setting.key ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getTypeLabel(setting.type)}</Badge>
                          </TableCell>
                          <TableCell>{getCategoryLabel(setting.category)}</TableCell>
                          <TableCell>
                            {setting.isActive ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(setting)}
                                data-testid={`button-edit-${setting.key}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(setting)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-${setting.key}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSetting ? "Editar Configuração" : "Nova Configuração"}
              </DialogTitle>
              <DialogDescription>
                {editingSetting
                  ? "Atualize os valores da configuração. Deixe o valor em branco para manter o atual."
                  : "Adicione uma nova configuração de API ou credencial."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key">Chave</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="ex: evolution_api_token"
                  disabled={!!editingSetting}
                  data-testid="input-setting-key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                <Input
                  id="value"
                  type="password"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={editingSetting ? "Deixe em branco para manter" : "Valor da configuração"}
                  data-testid="input-setting-value"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger data-testid="select-setting-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="select-setting-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                  data-testid="input-setting-description"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                    data-testid="switch-setting-active"
                  />
                  <Label htmlFor="isActive">Ativo</Label>
                </div>
                {!editingSetting && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isEncrypted"
                      checked={formData.isEncrypted}
                      onCheckedChange={(v) => setFormData({ ...formData, isEncrypted: v })}
                      data-testid="switch-setting-encrypted"
                    />
                    <Label htmlFor="isEncrypted">Criptografar</Label>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              {editingSetting && formData.value && (
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={validateMutation.isPending}
                  data-testid="button-validate-setting"
                >
                  {validateMutation.isPending ? "Validando..." : "Testar"}
                </Button>
              )}
              <Button variant="outline" onClick={closeModal} data-testid="button-cancel-setting">
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-setting"
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a configuração "{deletingSetting?.key}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
