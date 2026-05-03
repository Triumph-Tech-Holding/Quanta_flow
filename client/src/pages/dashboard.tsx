import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import {
  Users,
  TrendingUp,
  Flame,
  Snowflake,
  ThermometerSun,
  BarChart3,
  Target,
  ArrowRight,
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  AtSign,
  MessageSquare,
  Brain,
  ShoppingCart,
  HelpCircle,
  AlertTriangle,
  Headphones,
  Star,
  CircleDot,
  Sparkles,
  Clock,
  Zap,
  RefreshCw,
  Loader2,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { QuantaLogo } from "@/components/quanta-logo";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface DashboardStats {
  totalContacts: number;
  temperatureCounts: { frio: number; morno: number; quente: number };
  pipelineCounts: Record<string, number>;
  avgScore: number;
  recentContacts: {
    id: string;
    nome: string;
    pipelineStage: string;
    temperature: string;
    score: number;
    lastIntent: string | null;
    lastContactAt: string | null;
    createdAt: string;
    identifiers?: { channelType: string }[];
  }[];
  intentCounts: Record<string, number>;
  hotLeads: {
    id: string;
    nome: string;
    score: number;
    temperature: string;
    pipelineStage: string;
    lastIntent: string | null;
  }[];
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "novo", label: "Novo", color: "bg-blue-500" },
  { key: "qualificado", label: "Qualificado", color: "bg-amber-500" },
  { key: "proposta", label: "Proposta", color: "bg-violet-500" },
  { key: "negociacao", label: "Negociação", color: "bg-orange-500" },
  { key: "fechado_ganho", label: "Ganho", color: "bg-emerald-500" },
  { key: "fechado_perdido", label: "Perdido", color: "bg-red-500" },
];

