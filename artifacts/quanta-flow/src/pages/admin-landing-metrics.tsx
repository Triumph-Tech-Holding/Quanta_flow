import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Eye, MousePointerClick, FileText, Users } from "lucide-react";

interface Metrics { events: { eventType: string; count: number }[]; submissionCount: number; lastSubmissionAt: string | null }
interface Submission { id: string; payload: any; utm: any; createdAt: string; contactId: string | null }

export default function AdminLandingMetrics() {
  const { id } = useParams<{ id: string }>();
  const { data: metrics } = useQuery<Metrics>({ queryKey: [`/api/landing-pages/${id}/metrics`] });
  const { data: subs = [] } = useQuery<Submission[]>({ queryKey: [`/api/landing-pages/${id}/submissions`] });
  const { data: page } = useQuery<{ name: string; slug: string }>({ queryKey: [`/api/landing-pages/${id}`] });

  const find = (t: string) => metrics?.events.find(e => e.eventType === t)?.count ?? 0;
  const views = find("page_view");
  const formViews = find("form_view");
  const ctaClicks = find("cta_click");
  const submits = metrics?.submissionCount ?? 0;
  const conv = views > 0 ? ((submits / views) * 100).toFixed(1) : "0.0";

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-3"><SidebarTrigger />
            <Link href="/admin/landing-pages"><Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
            <h1 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Métricas{page ? ` — ${page.name}` : ""}</h1>
          </div>
          <ThemeToggle />
        </header>
        <main className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat icon={<Eye className="h-4 w-4" />} label="Visualizações" value={views} />
            <Stat icon={<FileText className="h-4 w-4" />} label="Form views" value={formViews} />
            <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Cliques no CTA" value={ctaClicks} />
            <Stat icon={<Users className="h-4 w-4" />} label="Conversões" value={submits} />
            <Stat icon={<BarChart3 className="h-4 w-4" />} label="Taxa de conversão" value={`${conv}%`} />
          </div>

          <Card>
            <CardHeader><CardTitle>Funil</CardTitle><CardDescription>Cada etapa em relação à anterior.</CardDescription></CardHeader>
            <CardContent>
              <Funnel steps={[
                { label: "Visualizações", value: views },
                { label: "Visualizou o formulário", value: formViews },
                { label: "Enviou o formulário", value: submits },
              ]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Últimas conversões</CardTitle></CardHeader>
            <CardContent>
              {subs.length === 0 ? <p className="text-sm text-muted-foreground">Sem conversões ainda.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left border-b"><th className="py-2">Data</th><th>Dados</th><th>Origem</th></tr></thead>
                    <tbody>
                      {subs.slice(0, 25).map(s => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-2 whitespace-nowrap">{new Date(s.createdAt).toLocaleString("pt-BR")}</td>
                          <td className="font-mono text-xs">{Object.entries(s.payload || {}).map(([k, v]) => <div key={k}><b>{k}:</b> {String(v)}</div>)}</td>
                          <td className="text-xs">{s.utm ? Object.entries(s.utm).map(([k, v]) => <div key={k}>{k}={String(v)}</div>) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (<Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">{icon}{label}</div><div className="text-2xl font-bold mt-1">{value}</div></CardContent></Card>);
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map(s => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const rel = i === 0 || steps[i - 1].value === 0 ? 100 : (s.value / steps[i - 1].value) * 100;
        return (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1"><span>{s.label}</span><span className="text-muted-foreground">{s.value} ({rel.toFixed(0)}%)</span></div>
            <div className="h-6 rounded-md bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}
