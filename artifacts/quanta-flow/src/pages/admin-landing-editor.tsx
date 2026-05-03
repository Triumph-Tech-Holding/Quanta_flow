import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Send, Eye, Plus, Trash2, GripVertical, Settings as SettingsIcon, ChevronUp, ChevronDown, Copy, Monitor, Smartphone, Tablet } from "lucide-react";
import { BlocksRenderer, type Block } from "@/components/landing/blocks-renderer";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LP {
  id: string; name: string; slug: string; status: "draft" | "published" | "archived";
  draftBlocks: Block[]; publishedBlocks: Block[] | null; publishedVersion: number | null;
  seo: { title?: string; description?: string; ogImage?: string; noindex?: boolean };
  settings: any; flowId: string | null; campaignId: string | null;
}
interface Flow { id: string; name: string; isActive: boolean }
interface Camp { id: string; name: string; status: string }
interface Branding { companyName: string | null; primaryColor: string; secondaryColor: string; logoUrl: string | null }

const BLOCK_LIBRARY: { type: Block["type"]; label: string; icon: string; create: () => Block }[] = [
  { type: "header", label: "Cabeçalho", icon: "🎩", create: () => ({ id: rid(), type: "header", props: { logoUrl: null, companyName: "Sua marca", menuLinks: [], ctaLabel: "Falar conosco", ctaHref: "#form" } }) },
  { type: "hero", label: "Hero", icon: "🎯", create: () => ({ id: rid(), type: "hero", props: { eyebrow: "", title: "Título principal de impacto", subtitle: "Subtítulo explicando o valor.", ctaLabel: "Começar agora", ctaHref: "#form", mediaUrl: null, mediaAlt: "", layout: "split" } }) },
  { type: "benefits", label: "Benefícios", icon: "⭐", create: () => ({ id: rid(), type: "benefits", props: { title: "Por que escolher", items: [{ title: "Rápido", description: "Em minutos" }, { title: "Seguro", description: "Padrão enterprise" }, { title: "Suporte", description: "Time dedicado" }] } }) },
  { type: "testimonials", label: "Depoimentos", icon: "💬", create: () => ({ id: rid(), type: "testimonials", props: { title: "O que dizem", items: [{ name: "Cliente", role: "CEO", quote: "Excelente." }] } }) },
  { type: "faq", label: "FAQ", icon: "❓", create: () => ({ id: rid(), type: "faq", props: { title: "Dúvidas comuns", items: [{ question: "Como funciona?", answer: "É simples." }] } }) },
  { type: "video", label: "Vídeo", icon: "▶️", create: () => ({ id: rid(), type: "video", props: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", caption: "" } }) },
  { type: "gallery", label: "Galeria", icon: "🖼️", create: () => ({ id: rid(), type: "gallery", props: { images: [] } }) },
  { type: "countdown", label: "Contagem regressiva", icon: "⏳", create: () => ({ id: rid(), type: "countdown", props: { deadline: new Date(Date.now() + 7 * 86400000).toISOString(), label: "Faltam para começar" } }) },
  { type: "socialProof", label: "Prova social", icon: "🏷️", create: () => ({ id: rid(), type: "socialProof", props: { title: "Empresas que confiam", logos: [] } }) },
  { type: "pricing", label: "Preços", icon: "💲", create: () => ({ id: rid(), type: "pricing", props: { title: "Planos", plans: [{ name: "Starter", price: "R$ 97", period: "/mês", features: ["Item A"], ctaLabel: "Assinar", ctaHref: "#form" }] } }) },
  { type: "richText", label: "Texto rico", icon: "📝", create: () => ({ id: rid(), type: "richText", props: { html: "<p>Edite este texto.</p>" } }) },
  { type: "cta", label: "Chamada (CTA)", icon: "📣", create: () => ({ id: rid(), type: "cta", props: { title: "Pronto para começar?", subtitle: "Aja agora.", ctaLabel: "Começar", ctaHref: "#form" } }) },
  { type: "form", label: "Formulário", icon: "📋", create: () => ({ id: rid(), type: "form", props: { title: "Quero saber mais", submitLabel: "Enviar", successMessage: "Recebido!", flowId: null, campaignId: null, fields: [{ id: rid(), type: "text", name: "nome", label: "Nome", required: true }, { id: rid(), type: "email", name: "email", label: "E-mail", required: true }, { id: rid(), type: "phone", name: "telefone", label: "WhatsApp", required: true }] } }) },
  { type: "calendarEmbed", label: "Agenda", icon: "📅", create: () => ({ id: rid(), type: "calendarEmbed", props: { url: "", height: 700 } }) },
  { type: "rawEmbed", label: "HTML/Embed", icon: "</>", create: () => ({ id: rid(), type: "rawEmbed", props: { html: "" } }) },
  { type: "footer", label: "Rodapé", icon: "📄", create: () => ({ id: rid(), type: "footer", props: { text: "© Sua empresa", links: [] } }) },
];

function rid() { return Math.random().toString(36).slice(2, 10); }

export default function AdminLandingEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: page, isLoading } = useQuery<LP>({ queryKey: [`/api/landing-pages/${id}`] });
  const { data: flows = [] } = useQuery<Flow[]>({ queryKey: ["/api/automation-flows"] });
  const { data: campaigns = [] } = useQuery<Camp[]>({ queryKey: ["/api/campaigns"] });
  const { data: branding } = useQuery<Branding>({ queryKey: ["/api/branding"] });

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seo, setSeo] = useState<LP["seo"]>({});
  const [settings, setSettings] = useState<any>({});
  const [flowId, setFlowId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [tab, setTab] = useState<"blocks" | "page">("blocks");
  const initRef = useRef(false);

  useEffect(() => {
    if (!page || initRef.current) return;
    initRef.current = true;
    setBlocks((page.draftBlocks ?? []) as Block[]);
    setSeo(page.seo ?? {});
    setSettings(page.settings ?? {});
    setFlowId(page.flowId);
    setCampaignId(page.campaignId);
    setName(page.name);
    setSlug(page.slug);
  }, [page]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/landing-pages/${id}`, { name, slug, draftBlocks: blocks, seo, settings, flowId, campaignId });
    },
    onSuccess: () => { toast({ title: "Salvo" }); queryClient.invalidateQueries({ queryKey: [`/api/landing-pages/${id}`] }); queryClient.invalidateQueries({ queryKey: ["/api/landing-pages"] }); },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" }),
  });
  const publish = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/landing-pages/${id}/publish`); },
    onSuccess: () => { toast({ title: "Página publicada" }); queryClient.invalidateQueries({ queryKey: [`/api/landing-pages/${id}`] }); },
    onError: (e: any) => toast({ title: "Erro ao publicar", description: e?.message, variant: "destructive" }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex(b => b.id === active.id);
    const newIdx = blocks.findIndex(b => b.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) setBlocks(arrayMove(blocks, oldIdx, newIdx));
  }

  function addBlock(type: Block["type"]) {
    const def = BLOCK_LIBRARY.find(b => b.type === type);
    if (!def) return;
    const b = def.create();
    setBlocks([...blocks, b]);
    setSelected(b.id);
  }
  function removeBlock(bid: string) { setBlocks(blocks.filter(b => b.id !== bid)); if (selected === bid) setSelected(null); }
  function moveBlock(bid: string, dir: -1 | 1) {
    const i = blocks.findIndex(b => b.id === bid); if (i < 0) return;
    const j = i + dir; if (j < 0 || j >= blocks.length) return;
    setBlocks(arrayMove(blocks, i, j));
  }
  function dupBlock(bid: string) { const b = blocks.find(x => x.id === bid); if (!b) return; const cp = JSON.parse(JSON.stringify(b)); cp.id = rid(); setBlocks([...blocks.slice(0, blocks.indexOf(b) + 1), cp, ...blocks.slice(blocks.indexOf(b) + 1)]); }
  function updateBlock(bid: string, mut: (b: Block) => Block) { setBlocks(blocks.map(b => b.id === bid ? mut(JSON.parse(JSON.stringify(b))) : b)); }

  const selectedBlock = blocks.find(b => b.id === selected);

  if (isLoading || !page) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  const deviceClass = device === "desktop" ? "max-w-full" : device === "tablet" ? "max-w-2xl" : "max-w-sm";
  const brandingData = branding || { companyName: null, primaryColor: "#00A86B", secondaryColor: "#0066CC", logoUrl: null };

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-2">
          <Link href="/admin/landing-pages"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-64 text-sm font-semibold" data-testid="input-page-name" />
          <span className="text-xs text-muted-foreground font-mono">/p/{slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md p-0.5">
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
            <Button variant={device === "tablet" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("tablet")}><Tablet className="h-4 w-4" /></Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
          </div>
          {page.status === "published" && <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline"><Eye className="h-4 w-4 mr-1" /> Abrir</Button></a>}
          <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          <Button size="sm" onClick={async () => { await save.mutateAsync(); publish.mutate(); }} disabled={publish.isPending} data-testid="button-publish"><Send className="h-4 w-4 mr-1" /> Publicar</Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[260px_1fr_320px] overflow-hidden">
        {/* Library */}
        <aside className="border-r bg-card overflow-y-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="blocks" className="flex-1">Blocos</TabsTrigger>
              <TabsTrigger value="page" className="flex-1">Página</TabsTrigger>
            </TabsList>
            <TabsContent value="blocks" className="p-3 space-y-1">
              {BLOCK_LIBRARY.map((b) => (
                <button key={b.type} onClick={() => addBlock(b.type)} className="w-full flex items-center gap-2 rounded-md border bg-background hover:bg-accent px-3 py-2 text-sm" data-testid={`add-block-${b.type}`}>
                  <span className="text-base">{b.icon}</span><span className="flex-1 text-left">{b.label}</span><Plus className="h-3.5 w-3.5 opacity-50" />
                </button>
              ))}
            </TabsContent>
            <TabsContent value="page" className="p-4 space-y-4">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
              <div className="border-t pt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO</div>
                <div><Label>Title</Label><Input value={seo.title || ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={seo.description || ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} rows={3} /></div>
                <div><Label>OG Image (URL)</Label><Input value={seo.ogImage || ""} onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })} /></div>
                <label className="flex items-center justify-between text-sm"><span>Não indexar (noindex)</span><Switch checked={!!seo.noindex} onCheckedChange={(v) => setSeo({ ...seo, noindex: v })} /></label>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integrações padrão</div>
                <div>
                  <Label>Fluxo (todas as conversões)</Label>
                  <Select value={flowId ?? "none"} onValueChange={(v) => setFlowId(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {flows.filter(f => f.isActive).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campanha</Label>
                  <Select value={campaignId ?? "none"} onValueChange={(v) => setCampaignId(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas */}
        <main className="overflow-y-auto bg-muted/30 p-6">
          <div className={`mx-auto bg-background border rounded-lg shadow-sm transition-all ${deviceClass}`}>
            {blocks.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground">
                <p className="mb-3">Sua página está vazia.</p>
                <p className="text-sm">Adicione blocos da biblioteca à esquerda para começar.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((b) => (
                    <SortableBlock key={b.id} block={b} selected={selected === b.id} onSelect={() => setSelected(b.id)} onRemove={() => removeBlock(b.id)} onUp={() => moveBlock(b.id, -1)} onDown={() => moveBlock(b.id, 1)} onDup={() => dupBlock(b.id)}>
                      <BlocksRenderer blocks={[b]} branding={brandingData} />
                    </SortableBlock>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </main>

        {/* Inspector */}
        <aside className="border-l bg-card overflow-y-auto">
          {selectedBlock ? (
            <BlockInspector key={selectedBlock.id} block={selectedBlock} flows={flows} campaigns={campaigns} onChange={(mut) => updateBlock(selectedBlock.id, mut)} />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              <SettingsIcon className="h-8 w-8 mb-2 opacity-30" />
              Selecione um bloco no canvas para editar suas propriedades.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SortableBlock({ block, selected, onSelect, onRemove, onUp, onDown, onDup, children }: { block: Block; selected: boolean; onSelect: () => void; onRemove: () => void; onUp: () => void; onDown: () => void; onDup: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`relative group border-b last:border-b-0 ${selected ? "ring-2 ring-primary" : ""}`} onClick={(e) => { e.stopPropagation(); onSelect(); }} data-testid={`block-${block.type}`}>
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition flex gap-1 bg-background border rounded-md shadow-sm">
        <button {...attributes} {...listeners} className="p-1.5 cursor-grab" title="Arrastar"><GripVertical className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onUp(); }} className="p-1.5" title="Subir"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDown(); }} className="p-1.5" title="Descer"><ChevronDown className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDup(); }} className="p-1.5" title="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 text-destructive" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-wider bg-background border rounded px-2 py-0.5 opacity-0 group-hover:opacity-100">{block.type}</div>
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

function BlockInspector({ block, flows, campaigns, onChange }: { block: Block; flows: Flow[]; campaigns: Camp[]; onChange: (mut: (b: Block) => Block) => void }) {
  const setProp = (key: string, value: any) => onChange((b) => { (b.props as any)[key] = value; return b; });
  const setStyle = (key: string, value: any) => onChange((b) => { (b.style ??= {} as any)[key] = value; return b; });
  return (
    <div className="p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{block.type}</div>
      {renderFields(block, setProp, flows, campaigns)}
      <div className="border-t pt-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estilo</div>
        <div><Label>Espaçamento</Label>
          <Select value={block.style?.paddingY ?? "lg"} onValueChange={(v) => setStyle("paddingY", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="sm">Pequeno</SelectItem><SelectItem value="md">Médio</SelectItem><SelectItem value="lg">Grande</SelectItem><SelectItem value="xl">Extra</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Cor de fundo</Label><Input type="color" value={block.style?.background || "#ffffff"} onChange={(e) => setStyle("background", e.target.value)} /></div>
      </div>
    </div>
  );
}

function renderFields(block: Block, setProp: (k: string, v: any) => void, flows: Flow[], campaigns: Camp[]) {
  const p = block.props;
  switch (block.type) {
    case "header":
      return (
        <>
          <div><Label>Logo (URL)</Label><Input value={p.logoUrl || ""} onChange={(e) => setProp("logoUrl", e.target.value)} /></div>
          <div><Label>Nome da empresa</Label><Input value={p.companyName || ""} onChange={(e) => setProp("companyName", e.target.value)} /></div>
          <div><Label>CTA do topo</Label><Input value={p.ctaLabel || ""} onChange={(e) => setProp("ctaLabel", e.target.value)} /></div>
          <div><Label>Link do CTA</Label><Input value={p.ctaHref || ""} onChange={(e) => setProp("ctaHref", e.target.value)} /></div>
          <ListEditor label="Itens do menu" items={p.menuLinks || []} onChange={(v) => setProp("menuLinks", v)} fields={[{ k: "label", l: "Texto" }, { k: "href", l: "Link" }]} />
        </>
      );
    case "hero":
      return (
        <>
          <div><Label>Selo (eyebrow)</Label><Input value={p.eyebrow || ""} onChange={(e) => setProp("eyebrow", e.target.value)} /></div>
          <div><Label>Título</Label><Textarea value={p.title || ""} onChange={(e) => setProp("title", e.target.value)} rows={2} /></div>
          <div><Label>Subtítulo</Label><Textarea value={p.subtitle || ""} onChange={(e) => setProp("subtitle", e.target.value)} rows={3} /></div>
          <div><Label>CTA</Label><Input value={p.ctaLabel || ""} onChange={(e) => setProp("ctaLabel", e.target.value)} /></div>
          <div><Label>Link do CTA</Label><Input value={p.ctaHref || ""} onChange={(e) => setProp("ctaHref", e.target.value)} /></div>
          <div><Label>Imagem (URL)</Label><Input value={p.mediaUrl || ""} onChange={(e) => setProp("mediaUrl", e.target.value)} /></div>
          <div><Label>Layout</Label>
            <Select value={p.layout || "split"} onValueChange={(v) => setProp("layout", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="split">Texto + imagem</SelectItem><SelectItem value="center">Centralizado</SelectItem></SelectContent>
            </Select>
          </div>
        </>
      );
    case "benefits":
    case "testimonials":
    case "faq":
    case "socialProof":
    case "gallery":
    case "pricing":
      const titleField = "title" in p ? <div><Label>Título</Label><Input value={p.title || ""} onChange={(e) => setProp("title", e.target.value)} /></div> : null;
      const itemFieldsMap: Record<string, { k: string; l: string; type?: "textarea" }[]> = {
        benefits: [{ k: "title", l: "Título" }, { k: "description", l: "Descrição", type: "textarea" }],
        testimonials: [{ k: "name", l: "Nome" }, { k: "role", l: "Cargo" }, { k: "avatarUrl", l: "Avatar URL" }, { k: "quote", l: "Depoimento", type: "textarea" }],
        faq: [{ k: "question", l: "Pergunta" }, { k: "answer", l: "Resposta", type: "textarea" }],
        socialProof: [{ k: "url", l: "Logo URL" }, { k: "alt", l: "Alt" }],
        gallery: [{ k: "url", l: "Imagem URL" }, { k: "alt", l: "Alt" }],
      };
      const listKey = block.type === "pricing" ? "plans" : block.type === "socialProof" ? "logos" : block.type === "gallery" ? "images" : "items";
      if (block.type === "pricing") {
        return <>
          {titleField}
          <ListEditor label="Planos" items={p.plans || []} onChange={(v) => setProp("plans", v)} fields={[{ k: "name", l: "Nome" }, { k: "price", l: "Preço" }, { k: "period", l: "Período" }, { k: "features", l: "Recursos (1 por linha)", type: "textarea" }, { k: "ctaLabel", l: "CTA" }, { k: "ctaHref", l: "Link CTA" }]} />
        </>;
      }
      return <>{titleField}<ListEditor label="Itens" items={(p as any)[listKey] || []} onChange={(v) => setProp(listKey, v)} fields={itemFieldsMap[block.type] || []} /></>;
    case "video":
      return <>
        <div><Label>URL do vídeo (embed)</Label><Input value={p.url || ""} onChange={(e) => setProp("url", e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Use a URL de embed do YouTube/Vimeo.</p></div>
        <div><Label>Legenda</Label><Input value={p.caption || ""} onChange={(e) => setProp("caption", e.target.value)} /></div>
      </>;
    case "countdown":
      return <>
        <div><Label>Data limite</Label><Input type="datetime-local" value={p.deadline ? new Date(p.deadline).toISOString().slice(0, 16) : ""} onChange={(e) => setProp("deadline", new Date(e.target.value).toISOString())} /></div>
        <div><Label>Texto</Label><Input value={p.label || ""} onChange={(e) => setProp("label", e.target.value)} /></div>
      </>;
    case "richText":
      return <div><Label>HTML</Label><Textarea value={p.html || ""} onChange={(e) => setProp("html", e.target.value)} rows={10} className="font-mono text-xs" /></div>;
    case "cta":
      return <>
        <div><Label>Título</Label><Input value={p.title || ""} onChange={(e) => setProp("title", e.target.value)} /></div>
        <div><Label>Subtítulo</Label><Input value={p.subtitle || ""} onChange={(e) => setProp("subtitle", e.target.value)} /></div>
        <div><Label>CTA</Label><Input value={p.ctaLabel || ""} onChange={(e) => setProp("ctaLabel", e.target.value)} /></div>
        <div><Label>Link</Label><Input value={p.ctaHref || ""} onChange={(e) => setProp("ctaHref", e.target.value)} /></div>
      </>;
    case "form":
      return <>
        <div><Label>Título</Label><Input value={p.title || ""} onChange={(e) => setProp("title", e.target.value)} /></div>
        <div><Label>Descrição</Label><Textarea value={p.description || ""} onChange={(e) => setProp("description", e.target.value)} rows={2} /></div>
        <div><Label>Texto do botão</Label><Input value={p.submitLabel || ""} onChange={(e) => setProp("submitLabel", e.target.value)} /></div>
        <div><Label>Mensagem de sucesso</Label><Input value={p.successMessage || ""} onChange={(e) => setProp("successMessage", e.target.value)} /></div>
        <div><Label>Redirecionar após (URL opcional)</Label><Input value={p.redirectUrl || ""} onChange={(e) => setProp("redirectUrl", e.target.value)} /></div>
        <div><Label>Texto LGPD</Label><Input value={p.consentText || ""} onChange={(e) => setProp("consentText", e.target.value)} /></div>
        <div>
          <Label>Fluxo após submit</Label>
          <Select value={p.flowId ?? "none"} onValueChange={(v) => setProp("flowId", v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Usar padrão da página" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Usar padrão da página</SelectItem>{flows.filter(f => f.isActive).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Campanha após submit</Label>
          <Select value={p.campaignId ?? "none"} onValueChange={(v) => setProp("campaignId", v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Usar padrão da página" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Usar padrão da página</SelectItem>{campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="border-t pt-3"><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Campos</div>
          <ListEditor label="" items={p.fields || []} onChange={(v) => setProp("fields", v)} fields={[{ k: "label", l: "Rótulo" }, { k: "name", l: "Nome (chave)" }, { k: "type", l: "Tipo (text/email/phone/textarea/select/checkbox)" }, { k: "placeholder", l: "Placeholder" }, { k: "required", l: "Obrigatório (true/false)" }]} ensureId />
        </div>
      </>;
    case "calendarEmbed":
      return <>
        <div><Label>URL do iframe (Calendly etc.)</Label><Input value={p.url || ""} onChange={(e) => setProp("url", e.target.value)} /></div>
        <div><Label>Altura (px)</Label><Input type="number" value={p.height || 700} onChange={(e) => setProp("height", Number(e.target.value))} /></div>
      </>;
    case "rawEmbed":
      return <div><Label>HTML</Label><Textarea value={p.html || ""} onChange={(e) => setProp("html", e.target.value)} rows={10} className="font-mono text-xs" /><p className="text-xs text-muted-foreground mt-1">⚠️ HTML é sanitizado para evitar scripts maliciosos.</p></div>;
    case "footer":
      return <>
        <div><Label>Texto</Label><Input value={p.text || ""} onChange={(e) => setProp("text", e.target.value)} /></div>
        <ListEditor label="Links" items={p.links || []} onChange={(v) => setProp("links", v)} fields={[{ k: "label", l: "Texto" }, { k: "href", l: "Link" }]} />
      </>;
    default:
      return <div className="text-sm text-muted-foreground">Sem propriedades editáveis.</div>;
  }
}

function ListEditor({ label, items, onChange, fields, ensureId }: { label: string; items: any[]; onChange: (items: any[]) => void; fields: { k: string; l: string; type?: "textarea" }[]; ensureId?: boolean }) {
  function update(i: number, k: string, v: any) {
    const next = [...items]; const cur = { ...(next[i] ?? {}) };
    if (k === "features" && typeof v === "string") cur[k] = v.split("\n").filter(Boolean);
    else if (k === "required") cur[k] = v === "true" || v === true;
    else cur[k] = v;
    next[i] = cur; onChange(next);
  }
  function addItem() { const empty: any = {}; if (ensureId) empty.id = Math.random().toString(36).slice(2, 10); for (const f of fields) empty[f.k] = ""; onChange([...items, empty]); }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)); }
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2">
            {fields.map(f => (
              <div key={f.k}>
                <Label className="text-xs">{f.l}</Label>
                {f.type === "textarea" ? (
                  <Textarea rows={3} value={f.k === "features" && Array.isArray(it[f.k]) ? it[f.k].join("\n") : (it[f.k] ?? "")} onChange={(e) => update(i, f.k, e.target.value)} />
                ) : (
                  <Input value={f.k === "required" ? String(!!it[f.k]) : (it[f.k] ?? "")} onChange={(e) => update(i, f.k, e.target.value)} />
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Remover</Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
    </div>
  );
}
