import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Award } from "lucide-react";

interface Leader {
  rank: number;
  contactId: string;
  nome: string;
  avatarUrl: string | null;
  points: number;
  completions: number;
  badges: number;
  minutes: number;
  rpm: number;
}

interface OpsSummary {
  days: number;
  sla: { withinSla: number; breached: number; total: number; pct: number | null };
  temperatures: Array<{ temperature: string; count: number }>;
  learning: { delivered: number; completed: number; points: number; minutes: number; rpm: number };
  scoreEvents: Array<{ eventType: string; count: number; points: number }>;
}

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-semibold text-muted-foreground">{rank}</span>;
}

export default function RankingPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery<{ days: number; leaders: Leader[] }>({
    queryKey: ["/api/leaderboard", { days }],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?days=${days}`, { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
      if (!res.ok) throw new Error("Falha ao carregar ranking");
      return res.json();
    },
  });
  const { data: ops } = useQuery<OpsSummary>({
    queryKey: ["/api/ops/summary", { days }],
    queryFn: async () => {
      const res = await fetch(`/api/ops/summary?days=${days}`, { credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
      if (!res.ok) throw new Error("Falha ao carregar resumo");
      return res.json();
    },
  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-lg font-semibold">Ranking & Operação</h1>
              <p className="text-xs text-muted-foreground">Gamificação por consumo de microlearning + saúde da operação</p>
            </div>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32" data-testid="select-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </header>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardDescription>SLA atendido</CardDescription><CardTitle className="text-2xl" data-testid="text-sla-pct">{ops?.sla.pct != null ? `${ops.sla.pct}%` : "—"}</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">{ops ? `${ops.sla.withinSla} dentro / ${ops.sla.breached} estouro` : ""}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Pílulas concluídas</CardDescription><CardTitle className="text-2xl" data-testid="text-completed">{ops?.learning.completed ?? "—"}</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">{ops ? `${ops.learning.delivered} entregues` : ""}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Minutos de conteúdo</CardDescription><CardTitle className="text-2xl">{ops?.learning.minutes ?? "—"}</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">RPM (rendimento/min): {ops?.learning.rpm ?? "—"}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Eventos de score</CardDescription><CardTitle className="text-2xl">{ops?.scoreEvents.reduce((acc, e) => acc + e.count, 0) ?? "—"}</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">{ops?.scoreEvents[0]?.eventType ?? ""}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top consumidores de microlearning</CardTitle>
              <CardDescription>Ranking por pontos acumulados na janela selecionada.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando ranking...</div>
              ) : (data?.leaders ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Ninguém pontuou ainda na janela selecionada.</div>
              ) : (
                <div className="divide-y">
                  {(data?.leaders ?? []).map((l) => (
                    <div key={l.contactId} className="flex items-center gap-4 py-3" data-testid={`row-leader-${l.rank}`}>
                      <div className="w-8 flex justify-center">{rankIcon(l.rank)}</div>
                      <Avatar className="h-9 w-9">
                        {l.avatarUrl ? <AvatarImage src={l.avatarUrl} alt={l.nome} /> : null}
                        <AvatarFallback>{l.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{l.nome}</div>
                        <div className="text-xs text-muted-foreground">{l.completions} pílulas · {l.minutes} min · RPM {l.rpm}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {l.badges > 0 && <Badge variant="secondary">{l.badges} badges</Badge>}
                        <div className="text-right">
                          <div className="text-lg font-bold" data-testid={`text-points-${l.rank}`}>{l.points}</div>
                          <div className="text-[11px] text-muted-foreground">pontos</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
