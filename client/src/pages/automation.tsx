import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Bot, Plus, Pencil, Trash2, Loader2, Zap, Tag, MessageSquare, Brain, Database,
  Thermometer, Clock, CheckCircle, XCircle, FileText, ListOrdered, ChevronRight,
  Users, Wrench, ShoppingCart, GraduationCap, Sparkles, GitMerge, X as XIcon,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface FlowStep {
  order: number;
  message: string;
  delaySeconds: number;
}

interface ConditionalExit {
  condition: string;
  label: string;
  targetFlowId: string;
  triggerKeywords: string[];
}

interface AutomationFlow {
  id: string;
  userId: string;
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  isActive: boolean;
  systemPrompt: string | null;
  initialMessage: string | null;
  temperature: number | null;
  responseDelay: number | null;
  inactivityTimeout: number | null;
  successCondition: string | null;
  interruptCondition: string | null;
  summaryEnabled: boolean | null;
  summaryFields: string | null;
  steps: FlowStep[] | null;
  conditionalExits: ConditionalExit[] | null;
  createdAt: string;
  updatedAt: string;
}

interface FlowFormState {
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  systemPrompt: string;
  initialMessage: string;
  temperature: number;
  responseDelay: number;
  inactivityTimeout: number;
  successCondition: string;
  interruptCondition: string;
  summaryEnabled: boolean;
  summaryFields: string;
  steps: FlowStep[];
  conditionalExits: ConditionalExit[];
}

const defaultForm: FlowFormState = {
  name: "",
  triggerKeywords: "",
  responseTemplate: "",
  systemPrompt: "",
  initialMessage: "",
  temperature: 0.4,
  responseDelay: 10,
  inactivityTimeout: 10,
  successCondition: "",
  interruptCondition: "",
  summaryEnabled: false,
  summaryFields: "",
  steps: [],
  conditionalExits: [],
};

// ─── Templates de assistente ────────────────────────────────────────────────

interface AssistantTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  data: Partial<FlowFormState>;
}

