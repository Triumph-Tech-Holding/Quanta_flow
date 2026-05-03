import { useState } from "react";
import { Link, useLocation } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, ExternalLink, BarChart3, Trash2, FileText } from "lucide-react";

interface LP {
  id: string; name: string; slug: string; status: "draft" | "published" | "archived";
  publishedAt: string | null; updatedAt: string;
}
interface Tpl { id: string; name: string; description: string }

export default function AdminLandingPages() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [templateId, setTemplateId] = useState<string>("blank");

  const { data: pages = [], isLoading } = useQuery<LP[]>({ queryKey: ["/api/landing-pages"] });
  const { data: templates = [] } = useQuery<Tpl[]>({ queryKey: ["/api/landing-templates"] });

  const create = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/landing-pages", { name, slug, templateId });
      return r.json();
    },
    onSuccess: (p: LP) => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing-pages"] });
      setOpen(false); setName(""); setSlug(""); setTemplateId("blank");
      toast({ title: "Página criada" });
      navigate(`/admin/landing-pages/${p.id}`);
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/landing-pages/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/landing-pages"] }); toast({ title: "Página removida" }); },
  });

  function autoSlug(v: string) {
    return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-3"><SidebarTrigger /><h1 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Landing Pages</h1></div>
          <ThemeToggle />
        </header>
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Crie páginas públicas que captam leads e disparam fluxos automaticamente.</p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button data-testid="button-new-landing"><Plus className="h-4 w-4 mr-2" /> Nova página</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova landing page</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Lançamento Produto X" data-testid="input-landing-name" /></div>
                  <div className="space-y-1"><Label>Slug (URL)</Label><Input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="lancamento-produto-x" data-testid="input-landing-slug" /><p className="text-xs text-muted-foreground">Sua página ficará em <code>/p/{slug || "..."}</code></p></div>
                  <div className="space-y-1"><Label>Template</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {templates.map((t) => (
                        <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} className={`text-left rounded-md border p-3 transition ${templateId === t.id ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`} data-testid={`template-${t.id}`}>
                          <div className="font-semibold text-sm">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => create.mutate()} disabled={!name || !slug || create.isPending} data-testid="button-create-landing">Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground text-sm">Carregando…</div>
          ) : pages.length === 0 ? (
            <Card><CardContent className="py-16 text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Você ainda não tem páginas. Crie sua primeira para começar a captar leads.</p>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Criar primeira página</Button>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pages.map((p) => (
                <Card key={p.id} className="hover-elevate" data-testid={`card-landing-${p.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? "Publicada" : p.status === "draft" ? "Rascunho" : "Arquivada"}</Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">/p/{p.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Link href={`/admin/landing-pages/${p.id}`}><Button size="sm" variant="default"><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button></Link>
                    <Link href={`/admin/landing-pages/${p.id}/metrics`}><Button size="sm" variant="outline"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Métricas</Button></Link>
                    {p.status === "published" && <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir</Button></a>}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover esta página?")) remove.mutate(p.id); }} className="text-destructive ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
