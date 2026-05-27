import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import QRCode from "react-qr-code";
import {
  Plus, Megaphone, Play, Pause, Trash2, BarChart3, Eye,
  Send, Users, CheckCircle, XCircle, MessageSquare, Share2, Copy, Download,
  Sparkles, FileText, ChevronRight, ChevronLeft, Clock, Pencil, AlertTriangle,
  Phone, Bot,
} from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  shareToken: string | null;
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  contentType: "single" | "sequence" | "agent";
  channels: string[];
  segmentFilter: { type: string; value?: string } | null;
  messages: Array<{ order: number; content: string; delayMinutes?: number }>;
  agentId: string | null;
  scheduledAt: string | null;
  rateLimit: number | null;
  allowedHours: { days: number[]; startHour: number; endHour: number } | null;
  totalContacts: number | null;
  sentCount: number | null;
  deliveredCount: number | null;
  repliedCount: number | null;
  convertedCount: number | null;
  failedCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MessageTemplate = {
  id: string;
  name: string;
  category: string;
  channel: string | null;
  content: string;
  variables: string[] | null;
  isActive: boolean;
};

type ErrataContact = {
  id: string;
  name: string;
  phone: string;
  messagesCount: number;
  status: string;
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Em Execução",
  paused: "Pausada",
  completed: "Concluída",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-purple-100 text-purple-700",
};

