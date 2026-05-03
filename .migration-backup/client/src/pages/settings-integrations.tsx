import { useState } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Table2, Plus, Trash2, Pencil, Loader2, CheckCircle2, Link2 } from "lucide-react";

const TRIGGER_EVENTS = [
  { id: "lead.created", label: "Lead criado" },
  { id: "lead.qualified", label: "Lead qualificado" },
  { id: "flow.success", label: "Fluxo: sucesso" },
];

const FIELD_OPTIONS = [
  { id: "name", label: "Nome" },
  { id: "phone", label: "Telefone" },
  { id: "email", label: "E-mail" },
  { id: "stage", label: "Estágio pipeline" },
  { id: "score", label: "Score" },
  { id: "temperature", label: "Temperatura" },
  { id: "intent", label: "Intenção" },
];

interface SheetIntegration {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetName: string;
  triggerEvent: string;
  columnMapping: Record<string, string>;
  isActive: boolean;
  googleToken: string | null;
}

interface SheetForm {
  name: string;
  spreadsheetId: string;
  sheetName: string;
  triggerEvent: string;
  columnMapping: Record<string, string>;
}

const defaultForm: SheetForm = {
  name: "",
  spreadsheetId: "",
  sheetName: "Leads",
  triggerEvent: "lead.created",
  columnMapping: {},
};

export default function SettingsIntegrationsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SheetForm>(defaultForm);

  const { data: integrations = [], isLoading } = useQuery<SheetIntegration[]>({
    queryKey: ["/api/integrations/sheets"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/sheets", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/sheets"] });
      toast({ title: "Integração criada!" });
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Erro ao criar integração", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/integrations/sheets/${editingId}`, form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/sheets"] });
      toast({ title: "Integração atualizada!" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: () => toast({ title: "Erro ao atualizar integração", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/integrations/sheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/sheets"] });
      toast({ title: "Integração removida" });
    },
    onError: () => toast({ title: "Erro ao remover integração", variant: "destructive" }),
  });

  function openNew() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(si: SheetIntegration) {
    setEditingId(si.id);
    setForm({
      name: si.name,
      spreadsheetId: si.spreadsheetId,
      sheetName: si.sheetName,
      triggerEvent: si.triggerEvent,
      columnMapping: si.columnMapping || {},
    });
    setDialogOpen(true);
  }

  function updateMapping(field: string, col: string) {
    setForm((prev) => ({
      ...prev,
      columnMapping: col ? { ...prev.columnMapping, [field]: col } : Object.fromEntries(Object.entries(prev.columnMapping).filter(([k]) => k !== field)),
    }));
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Table2 className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Integrações Externas</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Google Sheets */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-green-600" />
                        Google Sheets
                      </CardTitle>
                      <CardDescription>
                        Envie dados de leads automaticamente para planilhas do Google quando eventos ocorrerem.
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={openNew} data-testid="button-new-sheet-integration">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova integração
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : integrations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                      <Link2 className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Nenhuma integração com Google Sheets configurada.</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Configure suas credenciais OAuth do Google e adicione uma integração para começar a exportar leads automaticamente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {integrations.map((si) => (
                        <div key={si.id} className="border rounded-lg p-4" data-testid={`card-sheet-${si.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{si.name}</span>
                                {si.isActive && <Badge variant="secondary" className="text-[10px]">Ativa</Badge>}
                                {si.googleToken && (
                                  <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />OAuth conectado
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">Planilha: {si.spreadsheetId} / {si.sheetName}</p>
                              <p className="text-xs text-muted-foreground">
                                Evento: {TRIGGER_EVENTS.find(e => e.id === si.triggerEvent)?.label || si.triggerEvent}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(si.columnMapping || {}).map(([field, col]) => (
                                  <Badge key={field} variant="outline" className="text-[10px]">{field} → {col}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                                onClick={() => openEdit(si)} data-testid={`button-edit-sheet-${si.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(si.id)} disabled={deleteMutation.isPending}
                                data-testid={`button-delete-sheet-${si.id}`}>
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

              {/* Info sobre OAuth */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong>Configuração OAuth:</strong> Para autenticar com o Google, configure as variáveis de ambiente
                    <code className="mx-1 bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code> e
                    <code className="mx-1 bg-muted px-1 rounded">GOOGLE_CLIENT_SECRET</code> no painel de secrets do projeto.
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Integração" : "Nova Integração Google Sheets"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da integração</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Leads Quentes → Planilha Comercial" data-testid="input-sheet-name" />
            </div>
            <div className="space-y-1.5">
              <Label>ID da Planilha Google</Label>
              <Input value={form.spreadsheetId} onChange={(e) => setForm((p) => ({ ...p, spreadsheetId: e.target.value }))}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" data-testid="input-spreadsheet-id" />
              <p className="text-[11px] text-muted-foreground">Copie da URL: docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome da aba</Label>
              <Input value={form.sheetName} onChange={(e) => setForm((p) => ({ ...p, sheetName: e.target.value }))}
                placeholder="Leads" data-testid="input-sheet-tab" />
            </div>
            <div className="space-y-1.5">
              <Label>Evento gatilho</Label>
              <Select value={form.triggerEvent} onValueChange={(v) => setForm((p) => ({ ...p, triggerEvent: v }))}>
                <SelectTrigger data-testid="select-trigger-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mapeamento de colunas</Label>
              <p className="text-[11px] text-muted-foreground">Informe a coluna da planilha para cada campo (ex: A, B, C...)</p>
              {FIELD_OPTIONS.map((field) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="text-sm w-32 flex-shrink-0">{field.label}</span>
                  <Input
                    className="w-24"
                    value={form.columnMapping[field.id] || ""}
                    onChange={(e) => updateMapping(field.id, e.target.value.toUpperCase())}
                    placeholder="A"
                    maxLength={3}
                    data-testid={`input-col-${field.id}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setForm(defaultForm); }}>Cancelar</Button>
            <Button
              onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!form.name.trim() || !form.spreadsheetId.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-sheet"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar integração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
