import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface ScoreRule {
  id: string;
  eventType: string;
  points: number;
  hotThreshold: number;
  warmThreshold: number;
  coolDownDays: number;
  isActive: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  message_received: "Mensagem recebida",
  message_replied: "Resposta enviada",
  link_clicked: "Clique em link",
  form_submitted: "Formulário enviado",
  cta_clicked: "Clique em CTA",
  page_viewed: "Página visualizada",
  learning_delivered: "Microlearning entregue",
  learning_completed: "Microlearning concluído",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  manual_adjust: "Ajuste manual",
};

export default function AdminScoreRules() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<ScoreRule[]>({ queryKey: ["/api/score-rules"] });
  const [edits, setEdits] = useState<Record<string, Partial<ScoreRule>>>({});

  useEffect(() => { setEdits({}); }, [data]);

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<ScoreRule> }) => {
      const res = await apiRequest("PATCH", `/api/score-rules/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Regra salva" });
      queryClient.invalidateQueries({ queryKey: ["/api/score-rules"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao salvar", variant: "destructive" }),
  });

  const setField = (id: string, key: keyof ScoreRule, value: number | boolean) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };
  const valueOf = (r: ScoreRule, key: keyof ScoreRule) => (edits[r.id]?.[key] ?? r[key]) as any;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center border-b px-4 gap-3">
          <SidebarTrigger />
          <div>
            <h1 className="text-lg font-semibold">Motor de Score</h1>
            <p className="text-xs text-muted-foreground">Pontuação dinâmica do comportamento dos contatos</p>
          </div>
        </header>
        <div className="p-6 space-y-4 max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>Regras de pontuação</CardTitle>
              <CardDescription>
                Hot ≥ <strong>limite quente</strong> · Morno ≥ <strong>limite morno</strong> · Janela de cool-down em dias.
                Score é recalculado a cada evento e fica entre 0 e 100.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando regras...</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase text-muted-foreground px-2">
                    <div className="col-span-4">Evento</div>
                    <div className="col-span-2">Pontos</div>
                    <div className="col-span-2">Limite quente</div>
                    <div className="col-span-2">Limite morno</div>
                    <div className="col-span-1">Cool-down</div>
                    <div className="col-span-1 text-right">Ativo</div>
                  </div>
                  {(data ?? []).map((r) => {
                    const dirty = !!edits[r.id];
                    return (
                      <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 bg-card" data-testid={`row-rule-${r.eventType}`}>
                        <div className="col-span-4">
                          <div className="font-medium text-sm">{EVENT_LABELS[r.eventType] ?? r.eventType}</div>
                          <div className="text-[11px] text-muted-foreground">{r.eventType}</div>
                        </div>
                        <div className="col-span-2"><Input type="number" value={valueOf(r, "points")} onChange={(e) => setField(r.id, "points", Number(e.target.value))} data-testid={`input-points-${r.eventType}`} /></div>
                        <div className="col-span-2"><Input type="number" value={valueOf(r, "hotThreshold")} onChange={(e) => setField(r.id, "hotThreshold", Number(e.target.value))} /></div>
                        <div className="col-span-2"><Input type="number" value={valueOf(r, "warmThreshold")} onChange={(e) => setField(r.id, "warmThreshold", Number(e.target.value))} /></div>
                        <div className="col-span-1"><Input type="number" value={valueOf(r, "coolDownDays")} onChange={(e) => setField(r.id, "coolDownDays", Number(e.target.value))} /></div>
                        <div className="col-span-1 flex justify-end items-center gap-2">
                          <Switch checked={valueOf(r, "isActive")} onCheckedChange={(v) => setField(r.id, "isActive", !!v)} />
                          {dirty && (
                            <Button size="icon" variant="outline" onClick={() => updateMut.mutate({ id: r.id, body: edits[r.id] })} data-testid={`button-save-${r.eventType}`}>
                              <Save className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