const ASSISTANT_TEMPLATES: AssistantTemplate[] = [
  {
    id: "qualificador",
    name: "Qualificador",
    description: "Coleta nome, interesse, urgência e orçamento do lead antes de transferir.",
    icon: <Users className="h-6 w-6" />,
    color: "text-blue-500",
    data: {
      name: "Assistente Qualificador",
      initialMessage: "Olá! Seja bem-vindo. Para te atender melhor, pode me dizer seu nome e o que está buscando?",
      systemPrompt: "Você é um assistente de qualificação de leads. Seu objetivo é coletar: nome, interesse principal, urgência e orçamento disponível. Seja simpático e objetivo. Não ofereça soluções ainda.",
      temperature: 0.4,
      responseDelay: 10,
      inactivityTimeout: 10,
      successCondition: "Nome coletado, interesse identificado, urgência e orçamento definidos",
      interruptCondition: "Cliente pede atendimento humano ou demonstra frustração",
      summaryEnabled: true,
      summaryFields: "Nome, interesse, urgência, orçamento",
    },
  },
  {
    id: "resolutivo",
    name: "Resolutivo",
    description: "Resolve dúvidas e suporte de forma clara. Transfere em caso de problema complexo.",
    icon: <Wrench className="h-6 w-6" />,
    color: "text-green-500",
    data: {
      name: "Assistente Resolutivo",
      initialMessage: "Olá! Estou aqui para resolver sua dúvida. Como posso te ajudar?",
      systemPrompt: "Você é um assistente de suporte. Resolva dúvidas de forma clara e objetiva. Se não souber a resposta, diga que vai verificar e transfira para humano. Nunca invente informações.",
      temperature: 0.3,
      responseDelay: 8,
      inactivityTimeout: 15,
      successCondition: "Dúvida resolvida e cliente satisfeito",
      interruptCondition: "Problema técnico complexo, reclamação grave ou cliente insatisfeito",
      summaryEnabled: true,
      summaryFields: "Dúvida relatada, solução oferecida, satisfação",
    },
  },
  {
    id: "transacional",
    name: "Transacional",
    description: "Coleta pedido completo, endereço e pagamento. Confirma resumo antes de fechar.",
    icon: <ShoppingCart className="h-6 w-6" />,
    color: "text-orange-500",
    data: {
      name: "Assistente Transacional",
      initialMessage: "Olá! Pronto para te atender. O que você gostaria de pedir ou agendar hoje?",
      systemPrompt: "Você é um assistente de pedidos e agendamentos. Colete todas as informações necessárias para concluir a transação: itens, quantidades, endereço, forma de pagamento e confirmação do cliente. Sempre confirme o resumo antes de finalizar.",
      temperature: 0.4,
      responseDelay: 10,
      inactivityTimeout: 10,
      successCondition: "Pedido completo, endereço coletado, pagamento definido e cliente confirmou resumo",
      interruptCondition: "Cliente cancela, demonstra insatisfação ou sai do escopo do pedido",
      summaryEnabled: true,
      summaryFields: "Itens do pedido, endereço, forma de pagamento, observações",
    },
  },
  {
    id: "especialista",
    name: "Especialista",
    description: "Responde com profundidade técnica e exemplos práticos. Ideal para consultoria.",
    icon: <GraduationCap className="h-6 w-6" />,
    color: "text-purple-500",
    data: {
      name: "Assistente Especialista",
      initialMessage: "Olá! Sou especialista no assunto. Pode me fazer sua pergunta com o máximo de detalhes.",
      systemPrompt: "Você é um assistente especialista. Responda com profundidade e precisão técnica. Use linguagem adequada ao perfil do cliente. Cite exemplos práticos quando possível. Seja consultivo.",
      temperature: 0.5,
      responseDelay: 12,
      inactivityTimeout: 20,
      successCondition: "Consulta concluída e cliente com clareza sobre o tema",
      interruptCondition: "Questão fora do domínio de especialidade ou cliente solicita humano",
      summaryEnabled: true,
      summaryFields: "Tema consultado, dúvidas levantadas, encaminhamentos sugeridos",
    },
  },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AutomationPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [form, setForm] = useState<FlowFormState>(defaultForm);

  const { data: flows, isLoading } = useQuery<AutomationFlow[]>({
    queryKey: ["/api/automation-flows"],
  });

  function setField<K extends keyof FlowFormState>(key: K, value: FlowFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const buildPayload = () => ({
    name: form.name,
    triggerKeywords: form.triggerKeywords,
    responseTemplate: form.responseTemplate || " ",
    systemPrompt: form.systemPrompt || null,
    initialMessage: form.initialMessage || null,
    temperature: form.temperature,
    responseDelay: form.responseDelay,
    inactivityTimeout: form.inactivityTimeout,
    successCondition: form.successCondition || null,
    interruptCondition: form.interruptCondition || null,
    summaryEnabled: form.summaryEnabled,
    summaryFields: form.summaryFields || null,
    steps: form.steps.length > 0 ? form.steps : null,
    conditionalExits: form.conditionalExits.length > 0 ? form.conditionalExits : null,
  });

  function addExit() {
    setForm((prev) => ({
      ...prev,
      conditionalExits: [
        ...prev.conditionalExits,
        { condition: "", label: "", targetFlowId: "", triggerKeywords: [] },
      ],
    }));
  }

  function removeExit(idx: number) {
    setForm((prev) => ({
      ...prev,
      conditionalExits: prev.conditionalExits.filter((_, i) => i !== idx),
    }));
  }

  function updateExit(idx: number, key: keyof ConditionalExit, value: string | string[]) {
    setForm((prev) => ({
      ...prev,
      conditionalExits: prev.conditionalExits.map((e, i) =>
        i === idx ? { ...e, [key]: value } : e
      ),
    }));
  }

  function updateExitKeywordInput(idx: number, rawInput: string) {
    const keywords = rawInput.split(",").map((k) => k.trim()).filter(Boolean);
    updateExit(idx, "triggerKeywords", keywords);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/automation-flows", buildPayload());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Fluxo criado com sucesso" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar fluxo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/automation-flows/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Fluxo atualizado" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automation-flows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Fluxo excluído" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/automation-flows/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
    },
  });

  function resetForm() {
    setForm(defaultForm);
    setEditingFlow(null);
    setDialogOpen(false);
  }

  function openEdit(flow: AutomationFlow) {
    setEditingFlow(flow);
    setForm({
      name: flow.name,
      triggerKeywords: flow.triggerKeywords,
      responseTemplate: flow.responseTemplate,
      systemPrompt: flow.systemPrompt || "",
      initialMessage: flow.initialMessage || "",
      temperature: flow.temperature ?? 0.4,
      responseDelay: flow.responseDelay ?? 10,
      inactivityTimeout: flow.inactivityTimeout ?? 10,
      successCondition: flow.successCondition || "",
      interruptCondition: flow.interruptCondition || "",
      summaryEnabled: flow.summaryEnabled ?? false,
      summaryFields: flow.summaryFields || "",
      steps: flow.steps || [],
      conditionalExits: flow.conditionalExits || [],
    });
    setDialogOpen(true);
  }

  function openNew() {
    setEditingFlow(null);
    setForm(defaultForm);
    setTemplateModalOpen(true);
  }

  function applyTemplate(template: AssistantTemplate) {
    setForm({ ...defaultForm, ...template.data });
    setTemplateModalOpen(false);
    setDialogOpen(true);
  }

  function startFromScratch() {
    setForm(defaultForm);
    setTemplateModalOpen(false);
    setDialogOpen(true);
  }

  function handleSave() {
    if (editingFlow) {
      updateMutation.mutate({ id: editingFlow.id, data: buildPayload() });
    } else {
      createMutation.mutate();
    }
  }

  // ─── Steps helpers ─────────────────────────────────────────────────────────

  function addStep() {
    const nextOrder = form.steps.length > 0 ? Math.max(...form.steps.map((s) => s.order)) + 1 : 1;
    setField("steps", [...form.steps, { order: nextOrder, message: "", delaySeconds: 30 }]);
  }

  function removeStep(order: number) {
    const filtered = form.steps.filter((s) => s.order !== order);
    const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
    setField("steps", reordered);
  }

  function updateStep(order: number, key: keyof FlowStep, value: string | number) {
    setField(
      "steps",
      form.steps.map((s) => (s.order === order ? { ...s, [key]: value } : s))
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasSteps = form.steps.length > 0;
  const canSave = !!(
    form.name.trim() &&
    form.triggerKeywords.trim() &&
    (hasSteps || form.responseTemplate.trim())
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Bot className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Automação</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openNew} data-testid="button-add-flow">
                <Plus className="h-4 w-4 mr-2" />
                Novo Fluxo
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : !flows?.length ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Bot className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="font-medium text-lg mb-1">Nenhum fluxo de automação</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Crie fluxos para responder automaticamente mensagens com palavras-chave específicas
                    </p>
                    <Button onClick={openNew} data-testid="button-add-flow-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar primeiro fluxo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                flows.map((flow) => (
                  <Card key={flow.id} data-testid={`card-flow-${flow.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          <Zap className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="truncate" data-testid={`text-flow-name-${flow.id}`}>{flow.name}</span>
                          <Badge variant={flow.isActive ? "default" : "secondary"} data-testid={`badge-flow-status-${flow.id}`}>
                            {flow.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                          {flow.summaryEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-2.5 w-2.5 mr-1" />
                              Resumo
                            </Badge>
                          )}
                          {flow.steps && flow.steps.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <ListOrdered className="h-2.5 w-2.5 mr-1" />
                              {flow.steps.length} etapas
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Switch
                          checked={flow.isActive}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: flow.id, isActive: checked })}
                          data-testid={`switch-flow-${flow.id}`}
                        />
                        <Button size="icon" variant="ghost" onClick={() => openEdit(flow)} data-testid={`button-edit-flow-${flow.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(flow.id)} data-testid={`button-delete-flow-${flow.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground truncate">{flow.triggerKeywords}</span>
                      </div>
                      {flow.steps && flow.steps.length > 0 ? (
                        <div className="flex items-start gap-2 text-sm">
                          <ListOrdered className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {flow.steps.map((s) => `Etapa ${s.order}: ${s.delaySeconds}s`).join(" → ")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground line-clamp-2">{flow.responseTemplate}</span>
                        </div>
                      )}
                      {flow.responseDelay != null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Delay: {flow.responseDelay}s · Inatividade: {flow.inactivityTimeout}min</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </main>
        </SidebarInset>
      </div>

      {/* ─── Modal de seleção de template ─────────────────────────────────────── */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Escolha um ponto de partida
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Selecione um template pré-configurado ou comece do zero. Você poderá editar tudo depois.
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            {ASSISTANT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                data-testid={`button-template-${tpl.id}`}
              >
                <div className={`${tpl.color}`}>{tpl.icon}</div>
                <div>
                  <p className="font-semibold text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium mt-auto">
                  Usar template <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
          <div className="pt-1">
            <Button variant="outline" className="w-full" onClick={startFromScratch} data-testid="button-scratch">
              Começar do zero
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal de criação/edição do fluxo ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFlow ? "Editar Fluxo" : "Novo Fluxo de Automação"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flow-name">Nome do Fluxo</Label>
                <Input
                  id="flow-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex: Resposta automática - Compra"
                  data-testid="input-flow-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-keywords">Palavras-chave (separadas por vírgula)</Label>
                <Input
                  id="flow-keywords"
                  value={form.triggerKeywords}
                  onChange={(e) => setField("triggerKeywords", e.target.value)}
                  placeholder="Ex: quero comprar, quanto custa, preço"
                  data-testid="input-flow-keywords"
                />
                <p className="text-xs text-muted-foreground">
                  Quando uma mensagem contiver uma dessas palavras, o fluxo será ativado.
                </p>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["secao1", "secao3", "secao8"]} className="w-full">

              {/* SEÇÃO 1 — Mensagem Inicial */}
              <AccordionItem value="secao1">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Seção 1 — Mensagem Inicial
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="initial-message">Mensagem Inicial</Label>
                    <Textarea
                      id="initial-message"
                      value={form.initialMessage}
                      onChange={(e) => setField("initialMessage", e.target.value)}
                      placeholder="Olá! Como posso te ajudar hoje?"
                      rows={3}
                      data-testid="input-initial-message"
                    />
                    <p className="text-xs text-muted-foreground">
                      Primeira mensagem enviada ao contato quando o fluxo é ativado.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 2 — Instruções do Assistente */}
              <AccordionItem value="secao2">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Seção 2 — Instruções do Assistente
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="system-prompt">Instruções do Assistente</Label>
                    <Textarea
                      id="system-prompt"
                      value={form.systemPrompt}
                      onChange={(e) => setField("systemPrompt", e.target.value)}
                      placeholder="Você é um assistente de vendas simpático e objetivo. Responda em português..."
                      rows={6}
                      data-testid="input-system-prompt"
                    />
                    <p className="text-xs text-muted-foreground">
                      Define o comportamento, tom e regras do assistente. NÃO inclua dados do negócio aqui.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 3 — Contexto Geral */}
              <AccordionItem value="secao3">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Seção 3 — Contexto Geral (Base de Conhecimento)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="flow-response">
                      Contexto Geral
                      {hasSteps && <span className="text-xs text-muted-foreground ml-2">(ignorado quando há etapas)</span>}
                    </Label>
                    <Textarea
                      id="flow-response"
                      value={form.responseTemplate}
                      onChange={(e) => setField("responseTemplate", e.target.value)}
                      placeholder="Ex: Cardápio: Pizza Margherita R$45. Horário: Seg-Sex 11h-23h."
                      rows={6}
                      disabled={hasSteps}
                      data-testid="input-flow-response"
                    />
                    <p className="text-xs text-muted-foreground">
                      {hasSteps
                        ? "Desabilitado — o fluxo usa a sequência de etapas abaixo."
                        : "Informações do negócio: cardápio, preços, FAQ, horários, políticas."}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 4 — Modelo e Criatividade */}
              <AccordionItem value="secao4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-primary" />
                    Seção 4 — Modelo e Criatividade
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <Label>
                      Criatividade (Temperatura): <span className="font-bold text-primary">{form.temperature.toFixed(1)}</span>
                    </Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={[form.temperature]}
                      onValueChange={([v]) => setField("temperature", v)}
                      data-testid="slider-temperature"
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.0 — Robótico</span>
                      <span>0.4 — Ideal para vendas</span>
                      <span>1.0 — Criativo demais</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 5 — Tempo de Resposta e Inatividade */}
              <AccordionItem value="secao5">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Seção 5 — Tempo de Resposta e Inatividade
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="response-delay">
                        Atraso de Resposta (segundos)
                        {hasSteps && <span className="text-xs text-muted-foreground ml-1">(base)</span>}
                      </Label>
                      <Input
                        id="response-delay"
                        type="number"
                        min={0}
                        value={form.responseDelay}
                        onChange={(e) => setField("responseDelay", parseInt(e.target.value) || 0)}
                        data-testid="input-response-delay"
                      />
                      <p className="text-xs text-muted-foreground">
                        Aguarda antes de responder para parecer mais natural.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inactivity-timeout">Tempo de Inatividade (minutos)</Label>
                      <Input
                        id="inactivity-timeout"
                        type="number"
                        min={0}
                        value={form.inactivityTimeout}
                        onChange={(e) => setField("inactivityTimeout", parseInt(e.target.value) || 0)}
                        data-testid="input-inactivity-timeout"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minutos sem resposta para encerrar ou reengajar o contato.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 6 — Saídas e Condições */}
              <AccordionItem value="secao6">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Seção 6 — Saídas e Condições
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="success-condition">Condição de Sucesso</Label>
                      <Textarea
                        id="success-condition"
                        value={form.successCondition}
                        onChange={(e) => setField("successCondition", e.target.value)}
                        placeholder="Pedido completo, endereço coletado e pagamento definido"
                        rows={3}
                        data-testid="input-success-condition"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interrupt-condition">
                        <XCircle className="h-3 w-3 inline mr-1" />
                        Condição de Interrupção
                      </Label>
                      <Textarea
                        id="interrupt-condition"
                        value={form.interruptCondition}
                        onChange={(e) => setField("interruptCondition", e.target.value)}
                        placeholder="Cliente pede atendimento humano ou demonstra insatisfação"
                        rows={3}
                        data-testid="input-interrupt-condition"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 7 — Resumo e Salvamento */}
              <AccordionItem value="secao7">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Seção 7 — Resumo e Salvamento
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="summary-enabled">Ativar Resumo Automático</Label>
                        <p className="text-xs text-muted-foreground">
                          Salva automaticamente os dados coletados ao fim da conversa.
                        </p>
                      </div>
                      <Switch
                        id="summary-enabled"
                        checked={form.summaryEnabled}
                        onCheckedChange={(v) => setField("summaryEnabled", v)}
                        data-testid="switch-summary-enabled"
                      />
                    </div>
                    {form.summaryEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="summary-fields">Campos a Salvar</Label>
                        <Textarea
                          id="summary-fields"
                          value={form.summaryFields}
                          onChange={(e) => setField("summaryFields", e.target.value)}
                          placeholder="Nome do cliente, pedido completo, endereço, forma de pagamento"
                          rows={3}
                          data-testid="input-summary-fields"
                        />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 8 — Sequência de Mensagens */}
              <AccordionItem value="secao8">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-primary" />
                    Seção 8 — Sequência de Mensagens
                    {hasSteps && (
                      <Badge className="ml-2 text-xs" variant="secondary">{form.steps.length} etapa{form.steps.length > 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Configure uma sequência de mensagens com delays diferentes. Quando ativo, substitui o campo "Contexto Geral".
                    </p>
                    {form.steps.map((step) => (
                      <div key={step.order} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Etapa {step.order}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStep(step.order)}
                            data-testid={`button-remove-step-${step.order}`}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Mensagem</Label>
                          <Textarea
                            value={step.message}
                            onChange={(e) => updateStep(step.order, "message", e.target.value)}
                            placeholder="Texto da mensagem..."
                            rows={3}
                            data-testid={`input-step-message-${step.order}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Delay (segundos após ativação)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={step.delaySeconds}
                            onChange={(e) => updateStep(step.order, "delaySeconds", parseInt(e.target.value) || 0)}
                            data-testid={`input-step-delay-${step.order}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            {step.delaySeconds === 0 ? "Envio imediato" : `Enviar ${step.delaySeconds}s após o trigger`}
                          </p>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addStep}
                      className="w-full"
                      data-testid="button-add-step"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Etapa
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEÇÃO 9 — Saídas Condicionais */}
              <AccordionItem value="secao9">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-primary" />
                    Seção 9 — Saídas Condicionais
                    {form.conditionalExits.length > 0 && (
                      <Badge className="ml-2 text-xs" variant="secondary">
                        {form.conditionalExits.length} saída{form.conditionalExits.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Configure transições para outros assistentes baseadas em keywords. Quando uma keyword é detectada, o contato é transferido para o fluxo de destino.
                    </p>
                    {form.conditionalExits.map((exit, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Saída {idx + 1}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeExit(idx)}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            data-testid={`button-remove-exit-${idx}`}
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Rótulo da saída</Label>
                          <Input
                            value={exit.label}
                            onChange={(e) => updateExit(idx, "label", e.target.value)}
                            placeholder="Ex: Suporte Técnico, Financeiro..."
                            data-testid={`input-exit-label-${idx}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Fluxo de destino</Label>
                          <Select
                            value={exit.targetFlowId}
                            onValueChange={(val) => updateExit(idx, "targetFlowId", val)}
                          >
                            <SelectTrigger data-testid={`select-exit-flow-${idx}`}>
                              <SelectValue placeholder="Selecionar fluxo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(flows || []).filter(f => f.id !== editingFlow?.id).map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Keywords de gatilho (separadas por vírgula)</Label>
                          <Input
                            value={exit.triggerKeywords.join(", ")}
                            onChange={(e) => updateExitKeywordInput(idx, e.target.value)}
                            placeholder="Ex: suporte, ajuda, problema"
                            data-testid={`input-exit-keywords-${idx}`}
                          />
                          {exit.triggerKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {exit.triggerKeywords.map((kw, ki) => (
                                <Badge key={ki} variant="secondary" className="text-[10px]">{kw}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addExit}
                      className="w-full"
                      data-testid="button-add-exit"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Saída Condicional
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-flow">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              data-testid="button-save-flow"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingFlow ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
