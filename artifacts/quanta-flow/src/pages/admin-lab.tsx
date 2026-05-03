import { useState, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, PlayCircle, Volume2, Zap, CheckCircle2, XCircle,
  Webhook, Smartphone, Image as ImageIcon, ShieldCheck, RefreshCw,
  BarChart3, Pencil, Plus, Check, X, Trash2, FileText, Download, Eye, Sparkles,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";

interface ProjectStatusItem {
  id: string;
  featureId: string;
  featureName: string;
  category: string;
  priority: "alta" | "media" | "baixa";
  status: "concluido" | "em_curso" | "pendente" | "pausado";
  progress: number;
  notes?: string | null;
  sortOrder: number;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
}

const fmtDate = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

type TtsVoice = "alloy" | "echo" | "fable";

interface FlowTrace {
  blockId: string;
  blockType: string;
  status: "ok" | "skipped" | "condition_true" | "condition_false" | "would_send";
  result: string;
  wouldSend?: string;
  timestamp: string;
}

interface WebhookTestResult {
  webhookId: string;
  ok: boolean;
  status: number;
  responseBody?: string;
}

interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

interface AutomationFlow {
  id: string;
  name: string;
  isActive: boolean;
}

interface ChatMessage {
  role: "user" | "bot";
  type: string;
  content: string;
}

export default function AdminLab() {
  const { toast } = useToast();

  // --- Flow Simulator Chat ---
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [flowContactName, setFlowContactName] = useState("Maria Silva");
  const [flowContactPhone, setFlowContactPhone] = useState("11999999999");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [chatVars, setChatVars] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");
  const [chatDone, setChatDone] = useState(false);
  const [flowTrace, setFlowTrace] = useState<FlowTrace[]>([]);

  // --- TTS ---
  const [ttsText, setTtsText] = useState("Olá! Como posso ajudá-lo hoje?");
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>("alloy");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);

  // --- Image AI ---
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // --- Webhook Test ---
  const [webhookResults, setWebhookResults] = useState<Record<string, WebhookTestResult>>({});
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // --- WhatsApp Provider Test ---
  const [wpPhone, setWpPhone] = useState("");
  const [wpMessage, setWpMessage] = useState("Mensagem de teste do Quanta Flow Lab 🧪");
  const [wpResult, setWpResult] = useState<{ success: boolean; message: string } | null>(null);

  // --- Protocolos ---
  const SMOKE_TESTS = [
    { id: "health", label: "Health Check", endpoint: "/api/health", method: "GET" },
    { id: "auth_me", label: "Auth /me (token válido)", endpoint: "/api/auth/me", method: "GET" },
    { id: "flows", label: "Listar Fluxos", endpoint: "/api/automation-flows", method: "GET" },
    { id: "contacts", label: "Listar Contatos (CRM)", endpoint: "/api/crm/contacts", method: "GET" },
    { id: "agents", label: "Listar Agentes IA", endpoint: "/api/admin/agents", method: "GET" },
    { id: "campaigns", label: "Listar Campanhas", endpoint: "/api/admin/campaigns", method: "GET" },
    { id: "webhooks", label: "Listar Webhooks", endpoint: "/api/webhooks/outbound", method: "GET" },
    { id: "social", label: "Listar Projetos Sociais", endpoint: "/api/admin/social/projects", method: "GET" },
    { id: "status", label: "Painel de Status (FLOW Standard)", endpoint: "/api/admin/project-status", method: "GET" },
    { id: "templates", label: "Listar Templates", endpoint: "/api/admin/templates", method: "GET" },
  ];
  const DOD_ITEMS = [
    { id: "dod_auth", label: "Auth: Login/logout funcionando, token expira em 24h" },
    { id: "dod_rbac", label: "RBAC: Endpoints admin bloqueados para role 'user'" },
    { id: "dod_inbox", label: "Inbox: Mensagens chegam via Socket.io em tempo real" },
    { id: "dod_crm", label: "CRM: Lead criado automaticamente na 1ª mensagem" },
    { id: "dod_kanban", label: "CRM: Drag-and-drop do Kanban funcionando" },
    { id: "dod_flow", label: "Automação: Flow Sim executa blocos corretamente" },
    { id: "dod_agent", label: "Agentes IA: Chat preview responde via OpenAI" },
    { id: "dod_campaign", label: "Campanhas: Worker processa deliveries a cada 60s" },
    { id: "dod_social", label: "Social: Geração de conteúdo AI retorna formatos" },
    { id: "dod_settings", label: "Settings: Valores criptografados (AES-256-CBC)" },
    { id: "dod_sla", label: "Fila: Timer SLA fica vermelho ao ultrapassar prazo" },
    { id: "dod_manual", label: "Doc: Manual PDF e visualizador inline funcionando" },
  ];
  const [smokeResults, setSmokeResults] = useState<Record<string, "ok" | "fail" | "running">>({});
  const [runningAllSmoke, setRunningAllSmoke] = useState(false);
  const [dodChecked, setDodChecked] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("quanta_dod_checklist");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleDod = (id: string) => {
    setDodChecked(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem("quanta_dod_checklist", JSON.stringify(updated));
      return updated;
    });
  };

  const runSmokeTest = async (endpoint: string, method: string, id: string) => {
    setSmokeResults(prev => ({ ...prev, [id]: "running" }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(endpoint, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSmokeResults(prev => ({ ...prev, [id]: res.status >= 200 && res.status < 400 ? "ok" : "fail" }));
    } catch {
      setSmokeResults(prev => ({ ...prev, [id]: "fail" }));
    }
  };

  const runAllSmokeTests = async () => {
    setRunningAllSmoke(true);
    for (const test of SMOKE_TESTS) {
      await runSmokeTest(test.endpoint, test.method, test.id);
    }
    setRunningAllSmoke(false);
  };

  // --- Progresso (Painel de Status) ---
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editStatusValues, setEditStatusValues] = useState<Partial<ProjectStatusItem>>({});
  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatusValues, setNewStatusValues] = useState<{
    featureId: string;
    featureName: string;
    category: string;
    priority: "alta" | "media" | "baixa";
    status: "concluido" | "em_curso" | "pendente" | "pausado";
    progress: number;
  }>({ featureId: "", featureName: "", category: "geral", priority: "media", status: "pendente", progress: 0 });

  const { data: statusItems = [], isLoading: loadingStatus } = useQuery<ProjectStatusItem[]>({
    queryKey: ["/api/admin/project-status"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectStatusItem> }) => {
      return apiRequest("PUT", `/api/admin/project-status/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-status"] });
      setEditingStatusId(null);
      toast({ title: "Status atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/project-status/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-status"] });
      toast({ title: "Item removido!" });
    },
  });

  const createStatusMutation = useMutation({
    mutationFn: async (data: typeof newStatusValues) => apiRequest("POST", "/api/admin/project-status", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-status"] });
      setAddingStatus(false);
      setNewStatusValues({ featureId: "", featureName: "", category: "geral", priority: "media", status: "pendente", progress: 0 });
      toast({ title: "Feature adicionada!" });
    },
  });

  // --- Filtros do Painel de Status ---
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "em_curso" | "pausado" | "concluido">("todos");
  const [priorityFilter, setPriorityFilter] = useState<"todas" | "alta" | "media" | "baixa">("todas");

  // --- Detalhe da Feature (modal de história) ---
  const [detailFeature, setDetailFeature] = useState<ProjectStatusItem | null>(null);

  // --- Gerador de Backlog com IA ---
  const [aiOpen, setAiOpen] = useState(false);
  const [aiIdea, setAiIdea] = useState("");
  const [aiCategory, setAiCategory] = useState("Novo Módulo");
  const [aiSprintCount, setAiSprintCount] = useState(2);
  const [aiFeaturesPerSprint, setAiFeaturesPerSprint] = useState(3);
  const [aiPreview, setAiPreview] = useState<any[] | null>(null);

  const aiPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backlog/generate", {
        idea: aiIdea, category: aiCategory, sprintCount: aiSprintCount, featuresPerSprint: aiFeaturesPerSprint, dryRun: true,
      });
      return res.json() as Promise<{ features: any[]; sprintCount: number }>;
    },
    onSuccess: (data) => {
      setAiPreview(data.features);
      toast({ title: `Pré-visualização: ${data.features.length} features em ${data.sprintCount} sprints` });
    },
    onError: (err: Error) => toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" }),
  });

  const aiCommitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backlog/generate", {
        idea: aiIdea, category: aiCategory, sprintCount: aiSprintCount, featuresPerSprint: aiFeaturesPerSprint,
      });
      return res.json() as Promise<{ created: any[]; totalFeatures: number; sprintCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/project-status"] });
      toast({ title: `${data.totalFeatures} features adicionadas em ${data.sprintCount} sprints!` });
      setAiOpen(false);
      setAiIdea("");
      setAiPreview(null);
    },
    onError: (err: Error) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const { data: allFlows = [] } = useQuery<AutomationFlow[]>({
    queryKey: ["/api/automation-flows"],
  });
  const flows = allFlows.filter((f) => f.isActive);

  const { data: outboundWebhooks = [] } = useQuery<OutboundWebhook[]>({
    queryKey: ["/api/webhooks/outbound"],
  });

  // Flow chat simulation
  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/admin/lab/simulate-flow-chat", {
        flowId: selectedFlowId,
        currentBlockId: currentBlockId,
        userMessage: msg,
        vars: chatVars,
      });
      return res.json() as Promise<{ outboundMessages: ChatMessage[]; nextBlockId: string | null; awaitingReply: boolean; done: boolean }>;
    },
    onSuccess: (data) => {
      const newMessages = data.outboundMessages.map((m) => ({ ...m, role: "bot" as const }));
      setChatHistory((prev) => [...prev, { role: "user", type: "text", content: chatInput }, ...newMessages]);
      setCurrentBlockId(data.nextBlockId);
      setChatDone(data.done);
      setChatInput("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const initChat = () => {
    setChatHistory([]);
    setChatVars({ nome: flowContactName, telefone: flowContactPhone, email: "teste@example.com", mensagem: "" });
    setCurrentBlockId(null);
    setChatDone(false);
    setChatInput("");
    chatMutation.mutate("Iniciar");
  };

  const sendMessage = () => {
    if (!chatInput.trim() || chatDone || chatMutation.isPending) return;
    chatMutation.mutate(chatInput);
  };

  // TTS generation
  const ttsMutation = useMutation({
    mutationFn: async (): Promise<Blob> => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-tts", {
        text: ttsText,
        voice: ttsVoice,
      });
      return res.blob();
    },
    onSuccess: (blob: Blob) => {
      if (ttsAudioUrlRef.current) URL.revokeObjectURL(ttsAudioUrlRef.current);
      const url = URL.createObjectURL(blob);
      ttsAudioUrlRef.current = url;
      setTtsAudioUrl(url);
      toast({ title: "Áudio gerado! Use o player abaixo para ouvir." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar TTS", description: err.message, variant: "destructive" });
    },
  });

  // Image generation
  const imageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-image", { prompt: imagePrompt });
      return res.json() as Promise<{ imageUrl: string }>;
    },
    onSuccess: (data) => {
      setGeneratedImageUrl(data.imageUrl);
      toast({ title: "Imagem gerada com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar imagem", description: err.message, variant: "destructive" });
    },
  });

  // Webhook test
  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string): Promise<WebhookTestResult> => {
      const res = await apiRequest("POST", `/api/webhooks/outbound/${webhookId}/test`, {});
      const body = await res.json() as { ok: boolean; status: number; responseBody?: string };
      return { webhookId, ok: body.ok, status: body.status, responseBody: body.responseBody };
    },
    onSuccess: (data) => {
      setWebhookResults((prev) => ({
        ...prev,
        [data.webhookId]: data,
      }));
      setTestingWebhookId(null);
      toast({
        title: data.ok ? "Webhook OK!" : "Webhook retornou erro",
        description: `HTTP ${data.status}`,
        variant: data.ok ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      setTestingWebhookId(null);
      toast({ title: "Erro ao testar webhook", description: err.message, variant: "destructive" });
    },
  });

  // WhatsApp provider test
  const wpTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/test-whatsapp", {
        phone: wpPhone,
        message: wpMessage,
      });
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      setWpResult(data);
      toast({
        title: data.success ? "Mensagem enviada!" : "Falha no envio",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => {
      if (ttsAudioUrlRef.current) URL.revokeObjectURL(ttsAudioUrlRef.current);
    };
  }, []);

  const traceStatusIcon = (status: FlowTrace["status"]) => {
    switch (status) {
      case "ok":
      case "would_send":
      case "condition_true":
        return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
      case "skipped":
      case "condition_false":
        return <XCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <div>
            <h1 className="text-lg font-semibold">Laboratório de Testes</h1>
            <p className="text-xs text-muted-foreground">
              Ambiente seguro para testar funcionalidades sem afetar dados reais
            </p>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Tabs defaultValue="progresso" className="space-y-4">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="progresso" data-testid="tab-progresso">Progresso</TabsTrigger>
              <TabsTrigger value="protocolos" data-testid="tab-protocolos">Protocolos</TabsTrigger>
              <TabsTrigger value="docs" data-testid="tab-docs">Docs</TabsTrigger>
              <TabsTrigger value="flow" data-testid="tab-flow">Flow Sim</TabsTrigger>
              <TabsTrigger value="tts" data-testid="tab-tts">TTS</TabsTrigger>
              <TabsTrigger value="image" data-testid="tab-image">Imagem IA</TabsTrigger>
              <TabsTrigger value="webhook" data-testid="tab-webhook">Webhooks</TabsTrigger>
              <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
            </TabsList>

            {/* === PROGRESSO (Painel de Status / Engineering Cockpit) === */}
            <TabsContent value="progresso" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted"><BarChart3 className="w-5 h-5" /></div>
                      <div>
                        <CardTitle className="text-base">Progresso por Módulo — Painel de Status</CardTitle>
                        <CardDescription>Cockpit técnico interno: matriz editável de features com prioridade, status e progresso</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiOpen(true)} data-testid="button-ai-backlog">
                        <Sparkles className="w-4 h-4 text-primary" />Gerar Backlog com IA
                      </Button>
                      <Button size="sm" className="gap-2" onClick={() => setAddingStatus(true)} data-testid="button-add-feature">
                        <Plus className="w-4 h-4" />Nova Feature
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Filtros */}
                  <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-border">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Status:</span>
                      {([
                        { v: "todos",    l: "Todos",     cls: "bg-muted hover:bg-muted/80" },
                        { v: "pendente", l: "Pendentes", cls: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300" },
                        { v: "em_curso", l: "Em curso",  cls: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300" },
                        { v: "pausado",  l: "Pausados",  cls: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300" },
                        { v: "concluido",l: "Concluídos",cls: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300" },
                      ] as const).map((opt) => {
                        const active = statusFilter === opt.v;
                        const count = opt.v === "todos" ? statusItems.length : statusItems.filter(i => i.status === opt.v).length;
                        return (
                          <button
                            key={opt.v}
                            onClick={() => setStatusFilter(opt.v)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${active ? "ring-2 ring-primary/60 " + opt.cls : opt.cls + " opacity-70 hover:opacity-100"}`}
                            data-testid={`filter-status-${opt.v}`}
                          >
                            {opt.l} <span className="ml-1 opacity-70">{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs font-medium text-muted-foreground">Prioridade:</span>
                      {([
                        { v: "todas", l: "Todas" },
                        { v: "alta",  l: "Alta"  },
                        { v: "media", l: "Média" },
                        { v: "baixa", l: "Baixa" },
                      ] as const).map((opt) => {
                        const active = priorityFilter === opt.v;
                        return (
                          <button
                            key={opt.v}
                            onClick={() => setPriorityFilter(opt.v)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-muted-foreground"}`}
                            data-testid={`filter-priority-${opt.v}`}
                          >
                            {opt.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {loadingStatus ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /><span>Carregando...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted">
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-12">ID</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs">Feature</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-28">Categoria</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-20" title="Ordenado por prioridade decrescente">Prioridade ↓</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-24">Status</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-28">Progresso</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-20">Entrada</th>
                            <th className="border border-border px-2 py-2 text-left font-semibold text-xs w-20">Conclusão</th>
                            <th className="border border-border px-2 py-2 text-center font-semibold text-xs w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {addingStatus && (
                            <tr className="bg-primary/5 border border-primary/20">
                              <td className="border border-border px-2 py-1">
                                <input className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.featureId} onChange={e => setNewStatusValues(v => ({ ...v, featureId: e.target.value }))} placeholder="F26" />
                              </td>
                              <td className="border border-border px-2 py-1">
                                <input className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.featureName} onChange={e => setNewStatusValues(v => ({ ...v, featureName: e.target.value }))} placeholder="Nome da feature" />
                              </td>
                              <td className="border border-border px-2 py-1">
                                <input className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.category} onChange={e => setNewStatusValues(v => ({ ...v, category: e.target.value }))} placeholder="Categoria" />
                              </td>
                              <td className="border border-border px-2 py-1">
                                <select className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.priority} onChange={e => setNewStatusValues(v => ({ ...v, priority: e.target.value as "alta" | "media" | "baixa" }))}>
                                  <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
                                </select>
                              </td>
                              <td className="border border-border px-2 py-1">
                                <select className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.status} onChange={e => setNewStatusValues(v => ({ ...v, status: e.target.value as "concluido" | "em_curso" | "pendente" | "pausado" }))}>
                                  <option value="concluido">Concluído</option><option value="em_curso">Em curso</option><option value="pendente">Pendente</option><option value="pausado">Pausado</option>
                                </select>
                              </td>
                              <td className="border border-border px-2 py-1">
                                <input type="number" min={0} max={100} className="w-full text-xs border rounded px-1 py-0.5 bg-background" value={newStatusValues.progress} onChange={e => setNewStatusValues(v => ({ ...v, progress: Number(e.target.value) }))} />
                              </td>
                              <td className="border border-border px-2 py-1 text-xs text-muted-foreground italic">auto</td>
                              <td className="border border-border px-2 py-1 text-xs text-muted-foreground italic">—</td>
                              <td className="border border-border px-2 py-1 text-center">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => createStatusMutation.mutate(newStatusValues)} className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900" data-testid="button-save-new-feature"><Check className="w-3 h-3 text-green-600" /></button>
                                  <button onClick={() => setAddingStatus(false)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"><X className="w-3 h-3 text-red-500" /></button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {statusItems
                            .filter(it => statusFilter === "todos" ? true : it.status === statusFilter)
                            .filter(it => priorityFilter === "todas" ? true : it.priority === priorityFilter)
                            .map((item, i) => {
                            const isEditing = editingStatusId === item.id;
                            const priorityColor = item.priority === "alta" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : item.priority === "media" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                            const statusColor = item.status === "concluido" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : item.status === "em_curso" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : item.status === "pausado" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-muted text-muted-foreground";
                            return (
                              <tr key={item.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"} data-testid={`status-row-${item.featureId}`}>
                                <td className="border border-border px-2 py-1.5 text-xs font-mono text-muted-foreground">{item.featureId}</td>
                                <td className="border border-border px-2 py-1.5">
                                  {isEditing ? (
                                    <input className="w-full text-xs border rounded px-1 py-0.5 bg-background" defaultValue={item.featureName} onChange={e => setEditStatusValues(v => ({ ...v, featureName: e.target.value }))} />
                                  ) : (
                                    <button
                                      onClick={() => setDetailFeature(item)}
                                      className="text-xs font-medium text-left hover:text-primary hover:underline transition cursor-pointer"
                                      data-testid={`button-feature-detail-${item.featureId}`}
                                      title="Ver história e detalhes"
                                    >
                                      {item.featureName}
                                    </button>
                                  )}
                                </td>
                                <td className="border border-border px-2 py-1.5 text-xs text-muted-foreground">{item.category}</td>
                                <td className="border border-border px-2 py-1.5">
                                  {isEditing ? (
                                    <select className="text-xs border rounded px-1 py-0.5 bg-background" defaultValue={item.priority} onChange={e => setEditStatusValues(v => ({ ...v, priority: e.target.value as "alta" | "media" | "baixa" }))}>
                                      <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
                                    </select>
                                  ) : (<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColor}`}>{item.priority === "alta" ? "Alta" : item.priority === "media" ? "Média" : "Baixa"}</span>)}
                                </td>
                                <td className="border border-border px-2 py-1.5">
                                  {isEditing ? (
                                    <select className="text-xs border rounded px-1 py-0.5 bg-background" defaultValue={item.status} onChange={e => setEditStatusValues(v => ({ ...v, status: e.target.value as "concluido" | "em_curso" | "pendente" | "pausado" }))}>
                                      <option value="concluido">Concluído</option><option value="em_curso">Em curso</option><option value="pendente">Pendente</option><option value="pausado">Pausado</option>
                                    </select>
                                  ) : (<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor}`}>{item.status === "concluido" ? "Concluído" : item.status === "em_curso" ? "Em curso" : item.status === "pausado" ? "Pausado" : "Pendente"}</span>)}
                                </td>
                                <td className="border border-border px-2 py-1.5">
                                  {isEditing ? (
                                    <input type="number" min={0} max={100} className="w-full text-xs border rounded px-1 py-0.5 bg-background" defaultValue={item.progress} onChange={e => setEditStatusValues(v => ({ ...v, progress: Number(e.target.value) }))} />
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <Progress value={item.progress} className="h-1.5 flex-1" />
                                      <span className="text-xs text-muted-foreground w-8 shrink-0">{item.progress}%</span>
                                    </div>
                                  )}
                                </td>
                                <td className="border border-border px-2 py-1.5 text-xs text-muted-foreground tabular-nums" data-testid={`date-created-${item.featureId}`}>
                                  {fmtDate(item.createdAt)}
                                </td>
                                <td className="border border-border px-2 py-1.5 text-xs tabular-nums" data-testid={`date-completed-${item.featureId}`}>
                                  {item.completedAt ? (
                                    <span className="text-green-600 dark:text-green-400 font-medium">{fmtDate(item.completedAt)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="border border-border px-2 py-1.5 text-center">
                                  <div className="flex gap-1 justify-center">
                                    {isEditing ? (
                                      <>
                                        <button onClick={() => updateStatusMutation.mutate({ id: item.id, data: editStatusValues })} className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900" data-testid={`button-save-status-${item.featureId}`}><Check className="w-3 h-3 text-green-600" /></button>
                                        <button onClick={() => setEditingStatusId(null)} className="p-1 rounded hover:bg-muted"><X className="w-3 h-3 text-muted-foreground" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => { setEditingStatusId(item.id); setEditStatusValues({}); }} className="p-1 rounded hover:bg-muted" data-testid={`button-edit-status-${item.featureId}`}><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                                        <button onClick={() => deleteStatusMutation.mutate(item.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900" data-testid={`button-delete-status-${item.featureId}`}><Trash2 className="w-3 h-3 text-red-500" /></button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex gap-4 pt-2 text-xs text-muted-foreground border-t border-border">
                    <span>Total: <strong>{statusItems.length}</strong> features</span>
                    <span>Concluídas: <strong className="text-green-600">{statusItems.filter(i => i.status === "concluido").length}</strong></span>
                    <span>Em curso: <strong className="text-blue-600">{statusItems.filter(i => i.status === "em_curso").length}</strong></span>
                    <span>Pendentes: <strong className="text-muted-foreground">{statusItems.filter(i => i.status === "pendente").length}</strong></span>
                  </div>
                </CardContent>
              </Card>

              {/* Dialog: Detalhe / História da Feature */}
              <Dialog open={!!detailFeature} onOpenChange={(o) => { if (!o) setDetailFeature(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  {detailFeature && (() => {
                    const f = detailFeature;
                    const priorityColor = f.priority === "alta" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : f.priority === "media" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                    const statusColor = f.status === "concluido" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : f.status === "em_curso" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : f.status === "pausado" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-muted text-muted-foreground";
                    const statusLabel = f.status === "concluido" ? "Concluído" : f.status === "em_curso" ? "Em curso" : f.status === "pausado" ? "Pausado" : "Pendente";
                    const priorityLabel = f.priority === "alta" ? "Alta" : f.priority === "media" ? "Média" : "Baixa";

                    // Parse notes: "Sprint N\n\n<summary>\n\nUser Stories:\n1. ..."
                    const notes = (f.notes || "").trim();
                    const sprintMatch = /^Sprint\s+(\d+)/i.exec(notes);
                    const sprint = sprintMatch ? sprintMatch[1] : null;
                    const storiesIdx = notes.indexOf("User Stories:");
                    const beforeStories = storiesIdx >= 0 ? notes.slice(0, storiesIdx).trim() : notes;
                    const summary = beforeStories.replace(/^Sprint\s+\d+\s*/i, "").trim();
                    const storiesText = storiesIdx >= 0 ? notes.slice(storiesIdx + "User Stories:".length).trim() : "";
                    const storyLines = storiesText.split("\n").map(s => s.trim()).filter(s => s.length > 0);

                    const renderInlineMd = (s: string) => {
                      const parts = s.split(/(\*\*[^*]+\*\*)/g);
                      return parts.map((part, idx) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={idx} className="text-foreground">{part.slice(2, -2)}</strong>
                          : <span key={idx}>{part}</span>
                      );
                    };

                    return (
                      <>
                        <DialogHeader>
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">{f.featureId}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColor}`}>{priorityLabel}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor}`}>{statusLabel}</span>
                                {sprint && <Badge variant="outline" className="text-[10px]">Sprint {sprint}</Badge>}
                                <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                              </div>
                              <DialogTitle className="text-lg">{f.featureName}</DialogTitle>
                            </div>
                          </div>
                        </DialogHeader>

                        <div className="space-y-4 mt-2">
                          {/* Progresso */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Progresso</span>
                              <span className="font-medium">{f.progress}%</span>
                            </div>
                            <Progress value={f.progress} className="h-2" />
                          </div>

                          {/* Resumo */}
                          {summary && (
                            <div className="space-y-1">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</h4>
                              <p className="text-sm leading-relaxed">{summary}</p>
                            </div>
                          )}

                          {/* User Stories */}
                          {storyLines.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Stories</h4>
                              <ul className="space-y-2">
                                {storyLines.map((line, idx) => (
                                  <li key={idx} className="text-sm border-l-2 border-primary/40 pl-3 py-1 bg-muted/30 rounded-r leading-relaxed">
                                    {renderInlineMd(line.replace(/^\d+\.\s*/, ""))}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : !summary && (
                            <div className="text-sm text-muted-foreground italic border border-dashed border-border rounded-md p-4 text-center">
                              Esta feature ainda não tem história registrada. Use o botão "Gerar Backlog com IA" para criar features com user stories automaticamente, ou edite a feature e adicione notas.
                            </div>
                          )}

                          {/* Datas */}
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                            <div>
                              <div className="text-muted-foreground">Data de entrada</div>
                              <div className="font-medium tabular-nums">{fmtDate(f.createdAt)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Data de conclusão</div>
                              <div className={`font-medium tabular-nums ${f.completedAt ? "text-green-600 dark:text-green-400" : ""}`}>
                                {f.completedAt ? fmtDate(f.completedAt) : "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <DialogFooter className="gap-2 mt-4">
                          <Button variant="ghost" onClick={() => setDetailFeature(null)}>Fechar</Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => { setEditingStatusId(f.id); setEditStatusValues({}); setDetailFeature(null); }}
                            data-testid="button-detail-edit"
                          >
                            <Pencil className="w-4 h-4" /> Editar
                          </Button>
                        </DialogFooter>
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* Dialog: Gerador de Backlog com IA */}
              <Dialog open={aiOpen} onOpenChange={(o) => { setAiOpen(o); if (!o) { setAiPreview(null); } }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Gerar Backlog com IA
                    </DialogTitle>
                    <DialogDescription>
                      Descreva uma ideia ou objetivo. A IA gera Features, User Stories e organiza em Sprints — tudo já entra no Painel de Status.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Ideia / Objetivo</label>
                      <Textarea
                        rows={4}
                        placeholder="Ex.: Quero um módulo de gestão financeira com cobrança recorrente, conciliação bancária e DRE automático para os lojistas."
                        value={aiIdea}
                        onChange={(e) => setAiIdea(e.target.value)}
                        data-testid="textarea-ai-idea"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Categoria</label>
                        <Input value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} className="text-sm" data-testid="input-ai-category" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Sprints</label>
                        <Input type="number" min={1} max={6} value={aiSprintCount} onChange={(e) => setAiSprintCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} className="text-sm" data-testid="input-ai-sprints" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Features / sprint</label>
                        <Input type="number" min={1} max={6} value={aiFeaturesPerSprint} onChange={(e) => setAiFeaturesPerSprint(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} className="text-sm" data-testid="input-ai-features-per-sprint" />
                      </div>
                    </div>

                    {aiPreview && aiPreview.length > 0 && (
                      <div className="space-y-3 border-t pt-4">
                        <p className="text-xs text-muted-foreground">Pré-visualização — revise antes de salvar:</p>
                        {Array.from(new Set(aiPreview.map((f: any) => f.sprint || 1))).sort().map((sp) => (
                          <div key={sp} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-primary/10 text-primary border border-primary/20">Sprint {sp}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {aiPreview.filter((f: any) => (f.sprint || 1) === sp).length} features
                              </span>
                            </div>
                            <div className="space-y-2 pl-2">
                              {aiPreview.filter((f: any) => (f.sprint || 1) === sp).map((f: any, idx: number) => (
                                <div key={idx} className="border rounded-md p-3 space-y-1.5 bg-muted/30" data-testid={`ai-preview-feature-${idx}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{f.featureName}</p>
                                      {f.summary && <p className="text-xs text-muted-foreground">{f.summary}</p>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                                      <Badge className={`text-[10px] ${f.priority === "alta" ? "bg-red-100 text-red-700" : f.priority === "media" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                                        {f.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                  {Array.isArray(f.stories) && f.stories.length > 0 && (
                                    <ul className="text-xs text-muted-foreground space-y-0.5 mt-2 pl-3 list-disc">
                                      {f.stories.map((s: any, si: number) => (
                                        <li key={si}>
                                          Como <strong>{s.as}</strong>, quero <strong>{s.want}</strong>, para <strong>{s.so}</strong>.
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setAiOpen(false)}>Cancelar</Button>
                    {!aiPreview ? (
                      <Button
                        onClick={() => aiPreviewMutation.mutate()}
                        disabled={aiIdea.trim().length < 5 || aiPreviewMutation.isPending}
                        className="gap-2"
                        data-testid="button-ai-preview"
                      >
                        {aiPreviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Gerar Preview
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setAiPreview(null)} disabled={aiPreviewMutation.isPending || aiCommitMutation.isPending}>
                          Refazer
                        </Button>
                        <Button
                          onClick={() => aiCommitMutation.mutate()}
                          disabled={aiCommitMutation.isPending}
                          className="gap-2"
                          data-testid="button-ai-commit"
                        >
                          {aiCommitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Adicionar ao Backlog
                        </Button>
                      </>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* === FLOW SIMULATOR === */}
            <TabsContent value="flow" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {/* Config Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Configuração</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Fluxo</label>
                      <Select value={selectedFlowId} onValueChange={setSelectedFlowId} disabled={chatHistory.length > 0}>
                        <SelectTrigger data-testid="select-flow" className="text-xs">
                          <SelectValue placeholder="Selecione um fluxo" />
                        </SelectTrigger>
                        <SelectContent>
                          {flows.map((flow) => (
                            <SelectItem key={flow.id} value={flow.id}>
                              {flow.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Nome</label>
                      <Input
                        value={flowContactName}
                        onChange={(e) => setFlowContactName(e.target.value)}
                        placeholder="Maria Silva"
                        className="text-xs"
                        disabled={chatHistory.length > 0}
                        data-testid="input-flow-contact-name"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Telefone</label>
                      <Input
                        value={flowContactPhone}
                        onChange={(e) => setFlowContactPhone(e.target.value)}
                        placeholder="11999999999"
                        className="text-xs"
                        disabled={chatHistory.length > 0}
                        data-testid="input-flow-contact-phone"
                      />
                    </div>

                    {chatHistory.length === 0 ? (
                      <Button onClick={initChat} disabled={!selectedFlowId || chatMutation.isPending} className="w-full text-xs" data-testid="button-start-chat">
                        {chatMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PlayCircle className="h-3 w-3 mr-1" />}
                        Iniciar Conversa
                      </Button>
                    ) : (
                      <Button onClick={() => { setChatHistory([]); setChatDone(false); setChatInput(""); }} variant="outline" className="w-full text-xs">
                        Reiniciar
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Chat Area */}
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">Simulação de Conversa</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 flex flex-col h-96">
                    <ScrollArea className="flex-1 border rounded p-3">
                      <div className="space-y-3">
                        {chatHistory.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-8">Selecione um fluxo e clique em "Iniciar Conversa"</p>
                        ) : (
                          chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-xs p-2 rounded text-xs ${
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground border"
                                }`}
                              >
                                {msg.type !== "text" && <Badge className="text-xs mb-1">{msg.type}</Badge>}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    {!chatDone && chatHistory.length > 0 && (
                      <div className="flex gap-2">
                        <Input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          placeholder="Digite sua resposta..."
                          className="text-xs"
                          disabled={chatMutation.isPending}
                          data-testid="input-chat-message"
                        />
                        <Button onClick={sendMessage} disabled={!chatInput.trim() || chatMutation.isPending} className="text-xs" data-testid="button-send-message">
                          {chatMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviar"}
                        </Button>
                      </div>
                    )}

                    {chatDone && chatHistory.length > 0 && (
                      <p className="text-xs text-center text-muted-foreground py-2">✓ Conversa finalizada</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === TTS === */}
            <TabsContent value="tts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Gerador de Áudio TTS
                  </CardTitle>
                  <CardDescription>
                    Teste como o agente soará via áudio antes de usar em automações.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Texto para converter em áudio</label>
                    <Textarea
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder="Digite o texto para converter em áudio..."
                      className="min-h-24"
                      data-testid="input-tts-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Voz</label>
                    <Select value={ttsVoice} onValueChange={(v) => setTtsVoice(v as TtsVoice)}>
                      <SelectTrigger data-testid="select-tts-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Padrão)</SelectItem>
                        <SelectItem value="echo">Echo (Grave)</SelectItem>
                        <SelectItem value="fable">Fable (Narrativa)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => ttsMutation.mutate()}
                    disabled={!ttsText.trim() || ttsMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-tts"
                  >
                    {ttsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Volume2 className="h-4 w-4 mr-2" />
                    )}
                    Gerar Áudio
                  </Button>

                  {ttsAudioUrl && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Player de Áudio</label>
                      <audio
                        controls
                        src={ttsAudioUrl}
                        className="w-full"
                        data-testid="audio-tts-player"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === IMAGE AI === */}
            <TabsContent value="image" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Gerador de Imagens com IA
                  </CardTitle>
                  <CardDescription>
                    Gere imagens via DALL-E para usar em automações e campanhas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Descrição da imagem (prompt)</label>
                    <Textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Ex: Uma loja moderna de tecnologia com celulares expostos, estilo minimalista, tons de verde e branco"
                      className="min-h-20"
                      data-testid="input-image-prompt"
                    />
                  </div>

                  <Button
                    onClick={() => imageMutation.mutate()}
                    disabled={!imagePrompt.trim() || imageMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-image"
                  >
                    {imageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ImageIcon className="h-4 w-4 mr-2" />
                    )}
                    Gerar Imagem
                  </Button>

                  {generatedImageUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Imagem Gerada</label>
                      <img
                        src={generatedImageUrl}
                        alt="Imagem gerada pela IA"
                        className="w-full rounded-lg border object-contain max-h-96"
                        data-testid="img-generated"
                      />
                      <a
                        href={generatedImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === WEBHOOK TEST === */}
            <TabsContent value="webhook" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Teste de Webhooks Outbound
                  </CardTitle>
                  <CardDescription>
                    Dispare um evento de teste para cada webhook configurado e veja o resultado HTTP.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {outboundWebhooks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum webhook configurado. Configure em Configurações {">"} Webhooks Outbound.
                    </p>
                  ) : (
                    <div className="space-y-3" data-testid="webhook-list">
                      {outboundWebhooks.map((webhook) => {
                        const result = webhookResults[webhook.id];
                        const isTesting = testingWebhookId === webhook.id && testWebhookMutation.isPending;
                        return (
                          <div key={webhook.id} className="border rounded p-3 space-y-2" data-testid={`webhook-item-${webhook.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{webhook.name || "Sem nome"}</p>
                                  <Badge variant={webhook.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                                    {webhook.isActive ? "Ativo" : "Inativo"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2 shrink-0"
                                onClick={() => {
                                  setTestingWebhookId(webhook.id);
                                  testWebhookMutation.mutate(webhook.id);
                                }}
                                disabled={isTesting}
                                data-testid={`button-test-webhook-${webhook.id}`}
                              >
                                {isTesting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Testar"
                                )}
                              </Button>
                            </div>

                            {result && (
                              <div className={`text-xs p-2 rounded border ${result.ok ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`} data-testid={`webhook-result-${webhook.id}`}>
                                <div className="flex items-center gap-1 font-medium mb-1">
                                  {result.ok ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-600" />
                                  )}
                                  HTTP {result.status} — {result.ok ? "Sucesso" : "Erro"}
                                </div>
                                {result.responseBody && (
                                  <pre className="whitespace-pre-wrap break-all font-mono text-xs opacity-75 max-h-20 overflow-y-auto mt-1 bg-black/5 dark:bg-white/5 p-1 rounded">
                                    {result.responseBody}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === WHATSAPP PROVIDER TEST === */}
            <TabsContent value="whatsapp" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Teste do Provedor WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Envie uma mensagem real para validar se a integração WhatsApp está funcionando.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Número de destino (com DDD e código do país)</label>
                    <Input
                      value={wpPhone}
                      onChange={(e) => setWpPhone(e.target.value)}
                      placeholder="5511999999999"
                      data-testid="input-wp-phone"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Mensagem de teste</label>
                    <Textarea
                      value={wpMessage}
                      onChange={(e) => setWpMessage(e.target.value)}
                      placeholder="Mensagem de teste..."
                      className="min-h-16"
                      data-testid="input-wp-message"
                    />
                  </div>

                  <Button
                    onClick={() => wpTestMutation.mutate()}
                    disabled={!wpPhone.trim() || !wpMessage.trim() || wpTestMutation.isPending}
                    className="w-full"
                    data-testid="button-send-wp-test"
                  >
                    {wpTestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Smartphone className="h-4 w-4 mr-2" />
                    )}
                    Enviar Mensagem de Teste
                  </Button>

                  {wpResult && (
                    <div className={`text-sm p-3 rounded border ${wpResult.success ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`} data-testid="wp-test-result">
                      <div className="flex items-center gap-2">
                        {wpResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">{wpResult.success ? "Enviado com sucesso!" : "Falha no envio"}</span>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{wpResult.message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === PROTOCOLOS === */}
            <TabsContent value="protocolos" className="space-y-4">
              {/* Smoke Tests */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4" />
                      Smoke Tests — Endpoints Críticos
                    </CardTitle>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={runAllSmokeTests}
                      disabled={runningAllSmoke}
                      data-testid="button-run-all-smoke"
                    >
                      {runningAllSmoke ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Executar Todos
                    </Button>
                  </div>
                  <CardDescription>
                    Testa endpoints críticos do sistema e retorna status HTTP. Verde = 2xx/3xx/4xx, Vermelho = 5xx/timeout.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {SMOKE_TESTS.map(test => {
                      const result = smokeResults[test.id];
                      return (
                        <div key={test.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30" data-testid={`smoke-test-${test.id}`}>
                          <div className="flex items-center gap-3">
                            {result === "ok" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : result === "fail" ? (
                              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                            ) : result === "running" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{test.label}</p>
                              <p className="text-xs text-muted-foreground font-mono">{test.method} {test.endpoint}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => runSmokeTest(test.endpoint, test.method, test.id)}
                            disabled={result === "running"}
                            data-testid={`button-smoke-${test.id}`}
                          >
                            Testar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(smokeResults).length > 0 && (
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground border-t pt-3">
                      <span>OK: <strong className="text-green-600">{Object.values(smokeResults).filter(v => v === "ok").length}</strong></span>
                      <span>Falha: <strong className="text-red-600">{Object.values(smokeResults).filter(v => v === "fail").length}</strong></span>
                      <span>Pendentes: <strong>{SMOKE_TESTS.length - Object.keys(smokeResults).length}</strong></span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Definition of Done */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    Definition of Done — Critérios de Aceite
                  </CardTitle>
                  <CardDescription>
                    Checklist persistente de qualidade por área funcional. Estado salvo no navegador.
                    {" "}<strong>{Object.values(dodChecked).filter(Boolean).length}/{DOD_ITEMS.length}</strong> concluídos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {DOD_ITEMS.map(item => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${dodChecked[item.id] ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-background hover:bg-muted/30"}`}
                        data-testid={`dod-item-${item.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!dodChecked[item.id]}
                          onChange={() => toggleDod(item.id)}
                          className="h-4 w-4 accent-primary"
                          data-testid={`checkbox-dod-${item.id}`}
                        />
                        <span className={`text-sm ${dodChecked[item.id] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {Object.values(dodChecked).filter(Boolean).length === DOD_ITEMS.length && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Definition of Done completo! Feature pronta para deploy.</p>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground"
                    onClick={() => {
                      setDodChecked({});
                      localStorage.removeItem("quanta_dod_checklist");
                    }}
                    data-testid="button-reset-dod"
                  >
                    Limpar checklist
                  </Button>
                </CardContent>
              </Card>

              {/* Erros Comuns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    Erros Comuns e Soluções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { error: "req.user!.id is undefined", cause: "Usar .id em vez de .userId no JWT payload", fix: "Usar req.user!.userId em todos os handlers de rota" },
                      { error: "SelectItem value=\"\"", cause: "Shadcn SelectItem não aceita value vazio", fix: "Usar value=\"_none_\" como sentinel para opção vazia" },
                      { error: "array(text()) inválido", cause: "Sintaxe errada no schema Drizzle", fix: "Usar text().array() como método encadeado" },
                      { error: "useQuery(['key'])", cause: "Sintaxe TanStack Query v4 incompatível", fix: "Usar useQuery({ queryKey: ['key'] }) — sintaxe v5" },
                      { error: "JWT 401 após troca de senha", cause: "tokenVersion desatualizado no token local", fix: "Re-login obrigatório após mudança de senha" },
                      { error: "CORS 404 em /api/*", cause: "Proxy do Vite não configurado corretamente", fix: "Não modificar vite.config.ts — já está configurado" },
                    ].map((item, i) => (
                      <div key={i} className="border rounded-lg p-3 text-xs space-y-1 bg-muted/20" data-testid={`error-pattern-${i}`}>
                        <p className="font-mono text-red-600 dark:text-red-400 font-medium">{item.error}</p>
                        <p className="text-muted-foreground"><span className="font-medium">Causa:</span> {item.cause}</p>
                        <p className="text-foreground"><span className="font-medium text-green-600 dark:text-green-400">Fix:</span> {item.fix}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* === DOCS TÉCNICAS === */}
            <TabsContent value="docs" className="space-y-4">
              <TechDocsViewer />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

// =====================================================================
// Documentação Técnica do LAB — viewer + download de PDF
// =====================================================================

interface TechDoc {
  key: string;
  file: string;
  title: string;
  exists: boolean;
}

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map(c => c.trim());
}

function renderMarkdownInline(content: string): React.ReactElement[] {
  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let codeBlock: string[] | null = null;
  let listBuf: string[] = [];
  let tableBuf: string[] | null = null;

  const flushList = (key: number) => {
    if (listBuf.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="list-disc pl-6 space-y-1 text-sm my-2">
        {listBuf.map((li, i) => <li key={i}>{renderInline(li.replace(/^[-*]\s+/, ""))}</li>)}
      </ul>
    );
    listBuf = [];
  };

  const flushTable = (key: number) => {
    if (!tableBuf || tableBuf.length === 0) { tableBuf = null; return; }
    const rows = tableBuf;
    tableBuf = null;
    if (rows.length < 2) return;
    const header = splitRow(rows[0]);
    const sepIdx = rows[1] && /^\s*\|?\s*:?-{2,}/.test(rows[1]) ? 1 : -1;
    const bodyRows = rows.slice(sepIdx >= 0 ? 2 : 1).map(splitRow);
    elements.push(
      <div key={`tbl-${key}`} className="overflow-x-auto my-3 rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr>{header.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold border-b">{renderInline(h)}</th>)}</tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                {row.map((cell, ci) => <td key={ci} className="px-3 py-2 align-top">{renderInline(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const flushAll = (key: number) => { flushList(key); flushTable(key); };

  lines.forEach((raw, i) => {
    const line = raw;
    if (line.startsWith("```")) {
      if (codeBlock === null) {
        flushAll(i);
        codeBlock = [];
      } else {
        elements.push(
          <pre key={`code-${i}`} className="bg-muted text-xs p-3 rounded overflow-x-auto border my-2">
            <code>{codeBlock.join("\n")}</code>
          </pre>
        );
        codeBlock = null;
      }
      return;
    }
    if (codeBlock !== null) { codeBlock.push(line); return; }

    // Tabela: linha começa com | e contém pelo menos 1 outro |
    if (/^\s*\|.*\|/.test(line)) {
      flushList(i);
      if (tableBuf === null) tableBuf = [];
      tableBuf.push(line);
      return;
    }

    if (line.startsWith("# ")) {
      flushAll(i);
      elements.push(<h1 key={i} className="text-2xl font-bold mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      flushAll(i);
      elements.push(<h2 key={i} className="text-xl font-semibold mt-4 mb-2 border-b pb-1">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      flushAll(i);
      elements.push(<h3 key={i} className="text-lg font-semibold mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("> ")) {
      flushAll(i);
      elements.push(<blockquote key={i} className="border-l-4 border-primary pl-3 italic text-sm text-muted-foreground my-2">{renderInline(line.slice(2))}</blockquote>);
    } else if (/^---+\s*$/.test(line)) {
      flushAll(i);
      elements.push(<hr key={i} className="my-4 border-border" />);
    } else if (/^[-*]\s+/.test(line)) {
      flushTable(i);
      listBuf.push(line);
    } else if (line.trim() === "") {
      flushAll(i);
    } else {
      flushAll(i);
      elements.push(<p key={i} className="text-sm my-1 leading-relaxed">{renderInline(line)}</p>);
    }
  });
  flushAll(lines.length);
  return elements;
}

function TechDocsViewer() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("features");
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: docs = [], isLoading: loadingList } = useQuery<TechDoc[]>({
    queryKey: ["/api/documentation/tech"],
  });

  const { data: content, isLoading: loadingContent } = useQuery<string>({
    queryKey: ["/api/documentation/tech", selected],
    enabled: !!selected,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documentation/tech/${selected}`);
      return res.text();
    },
  });

  const handleDownloadPdf = async (key: string, title: string) => {
    try {
      setDownloading(key);
      const res = await apiRequest("GET", `/api/documentation/tech/${key}/pdf`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QuantaFlow_${key}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "PDF baixado!", description: title });
    } catch (e) {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const selectedMeta = docs.find(d => d.key === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Lista de documentos */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Documentos Técnicos</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Toda documentação do projeto. Visualize inline ou baixe como PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {loadingList ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : (
            docs.map(doc => (
              <div
                key={doc.key}
                className={`flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer text-sm transition-colors ${selected === doc.key ? "bg-muted border border-primary/40" : ""}`}
                onClick={() => setSelected(doc.key)}
                data-testid={`doc-item-${doc.key}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDownloadPdf(doc.key, doc.title); }}
                  disabled={!doc.exists || downloading === doc.key}
                  data-testid={`button-download-${doc.key}`}
                  title="Baixar PDF"
                >
                  {downloading === doc.key
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Viewer */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base truncate" data-testid="text-doc-title">
                {selectedMeta?.title ?? "Selecione um documento"}
              </CardTitle>
              {selectedMeta && (
                <CardDescription className="text-xs font-mono">{selectedMeta.file}</CardDescription>
              )}
            </div>
            {selectedMeta && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadPdf(selectedMeta.key, selectedMeta.title)}
                disabled={downloading === selectedMeta.key}
                data-testid="button-download-current"
              >
                {downloading === selectedMeta.key
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Download className="w-4 h-4 mr-2" />}
                Baixar PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <div className="p-6">
              {loadingContent ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Carregando conteúdo…
                </div>
              ) : content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="doc-content">
                  {renderMarkdownInline(content)}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum conteúdo carregado.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
