import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Plus, Pencil, Trash2, MessageSquare, Volume2, Bot, Send, Loader2,
  Sparkles, Copy, ToggleLeft, ToggleRight,
} from "lucide-react";
import type { AiAgent } from "@shared/schema";

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "amigavel", label: "Amigável" },
  { value: "direto", label: "Direto" },
  { value: "consultivo", label: "Consultivo" },
  { value: "empatico", label: "Empático" },
];

const SPECIALTY_OPTIONS = [
  { value: "vendas", label: "Vendas" },
  { value: "suporte", label: "Suporte" },
  { value: "sac", label: "SAC" },
  { value: "cobranca", label: "Cobrança" },
  { value: "onboarding", label: "Onboarding" },
  { value: "generico", label: "Genérico" },
];

const VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
];

const MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Rápido)" },
  { value: "gpt-4o", label: "GPT-4o (Avançado)" },
];

const DEFAULT_PROMPTS: Record<string, string> = {
  vendas: `Você é um assistente de vendas especialista. Seu objetivo é qualificar leads, responder dúvidas sobre produtos/serviços e guiar o cliente para a compra. Seja persuasivo mas não insistente. Use técnicas de venda consultiva.`,
  suporte: `Você é um assistente de suporte técnico. Ajude os clientes a resolver problemas técnicos de forma clara e objetiva. Peça informações relevantes para diagnosticar o problema e forneça soluções passo a passo.`,
  sac: `Você é um assistente de atendimento ao cliente. Resolva reclamações, forneça informações sobre pedidos e políticas, e garanta a satisfação do cliente. Seja empático e proativo na resolução.`,
  cobranca: `Você é um assistente de cobrança. Comunique-se de forma profissional e respeitosa sobre pendências financeiras. Ofereça opções de pagamento e negociação. Siga as regulamentações do CDC.`,
  onboarding: `Você é um assistente de onboarding. Guie novos clientes pelo processo de configuração e primeiros passos. Seja paciente, explique cada etapa e garanta que o cliente se sinta acolhido.`,
  generico: `Você é um assistente virtual inteligente. Responda perguntas, forneça informações e ajude os clientes da melhor forma possível. Seja educado, objetivo e útil.`,
};

const TOOL_OPTIONS = [
  { value: "intent_detection", label: "Detecção de Intenção" },
  { value: "lead_scoring", label: "Lead Scoring" },
  { value: "product_search", label: "Busca de Produtos" },
  { value: "faq_search", label: "Busca FAQ" },
  { value: "appointment_booking", label: "Agendamento" },
  { value: "order_status", label: "Status de Pedido" },
];

interface AgentFormData {
  name: string;
  description: string;
  model: string;
  temperature: number;
  tone: string;
  language: string;
  specialty: string;
  systemPrompt: string;
  ttsVoice: string;
  maxTokens: number;
  isActive: boolean;
  avatarUrl: string;
  tools: string[];
  escalationKeywords: string;
  escalationMessage: string;
}

