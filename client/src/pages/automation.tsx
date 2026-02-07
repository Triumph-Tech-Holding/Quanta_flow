import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Bot, Plus, Pencil, Trash2, Loader2, Zap, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AutomationFlow {
  id: string;
  userId: string;
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AutomationPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [name, setName] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [responseTemplate, setResponseTemplate] = useState("");

  const { data: flows, isLoading } = useQuery<AutomationFlow[]>({
    queryKey: ["/api/automation-flows"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/automation-flows", {
        name,
        triggerKeywords,
        responseTemplate,
      });
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
    setName("");
    setTriggerKeywords("");
    setResponseTemplate("");
    setEditingFlow(null);
    setDialogOpen(false);
  }

  function openEdit(flow: AutomationFlow) {
    setEditingFlow(flow);
    setName(flow.name);
    setTriggerKeywords(flow.triggerKeywords);
    setResponseTemplate(flow.responseTemplate);
    setDialogOpen(true);
  }

  function handleSave() {
    if (editingFlow) {
      updateMutation.mutate({
        id: editingFlow.id,
        data: { name, triggerKeywords, responseTemplate },
      });
    } else {
      createMutation.mutate();
    }
  }

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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingFlow ? "Editar Fluxo" : "Novo Fluxo de Automação"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="flow-name">Nome do Fluxo</Label>
                      <Input
                        id="flow-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Resposta automática - Compra"
                        data-testid="input-flow-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flow-keywords">Palavras-chave (separadas por vírgula)</Label>
                      <Input
                        id="flow-keywords"
                        value={triggerKeywords}
                        onChange={(e) => setTriggerKeywords(e.target.value)}
                        placeholder="Ex: quero comprar, quanto custa, preço"
                        data-testid="input-flow-keywords"
                      />
                      <p className="text-xs text-muted-foreground">
                        Quando uma mensagem recebida contiver uma dessas palavras, a resposta será enviada automaticamente.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flow-response">Template de Resposta</Label>
                      <Textarea
                        id="flow-response"
                        value={responseTemplate}
                        onChange={(e) => setResponseTemplate(e.target.value)}
                        placeholder="Ex: Olá! Obrigado pelo interesse. Vou te passar todas as informações..."
                        rows={4}
                        data-testid="input-flow-response"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetForm} data-testid="button-cancel-flow">
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={!name.trim() || !triggerKeywords.trim() || !responseTemplate.trim() || createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-flow"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
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
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Resposta automática</p>
                        <p className="text-sm whitespace-pre-wrap line-clamp-3" data-testid={`text-flow-response-${flow.id}`}>
                          {flow.responseTemplate}
                        </p>
                      </div>
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
