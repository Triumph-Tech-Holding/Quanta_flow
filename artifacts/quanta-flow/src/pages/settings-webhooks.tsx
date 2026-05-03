import { useState } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Plus, Trash2, Pencil, Loader2, Play, CheckCircle2, XCircle, Globe } from "lucide-react";

const SUPPORTED_EVENTS = [
  { id: "lead.created", label: "Lead criado" },
  { id: "lead.qualified", label: "Lead qualificado" },
  { id: "flow.success", label: "Fluxo: condição de sucesso" },
  { id: "flow.interrupt", label: "Fluxo: condição de interrupção" },
  { id: "conversation.closed", label: "Conversa encerrada" },
];

interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string | null;
  lastStatus: string | null;
  lastTriggeredAt: string | null;
}

interface WebhookForm {
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
}

const defaultForm: WebhookForm = { name: "", url: "", events: [], secret: "", isActive: true };

export default function SettingsWebhooksPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>(defaultForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery<OutboundWebhook[]>({
    queryKey: ["/api/webhooks/outbound"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/webhooks/outbound", { ...form, secret: form.secret || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/outbound"] });
      toast({ title: "Webhook criado!" });
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Erro ao criar webhook", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/webhooks/outbound/${editingId}`, { ...form, secret: form.secret || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/outbound"] });
      toast({ title: "Webhook atualizado!" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Erro ao atualizar webhook", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/webhooks/outbound/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/outbound"] });
      toast({ title: "Webhook removido" });
    },
    onError: () => toast({ title: "Erro ao remover webhook", variant: "destructive" }),
  });

  async function testWebhook(id: string) {
    setTestingId(id);
    try {
      const res = await apiRequest("POST", `/api/webhooks/outbound/${id}/test`, {});
      const data = await res.json() as { ok: boolean; status?: number; message?: string };
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/outbound"] });
      if (data.ok) {
        toast({ title: "Webhook testado com sucesso!", description: `Status: ${data.status}` });
      } else {
        toast({ title: "Falha no teste", description: data.message || `Status: ${data.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao testar webhook", variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  function openNew() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(wh: OutboundWebhook) {
    setEditingId(wh.id);
    setForm({ name: wh.name, url: wh.url, events: wh.events || [], secret: "", isActive: wh.isActive });
    setDialogOpen(true);
  }

  function toggleEvent(eventId: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  }

  function statusBadge(status: string | null) {
    if (!status) return null;
    if (status === "success") return <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Webhook className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Webhooks de Saída</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={openNew} data-testid="button-new-webhook">
                <Plus className="h-4 w-4 mr-2" />
                Novo Webhook
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Webhooks configurados</CardTitle>
                  <CardDescription>
                    Notifique sistemas externos automaticamente quando eventos acontecem no Quanta Flow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : webhooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <Globe className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Nenhum webhook configurado ainda.</p>
                      <Button variant="outline" size="sm" onClick={openNew}>Criar primeiro webhook</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {webhooks.map((wh) => (
                        <div key={wh.id} className="border rounded-lg p-4" data-testid={`card-webhook-${wh.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm">{wh.name}</span>
                                {wh.isActive ? (
                                  <Badge variant="secondary" className="text-[10px]">Ativo</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                                )}
                                {statusBadge(wh.lastStatus)}
                              </div>
                              <p className="text-xs text-muted-foreground break-all">{wh.url}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(wh.events || []).map((ev) => (
                                  <Badge key={ev} variant="outline" className="text-[10px]">{ev}</Badge>
                                ))}
                              </div>
                              {wh.lastTriggeredAt && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Último disparo: {new Date(wh.lastTriggeredAt).toLocaleString("pt-BR")}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                                onClick={() => testWebhook(wh.id)} disabled={testingId === wh.id}
                                data-testid={`button-test-webhook-${wh.id}`}>
                                {testingId === wh.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                                onClick={() => openEdit(wh)} data-testid={`button-edit-webhook-${wh.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(wh.id)} disabled={deleteMutation.isPending}
                                data-testid={`button-delete-webhook-${wh.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Webhook" : "Novo Webhook de Saída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Zapier Lead Criado" data-testid="input-webhook-name" />
            </div>
            <div className="space-y-1.5">
              <Label>URL de destino</Label>
              <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://hooks.zapier.com/..." data-testid="input-webhook-url" />
            </div>
            <div className="space-y-2">
              <Label>Eventos que disparam</Label>
              <div className="space-y-2">
                {SUPPORTED_EVENTS.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <Checkbox id={ev.id} checked={form.events.includes(ev.id)} onCheckedChange={() => toggleEvent(ev.id)}
                      data-testid={`checkbox-event-${ev.id}`} />
                    <label htmlFor={ev.id} className="text-sm cursor-pointer">{ev.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Secret HMAC (opcional)</Label>
              <Input value={form.secret} onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                type="password" placeholder="Chave secreta para validação HMAC-SHA256" data-testid="input-webhook-secret" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                data-testid="switch-webhook-active" />
              <Label>Webhook ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setForm(defaultForm); }}>Cancelar</Button>
            <Button
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!form.name.trim() || !form.url.trim() || form.events.length === 0 || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-webhook"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
