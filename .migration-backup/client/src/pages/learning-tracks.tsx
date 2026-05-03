import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GraduationCap,
  Clock,
  ToggleLeft,
  ToggleRight,
  Link2,
  Video,
  FileText,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LearningTrack {
  id: string;
  userId: string;
  stageOrIntent: string;
  stepOrder: number;
  delayHours: number;
  contentType: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const STAGE_INTENT_OPTIONS = [
  { value: "novo", label: "Estágio: Novo" },
  { value: "qualificado", label: "Estágio: Qualificado" },
  { value: "proposta", label: "Estágio: Proposta" },
  { value: "negociacao", label: "Estágio: Negociação" },
  { value: "fechado_ganho", label: "Estágio: Fechado Ganho" },
  { value: "compra_quente", label: "Intenção: Compra Quente" },
  { value: "duvida", label: "Intenção: Dúvida" },
  { value: "reclamacao", label: "Intenção: Reclamação" },
  { value: "suporte", label: "Intenção: Suporte" },
  { value: "elogio", label: "Intenção: Elogio" },
];

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  texto: FileText,
  video: Video,
  link: Link2,
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  texto: "Texto",
  video: "Vídeo",
  link: "Link",
};

const defaultForm = {
  stageOrIntent: "novo",
  stepOrder: 1,
  delayHours: 24,
  contentType: "texto",
  content: "",
  isActive: true,
};

type FormState = typeof defaultForm;

export default function LearningTracksPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<LearningTrack | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningTrack | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data: tracks = [], isLoading } = useQuery<LearningTrack[]>({
    queryKey: ["/api/learning-tracks"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await apiRequest("POST", "/api/learning-tracks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-tracks"] });
      toast({ title: "Trilha criada!" });
      resetForm();
    },
    onError: () => toast({ title: "Erro ao criar trilha", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormState> }) => {
      const res = await apiRequest("PUT", `/api/learning-tracks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-tracks"] });
      toast({ title: "Trilha atualizada!" });
      resetForm();
    },
    onError: () => toast({ title: "Erro ao atualizar trilha", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/learning-tracks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-tracks"] });
      toast({ title: "Trilha removida" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Erro ao remover trilha", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/learning-tracks/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-tracks"] });
    },
  });

  function resetForm() {
    setForm(defaultForm);
    setEditingTrack(null);
    setDialogOpen(false);
  }

  function openNew() {
    const currentGroup = tracks.filter(t => t.stageOrIntent === form.stageOrIntent);
    const nextOrder = currentGroup.length > 0 ? Math.max(...currentGroup.map(t => t.stepOrder)) + 1 : 1;
    setForm({ ...defaultForm, stepOrder: nextOrder });
    setEditingTrack(null);
    setDialogOpen(true);
  }

  function openEdit(track: LearningTrack) {
    setEditingTrack(track);
    setForm({
      stageOrIntent: track.stageOrIntent,
      stepOrder: track.stepOrder,
      delayHours: track.delayHours,
      contentType: track.contentType,
      content: track.content,
      isActive: track.isActive,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editingTrack) {
      updateMutation.mutate({ id: editingTrack.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Agrupar por stageOrIntent
  const grouped = tracks.reduce<Record<string, LearningTrack[]>>((acc, t) => {
    if (!acc[t.stageOrIntent]) acc[t.stageOrIntent] = [];
    acc[t.stageOrIntent].push(t);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped).sort();

  const stageLabel = (key: string) =>
    STAGE_INTENT_OPTIONS.find(o => o.value === key)?.label || key;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0">
          <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <GraduationCap className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Microlearning</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={openNew} size="sm" data-testid="button-new-track">
                <Plus className="h-4 w-4 mr-2" />
                Nova Etapa
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center gap-3">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-muted-foreground">Nenhuma trilha cadastrada</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Crie etapas de conteúdo automático para seus leads.
                  </p>
                </div>
                <Button onClick={openNew} data-testid="button-new-track-empty">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Etapa
                </Button>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {groupKeys.map((groupKey) => (
                  <div key={groupKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {stageLabel(groupKey)}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {grouped[groupKey].length} etapa{grouped[groupKey].length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="space-y-2 relative">
                      {grouped[groupKey]
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((track, idx) => {
                          const ContentIcon = CONTENT_TYPE_ICONS[track.contentType] || FileText;
                          return (
                            <Card
                              key={track.id}
                              className={`${!track.isActive ? "opacity-50" : ""}`}
                              data-testid={`card-track-${track.id}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <Badge variant="outline" className="text-[10px] gap-1">
                                        <ContentIcon className="h-3 w-3" />
                                        {CONTENT_TYPE_LABELS[track.contentType]}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {track.delayHours === 0
                                          ? "Envio imediato"
                                          : `${track.delayHours}h após contato`}
                                      </span>
                                      {!track.isActive && (
                                        <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-foreground line-clamp-2 mt-1" data-testid={`text-track-content-${track.id}`}>
                                      {track.content}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Switch
                                      checked={track.isActive}
                                      onCheckedChange={(checked) =>
                                        toggleMutation.mutate({ id: track.id, isActive: checked })
                                      }
                                      data-testid={`switch-track-${track.id}`}
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => openEdit(track)}
                                      className="h-8 w-8"
                                      data-testid={`button-edit-track-${track.id}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setDeleteTarget(track)}
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      data-testid={`button-delete-track-${track.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTrack ? "Editar Etapa" : "Nova Etapa de Microlearning"}</DialogTitle>
            <DialogDescription>
              Configure uma mensagem automática enviada com base no estágio ou intenção do lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="stageOrIntent">Estágio / Intenção</Label>
              <Select
                value={form.stageOrIntent}
                onValueChange={(val) => setForm((f) => ({ ...f, stageOrIntent: val }))}
              >
                <SelectTrigger data-testid="select-stage-intent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_INTENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stepOrder">Ordem</Label>
                <Input
                  id="stepOrder"
                  type="number"
                  min={1}
                  value={form.stepOrder}
                  onChange={(e) => setForm((f) => ({ ...f, stepOrder: parseInt(e.target.value) || 1 }))}
                  data-testid="input-step-order"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delayHours">Delay (horas)</Label>
                <Input
                  id="delayHours"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.delayHours}
                  onChange={(e) => setForm((f) => ({ ...f, delayHours: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-delay-hours"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Conteúdo</Label>
              <Select
                value={form.contentType}
                onValueChange={(val) => setForm((f) => ({ ...f, contentType: val }))}
              >
                <SelectTrigger data-testid="select-content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> Texto</div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2"><Video className="h-4 w-4" /> Vídeo</div>
                  </SelectItem>
                  <SelectItem value="link">
                    <div className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Link</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={
                  form.contentType === "texto"
                    ? "Digite a mensagem que será enviada..."
                    : form.contentType === "video"
                    ? "Cole a URL do vídeo..."
                    : "Cole o link que será enviado..."
                }
                rows={4}
                data-testid="input-content"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                data-testid="switch-is-active"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Etapa ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-track">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.content.trim() || isSaving}
              data-testid="button-save-track"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingTrack ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A etapa de microlearning será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-track"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