const INTENT_CONFIG: Record<string, { label: string; icon: typeof Brain; className: string }> = {
  compra_quente: { label: "Compra", icon: ShoppingCart, className: "text-emerald-600 dark:text-emerald-400" },
  duvida: { label: "Dúvida", icon: HelpCircle, className: "text-blue-600 dark:text-blue-400" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  suporte: { label: "Suporte", icon: Headphones, className: "text-amber-600 dark:text-amber-400" },
  elogio: { label: "Elogio", icon: Star, className: "text-violet-600 dark:text-violet-400" },
  indefinido: { label: "Indefinido", icon: CircleDot, className: "text-muted-foreground" },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getStageLabel(stage: string) {
  return STAGES.find(s => s.key === stage)?.label || stage;
}

function TemperatureBadge({ temp }: { temp: string }) {
  const config: Record<string, { className: string; label: string }> = {
    frio: { className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", label: "Frio" },
    morno: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", label: "Morno" },
    quente: { className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", label: "Quente" },
  };
  const c = config[temp] || config.frio;
  return <Badge variant="outline" className={c.className} data-testid={`badge-temp-${temp}`}>{c.label}</Badge>;
}

function PipelineBar({ pipelineCounts, total }: { pipelineCounts: Record<string, number>; total: number }) {
  if (total === 0) return <div className="h-3 rounded-full bg-muted" />;
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-0.5" data-testid="pipeline-bar">
      {STAGES.map(stage => {
        const count = pipelineCounts[stage.key] || 0;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={stage.key}
            className={`${stage.color} transition-all`}
            style={{ width: `${pct}%`, minWidth: count > 0 ? "4px" : 0 }}
            title={`${stage.label}: ${count}`}
          />
        );
      })}
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

interface BrainAction {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
}

interface BrainPrediction {
  probability: "Alta" | "Media" | "Baixa";
  confidence: number;
  reasoning: string;
}

interface BrainInsight {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  type: string;
  severity: "alta" | "media" | "baixa";
  title: string;
  description: string;
  hoursSinceLastContact: number | null;
  score: number;
  temperature: string;
  lastIntent: string | null;
  pipelineStage: string;
  prediction?: BrainPrediction;
  suggestedActions: BrainAction[];
  generatedAt: string;
}

interface BrainResponse {
  summary: {
    totalInsights: number;
    bySeverity: Record<"alta" | "media" | "baixa", number>;
    byType: Record<string, number>;
    generatedAt: string;
  };
  insights: BrainInsight[];
}

const SEVERITY_STYLE: Record<"alta" | "media" | "baixa", { bg: string; text: string; border: string; label: string }> = {
  alta:  { bg: "bg-red-500/10",    text: "text-red-700 dark:text-red-300",       border: "border-red-500/40",    label: "Crítico" },
  media: { bg: "bg-amber-500/10",  text: "text-amber-700 dark:text-amber-300",   border: "border-amber-500/40",  label: "Atenção" },
  baixa: { bg: "bg-blue-500/10",   text: "text-blue-700 dark:text-blue-300",     border: "border-blue-500/40",   label: "Monitorar" },
};

const PROB_STYLE: Record<"Alta" | "Media" | "Baixa", string> = {
  Alta:  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  Media: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  Baixa: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
};

function BrainInsightsCard() {
  const { toast } = useToast();
  const [withPrediction, setWithPrediction] = useState(false);
  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, BrainPrediction>>({});

  const brainQuery = useQuery<BrainResponse>({
    queryKey: ["/api/brain/insights", { withPrediction }],
    queryFn: async () => {
      const res = await fetch(`/api/brain/insights${withPrediction ? "?withPrediction=true" : ""}`, {
        credentials: "include",
        headers: {
          ...(localStorage.getItem("token") ? { Authorization: `Bearer ${localStorage.getItem("token")}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Falha ao carregar insights");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/brain/insights"] });
    },
    onSuccess: () => toast({ title: "Insights atualizados" }),
  });

  const predictOne = async (contactId: string) => {
    if (predictions[contactId]) return;
    setPredicting(contactId);
    try {
      const res = await apiRequest("GET", `/api/brain/insights/${contactId}/prediction`);
      const pred = await res.json();
      setPredictions(prev => ({ ...prev, [contactId]: pred }));
    } catch (e: any) {
      toast({ title: "Erro ao prever", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setPredicting(null);
    }
  };

  const data = brainQuery.data;
  const insights = data?.insights || [];
  const sev = data?.summary?.bySeverity || { alta: 0, media: 0, baixa: 0 };

  return (
    <Card data-testid="card-brain-insights" className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                IA Brain — Insights
                {brainQuery.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Co-piloto inteligente para o seu funil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={withPrediction ? "default" : "outline"}
              size="sm"
              onClick={() => setWithPrediction(v => !v)}
              data-testid="button-toggle-predictions"
              className="gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              {withPrediction ? "Predições ativas" : "Ativar predições"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={brainQuery.isFetching}
              data-testid="button-refresh-brain"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${brainQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Resumo de severidade */}
        {!brainQuery.isLoading && insights.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(["alta", "media", "baixa"] as const).map(k => {
              const s = SEVERITY_STYLE[k];
              return (
                <div key={k} className={`rounded-md border ${s.border} ${s.bg} px-2 py-1.5`} data-testid={`brain-sev-${k}`}>
                  <div className={`text-xs font-medium ${s.text}`}>{s.label}</div>
                  <div className={`text-lg font-bold ${s.text} tabular-nums`}>{sev[k] || 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {brainQuery.isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : brainQuery.isError ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Erro ao carregar insights. Tente novamente.
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Tudo sob controle!</p>
            <p className="text-xs text-muted-foreground">
              Nenhum lead quente ou de alto score precisando de atenção no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 8).map(ins => {
              const s = SEVERITY_STYLE[ins.severity];
              const pred = ins.prediction || predictions[ins.contactId];
              return (
                <div
                  key={ins.id}
                  className={`rounded-lg border ${s.border} ${s.bg} p-3 space-y-2`}
                  data-testid={`brain-insight-${ins.contactId}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center flex-shrink-0 border border-border">
                        <span className="text-xs font-medium">{ins.contactName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{ins.contactName}</span>
                          <Badge variant="outline" className={`text-[10px] ${s.text} ${s.border}`}>{s.label}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{ins.score} pts</Badge>
                          {ins.hoursSinceLastContact !== null && (
                            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {ins.hoursSinceLastContact}h sem contato
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{ins.description}</p>
                      </div>
                    </div>
                    <Link href={`/crm/contact/${ins.contactId}`}>
                      <Button variant="ghost" size="sm" className="h-7 gap-1" data-testid={`button-open-${ins.contactId}`}>
                        Abrir <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>

                  {/* Predição */}
                  {pred ? (
                    <div className={`rounded-md border ${PROB_STYLE[pred.probability]} px-2 py-1.5 text-xs flex items-start gap-2`}>
                      <Zap className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold">Conversão {pred.probability}</span>
                        <span className="opacity-70"> · {Math.round(pred.confidence * 100)}% conf.</span>
                        <p className="opacity-90 mt-0.5">{pred.reasoning}</p>
                      </div>
                    </div>
                  ) : (
                    !withPrediction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => predictOne(ins.contactId)}
                        disabled={predicting === ins.contactId}
                        className="h-7 text-xs gap-1.5 w-full justify-start text-muted-foreground hover:text-foreground"
                        data-testid={`button-predict-${ins.contactId}`}
                      >
                        {predicting === ins.contactId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Prever conversão com IA
                      </Button>
                    )
                  )}

                  {/* Ações sugeridas */}
                  {ins.suggestedActions.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Ações sugeridas
                      </div>
                      <ul className="space-y-0.5">
                        {ins.suggestedActions.slice(0, 3).map((a, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                            <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                            {a.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
            {insights.length > 8 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                Mostrando 8 de {insights.length} insights
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  useSocket(); // ouve eventos brain:new-insight em tempo real

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ["/api/crm/dashboard"],
  });

  const stats = statsQuery.data;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>

          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <QuantaLogo size="sm" />
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-greeting">
                    {getGreeting()}, {user?.nome?.split(" ")[0] || "Usuário"}!
                  </h1>
                  <p className="text-sm text-muted-foreground" data-testid="text-welcome-message">
                    Painel de controle do seu CRM Omnichannel
                  </p>
                </div>
              </div>
              <Link href="/crm">
                <Button variant="outline" data-testid="button-go-crm">
                  Abrir CRM
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {statsQuery.isLoading ? (
              <StatsLoadingSkeleton />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card data-testid="card-stat-total">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-contacts">{stats?.totalContacts || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">Contatos no CRM</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-stat-hot">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Leads Quentes</CardTitle>
                      <Flame className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-hot-count">
                        {stats?.temperatureCounts.quente || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Prontos para conversão</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-stat-warm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Leads Mornos</CardTitle>
                      <ThermometerSun className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-warm-count">
                        {stats?.temperatureCounts.morno || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Em fase de aquecimento</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-stat-score">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Score Médio</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-avg-score">{stats?.avgScore || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">Pontuação média dos contatos</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card data-testid="card-pipeline-distribution">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        Distribuição do Pipeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <PipelineBar pipelineCounts={stats?.pipelineCounts || {}} total={stats?.totalContacts || 0} />
                      <div className="grid grid-cols-2 gap-2">
                        {STAGES.map(stage => {
                          const count = stats?.pipelineCounts[stage.key] || 0;
                          return (
                            <div key={stage.key} className="flex items-center gap-2" data-testid={`pipeline-stage-${stage.key}`}>
                              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                              <span className="text-sm text-muted-foreground">{stage.label}</span>
                              <span className="text-sm font-medium ml-auto">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-temperature-overview">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        Temperatura dos Leads
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { key: "quente" as const, label: "Quente", icon: Flame, color: "text-red-500", bg: "bg-red-500" },
                        { key: "morno" as const, label: "Morno", icon: ThermometerSun, color: "text-amber-500", bg: "bg-amber-500" },
                        { key: "frio" as const, label: "Frio", icon: Snowflake, color: "text-blue-500", bg: "bg-blue-500" },
                      ].map(temp => {
                        const count = stats?.temperatureCounts[temp.key] || 0;
                        const total = stats?.totalContacts || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={temp.key} className="space-y-1.5" data-testid={`temp-bar-${temp.key}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <temp.icon className={`h-4 w-4 ${temp.color}`} />
                                <span className="text-sm font-medium">{temp.label}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{count} ({stats?.totalContacts ? pct : 0}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${temp.bg} transition-all`}
                                style={{ width: `${stats?.totalContacts ? pct : 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card data-testid="card-intent-distribution">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-muted-foreground" />
                        Intenções Detectadas (IA)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(stats?.intentCounts || {}).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Nenhuma intenção detectada ainda
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(stats?.intentCounts || {})
                            .sort(([, a], [, b]) => b - a)
                            .map(([intent, count]) => {
                              const config = INTENT_CONFIG[intent] || INTENT_CONFIG.indefinido;
                              const Icon = config.icon;
                              return (
                                <div key={intent} className="flex items-center justify-between" data-testid={`intent-${intent}`}>
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${config.className}`} />
                                    <span className="text-sm">{config.label}</span>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-hot-leads">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Flame className="h-4 w-4 text-red-500" />
                        Leads Quentes
                      </CardTitle>
                      <Link href="/crm">
                        <Button variant="ghost" size="sm" data-testid="button-view-all-leads">
                          Ver todos
                        </Button>
                      </Link>
                    </CardHeader>
                    <CardContent>
                      {(stats?.hotLeads?.length || 0) === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Nenhum lead quente ainda
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {stats?.hotLeads.map(lead => (
                            <div key={lead.id} className="flex items-center justify-between" data-testid={`hot-lead-${lead.id}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                    {lead.nome.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{lead.nome}</p>
                                  <p className="text-xs text-muted-foreground">{getStageLabel(lead.pipelineStage)}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {lead.score} pts
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <BrainInsightsCard />

                <Card data-testid="card-recent-contacts">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-base">Contatos Recentes</CardTitle>
                    <Link href="/crm">
                      <Button variant="ghost" size="sm" data-testid="button-view-all-contacts">
                        Ver todos
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {(stats?.recentContacts?.length || 0) === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                        <div>
                          <p className="font-medium">Nenhum contato ainda</p>
                          <p className="text-sm text-muted-foreground">
                            Adicione contatos no CRM ou conecte seu WhatsApp para receber automaticamente
                          </p>
                        </div>
                        <Link href="/crm">
                          <Button variant="outline" size="sm" data-testid="button-add-first-contact">
                            Ir para o CRM
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats?.recentContacts.map(contact => {
                          const intentConfig = contact.lastIntent ? INTENT_CONFIG[contact.lastIntent] : null;
                          return (
                            <div key={contact.id} className="flex items-center justify-between gap-4 py-1.5" data-testid={`recent-contact-${contact.id}`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-medium text-primary">
                                    {contact.nome.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{contact.nome}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{getStageLabel(contact.pipelineStage)}</span>
                                    {intentConfig && (
                                      <>
                                        <span className="text-xs text-muted-foreground">-</span>
                                        <span className={`text-xs ${intentConfig.className}`}>{intentConfig.label}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <TemperatureBadge temp={contact.temperature} />
                                <Badge variant="secondary" className="text-xs">{contact.score} pts</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
