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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Bot, Plus, Pencil, Trash2, Loader2, Zap, Tag, MessageSquare, Brain, Database, Thermometer, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
};

export default function AutomationPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
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
    responseTemplate: form.responseTemplate,
    systemPrompt: form.systemPrompt || null,
    initialMessage: form.initialMessage || null,
    temperature: form.temperature,
    responseDelay: form.responseDelay,
    inactivityTimeout: form.inactivityTimeout,
    successCondition: form.successCondition || null,
    interruptCondition: form.interruptCondition || null,
    summaryEnabled: form.summaryEnabled,
    summaryFields: form.summaryFields || null,
  });

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
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editingFlow) {
      updateMutation.mutate({ id: editingFlow.id, data: buildPayload() });
    } else {
      createMutation.mutate();
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-flow">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Fluxo
                  </Button>
                </DialogTrigger>
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

                    <Accordion type="multiple" defaultValue={["secao1", "secao3"]} className="w-full">

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
                              placeholder="Você é um assistente de vendas simpático e objetivo. Responda em português. Não mencione preços sem antes entender a necessidade do cliente."
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
                            <Label htmlFor="flow-response">Contexto Geral (Base de Conhecimento)</Label>
                            <Textarea
                              id="flow-response"
                              value={form.responseTemplate}
                              onChange={(e) => setField("responseTemplate", e.target.value)}
                              placeholder="Ex: Cardápio: Pizza Margherita R$45, Pizza Calabresa R$50. Horário: Seg-Sex 11h-23h. Entrega: até 45min."
                              rows={6}
                              data-testid="input-flow-response"
                            />
                            <p className="text-xs text-muted-foreground">
                              Informações do negócio: cardápio, preços, FAQ, horários, políticas.
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
                              <Label htmlFor="response-delay">Atraso de Resposta (segundos)</Label>
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
                              <p className="text-xs text-muted-foreground">
                                Quando o assistente considera a conversa concluída com êxito.
                              </p>
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
                              <p className="text-xs text-muted-foreground">
                                Quando o assistente deve transferir para um atendente humano.
                              </p>
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
                                <p className="text-xs text-muted-foreground">
                                  Liste os dados que devem ser salvos no perfil do contato.
                                </p>
                              </div>
                            )}
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
                      disabled={!form.name.trim() || !form.triggerKeywords.trim() || !form.responseTemplate.trim() || isSaving}
                      data-testid="button-save-flow"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {editingFlow ? "Salvar" : "Criar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Palavras-chave
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {flow.triggerKeywords.split(",").map((kw, i) => (
                            <Badge key={i} variant="outline">{kw.trim()}</Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div>
                          <p className="mb-1 font-medium text-foreground">Base de Conhecimento</p>
                          <p className="line-clamp-2" data-testid={`text-flow-response-${flow.id}`}>
                            {flow.responseTemplate}
                          </p>
                        </div>
                        {flow.initialMessage && (
                          <div>
                            <p className="mb-1 font-medium text-foreground">Mensagem Inicial</p>
                            <p className="line-clamp-2">{flow.initialMessage}</p>
                          </div>
                        )}
                      </div>
                      {(flow.temperature !== null || flow.responseDelay !== null) && (
                        <>
                          <Separator />
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {flow.temperature !== null && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-3 w-3" />
                                Temp: {Number(flow.temperature).toFixed(1)}
                              </span>
                            )}
                            {flow.responseDelay !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Atraso: {flow.responseDelay}s
                              </span>
                            )}
                            {flow.inactivityTimeout !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Inatividade: {flow.inactivityTimeout}min
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
