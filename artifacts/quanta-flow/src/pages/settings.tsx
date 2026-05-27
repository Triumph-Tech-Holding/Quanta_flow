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
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, History, Settings as SettingsIcon, Wifi, WifiOff, QrCode, Smartphone, Copy, ExternalLink, Globe, Save, Check, Phone } from "lucide-react";
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

function MetaConfigPanel() {
  const { toast } = useToast();
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/meta`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast({ title: "URL do webhook copiada!" });
  };

  const saveMeta = async () => {
    if (!metaPhoneNumberId || !metaAccessToken || !metaVerifyToken) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const keys = [
        { key: "meta_phone_number_id", value: metaPhoneNumberId, description: "Phone Number ID da Meta Cloud API" },
        { key: "meta_access_token", value: metaAccessToken, description: "Access Token da Meta Cloud API" },
        { key: "meta_verify_token", value: metaVerifyToken, description: "Verify Token para webhook da Meta" },
      ];
      for (const item of keys) {
        await apiRequest("POST", "/api/admin/settings", {
          key: item.key,
          value: item.value,
          type: "api_key",
          category: "whatsapp",
          description: item.description,
          isActive: true,
          isEncrypted: true,
        }).catch(async () => {
          await apiRequest("PUT", `/api/admin/settings/${item.key}`, { value: item.value });
        });
      }
      toast({ title: "Credenciais Meta salvas com sucesso!" });
      setMetaPhoneNumberId("");
      setMetaAccessToken("");
      setMetaVerifyToken("");
    } catch (error: any) {
      toast({ title: "Erro ao salvar credenciais", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4" data-testid="panel-meta-config">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Meta Oficial (Cloud API)
          </p>
          <p className="text-xs text-muted-foreground">
            WhatsApp Business Cloud API — API oficial da Meta para envio e recebimento de mensagens.
          </p>
        </div>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          data-testid="link-meta-console"
        >
          Meta Developers Console <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="p-3 bg-muted rounded-md text-sm space-y-1">
        <p className="font-medium text-xs">Como configurar:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
          <li>Acesse o Meta Developers Console e crie/selecione seu App</li>
          <li>No painel do WhatsApp, copie o <strong>Phone Number ID</strong></li>
          <li>Gere um <strong>Access Token</strong> permanente (System User Token)</li>
          <li>Defina um <strong>Verify Token</strong> (qualquer texto que você escolher)</li>
          <li>Configure o Webhook no Meta apontando para a URL abaixo</li>
        </ol>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone Number ID</label>
          <Input
            placeholder="Ex: 123456789012345"
            value={metaPhoneNumberId}
            onChange={(e) => setMetaPhoneNumberId(e.target.value)}
            data-testid="input-meta-phone-number-id"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Access Token</label>
          <Input
            type="password"
            placeholder="EAAxxxxxxxxxxxxxxxx..."
            value={metaAccessToken}
            onChange={(e) => setMetaAccessToken(e.target.value)}
            data-testid="input-meta-access-token"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Verify Token</label>
          <Input
            placeholder="Seu token de verificação do webhook"
            value={metaVerifyToken}
            onChange={(e) => setMetaVerifyToken(e.target.value)}
            data-testid="input-meta-verify-token"
          />
          <p className="text-xs text-muted-foreground">
            Mesmo token que você configurou no Meta Developers Console
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">URL do Webhook</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-2 rounded-md break-all" data-testid="text-meta-webhook-url">
            {webhookUrl}
          </code>
          <Button size="icon" variant="outline" onClick={copyWebhookUrl} data-testid="button-copy-meta-webhook">
            {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cole esta URL no campo "Callback URL" do webhook no Meta Developers Console
        </p>
      </div>

      <Button
        onClick={saveMeta}
        disabled={saving}
        className="w-full"
        data-testid="button-save-meta"
      >
        {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Configurações Meta
      </Button>
    </div>
  );
}

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

  const { data: providerData, refetch: refetchProvider } = useQuery<{
    activeProvider: string;
    connected: boolean;
    phoneNumber: string | null;
  }>({ queryKey: ["/api/whatsapp-provider"] });

  const { data: qrData, refetch: refetchQr } = useQuery<{
    qrCode: string | null;
    connected: boolean;
    message: string;
  }>({
    queryKey: ["/api/whatsapp-local/qrcode"],
    refetchInterval: (query) =>
      providerData?.activeProvider === "baileys" && !query.state.data?.connected ? 3000 : false,
    enabled: providerData?.activeProvider === "baileys",
  });

  const switchProviderMutation = useMutation({
    mutationFn: (provider: string) =>
      apiRequest("POST", "/api/whatsapp-provider/switch", { provider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-provider"] });
      toast({ title: "Provedor alterado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao alterar provedor", description: error.message, variant: "destructive" });
    },
  });

  const connectBaileysMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp-local/connect"),
    onSuccess: () => {
      refetchProvider();
      refetchQr();
      toast({ title: "WhatsApp Local iniciando — aguarde o QR Code" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
    },
  });

  const disconnectBaileysMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp-local/disconnect"),
    onSuccess: () => {
      refetchProvider();
      refetchQr();
      toast({ title: "WhatsApp Local desconectado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
    },
  });

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

        {/* WhatsApp Provider Panel */}
        <Card data-testid="card-whatsapp-provider">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Provedor WhatsApp
            </CardTitle>
            <CardDescription>
              Selecione o provedor de conexão WhatsApp para sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Provedor ativo:</span>
                <Badge
                  variant="outline"
                  className={
                    providerData?.connected
                      ? "text-green-600 border-green-500"
                      : "text-muted-foreground"
                  }
                >
                  {providerData?.connected ? (
                    <Wifi className="h-3 w-3 mr-1" />
                  ) : (
                    <WifiOff className="h-3 w-3 mr-1" />
                  )}
                  {providerData?.activeProvider === "zapi"
                    ? "Z-API"
                    : providerData?.activeProvider === "baileys"
                    ? "WhatsApp Local (Baileys)"
                    : providerData?.activeProvider === "evolution"
                    ? "Evolution API"
                    : providerData?.activeProvider === "meta"
                    ? "Meta Oficial"
                    : "Nenhum"}
                </Badge>
                {providerData?.connected && providerData?.phoneNumber && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs" data-testid="badge-phone-number">
                    <Phone className="h-3 w-3" />
                    {providerData.phoneNumber}
                  </Badge>
                )}
              </div>

              <Select
                value={providerData?.activeProvider || "none"}
                onValueChange={(val) => switchProviderMutation.mutate(val)}
                disabled={switchProviderMutation.isPending}
              >
                <SelectTrigger className="w-52" data-testid="select-provider">
                  <SelectValue placeholder="Selecionar provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="zapi">Z-API (Nuvem)</SelectItem>
                  <SelectItem value="meta">Meta Oficial (Cloud API)</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="baileys">WhatsApp Local (Baileys)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {providerData?.activeProvider === "baileys" && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-sm">WhatsApp Local (Baileys)</p>
                    <p className="text-xs text-muted-foreground">
                      Conexão direta sem API externa. Escaneie o QR Code para conectar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!qrData?.connected ? (
                      <Button
                        onClick={() => connectBaileysMutation.mutate()}
                        disabled={connectBaileysMutation.isPending}
                        size="sm"
                        data-testid="button-baileys-connect"
                      >
                        {connectBaileysMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-1" />
                        )}
                        Gerar QR Code
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => disconnectBaileysMutation.mutate()}
                        disabled={disconnectBaileysMutation.isPending}
                        size="sm"
                        data-testid="button-baileys-disconnect"
                      >
                        Desconectar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchQr()}
                      data-testid="button-baileys-refresh-qr"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {qrData?.connected ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">WhatsApp Local conectado!</span>
                  </div>
                ) : qrData?.qrCode ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho
                    </p>
                    <img
                      src={qrData.qrCode}
                      alt="QR Code WhatsApp"
                      className="w-48 h-48 border rounded-lg"
                      data-testid="img-baileys-qrcode"
                    />
                    <p className="text-xs text-muted-foreground">{qrData.message}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Clique em "Gerar QR Code" para iniciar a conexão
                  </p>
                )}
              </div>
            )}

            {providerData?.activeProvider === "meta" && (
              <MetaConfigPanel />
            )}
          </CardContent>
        </Card>

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
