import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Palette, CreditCard, Users2, Save, Loader2, Upload, X } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  plan: "free" | "pro" | "business" | "enterprise";
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  timezone: string | null;
  locale: string | null;
  defaultSlaMinutes: number | null;
  role?: string;
}

interface Member {
  userId: string;
  role: "owner" | "admin" | "member";
  nome: string;
  email: string;
  status: string;
  createdAt: string;
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-slate-200 text-slate-800" },
  pro: { label: "Pro", color: "bg-blue-100 text-blue-800" },
  business: { label: "Business", color: "bg-emerald-100 text-emerald-800" },
  enterprise: { label: "Enterprise", color: "bg-purple-100 text-purple-800" },
};

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "UTC",
];

const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];

function ImageField({
  label,
  value,
  onChange,
  testIdPrefix,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  testIdPrefix: string;
}) {
  const { token } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error((await res.json()).message || "Falha no upload");
      const { url } = await res.json();
      onChange(url);
      toast({ title: "Imagem enviada" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Erro no upload", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt={label} className="h-16 w-16 object-contain rounded border" data-testid={`${testIdPrefix}-preview`} />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
              data-testid={`${testIdPrefix}-remove`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="h-16 w-16 rounded border border-dashed flex items-center justify-center text-muted-foreground">
            <Building2 className="h-6 w-6" />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} data-testid={`${testIdPrefix}-input`} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} data-testid={`${testIdPrefix}-upload`}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsCompany() {
  const { toast } = useToast();
  const { data: ws, isLoading } = useQuery<Workspace>({ queryKey: ["/api/workspaces/current"] });
  const { data: membersResp } = useQuery<{ members: Member[]; currentRole: string }>({
    queryKey: ["/api/workspaces", ws?.id, "members"],
    queryFn: async () => (await apiRequest("GET", `/api/workspaces/${ws!.id}/members`)).json(),
    enabled: !!ws?.id,
  });

  const [form, setForm] = useState<Partial<Workspace>>({});
  useEffect(() => { if (ws) setForm(ws); }, [ws]);

  const isAdmin = ws?.role === "owner" || ws?.role === "admin";

  const updateMut = useMutation({
    mutationFn: async (patch: Partial<Workspace>) => {
      const res = await apiRequest("PATCH", `/api/workspaces/${ws!.id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas" });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/workspaces/${ws!.id}/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Membro removido" });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", ws?.id, "members"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/${ws!.id}/members/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Papel atualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", ws?.id, "members"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function saveTab(fields: (keyof Workspace)[]) {
    const patch: Partial<Workspace> = {};
    for (const f of fields) (patch as any)[f] = (form as any)[f];
    updateMut.mutate(patch);
  }

  if (isLoading || !ws) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const planMeta = PLAN_LABELS[ws.plan] ?? PLAN_LABELS.free;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="font-semibold">Configurações da empresa</h1>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            {ws.logoUrl ? (
              <img src={ws.logoUrl} alt={ws.name} className="h-12 w-12 rounded object-contain border" />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><Building2 className="h-6 w-6 text-muted-foreground" /></div>
            )}
            <div>
              <div className="text-xl font-semibold" data-testid="text-workspace-name">{ws.companyName || ws.name}</div>
              <div className="text-sm text-muted-foreground">/{ws.slug} · <Badge className={planMeta.color}>{planMeta.label}</Badge></div>
            </div>
          </div>

          {!isAdmin && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Você é membro deste workspace. Apenas o owner ou administradores podem editar as configurações.
            </div>
          )}

          <Tabs defaultValue="geral" className="w-full">
            <TabsList>
              <TabsTrigger value="geral" data-testid="tab-geral"><Building2 className="h-4 w-4 mr-2" />Geral</TabsTrigger>
              <TabsTrigger value="branding" data-testid="tab-branding"><Palette className="h-4 w-4 mr-2" />Branding</TabsTrigger>
              <TabsTrigger value="plano" data-testid="tab-plano"><CreditCard className="h-4 w-4 mr-2" />Plano</TabsTrigger>
              <TabsTrigger value="membros" data-testid="tab-membros"><Users2 className="h-4 w-4 mr-2" />Membros</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados gerais</CardTitle>
                  <CardDescription>Nome legal, fuso e idioma usados em toda a plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome do workspace</Label>
                      <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isAdmin} data-testid="input-name" />
                    </div>
                    <div>
                      <Label>Razão social / nome legal</Label>
                      <Input value={form.companyName ?? ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} disabled={!isAdmin} data-testid="input-company-name" />
                    </div>
                    <div>
                      <Label>Slug (URL)</Label>
                      <Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={!isAdmin} data-testid="input-slug" />
                    </div>
                    <div>
                      <Label>SLA padrão (minutos)</Label>
                      <Input type="number" value={form.defaultSlaMinutes ?? 60} onChange={(e) => setForm({ ...form, defaultSlaMinutes: Number(e.target.value) })} disabled={!isAdmin} data-testid="input-sla" />
                    </div>
                    <div>
                      <Label>Fuso horário</Label>
                      <Select value={form.timezone ?? "America/Sao_Paulo"} onValueChange={(v) => setForm({ ...form, timezone: v })} disabled={!isAdmin}>
                        <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Idioma</Label>
                      <Select value={form.locale ?? "pt-BR"} onValueChange={(v) => setForm({ ...form, locale: v })} disabled={!isAdmin}>
                        <SelectTrigger data-testid="select-locale"><SelectValue /></SelectTrigger>
                        <SelectContent>{LOCALES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => saveTab(["name", "companyName", "slug", "defaultSlaMinutes", "timezone", "locale"])} disabled={!isAdmin || updateMut.isPending} data-testid="button-save-geral">
                    {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Identidade visual</CardTitle>
                  <CardDescription>Logo, favicon e cores aplicadas no painel do workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageField label="Logo" value={form.logoUrl ?? null} onChange={(u) => setForm({ ...form, logoUrl: u })} testIdPrefix="logo" />
                    <ImageField label="Favicon" value={form.faviconUrl ?? null} onChange={(u) => setForm({ ...form, faviconUrl: u })} testIdPrefix="favicon" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Cor primária</Label>
                      <div className="flex items-center gap-2">
                        <Input type="color" value={form.primaryColor ?? "#00A86B"} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} disabled={!isAdmin} className="w-16 h-10 p-1" data-testid="input-primary-color" />
                        <Input value={form.primaryColor ?? "#00A86B"} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} disabled={!isAdmin} />
                      </div>
                    </div>
                    <div>
                      <Label>Cor secundária</Label>
                      <div className="flex items-center gap-2">
                        <Input type="color" value={form.secondaryColor ?? "#1B3A57"} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} disabled={!isAdmin} className="w-16 h-10 p-1" data-testid="input-secondary-color" />
                        <Input value={form.secondaryColor ?? "#1B3A57"} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} disabled={!isAdmin} />
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => saveTab(["logoUrl", "faviconUrl", "primaryColor", "secondaryColor"])} disabled={!isAdmin || updateMut.isPending} data-testid="button-save-branding">
                    {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plano" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Plano atual</CardTitle>
                  <CardDescription>Limites e recursos do plano contratado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge className={planMeta.color + " text-base px-3 py-1"} data-testid="badge-plan">{planMeta.label}</Badge>
                    <span className="text-sm text-muted-foreground">Para alterar o plano, fale com o suporte.</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="border rounded p-3"><div className="text-muted-foreground">Membros</div><div className="text-lg font-semibold">{membersResp?.members.length ?? 0}</div></div>
                    <div className="border rounded p-3"><div className="text-muted-foreground">SLA padrão</div><div className="text-lg font-semibold">{ws.defaultSlaMinutes ?? 60} min</div></div>
                    <div className="border rounded p-3"><div className="text-muted-foreground">Fuso</div><div className="text-lg font-semibold">{ws.timezone ?? "—"}</div></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="membros" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Membros do workspace</CardTitle>
                  <CardDescription>Pessoas com acesso a este workspace. Convites por e-mail virão na próxima entrega.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(membersResp?.members ?? []).map((m) => {
                        const isOwner = m.userId === ws.ownerUserId;
                        const canEdit = ws.role === "owner" && !isOwner;
                        const canRemove = isAdmin && !isOwner;
                        return (
                          <TableRow key={m.userId} data-testid={`row-member-${m.userId}`}>
                            <TableCell className="font-medium">{m.nome}</TableCell>
                            <TableCell className="text-muted-foreground">{m.email}</TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Select value={m.role} onValueChange={(v) => updateRoleMut.mutate({ userId: m.userId, role: v })}>
                                  <SelectTrigger className="w-32" data-testid={`select-role-${m.userId}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Membro</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline">{isOwner ? "Owner" : m.role === "admin" ? "Admin" : "Membro"}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canRemove ? (
                                <Button variant="ghost" size="sm" onClick={() => removeMemberMut.mutate(m.userId)} data-testid={`button-remove-${m.userId}`}>
                                  Remover
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!membersResp || membersResp.members.length === 0) && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum membro</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