const defaultForm: AgentFormData = {
  name: "",
  description: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
  tone: "amigavel",
  language: "pt-BR",
  specialty: "generico",
  systemPrompt: DEFAULT_PROMPTS.generico,
  ttsVoice: "nova",
  maxTokens: 500,
  isActive: true,
  avatarUrl: "",
  tools: [],
  escalationKeywords: "",
  escalationMessage: "",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AdminAgents() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [chatAgent, setChatAgent] = useState<AiAgent | null>(null);
  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: agents = [], isLoading } = useQuery<AiAgent[]>({
    queryKey: ["/api/admin/agents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: AgentFormData) => apiRequest("POST", "/api/admin/agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      toast({ title: "Agente criado com sucesso" });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Erro ao criar agente", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentFormData }) => apiRequest("PUT", `/api/admin/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      toast({ title: "Agente atualizado" });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Erro ao atualizar agente", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      toast({ title: "Agente removido" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Erro ao remover agente", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PUT", `/api/admin/agents/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
    },
  });

  function resetForm() {
    setForm(defaultForm);
    setEditingAgent(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(agent: AiAgent) {
    setEditingAgent(agent);
    const esc = agent.escalationRules as { keywords: string[]; message: string } | null;
    setForm({
      name: agent.name,
      description: agent.description || "",
      model: agent.model,
      temperature: agent.temperature,
      tone: agent.tone,
      language: agent.language,
      specialty: agent.specialty,
      systemPrompt: agent.systemPrompt,
      ttsVoice: agent.ttsVoice || "nova",
      maxTokens: agent.maxTokens || 500,
      isActive: agent.isActive,
      avatarUrl: agent.avatarUrl || "",
      tools: (agent.tools as string[]) || [],
      escalationKeywords: esc?.keywords?.join(", ") || "",
      escalationMessage: esc?.message || "",
    });
    setDialogOpen(true);
  }

  function openChat(agent: AiAgent) {
    setChatAgent(agent);
    setChatMessages([]);
    setChatInput("");
    setChatDialogOpen(true);
  }

  function buildPayload(f: AgentFormData) {
    const payload: Record<string, unknown> = { ...f };
    delete payload.escalationKeywords;
    delete payload.escalationMessage;
    if (f.escalationKeywords.trim()) {
      payload.escalationRules = {
        keywords: f.escalationKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        message: f.escalationMessage || "Transferindo para atendente humano...",
      };
    } else {
      payload.escalationRules = null;
    }
    return payload;
  }

  function handleSubmit() {
    if (!form.name || !form.systemPrompt) {
      toast({ title: "Preencha nome e prompt do sistema", variant: "destructive" });
      return;
    }
    const payload = buildPayload(form);
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data: payload as any });
    } else {
      createMutation.mutate(payload as any);
    }
  }

  async function sendChat() {
    if (!chatAgent || !chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsSending(true);

    try {
      const res = await apiRequest("POST", `/api/admin/agents/${chatAgent.id}/chat`, {
        message: userMsg.content,
        history: [...chatMessages, userMsg],
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleSpecialtyChange(val: string) {
    setForm((f) => ({
      ...f,
      specialty: val,
      systemPrompt: DEFAULT_PROMPTS[val] || f.systemPrompt,
    }));
  }

  function duplicateAgent(agent: AiAgent) {
    setEditingAgent(null);
    const esc = agent.escalationRules as { keywords: string[]; message: string } | null;
    setForm({
      name: `${agent.name} (Cópia)`,
      description: agent.description || "",
      model: agent.model,
      temperature: agent.temperature,
      tone: agent.tone,
      language: agent.language,
      specialty: agent.specialty,
      systemPrompt: agent.systemPrompt,
      ttsVoice: agent.ttsVoice || "nova",
      maxTokens: agent.maxTokens || 500,
      isActive: false,
      avatarUrl: "",
      tools: (agent.tools as string[]) || [],
      escalationKeywords: esc?.keywords?.join(", ") || "",
      escalationMessage: esc?.message || "",
    });
    setDialogOpen(true);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Fábrica de Agentes IA</h1>
          </div>
          <div className="ml-auto">
            <Button onClick={openCreate} data-testid="button-create-agent">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agente
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card className="max-w-lg mx-auto mt-12">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum agente criado</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Crie seu primeiro agente IA expert para automatizar atendimentos com inteligência artificial.
                </p>
                <Button onClick={openCreate} data-testid="button-create-first-agent">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar Primeiro Agente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.id} className={`relative transition-opacity ${!agent.isActive ? "opacity-60" : ""}`} data-testid={`card-agent-${agent.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        {agent.avatarUrl ? (
                          <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate" data-testid={`text-agent-name-${agent.id}`}>
                          {agent.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-1 text-xs">
                          {agent.description || "Sem descrição"}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={agent.isActive}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: agent.id, isActive: checked })}
                        data-testid={`switch-active-${agent.id}`}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant="secondary" className="text-[11px]" data-testid={`badge-specialty-${agent.id}`}>
                        {SPECIALTY_OPTIONS.find((s) => s.value === agent.specialty)?.label || agent.specialty}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {TONE_OPTIONS.find((t) => t.value === agent.tone)?.label || agent.tone}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {agent.model}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        T: {agent.temperature}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openChat(agent)} data-testid={`button-chat-${agent.id}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(agent)} data-testid={`button-edit-${agent.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicateAgent(agent)} data-testid={`button-duplicate-${agent.id}`}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(agent.id)}
                        data-testid={`button-delete-${agent.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingAgent ? "Editar Agente" : "Novo Agente IA"}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="personality">Personalidade</TabsTrigger>
                <TabsTrigger value="advanced">Avançado</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 pr-4">
                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Agente *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Vendedor Expert"
                      data-testid="input-agent-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Breve descrição do agente"
                      data-testid="input-agent-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Especialidade</Label>
                      <Select value={form.specialty} onValueChange={handleSpecialtyChange}>
                        <SelectTrigger data-testid="select-specialty">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALTY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={form.model} onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}>
                        <SelectTrigger data-testid="select-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                      data-testid="switch-agent-active"
                    />
                    <Label>Agente ativo</Label>
                  </div>
                </TabsContent>

                <TabsContent value="personality" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tom de Voz</Label>
                      <Select value={form.tone} onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}>
                        <SelectTrigger data-testid="select-tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TONE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                        <SelectTrigger data-testid="select-language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Português (BR)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Voz TTS</Label>
                    <Select value={form.ttsVoice} onValueChange={(v) => setForm((f) => ({ ...f, ttsVoice: v }))}>
                      <SelectTrigger data-testid="select-tts-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Temperatura: {form.temperature.toFixed(1)}</Label>
                      <span className="text-xs text-muted-foreground">
                        {form.temperature <= 0.3 ? "Preciso" : form.temperature <= 0.7 ? "Balanceado" : "Criativo"}
                      </span>
                    </div>
                    <Slider
                      value={[form.temperature]}
                      onValueChange={([v]) => setForm((f) => ({ ...f, temperature: v }))}
                      min={0}
                      max={1}
                      step={0.1}
                      data-testid="slider-temperature"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">Prompt do Sistema *</Label>
                    <Textarea
                      id="systemPrompt"
                      value={form.systemPrompt}
                      onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                      rows={8}
                      placeholder="Instruções detalhadas para o agente..."
                      className="font-mono text-sm"
                      data-testid="textarea-system-prompt"
                    />
                    <p className="text-xs text-muted-foreground">{form.systemPrompt.length} caracteres</p>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Tokens: {form.maxTokens}</Label>
                    </div>
                    <Slider
                      value={[form.maxTokens]}
                      onValueChange={([v]) => setForm((f) => ({ ...f, maxTokens: v }))}
                      min={50}
                      max={4000}
                      step={50}
                      data-testid="slider-max-tokens"
                    />
                    <p className="text-xs text-muted-foreground">Limite de tokens na resposta do agente</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Ferramentas Habilitadas</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TOOL_OPTIONS.map((tool) => (
                        <label key={tool.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.tools.includes(tool.value)}
                            onChange={(e) => {
                              setForm((f) => ({
                                ...f,
                                tools: e.target.checked
                                  ? [...f.tools, tool.value]
                                  : f.tools.filter((t) => t !== tool.value),
                              }));
                            }}
                            className="rounded border-input"
                            data-testid={`checkbox-tool-${tool.value}`}
                          />
                          {tool.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Regras de Escalação</Label>
                    <Input
                      value={form.escalationKeywords}
                      onChange={(e) => setForm((f) => ({ ...f, escalationKeywords: e.target.value }))}
                      placeholder="humano, atendente, gerente (separados por vírgula)"
                      data-testid="input-escalation-keywords"
                    />
                    <Input
                      value={form.escalationMessage}
                      onChange={(e) => setForm((f) => ({ ...f, escalationMessage: e.target.value }))}
                      placeholder="Mensagem ao escalar (ex: Transferindo para atendente...)"
                      data-testid="input-escalation-message"
                    />
                    <p className="text-xs text-muted-foreground">
                      Quando o cliente mencionar essas palavras, o agente será interrompido e um humano será acionado.
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Avatar do Agente</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.avatarUrl}
                        onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                        placeholder="https://..."
                        className="flex-1"
                        data-testid="input-avatar-url"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            toast({ title: "Gerando avatar..." });
                            const res = await apiRequest("POST", "/api/admin/agents/generate-avatar", {
                              name: form.name,
                              specialty: form.specialty,
                              tone: form.tone,
                            });
                            const data = await res.json();
                            if (data.url) {
                              setForm((f) => ({ ...f, avatarUrl: data.url }));
                              toast({ title: "Avatar gerado com sucesso!" });
                            }
                          } catch {
                            toast({ title: "Erro ao gerar avatar", variant: "destructive" });
                          }
                        }}
                        disabled={!form.name}
                        data-testid="button-generate-avatar"
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        Gerar Avatar
                      </Button>
                    </div>
                    {form.avatarUrl && (
                      <div className="flex justify-center mt-2">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={form.avatarUrl} alt="Preview" />
                          <AvatarFallback><Bot className="h-8 w-8" /></AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-agent">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAgent ? "Salvar" : "Criar Agente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Chat com {chatAgent?.name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 border rounded-lg p-3 min-h-[300px]">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Bot className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Envie uma mensagem para testar o agente</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex mb-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                    data-testid={`chat-message-${i}`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start mb-3">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </ScrollArea>
            <div className="flex gap-2 mt-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Digite sua mensagem..."
                disabled={isSending}
                data-testid="input-chat-message"
              />
              <Button onClick={sendChat} disabled={isSending || !chatInput.trim()} data-testid="button-send-chat">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja remover este agente? Esta ação não pode ser desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}