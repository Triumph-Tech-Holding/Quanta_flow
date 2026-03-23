import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Megaphone, Plus, Trash2, Pencil, Copy, Check, Sparkles, Loader2,
  FileText, Mic, Video, Radio, Link2, Calendar, FolderOpen, BookOpen,
  ChevronLeft, ChevronRight, Eye, Download, CheckCircle2, Clock, Newspaper,
  BarChart3, Target, TrendingUp, MousePointerClick, SendHorizontal, Layers,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Payload types for mutations
interface ProjectPayload {
  name: string;
  clientName: string | null;
  description: string | null;
  brand: { tone: string; niche: string; leadershipStyle?: string; colors?: string[] };
}
interface GeneratePayload {
  projectId?: string;
  idea: string;
  channel: string;
  tone: string;
}
interface UpdateAssetPayload {
  status?: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  formats?: Record<string, string | undefined>;
  utmLink?: string | null;
}

// Types
interface SocialProject {
  id: string;
  name: string;
  clientName?: string;
  description?: string;
  brand?: { tone?: string; niche?: string; colors?: string[]; leadershipStyle?: string };
  isActive: boolean;
  assetCount: number;
  createdAt: string;
}

interface ContentAsset {
  id: string;
  projectId?: string;
  sourceIdea: string;
  ideaArea?: string;
  ideaSources?: string;
  formats?: {
    headlines?: string[];
    article?: string;
    podcastScript?: string;
    reelScript?: string;
    liveScript?: string;
    socialAds?: string;
    audioUrl?: string;
  };
  usedPrompt?: string;
  channel: string;
  status: "draft" | "approved" | "scheduled" | "published";
  scheduledAt?: string;
  publishedAt?: string;
  utmLink?: string;
  notes?: string;
  createdAt: string;
}

interface PublicationSchedule {
  id: string;
  assetId: string;
  platform: string;
  scheduledTime: string;
  status: "planned" | "sent" | "manual";
  notes?: string;
  createdAt: string;
}

const LEADERSHIP_STYLES = [
  { value: "hormozi", label: "Alex Hormozi — Ofertas & Resultados", desc: "Linguagem direta, foco em ROI e resultados concretos" },
  { value: "priestley", label: "Daniel Priestley — Autoridade & KPI", desc: "Posicionamento como Key Person of Influence, ecossistemas" },
  { value: "garyvee", label: "Gary Vaynerchuk — Documentação & Autenticidade", desc: "Volume de conteúdo orgânico e jornada autêntica" },
];

const CHANNELS = [
  { value: "instagram", label: "Instagram", color: "bg-pink-500" },
  { value: "tiktok", label: "TikTok", color: "bg-black" },
  { value: "youtube", label: "YouTube", color: "bg-red-500" },
  { value: "linkedin", label: "LinkedIn", color: "bg-blue-600" },
  { value: "blog", label: "Blog", color: "bg-purple-500" },
  { value: "whatsapp", label: "WhatsApp", color: "bg-green-500" },
];