export default function AdminCampaigns() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // AI variant picker
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [aiVariants, setAiVariants] = useState<string[]>([]);

  // Errata state
  const [errataCampaignId, setErrataCampaignId] = useState("");
  const [errataContext, setErrataContext] = useState("");
  const [errataMessage, setErrataMessage] = useState("");
  const [errataContacts, setErrataContacts] = useState<ErrataContact[]>([]);
  const [selectedErrataContacts, setSelectedErrataContacts] = useState<Set<string>>(new Set());
  const [testPhone, setTestPhone] = useState("");
  const [errataLoading, setErrataLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contentType: "single" as "single" | "sequence" | "agent",
    channels: ["whatsapp"],
    segmentFilter: { type: "all" as string, value: "" },
    messages: [{ order: 0, content: "", delayMinutes: 0 }],
    rateLimit: 100,
    allowedHours: null as { days: number[]; startHour: number; endHour: number } | null,
    scheduleType: "immediate" as "immediate" | "scheduled",
    scheduledAt: "",
  });

  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "geral",
    channel: "whatsapp",
    content: "",
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/admin/campaigns"],
  });

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/admin/templates"],
  });

  const { data: segmentPreview } = useQuery({
    queryKey: ["/api/admin/campaigns/preview-segment", formData.segmentFilter],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/admin/campaigns/preview-segment", {
        segmentFilter: formData.segmentFilter.type === "all" ? null : formData.segmentFilter,
      });
      return res.json();
    },
    enabled: showWizard && wizardStep === 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/campaigns", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: editingCampaign ? "Campanha atualizada!" : "Campanha criada com sucesso" });
      setShowWizard(false);
      setEditingCampaign(null);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar campanha", description: err.message, variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/campaigns/${id}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campanha iniciada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao iniciar", description: err.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/campaigns/${id}/pause`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campanha pausada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campanha excluída" });
    },
  });

  const generateCopyMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/campaigns/generate-copy", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.suggestions && data.suggestions.length > 0) {
        const variants = data.suggestions.map((s: { content: string }) => s.content || "");
        setAiVariants(variants);
        setShowVariantPicker(true);
      }
    },
  });

  const generateSequenceMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/campaigns/generate-sequence", data);
      return res.json();
    },
    onSuccess: (data: { messages: Array<{ order: number; content: string; delayMinutes: number }> }) => {
      if (data.messages && data.messages.length > 0) {
        setFormData(prev => ({ ...prev, messages: data.messages }));
        toast({ title: "Sequência gerada com IA!" });
      }
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      toast({ title: "Template criado" });
      setShowTemplateDialog(false);
      setTemplateForm({ name: "", category: "geral", channel: "whatsapp", content: "" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      toast({ title: "Template excluído" });
    },
  });

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      contentType: "single",
      channels: ["whatsapp"],
      segmentFilter: { type: "all", value: "" },
      messages: [{ order: 0, content: "", delayMinutes: 0 }],
      rateLimit: 100,
      allowedHours: null,
      scheduleType: "immediate",
      scheduledAt: "",
    });
    setWizardStep(0);
  }

  function openEditWizard(campaign: Campaign) {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      contentType: campaign.contentType,
      channels: campaign.channels || ["whatsapp"],
      segmentFilter: (campaign.segmentFilter as { type: string; value: string }) || { type: "all", value: "" },
      messages: campaign.messages?.length > 0
        ? campaign.messages.map((m: { order: number; content: string; delayMinutes?: number }) => ({ ...m, delayMinutes: m.delayMinutes ?? 0 }))
        : [{ order: 0, content: "", delayMinutes: 0 }],
      rateLimit: campaign.rateLimit || 100,
      allowedHours: campaign.allowedHours || null,
      scheduleType: campaign.scheduledAt ? "scheduled" : "immediate",
      scheduledAt: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
        : "",
    });
    setWizardStep(0);
    setShowWizard(true);
  }

  function handleCreateCampaign() {
    const isScheduled = formData.scheduleType === "scheduled" && formData.scheduledAt;
    createMutation.mutate({
      name: formData.name,
      description: formData.description || null,
      contentType: formData.contentType,
      channels: formData.channels,
      segmentFilter: formData.segmentFilter.type === "all" ? null : formData.segmentFilter,
      messages: formData.messages,
      rateLimit: formData.rateLimit,
      allowedHours: formData.allowedHours,
      scheduledAt: isScheduled ? formData.scheduledAt : null,
      status: isScheduled ? "scheduled" : "draft",
    });
  }

  async function loadErrataContacts(campaignId: string) {
    if (!campaignId) return;
    setErrataLoading(true);
    try {
      const res = await apiRequest("GET", `/api/admin/campaigns/${campaignId}/contacts`);
      const data = await res.json();
      setErrataContacts(data.contacts || []);
      setSelectedErrataContacts(new Set((data.contacts || []).map((c: ErrataContact) => c.id)));
    } catch {
      toast({ title: "Erro ao carregar contatos", variant: "destructive" });
    } finally {
      setErrataLoading(false);
    }
  }

  async function generateErrataMessage() {
    const campaign = campaigns.find(c => c.id === errataCampaignId);
    setErrataLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/campaigns/errata/generate", {
        campaignName: campaign?.name,
        context: errataContext,
      });
      const data = await res.json();
      setErrataMessage(data.message || "");
    } catch {
      toast({ title: "Erro ao gerar mensagem", variant: "destructive" });
    } finally {
      setErrataLoading(false);
    }
  }

  async function sendErrata(isTest: boolean) {
    if (!errataMessage.trim()) {
      toast({ title: "Escreva ou gere uma mensagem primeiro", variant: "destructive" });
      return;
    }
    if (isTest && !testPhone.trim()) {
      toast({ title: "Informe um número de teste", variant: "destructive" });
      return;
    }
    setErrataLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/campaigns/errata/send", {
        message: errataMessage,
        contactIds: isTest ? undefined : [...selectedErrataContacts],
        testPhone: isTest ? testPhone : undefined,
      });
      const data = await res.json();
      if (isTest) {
        toast({ title: `Teste enviado para ${testPhone}!` });
      } else {
        toast({ title: `Errata enviada para ${data.sent} contato(s)!` });
      }
    } catch {
      toast({ title: "Erro ao enviar errata", variant: "destructive" });
    } finally {
      setErrataLoading(false);
    }
  }

  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const wizardSteps = ["Audiência", "Conteúdo", "Agendamento", "Revisão"];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Campanhas</h1>
              <p className="text-muted-foreground">Gerencie campanhas de mensagens em massa e sequências automatizadas</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-campaigns">
              <TabsTrigger value="campaigns" data-testid="tab-campaigns">
                <Megaphone className="h-4 w-4 mr-1" /> Campanhas
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <FileText className="h-4 w-4 mr-1" /> Templates
              </TabsTrigger>
              <TabsTrigger value="errata" data-testid="tab-errata">
                <AlertTriangle className="h-4 w-4 mr-1" /> Errata
              </TabsTrigger>
            </TabsList>

            {/* ─── CAMPANHAS ─────────────────────────────────────────── */}
            <TabsContent value="campaigns" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingCampaign(null); resetForm(); setShowWizard(true); }} data-testid="button-new-campaign">
                  <Plus className="h-4 w-4 mr-1" /> Nova Campanha
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : campaigns.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">Nenhuma campanha criada</p>
                    <p className="text-sm text-muted-foreground">Crie sua primeira campanha para enviar mensagens em massa</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {campaigns.map((campaign) => (
                    <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg" data-testid={`text-campaign-name-${campaign.id}`}>{campaign.name}</h3>
                              <Badge className={statusColors[campaign.status]} data-testid={`badge-status-${campaign.id}`}>
                                {statusLabels[campaign.status]}
                              </Badge>
                              <Badge variant="outline">
                                {campaign.contentType === "single" ? "Mensagem Única" : campaign.contentType === "sequence" ? "Sequência" : "Agente IA"}
                              </Badge>
                            </div>
                            {campaign.description && (
                              <p className="text-sm text-muted-foreground mb-2">{campaign.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {campaign.totalContacts || 0} contatos</span>
                              <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {campaign.sentCount || 0} enviados</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {campaign.repliedCount || 0} respostas</span>
                              {campaign.failedCount ? (
                                <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" /> {campaign.failedCount} falhas</span>
                              ) : null}
                            </div>
                            {campaign.status === "running" && campaign.totalContacts && campaign.totalContacts > 0 && (
                              <Progress
                                value={((campaign.sentCount || 0) / campaign.totalContacts) * 100}
                                className="mt-2 h-2"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditWizard(campaign)}
                              data-testid={`button-edit-${campaign.id}`}
                              title="Editar campanha"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setShareCampaign(campaign); setShareModalOpen(true); }}
                              data-testid={`button-share-${campaign.id}`}
                              title="Compartilhar link / QR Code"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelectedCampaign(campaign); setShowMetrics(true); }}
                              data-testid={`button-metrics-${campaign.id}`}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            {/* Botão Errata rápido para campanhas concluídas */}
                            {campaign.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setErrataCampaignId(campaign.id);
                                  loadErrataContacts(campaign.id);
                                  setActiveTab("errata");
                                }}
                                data-testid={`button-errata-${campaign.id}`}
                                title="Enviar errata / retratação"
                                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                            )}
                            {(campaign.status === "draft" || campaign.status === "paused") && (
                              <Button
                                size="sm"
                                onClick={() => startMutation.mutate(campaign.id)}
                                disabled={startMutation.isPending}
                                data-testid={`button-start-${campaign.id}`}
                              >
                                <Play className="h-4 w-4 mr-1" /> Iniciar
                              </Button>
                            )}
                            {campaign.status === "running" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => pauseMutation.mutate(campaign.id)}
                                data-testid={`button-pause-${campaign.id}`}
                              >
                                <Pause className="h-4 w-4 mr-1" /> Pausar
                              </Button>
                            )}
                            {campaign.status === "draft" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteMutation.mutate(campaign.id)}
                                data-testid={`button-delete-${campaign.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── TEMPLATES ─────────────────────────────────────────── */}
            <TabsContent value="templates" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowTemplateDialog(true)} data-testid="button-new-template">
                  <Plus className="h-4 w-4 mr-1" /> Novo Template
                </Button>
              </div>

              {templates.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum template criado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} data-testid={`card-template-${template.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <CardDescription>
                          <Badge variant="outline" className="text-xs">{template.category}</Badge>
                          {" "}
                          <Badge variant="outline" className="text-xs">{template.channel}</Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{template.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 mt-2"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              messages: [{ order: 0, content: template.content, delayMinutes: 0 }],
                            }));
                            setActiveTab("campaigns");
                            setEditingCampaign(null);
                            setShowWizard(true);
                            setWizardStep(1);
                            toast({ title: "Template aplicado ao wizard" });
                          }}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          Usar em campanha
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── ERRATA ────────────────────────────────────────────── */}
            <TabsContent value="errata" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    Errata — Pedido de Desculpas por IA
                  </CardTitle>
                  <CardDescription>
                    Envie uma retratação personalizada para contatos que receberam mensagens indevidas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Seleção de campanha */}
                  <div className="space-y-1.5">
                    <Label>Campanha de referência</Label>
                    <Select
                      value={errataCampaignId}
                      onValueChange={(id) => {
                        setErrataCampaignId(id);
                        loadErrataContacts(id);
                      }}
                    >
                      <SelectTrigger data-testid="select-errata-campaign">
                        <SelectValue placeholder="Selecione a campanha que gerou o problema..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {statusLabels[c.status]} — {c.sentCount || 0} enviados
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contexto */}
                  <div className="space-y-1.5">
                    <Label>O que aconteceu? <span className="text-muted-foreground text-xs">(opcional — ajuda a IA a personalizar)</span></Label>
                    <Textarea
                      value={errataContext}
                      onChange={(e) => setErrataContext(e.target.value)}
                      placeholder="Ex: Foram enviadas 3 mensagens iguais por engano para todos os contatos, parecendo spam..."
                      rows={2}
                      data-testid="input-errata-context"
                    />
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Mensagem de retratação</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateErrataMessage}
                        disabled={errataLoading}
                        data-testid="button-generate-errata"
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {errataLoading ? "Gerando..." : "Gerar com IA"}
                      </Button>
                    </div>
                    <Textarea
                      value={errataMessage}
                      onChange={(e) => setErrataMessage(e.target.value)}
                      placeholder="A IA vai gerar uma mensagem empática aqui, ou escreva a sua..."
                      rows={4}
                      data-testid="input-errata-message"
                    />
                    <p className="text-xs text-muted-foreground">Use <code>{"{nome}"}</code> para personalizar com o nome do contato. {errataMessage.length}/200 caracteres.</p>
                  </div>

                  {/* Lista de contatos */}
                  {errataContacts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Destinatários ({selectedErrataContacts.size} de {errataContacts.length} selecionados)</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedErrataContacts(new Set(errataContacts.map(c => c.id)))}
                          >
                            Todos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedErrataContacts(new Set())}
                          >
                            Nenhum
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                        {errataContacts.map(contact => (
                          <div key={contact.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
                            <Checkbox
                              checked={selectedErrataContacts.has(contact.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedErrataContacts);
                                if (checked) next.add(contact.id);
                                else next.delete(contact.id);
                                setSelectedErrataContacts(next);
                              }}
                              data-testid={`checkbox-errata-contact-${contact.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{contact.name || contact.phone}</p>
                              <p className="text-xs text-muted-foreground">{contact.phone}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {contact.messagesCount} msg{contact.messagesCount !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {errataCampaignId && errataContacts.length === 0 && !errataLoading && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum contato encontrado para esta campanha.
                    </p>
                  )}

                  {/* Teste + Envio */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      Testar antes de enviar
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="Ex: 5511999998888"
                        className="flex-1"
                        data-testid="input-errata-test-phone"
                      />
                      <Button
                        variant="outline"
                        onClick={() => sendErrata(true)}
                        disabled={errataLoading || !errataMessage.trim() || !testPhone.trim()}
                        data-testid="button-errata-test"
                      >
                        <Bot className="h-4 w-4 mr-1" />
                        Testar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O teste envia apenas para o número acima, sem afetar a lista de destinatários.
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => sendErrata(false)}
                    disabled={errataLoading || !errataMessage.trim() || selectedErrataContacts.size === 0}
                    data-testid="button-errata-send"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {errataLoading ? "Enviando..." : `Enviar Errata para ${selectedErrataContacts.size} contato(s)`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ─── WIZARD (Nova / Editar Campanha) ───────────────────────── */}
          <Dialog open={showWizard} onOpenChange={(open) => { setShowWizard(open); if (!open) setEditingCampaign(null); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCampaign ? `Editar: ${editingCampaign.name}` : "Nova Campanha"}</DialogTitle>
                <DialogDescription>
                  Passo {wizardStep + 1} de {wizardSteps.length}: {wizardSteps[wizardStep]}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mb-4">
                {wizardSteps.map((step, i) => (
                  <div
                    key={step}
                    className={`flex-1 h-2 rounded-full ${i <= wizardStep ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>

              {wizardStep === 0 && (
                <div className="space-y-4">
                  <div>
                    <Label>Nome da campanha</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Black Friday 2026"
                      data-testid="input-campaign-name"
                    />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o objetivo da campanha..."
                      data-testid="input-campaign-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de conteúdo</Label>
                      <Select
                        value={formData.contentType}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, contentType: v as "single" | "sequence" | "agent" }))}
                      >
                        <SelectTrigger data-testid="select-content-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Mensagem Única</SelectItem>
                          <SelectItem value="sequence">Sequência (Drip)</SelectItem>
                          <SelectItem value="agent">Agente IA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Canais de envio</Label>
                      <div className="flex gap-2 mt-1">
                        {[
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "telegram", label: "Telegram" },
                          { value: "email", label: "Email" },
                        ].map((ch) => (
                          <Button
                            key={ch.value}
                            type="button"
                            variant={formData.channels.includes(ch.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setFormData(prev => {
                                const has = prev.channels.includes(ch.value);
                                const newChannels = has
                                  ? prev.channels.filter(c => c !== ch.value)
                                  : [...prev.channels, ch.value];
                                return { ...prev, channels: newChannels.length > 0 ? newChannels : [ch.value] };
                              });
                            }}
                            data-testid={`button-channel-${ch.value}`}
                          >
                            {ch.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Segmentação</Label>
                    <Select
                      value={formData.segmentFilter.type}
                      onValueChange={(v) => setFormData(prev => ({
                        ...prev, segmentFilter: { type: v, value: "" },
                      }))}
                    >
                      <SelectTrigger data-testid="select-segment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os contatos</SelectItem>
                        <SelectItem value="temperature">Por Temperatura</SelectItem>
                        <SelectItem value="stage">Por Estágio Pipeline</SelectItem>
                        <SelectItem value="tag">Por Tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.segmentFilter.type === "temperature" && (
                    <div>
                      <Label>Temperatura</Label>
                      <Select
                        value={formData.segmentFilter.value}
                        onValueChange={(v) => setFormData(prev => ({
                          ...prev, segmentFilter: { ...prev.segmentFilter, value: v },
                        }))}
                      >
                        <SelectTrigger data-testid="select-segment-value">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quente">Quente</SelectItem>
                          <SelectItem value="morno">Morno</SelectItem>
                          <SelectItem value="frio">Frio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.segmentFilter.type === "stage" && (
                    <div>
                      <Label>Estágio do Pipeline</Label>
                      <Select
                        value={formData.segmentFilter.value}
                        onValueChange={(v) => setFormData(prev => ({
                          ...prev, segmentFilter: { ...prev.segmentFilter, value: v },
                        }))}
                      >
                        <SelectTrigger data-testid="select-segment-value">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="qualificado">Qualificado</SelectItem>
                          <SelectItem value="proposta">Proposta</SelectItem>
                          <SelectItem value="negociacao">Negociação</SelectItem>
                          <SelectItem value="fechado_ganho">Fechado Ganho</SelectItem>
                          <SelectItem value="fechado_perdido">Fechado Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.segmentFilter.type === "tag" && (
                    <div>
                      <Label>Tag</Label>
                      <Input
                        value={formData.segmentFilter.value}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, segmentFilter: { ...prev.segmentFilter, value: e.target.value },
                        }))}
                        placeholder="Ex: vip, interessado, newsletter"
                        data-testid="input-segment-tag"
                      />
                    </div>
                  )}

                  {segmentPreview && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="h-4 w-4" />
                          <span className="font-medium">Preview: {segmentPreview.count} contatos</span>
                        </div>
                        {segmentPreview.sample && segmentPreview.sample.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Exemplos: {segmentPreview.sample.map((s: { name: string; phone: string }) => s.name || s.phone).join(", ")}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Mensagens</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateCopyMutation.mutate({
                          objective: formData.name,
                          tone: "amigavel",
                          channel: formData.channels[0],
                        })}
                        disabled={generateCopyMutation.isPending}
                        data-testid="button-generate-copy"
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {generateCopyMutation.isPending ? "Gerando..." : "Gerar com IA"}
                      </Button>
                      {formData.contentType === "sequence" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSequenceMutation.mutate({
                            objective: formData.name,
                            tone: "amigavel",
                            channel: formData.channels[0],
                            steps: 3,
                          })}
                          disabled={generateSequenceMutation.isPending}
                          data-testid="button-generate-sequence"
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          {generateSequenceMutation.isPending ? "Gerando..." : "Gerar Sequência IA"}
                        </Button>
                      )}
                      {formData.contentType === "sequence" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            messages: [...prev.messages, { order: prev.messages.length, content: "", delayMinutes: 60 }],
                          }))}
                          data-testid="button-add-message"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Etapa
                        </Button>
                      )}
                    </div>
                  </div>

                  {formData.messages.map((msg, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {formData.contentType === "sequence" ? `Etapa ${idx + 1}` : "Mensagem"}
                          </span>
                          {idx > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                messages: prev.messages.filter((_, i) => i !== idx),
                              }))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={msg.content}
                          onChange={(e) => {
                            const newMsgs = [...formData.messages];
                            newMsgs[idx] = { ...newMsgs[idx], content: e.target.value };
                            setFormData(prev => ({ ...prev, messages: newMsgs }));
                          }}
                          placeholder="Olá {nome}, temos uma oferta especial para você..."
                          rows={3}
                          data-testid={`input-message-${idx}`}
                        />
                        <p className="text-xs text-muted-foreground">
                          Variáveis: {"{nome}"}, {"{telefone}"}, {"{email}"}
                        </p>
                        {formData.contentType === "sequence" && idx > 0 && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              value={msg.delayMinutes || 0}
                              onChange={(e) => {
                                const newMsgs = [...formData.messages];
                                newMsgs[idx] = { ...newMsgs[idx], delayMinutes: parseInt(e.target.value) || 0 };
                                setFormData(prev => ({ ...prev, messages: newMsgs }));
                              }}
                              className="w-24"
                              min={0}
                              data-testid={`input-delay-${idx}`}
                            />
                            <span className="text-sm text-muted-foreground">minutos de intervalo</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label>Quando enviar</Label>
                    <Select
                      value={formData.scheduleType}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, scheduleType: v as "immediate" | "scheduled" }))}
                    >
                      <SelectTrigger data-testid="select-schedule-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Imediatamente ao iniciar</SelectItem>
                        <SelectItem value="scheduled">Agendar data/hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.scheduleType === "scheduled" && (
                    <div>
                      <Label>Data e hora de envio</Label>
                      <Input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                        data-testid="input-scheduled-at"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Rate Limit (msgs por ciclo de 60s)</Label>
                    <Input
                      type="number"
                      value={formData.rateLimit}
                      onChange={(e) => setFormData(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 100 }))}
                      min={1}
                      data-testid="input-rate-limit"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Horário comercial permitido</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          allowedHours: prev.allowedHours
                            ? null
                            : { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 },
                        }))}
                        data-testid="button-toggle-hours"
                      >
                        {formData.allowedHours ? "Desativar" : "Ativar"}
                      </Button>
                    </div>

                    {formData.allowedHours && (
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">Dias permitidos</Label>
                            <div className="flex gap-1">
                              {dayLabels.map((day, idx) => (
                                <Button
                                  key={day}
                                  variant={formData.allowedHours!.days.includes(idx) ? "default" : "outline"}
                                  size="sm"
                                  className="w-10 h-8 text-xs"
                                  onClick={() => {
                                    const days = formData.allowedHours!.days.includes(idx)
                                      ? formData.allowedHours!.days.filter(d => d !== idx)
                                      : [...formData.allowedHours!.days, idx].sort();
                                    setFormData(prev => ({
                                      ...prev,
                                      allowedHours: { ...prev.allowedHours!, days },
                                    }));
                                  }}
                                  data-testid={`button-day-${idx}`}
                                >
                                  {day}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Hora início</Label>
                              <Select
                                value={String(formData.allowedHours.startHour)}
                                onValueChange={(v) => setFormData(prev => ({
                                  ...prev,
                                  allowedHours: { ...prev.allowedHours!, startHour: parseInt(v) },
                                }))}
                              >
                                <SelectTrigger data-testid="select-start-hour">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Hora fim</Label>
                              <Select
                                value={String(formData.allowedHours.endHour)}
                                onValueChange={(v) => setFormData(prev => ({
                                  ...prev,
                                  allowedHours: { ...prev.allowedHours!, endHour: parseInt(v) },
                                }))}
                              >
                                <SelectTrigger data-testid="select-end-hour">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resumo da Campanha</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Nome:</span>
                          <p className="font-medium">{formData.name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tipo:</span>
                          <p className="font-medium">
                            {formData.contentType === "single" ? "Mensagem Única" :
                             formData.contentType === "sequence" ? "Sequência" : "Agente IA"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Canal:</span>
                          <p className="font-medium">{formData.channels.join(", ")}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Segmentação:</span>
                          <p className="font-medium">
                            {formData.segmentFilter.type === "all" ? "Todos" :
                             `${formData.segmentFilter.type}: ${formData.segmentFilter.value}`}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mensagens:</span>
                          <p className="font-medium">{formData.messages.length} etapa(s)</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate Limit:</span>
                          <p className="font-medium">{formData.rateLimit} msgs/ciclo</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Envio:</span>
                          <p className="font-medium">
                            {formData.scheduleType === "immediate" ? "Imediato" :
                             formData.scheduledAt ? new Date(formData.scheduledAt).toLocaleString("pt-BR") : "Não definido"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Horário comercial:</span>
                          <p className="font-medium">
                            {formData.allowedHours
                              ? `${formData.allowedHours.startHour}h–${formData.allowedHours.endHour}h (${formData.allowedHours.days.map(d => dayLabels[d]).join(", ")})`
                              : "Sem restrição"}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Preview da primeira mensagem:</span>
                        <p className="mt-1 p-2 bg-muted rounded text-sm">
                          {formData.messages[0]?.content || "(vazio)"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => wizardStep > 0 ? setWizardStep(wizardStep - 1) : setShowWizard(false)}
                  data-testid="button-wizard-back"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {wizardStep === 0 ? "Cancelar" : "Voltar"}
                </Button>
                {wizardStep < wizardSteps.length - 1 ? (
                  <Button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={wizardStep === 0 && !formData.name}
                    data-testid="button-wizard-next"
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={createMutation.isPending}
                    data-testid="button-wizard-create"
                  >
                    {createMutation.isPending ? "Salvando..." : editingCampaign ? "Salvar Alterações" : "Criar Campanha"}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* ─── SELETOR DE VARIANTE IA ─────────────────────────────── */}
          <Dialog open={showVariantPicker} onOpenChange={setShowVariantPicker}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Escolha uma variante
                </DialogTitle>
                <DialogDescription>
                  A IA gerou {aiVariants.length} opções de mensagem. Selecione a que melhor se encaixa na sua campanha.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {aiVariants.map((variant, idx) => (
                  <Card
                    key={idx}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        messages: [{ order: 0, content: variant, delayMinutes: 0 }],
                      }));
                      setShowVariantPicker(false);
                      toast({ title: `Variante ${idx + 1} selecionada!` });
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5">#{idx + 1}</Badge>
                        <p className="text-sm">{variant}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* ─── MÉTRICAS ──────────────────────────────────────────────── */}
          <Dialog open={showMetrics} onOpenChange={setShowMetrics}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Métricas - {selectedCampaign?.name}</DialogTitle>
              </DialogHeader>
              {selectedCampaign && <CampaignMetrics campaignId={selectedCampaign.id} />}
            </DialogContent>
          </Dialog>

          {/* ─── NOVO TEMPLATE ─────────────────────────────────────────── */}
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do template"
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(v) => setTemplateForm(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger data-testid="select-template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="cobranca">Cobrança</SelectItem>
                      <SelectItem value="fidelizacao">Fidelização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Olá {nome}, ..."
                    rows={4}
                    data-testid="input-template-content"
                  />
                </div>
                <Button
                  onClick={() => createTemplateMutation.mutate(templateForm)}
                  disabled={!templateForm.name || !templateForm.content || createTemplateMutation.isPending}
                  className="w-full"
                  data-testid="button-save-template"
                >
                  {createTemplateMutation.isPending ? "Salvando..." : "Salvar Template"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>

      {/* ─── COMPARTILHAR ──────────────────────────────────────────────── */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Compartilhar Campanha
            </DialogTitle>
            <DialogDescription>
              Compartilhe o link para inscrição nesta campanha
            </DialogDescription>
          </DialogHeader>
          {shareCampaign && (() => {
            const url = `${window.location.origin}/c/${shareCampaign.shareToken}`;
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Qualquer pessoa com este link pode se inscrever na campanha <strong>{shareCampaign.name}</strong>.
                </p>
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <QRCode value={url} size={180} id={`qr-svg-campaign-${shareCampaign.id}`} data-testid="qr-code-campaign" />
                </div>
                <div className="flex items-center gap-2">
                  <Input value={url} readOnly className="text-xs font-mono" data-testid="input-share-url-campaign" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(url); toast({ title: "Link copiado!" }); }}
                    data-testid="button-copy-share-url-campaign"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    const svg = document.getElementById(`qr-svg-campaign-${shareCampaign.id}`) as SVGElement | null;
                    if (!svg) return;
                    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `qr-${shareCampaign.name.replace(/\s+/g, "-")}.svg`;
                    a.click();
                  }}
                  data-testid="button-download-qr-campaign"
                >
                  <Download className="h-4 w-4 mr-2" /> Baixar QR Code (SVG)
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function CampaignMetrics({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useQuery<{ campaign: Campaign; metrics: { total: number; sent: number; delivered: number; replied: number; converted: number; failed: number } }>({
    queryKey: ["/api/admin/campaigns", campaignId, "metrics"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/metrics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      return res.json();
    },
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando métricas...</div>;
  if (!data) return null;

  const { metrics } = data;
  const total = metrics.total || 1;

  const stats = [
    { label: "Total", value: metrics.total, icon: Users, color: "text-blue-500" },
    { label: "Enviados", value: metrics.sent, icon: Send, color: "text-green-500" },
    { label: "Entregues", value: metrics.delivered, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Respondidos", value: metrics.replied, icon: MessageSquare, color: "text-purple-500" },
    { label: "Convertidos", value: metrics.converted, icon: CheckCircle, color: "text-amber-500" },
    { label: "Falhas", value: metrics.failed, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Taxa de envio</span>
          <span>{((metrics.sent / total) * 100).toFixed(1)}%</span>
        </div>
        <Progress value={(metrics.sent / total) * 100} className="h-2" />
        <div className="flex justify-between text-sm">
          <span>Taxa de resposta</span>
          <span>{((metrics.replied / total) * 100).toFixed(1)}%</span>
        </div>
        <Progress value={(metrics.replied / total) * 100} className="h-2" />
      </div>
    </div>
  );
}