const STATUS_CONFIG = {
  draft: { label: "Rascunho", variant: "secondary" as const },
  approved: { label: "Aprovado", variant: "default" as const },
  scheduled: { label: "Agendado", variant: "outline" as const },
  published: { label: "Publicado", variant: "default" as const },
};

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant="ghost" size="icon" className={className} onClick={handleCopy} title="Copiar">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const ch = CHANNELS.find(c => c.value === channel);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-white ${ch?.color || "bg-gray-400"}`}>
      {ch?.label || channel}
    </span>
  );
}

// ==================== PROJECTS TAB ====================

function ProjectsTab({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SocialProject | null>(null);
  const [form, setForm] = useState({ name: "", clientName: "", description: "", tone: "", niche: "", leadershipStyle: "none", colors: "" });

  const { data: projects = [], isLoading } = useQuery<SocialProject[]>({
    queryKey: ["/api/admin/social/projects"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectPayload) => apiRequest("POST", "/api/admin/social/projects", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social/projects"] }); setShowModal(false); toast({ title: "Projeto criado!" }); },
    onError: () => toast({ title: "Erro ao criar projeto", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectPayload }) => apiRequest("PATCH", `/api/admin/social/projects/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social/projects"] }); setShowModal(false); toast({ title: "Projeto atualizado!" }); },
    onError: () => toast({ title: "Erro ao atualizar projeto", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/social/projects/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social/projects"] }); toast({ title: "Projeto excluído" }); },
    onError: () => toast({ title: "Erro ao excluir projeto", variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setForm({ name: "", clientName: "", description: "", tone: "", niche: "", leadershipStyle: "none", colors: "" }); setShowModal(true); };
  const openEdit = (p: SocialProject) => {
    setEditing(p);
    setForm({ name: p.name, clientName: p.clientName || "", description: p.description || "", tone: p.brand?.tone || "", niche: p.brand?.niche || "", leadershipStyle: p.brand?.leadershipStyle || "none", colors: (p.brand?.colors || []).join(", ") });
    setShowModal(true);
  };

  const handleSubmit = () => {
    const ls = form.leadershipStyle === "none" ? undefined : form.leadershipStyle;
    const colors = form.colors ? form.colors.split(",").map(c => c.trim()).filter(c => c) : undefined;
    const payload = { name: form.name, clientName: form.clientName || null, description: form.description || null, brand: { tone: form.tone, niche: form.niche, leadershipStyle: ls, colors } };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s) cadastrado(s)</p>
        {isAdmin && <Button size="sm" onClick={openNew} data-testid="button-new-project"><Plus className="h-4 w-4 mr-1" /> Novo Projeto</Button>}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum projeto criado ainda.</p>
          {isAdmin && <Button variant="outline" size="sm" className="mt-3" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Criar primeiro projeto</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Card key={p.id} data-testid={`card-project-${p.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{p.name}</CardTitle>
                    {p.clientName && <CardDescription className="truncate">{p.clientName}</CardDescription>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{p.assetCount} ativos</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {p.brand?.niche && <Badge variant="outline" className="text-[10px]">{p.brand.niche}</Badge>}
                  {p.brand?.tone && <Badge variant="outline" className="text-[10px]">{p.brand.tone}</Badge>}
                  {p.brand?.leadershipStyle && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{LEADERSHIP_STYLES.find(s => s.value === p.brand?.leadershipStyle)?.label.split("—")[0].trim() || p.brand.leadershipStyle}</Badge>}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} data-testid={`button-edit-project-${p.id}`}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Excluir projeto e todos os ativos?")) deleteMutation.mutate(p.id); }} data-testid={`button-delete-project-${p.id}`}><Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do Projeto *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Mauro Triumph - Março 2026" data-testid="input-project-name" /></div>
            <div><Label>Nome do Cliente</Label><Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Ex: Mauro Triumph" /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Objetivo do projeto..." rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nicho</Label><Input value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} placeholder="Ex: Desenvolvimento Pessoal" /></div>
              <div>
                <Label>Tom de Voz</Label>
                <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspirador">Inspirador</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="provocativo">Provocativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Framework de Liderança</Label>
              <Select value={form.leadershipStyle} onValueChange={v => setForm(f => ({ ...f, leadershipStyle: v }))}>
                <SelectTrigger data-testid="select-leadership-style"><SelectValue placeholder="Nenhum (padrão)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (padrão)</SelectItem>
                  {LEADERSHIP_STYLES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div>
                        <div className="font-medium text-sm">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Influencia o estilo de linguagem e abordagem da IA na geração de conteúdo.</p>
            </div>
            <div>
              <Label>Cores da Marca (hex, separadas por vírgula)</Label>
              <Input value={form.colors} onChange={e => setForm(f => ({ ...f, colors: e.target.value }))} placeholder="Ex: #00A86B, #1B3A57, #FFFFFF" data-testid="input-brand-colors" />
              <p className="text-xs text-muted-foreground mt-1">Opcional. Cores em hex para referência de identidade visual.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name || createMutation.isPending || updateMutation.isPending} data-testid="button-save-project">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar" : "Criar Projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== STUDIO TAB ====================

function StudioTab({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectId, setProjectId] = useState("_none_");
  const [idea, setIdea] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [tone, setTone] = useState("inspirador");
  const [generatedAsset, setGeneratedAsset] = useState<ContentAsset | null>(null);
  const [activeFormat, setActiveFormat] = useState("headlines");
  const [showPrompt, setShowPrompt] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("nova");
  const [utmBase, setUtmBase] = useState("");
  const [generatingTts, setGeneratingTts] = useState(false);
  const [generatingUtm, setGeneratingUtm] = useState(false);

  const { data: projects = [] } = useQuery<SocialProject[]>({ queryKey: ["/api/admin/social/projects"] });

  const generateMutation = useMutation<ContentAsset, Error, GeneratePayload>({
    mutationFn: (data: GeneratePayload) => apiRequest("POST", "/api/admin/social/generate", data).then(r => r.json()),
    onSuccess: (asset: ContentAsset) => {
      setGeneratedAsset(asset);
      setStep(2);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets"] });
    },
    onError: () => toast({ title: "Erro ao gerar conteúdo", description: "Verifique a conexão com a IA", variant: "destructive" }),
  });

  const handleGenerate = () => {
    if (!idea.trim()) { toast({ title: "Digite uma ideia", variant: "destructive" }); return; }
    generateMutation.mutate({ projectId: projectId === "_none_" ? undefined : projectId, idea: idea.trim(), channel, tone });
  };

  const handleTts = async () => {
    if (!generatedAsset) return;
    setGeneratingTts(true);
    try {
      const res = await apiRequest("POST", `/api/admin/social/assets/${generatedAsset.id}/tts`, { voice: ttsVoice });
      const data: { asset: ContentAsset } = await res.json();
      setGeneratedAsset(data.asset);
      toast({ title: "Áudio gerado com sucesso!" });
    } catch {
      toast({ title: "Erro ao gerar áudio TTS", variant: "destructive" });
    } finally {
      setGeneratingTts(false);
    }
  };

  const handleUtm = async () => {
    if (!generatedAsset || !utmBase) return;
    setGeneratingUtm(true);
    try {
      const res = await apiRequest("POST", `/api/admin/social/assets/${generatedAsset.id}/generate-utm`, { baseUrl: utmBase });
      const data: { asset: ContentAsset; utmLink: string } = await res.json();
      setGeneratedAsset(data.asset);
      toast({ title: "Link UTM gerado!" });
    } catch {
      toast({ title: "Erro ao gerar UTM", variant: "destructive" });
    } finally {
      setGeneratingUtm(false);
    }
  };

  const approveMutation = useMutation<ContentAsset, Error, { id: string; status: string }>({
    mutationFn: ({ id, status }) => apiRequest("PATCH", `/api/admin/social/assets/${id}`, { status }).then(r => r.json()),
    onSuccess: (asset: ContentAsset) => {
      setGeneratedAsset(asset);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets"] });
      toast({ title: asset.status === "approved" ? "Ativo aprovado!" : "Status atualizado" });
    },
  });

  const handleReset = () => { setStep(1); setIdea(""); setGeneratedAsset(null); setActiveFormat("headlines"); setUtmBase(""); };

  if (!isAdmin) return (
    <div className="text-center py-20 text-muted-foreground">
      <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>Apenas administradores podem gerar conteúdo.</p>
    </div>
  );

  const formats = generatedAsset?.formats || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[{ n: 1, label: "Ideia" }, { n: 2, label: "Conteúdo" }, { n: 3, label: "Finalizar" }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${step === n ? "bg-primary text-white border-primary" : step > n ? "bg-primary/20 border-primary text-primary" : "bg-muted border-muted-foreground/30 text-muted-foreground"}`}>{n}</div>
            <span className={step === n ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {n < 3 && <div className="w-8 h-px bg-muted-foreground/30" />}
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Qual é a sua ideia?</CardTitle><CardDescription>Digite o tema central e a IA vai transformar em 5 formatos de conteúdo prontos para publicar.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Projeto / Cliente</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-project"><SelectValue placeholder="Nenhum (geral)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhum (geral)</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.clientName ? ` — ${p.clientName}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal Principal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger data-testid="select-channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tom de Voz</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspirador">Inspirador</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="provocativo">Provocativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ideia Central *</Label>
              <Textarea
                value={idea}
                onChange={e => setIdea(e.target.value)}
                placeholder="Ex: A resiliência é a maior vantagem competitiva de um empreendedor..."
                rows={4}
                data-testid="textarea-idea"
              />
              <p className="text-xs text-muted-foreground mt-1">Seja específico — quanto mais contexto, melhor o conteúdo gerado.</p>
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={generateMutation.isPending || !idea.trim()} data-testid="button-generate">
              {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando conteúdo...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Conteúdo com IA</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generated Content */}
      {step === 2 && generatedAsset && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Conteúdo Gerado</h3>
              {generatedAsset.ideaArea && <p className="text-xs text-muted-foreground">{generatedAsset.ideaArea}{generatedAsset.ideaSources ? ` — ${generatedAsset.ideaSources}` : ""}</p>}
            </div>
            <div className="flex gap-2">
              {generatedAsset.usedPrompt && (
                <Button variant="outline" size="sm" onClick={() => setShowPrompt(true)} data-testid="button-show-prompt"><Eye className="h-3.5 w-3.5 mr-1" /> Show Prompt</Button>
              )}
              <Button size="sm" onClick={() => setStep(3)} data-testid="button-next-step">Finalizar →</Button>
            </div>
          </div>

          <Tabs value={activeFormat} onValueChange={setActiveFormat}>
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="headlines" className="text-xs"><Newspaper className="h-3.5 w-3.5 mr-1 hidden sm:block" />Headlines</TabsTrigger>
              <TabsTrigger value="article" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1 hidden sm:block" />Artigo</TabsTrigger>
              <TabsTrigger value="podcastScript" className="text-xs"><Mic className="h-3.5 w-3.5 mr-1 hidden sm:block" />Podcast</TabsTrigger>
              <TabsTrigger value="reelScript" className="text-xs"><Video className="h-3.5 w-3.5 mr-1 hidden sm:block" />Reels</TabsTrigger>
              <TabsTrigger value="liveScript" className="text-xs"><Radio className="h-3.5 w-3.5 mr-1 hidden sm:block" />Live</TabsTrigger>
              <TabsTrigger value="socialAds" className="text-xs"><Target className="h-3.5 w-3.5 mr-1 hidden sm:block" />Social Ads</TabsTrigger>
            </TabsList>

            <TabsContent value="headlines">
              <Card><CardContent className="pt-4 space-y-2">
                {(formats.headlines || []).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded border bg-muted/30">
                    <span className="text-xs font-bold text-primary mt-0.5 shrink-0">#{i + 1}</span>
                    <p className="text-sm flex-1">{h}</p>
                    <CopyButton text={h} />
                  </div>
                ))}
                {(formats.headlines || []).length === 0 && <p className="text-muted-foreground text-sm">Nenhuma headline gerada.</p>}
                <div className="pt-2 flex justify-end">
                  <CopyButton text={(formats.headlines || []).join("\n")} className="border" />
                </div>
              </CardContent></Card>
            </TabsContent>

            {(["article", "podcastScript", "reelScript", "liveScript"] as const).map(key => {
              const labels: Record<string, string> = { article: "Artigo", podcastScript: "Roteiro de Podcast", reelScript: "Script de Reels", liveScript: "Roteiro de Live" };
              const text = formats[key] || "";
              return (
                <TabsContent key={key} value={key}>
                  <Card><CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{labels[key]}</span>
                      <CopyButton text={text} />
                    </div>
                    <ScrollArea className="h-64">
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{text || "Conteúdo não disponível"}</pre>
                    </ScrollArea>
                  </CardContent></Card>
                </TabsContent>
              );
            })}

            <TabsContent value="socialAds">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Copy de Anúncio — Agentes de Fidelização</span>
                    </div>
                    <CopyButton text={formats.socialAds || ""} />
                  </div>
                  <ScrollArea className="h-64">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{formats.socialAds || "Social Ads não disponível. Regere o conteúdo para incluir este formato."}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Prompt Utilizado pela IA</DialogTitle></DialogHeader>
              <ScrollArea className="h-64"><pre className="text-xs whitespace-pre-wrap font-mono p-2 bg-muted rounded">{generatedAsset.usedPrompt}</pre></ScrollArea>
              <DialogFooter>
                <CopyButton text={generatedAsset.usedPrompt || ""} />
                <Button variant="outline" onClick={() => setShowPrompt(false)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Step 3: Finalize */}
      {step === 3 && generatedAsset && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <h3 className="font-semibold">Finalizar Ativo</h3>
          </div>

          {/* TTS Audio */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Narração em Áudio (TTS)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {generatedAsset.formats?.audioUrl ? (
                <div className="space-y-2">
                  <audio controls className="w-full h-10" src={generatedAsset.formats.audioUrl} />
                  <a href={generatedAsset.formats.audioUrl} download className="text-xs text-primary flex items-center gap-1"><Download className="h-3 w-3" /> Baixar áudio</a>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Select value={ttsVoice} onValueChange={setTtsVoice}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nova">Nova (feminino)</SelectItem>
                      <SelectItem value="alloy">Alloy (neutro)</SelectItem>
                      <SelectItem value="echo">Echo (masculino)</SelectItem>
                      <SelectItem value="onyx">Onyx (masculino grave)</SelectItem>
                      <SelectItem value="shimmer">Shimmer (feminino)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleTts} disabled={generatingTts} data-testid="button-generate-tts">
                    {generatingTts ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                    Gerar Áudio do Podcast
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* UTM Link */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Link UTM Rastreável</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {generatedAsset.utmLink ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all">
                  <span className="flex-1">{generatedAsset.utmLink}</span>
                  <CopyButton text={generatedAsset.utmLink} />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={utmBase} onChange={e => setUtmBase(e.target.value)} placeholder="https://seusite.com/pagina" className="flex-1 text-sm" data-testid="input-utm-base" />
                  <Button variant="outline" size="sm" onClick={handleUtm} disabled={generatingUtm || !utmBase} data-testid="button-generate-utm">
                    {generatingUtm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status & Actions */}
          <Card>
            <CardContent className="pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={STATUS_CONFIG[generatedAsset.status]?.variant || "secondary"}>
                  {STATUS_CONFIG[generatedAsset.status]?.label || generatedAsset.status}
                </Badge>
              </div>
              <div className="flex gap-2">
                {generatedAsset.status === "draft" && (
                  <Button size="sm" onClick={() => approveMutation.mutate({ id: generatedAsset.id, status: "approved" })} disabled={approveMutation.isPending} data-testid="button-approve">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-new-idea">Nova Ideia</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ==================== LIBRARY TAB ====================

function LibraryTab({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<ContentAsset | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [newSchedPlatform, setNewSchedPlatform] = useState("instagram");
  const [newSchedTime, setNewSchedTime] = useState("");

  const { data: projects = [] } = useQuery<SocialProject[]>({
    queryKey: ["/api/admin/social/projects"],
  });

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filterProject !== "all") p.projectId = filterProject;
    if (filterStatus !== "all") p.status = filterStatus;
    if (filterChannel !== "all") p.channel = filterChannel;
    return new URLSearchParams(p).toString();
  }, [filterProject, filterStatus, filterChannel]);

  const { data: assets = [], isLoading } = useQuery<ContentAsset[]>({
    queryKey: ["/api/admin/social/assets", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/social/assets${queryParams ? "?" + queryParams : ""}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetPayload }) => apiRequest("PATCH", `/api/admin/social/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/calendar"] });
      setSelectedAsset(null);
      toast({ title: "Ativo atualizado!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/social/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/projects"] });
      toast({ title: "Ativo excluído" });
    },
  });

  const { data: assetSchedules = [] } = useQuery<PublicationSchedule[]>({
    queryKey: ["/api/admin/social/assets", selectedAsset?.id, "schedules"],
    queryFn: async () => {
      if (!selectedAsset) return [];
      const res = await fetch(`/api/admin/social/assets/${selectedAsset.id}/schedules`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      return res.json();
    },
    enabled: !!selectedAsset,
  });

  const createScheduleMutation = useMutation({
    mutationFn: ({ assetId, platform, scheduledTime }: { assetId: string; platform: string; scheduledTime: string }) =>
      apiRequest("POST", `/api/admin/social/assets/${assetId}/schedules`, { platform, scheduledTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets", selectedAsset?.id, "schedules"] });
      setNewSchedTime("");
      toast({ title: "Agendamento criado!" });
    },
    onError: () => toast({ title: "Erro ao criar agendamento", variant: "destructive" }),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (schedId: string) => apiRequest("DELETE", `/api/admin/social/schedules/${schedId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/assets", selectedAsset?.id, "schedules"] });
      toast({ title: "Agendamento removido" });
    },
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44 text-sm" data-testid="filter-project"><SelectValue placeholder="Todos os projetos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 text-sm" data-testid="filter-status"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-36 text-sm" data-testid="filter-channel"><SelectValue placeholder="Todos os canais" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center ml-auto">{assets.length} ativo(s)</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum ativo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map(a => (
            <Card key={a.id} data-testid={`card-asset-${a.id}`} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <ChannelBadge channel={a.channel} />
                  <Badge variant={STATUS_CONFIG[a.status]?.variant || "secondary"} className="text-[10px]">
                    {STATUS_CONFIG[a.status]?.label || a.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium line-clamp-2">{a.sourceIdea}</p>
                {a.ideaArea && <p className="text-xs text-muted-foreground">{a.ideaArea}</p>}
                {a.projectId && projectMap[a.projectId] && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderOpen className="h-3 w-3" />
                    {projectMap[a.projectId]}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {a.formats?.headlines && a.formats.headlines.length > 0 && <Badge variant="outline" className="text-[9px]"><Newspaper className="h-2.5 w-2.5 mr-0.5" />Headlines</Badge>}
                  {a.formats?.article && <Badge variant="outline" className="text-[9px]"><FileText className="h-2.5 w-2.5 mr-0.5" />Artigo</Badge>}
                  {a.formats?.podcastScript && <Badge variant="outline" className="text-[9px]"><Mic className="h-2.5 w-2.5 mr-0.5" />Podcast</Badge>}
                  {a.formats?.audioUrl && <Badge variant="outline" className="text-[9px]"><Mic className="h-2.5 w-2.5 mr-0.5 text-green-500" />Áudio</Badge>}
                  {a.utmLink && <Badge variant="outline" className="text-[9px]"><Link2 className="h-2.5 w-2.5 mr-0.5 text-blue-500" />UTM</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground">{format(parseISO(a.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                <div className="flex gap-1 pt-1 flex-wrap">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setSelectedAsset(a)} data-testid={`button-detail-asset-${a.id}`}><Eye className="h-3 w-3 mr-1" />Ver</Button>
                  {isAdmin && a.status === "draft" && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "approved" } })}>
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />Aprovar
                    </Button>
                  )}
                  {isAdmin && a.status === "approved" && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "published", publishedAt: new Date().toISOString() } })}>
                      <CheckCircle2 className="h-3 w-3 mr-1 text-primary" />Publicado
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (confirm("Excluir ativo?")) deleteMutation.mutate(a.id); }} data-testid={`button-delete-asset-${a.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Asset detail modal */}
      <Dialog open={!!selectedAsset} onOpenChange={v => !v && setSelectedAsset(null)}>
        {selectedAsset && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChannelBadge channel={selectedAsset.channel} />
                <span className="truncate">{selectedAsset.sourceIdea}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedAsset.ideaArea && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedAsset.ideaArea}{selectedAsset.ideaSources ? ` — Fontes: ${selectedAsset.ideaSources}` : ""}</span>
                </div>
              )}

              <Tabs defaultValue="headlines">
                <TabsList className="w-full grid grid-cols-6">
                  <TabsTrigger value="headlines" className="text-[10px]">Headlines</TabsTrigger>
                  <TabsTrigger value="article" className="text-[10px]">Artigo</TabsTrigger>
                  <TabsTrigger value="podcastScript" className="text-[10px]">Podcast</TabsTrigger>
                  <TabsTrigger value="reelScript" className="text-[10px]">Reels</TabsTrigger>
                  <TabsTrigger value="liveScript" className="text-[10px]">Live</TabsTrigger>
                  <TabsTrigger value="socialAds" className="text-[10px]">Ads</TabsTrigger>
                </TabsList>
                <TabsContent value="headlines">
                  <ScrollArea className="h-48"><div className="space-y-1">{(selectedAsset.formats?.headlines || []).map((h, i) => (<div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/40 text-sm"><span className="text-primary font-bold shrink-0">#{i + 1}</span><span className="flex-1">{h}</span><CopyButton text={h} /></div>))}</div></ScrollArea>
                </TabsContent>
                {(["article", "podcastScript", "reelScript", "liveScript"] as const).map(k => (
                  <TabsContent key={k} value={k}>
                    <ScrollArea className="h-48"><div className="flex justify-end mb-1"><CopyButton text={selectedAsset.formats?.[k] || ""} /></div><pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{selectedAsset.formats?.[k] || "Não disponível"}</pre></ScrollArea>
                  </TabsContent>
                ))}
                <TabsContent value="socialAds">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Copy de Anúncio (Agentes de Fidelização)</span>
                    <CopyButton text={selectedAsset.formats?.socialAds || ""} />
                  </div>
                  <ScrollArea className="h-48"><pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{selectedAsset.formats?.socialAds || "Não disponível neste ativo. Regere para incluir."}</pre></ScrollArea>
                </TabsContent>
              </Tabs>

              {selectedAsset.formats?.audioUrl && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Áudio TTS</p>
                  <audio controls className="w-full h-10" src={selectedAsset.formats.audioUrl} />
                  <a href={selectedAsset.formats.audioUrl} download className="text-xs text-primary flex items-center gap-1"><Download className="h-3 w-3" /> Baixar</a>
                </div>
              )}

              {selectedAsset.utmLink && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" /> Link UTM</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all"><span className="flex-1">{selectedAsset.utmLink}</span><CopyButton text={selectedAsset.utmLink} /></div>
                </div>
              )}

              {/* Publication Schedules per Platform */}
              <div className="space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1"><SendHorizontal className="h-3.5 w-3.5 text-primary" /> Agendamentos por Plataforma</p>
                {assetSchedules.length > 0 && (
                  <div className="space-y-1">
                    {assetSchedules.map(s => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded border text-xs">
                        <ChannelBadge channel={s.platform} />
                        <span className="flex-1">{format(new Date(s.scheduledTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        <Badge variant={s.status === "sent" ? "default" : s.status === "manual" ? "outline" : "secondary"} className="text-[9px]">
                          {s.status === "planned" ? "Planejado" : s.status === "sent" ? "Enviado" : "Manual"}
                        </Badge>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteScheduleMutation.mutate(s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Select value={newSchedPlatform} onValueChange={setNewSchedPlatform}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="datetime-local" className="flex-1 h-8 text-xs" value={newSchedTime} onChange={e => setNewSchedTime(e.target.value)} />
                    <Button size="sm" variant="outline" disabled={!newSchedTime || createScheduleMutation.isPending} onClick={() => createScheduleMutation.mutate({ assetId: selectedAsset.id, platform: newSchedPlatform, scheduledTime: newSchedTime })} data-testid="button-add-schedule">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isAdmin && selectedAsset.status === "approved" && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Label className="text-xs shrink-0 text-muted-foreground">Marcar asset como agendado:</Label>
                  <Input type="datetime-local" className="text-xs h-8 flex-1" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                  <Button size="sm" variant="outline" disabled={!scheduleDate} onClick={() => { updateMutation.mutate({ id: selectedAsset.id, data: { status: "scheduled", scheduledAt: scheduleDate } }); }}>
                    <Calendar className="h-3 w-3 mr-1" /> Agendar
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ==================== CALENDAR TAB ====================

function CalendarTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: assets = [] } = useQuery<ContentAsset[]>({
    queryKey: ["/api/admin/social/calendar", monthStr],
    queryFn: async () => {
      const res = await fetch(`/api/admin/social/calendar?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      return res.json();
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = getDay(days[0]);
  const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const assetsByDay = useMemo(() => {
    const map: Record<string, ContentAsset[]> = {};
    assets.forEach(a => {
      if (a.scheduledAt) {
        const key = format(parseISO(a.scheduledAt), "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    });
    return map;
  }, [assets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(d => subMonths(d, 1))} data-testid="button-prev-month"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(d => addMonths(d, 1))} data-testid="button-next-month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {WEEK_DAYS.map(d => <div key={d} className="text-center text-xs font-medium py-2 text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} className="min-h-20 border-t border-r bg-muted/20" />)}
          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayAssets = assetsByDay[key] || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div key={key} className={`min-h-20 border-t border-r p-1 ${isToday ? "bg-primary/5" : ""}`} data-testid={`calendar-day-${key}`}>
                <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</p>
                <div className="space-y-0.5">
                  {dayAssets.slice(0, 3).map(a => (
                    <div key={a.id} className="text-[9px] rounded px-1 py-0.5 flex items-center gap-0.5 truncate" title={a.sourceIdea}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHANNELS.find(c => c.value === a.channel)?.color || "bg-gray-400"}`} />
                      <span className="truncate">{a.sourceIdea.slice(0, 20)}</span>
                    </div>
                  ))}
                  {dayAssets.length > 3 && <p className="text-[9px] text-muted-foreground">+{dayAssets.length - 3} mais</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">Nenhum conteúdo agendado neste mês.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{assets.length} ativo(s) agendado(s) em {format(currentMonth, "MMMM", { locale: ptBR })}</p>
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded border text-sm">
              <div className="shrink-0"><Clock className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-xs text-muted-foreground shrink-0">{a.scheduledAt ? format(parseISO(a.scheduledAt), "dd/MM HH:mm") : ""}</span>
              <ChannelBadge channel={a.channel} />
              <span className="flex-1 truncate">{a.sourceIdea}</span>
              <Badge variant={STATUS_CONFIG[a.status]?.variant || "secondary"} className="text-[10px] shrink-0">{STATUS_CONFIG[a.status]?.label}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== DASHBOARD TAB ====================

function DashboardTab() {
  const { data: stats, isLoading } = useQuery<{ total: number; byStatus: Record<string, number>; byChannel: Record<string, number> }>({
    queryKey: ["/api/admin/social/stats"],
  });
  const { data: projects = [] } = useQuery<SocialProject[]>({ queryKey: ["/api/admin/social/projects"] });
  const { data: recentAssets = [] } = useQuery<ContentAsset[]>({
    queryKey: ["/api/admin/social/assets", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/admin/social/assets?limit=6", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      return res.json();
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const s = stats || { total: 0, byStatus: {}, byChannel: {} };

  const kpis = [
    { label: "Total de Ativos", value: s.total, icon: Layers, color: "text-blue-500" },
    { label: "Em Rascunho", value: s.byStatus.draft || 0, icon: Clock, color: "text-yellow-500" },
    { label: "Aprovados", value: s.byStatus.approved || 0, icon: CheckCircle2, color: "text-green-500" },
    { label: "Publicados", value: s.byStatus.published || 0, icon: TrendingUp, color: "text-primary" },
    { label: "Projetos Ativos", value: projects.filter(p => p.isActive).length, icon: FolderOpen, color: "text-purple-500" },
    { label: "Agendados", value: s.byStatus.scheduled || 0, icon: Calendar, color: "text-orange-500" },
  ];

  const topChannels = Object.entries(s.byChannel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const formatDist = [
    { key: "draft", label: "Rascunho", count: s.byStatus.draft || 0, color: "bg-yellow-400" },
    { key: "approved", label: "Aprovado", count: s.byStatus.approved || 0, color: "bg-green-500" },
    { key: "scheduled", label: "Agendado", count: s.byStatus.scheduled || 0, color: "bg-orange-400" },
    { key: "published", label: "Publicado", count: s.byStatus.published || 0, color: "bg-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <k.icon className={`h-5 w-5 mx-auto mb-1 ${k.color}`} />
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-[10px] text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum ativo gerado ainda.</p>
            ) : (
              formatDist.map(f => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{f.label}</span>
                    <span className="font-medium">{f.count} ({s.total > 0 ? Math.round((f.count / s.total) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${f.color} transition-all`} style={{ width: `${s.total > 0 ? (f.count / s.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Channel distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" /> Canais Mais Usados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado ainda.</p>
            ) : (
              topChannels.map(([channel, count]) => {
                const ch = CHANNELS.find(c => c.value === channel);
                return (
                  <div key={channel} className="flex items-center gap-3">
                    <ChannelBadge channel={channel} />
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${ch?.color || "bg-gray-400"}`} style={{ width: `${s.total > 0 ? (count / s.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-medium w-6 text-right">{count}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Ativos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum ativo gerado ainda. Vá ao Estúdio para criar!</p>
          ) : (
            <div className="space-y-2">
              {recentAssets.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                  <ChannelBadge channel={a.channel} />
                  <span className="flex-1 truncate">{a.sourceIdea}</span>
                  {a.ideaArea && <span className="text-xs text-muted-foreground hidden md:block truncate max-w-32">{a.ideaArea}</span>}
                  <Badge variant={STATUS_CONFIG[a.status]?.variant || "secondary"} className="text-[10px] shrink-0">{STATUS_CONFIG[a.status]?.label}</Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(a.createdAt), "dd/MM", { locale: ptBR })}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function SocialAdsPage() {
  const { hasRole, user } = useAuth();
  const isAdmin = user?.tipoAtor === "admin" || hasRole("super_admin") || hasRole("admin");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Social/Ads</h1>
            <Badge variant="secondary" className="text-xs">Estúdio de Conteúdo</Badge>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6">
          <Tabs defaultValue={isAdmin ? "studio" : "library"}>
            <TabsList className="mb-6">
              {isAdmin && <TabsTrigger value="dashboard" data-testid="tab-dashboard"><BarChart3 className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>}
              {isAdmin && <TabsTrigger value="studio" data-testid="tab-studio"><Sparkles className="h-4 w-4 mr-1.5" />Estúdio</TabsTrigger>}
              <TabsTrigger value="library" data-testid="tab-library"><BookOpen className="h-4 w-4 mr-1.5" />Biblioteca</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar"><Calendar className="h-4 w-4 mr-1.5" />Calendário</TabsTrigger>
              {isAdmin && <TabsTrigger value="projects" data-testid="tab-projects"><FolderOpen className="h-4 w-4 mr-1.5" />Projetos</TabsTrigger>}
            </TabsList>
            {isAdmin && <TabsContent value="dashboard"><DashboardTab /></TabsContent>}
            {isAdmin && <TabsContent value="studio"><StudioTab isAdmin={isAdmin} /></TabsContent>}
            <TabsContent value="library"><LibraryTab isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="calendar"><CalendarTab /></TabsContent>
            {isAdmin && <TabsContent value="projects"><ProjectsTab isAdmin={isAdmin} /></TabsContent>}
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
