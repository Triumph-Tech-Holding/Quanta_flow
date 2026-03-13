import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, PlayCircle, Volume2, Zap, CheckCircle2, XCircle,
  Webhook, Smartphone, Image as ImageIcon,
} from "lucide-react";

type TtsVoice = "alloy" | "echo" | "fable";

interface FlowTrace {
  blockId: string;
  blockType: string;
  status: "ok" | "skipped" | "condition_true" | "condition_false" | "would_send";
  result: string;
  wouldSend?: string;
  timestamp: string;
}

interface WebhookTestResult {
  webhookId: string;
  ok: boolean;
  status: number;
}

interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

interface AutomationFlow {
  id: string;
  name: string;
}

export default function AdminLab() {
  const { toast } = useToast();

  // --- Flow Simulator ---
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [flowContactName, setFlowContactName] = useState("Maria Silva");
  const [flowContactPhone, setFlowContactPhone] = useState("11999999999");
  const [flowTriggerMessage, setFlowTriggerMessage] = useState("Olá, tenho interesse!");
  const [flowTrace, setFlowTrace] = useState<FlowTrace[]>([]);

  // --- TTS ---
  const [ttsText, setTtsText] = useState("Olá! Como posso ajudá-lo hoje?");
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>("alloy");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);

  // --- Image AI ---
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // --- Webhook Test ---
  const [webhookResults, setWebhookResults] = useState<Record<string, WebhookTestResult>>({});
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // --- WhatsApp Provider Test ---
  const [wpPhone, setWpPhone] = useState("");
  const [wpMessage, setWpMessage] = useState("Mensagem de teste do Quanta Flow Lab 🧪");
  const [wpResult, setWpResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: flows = [] } = useQuery<AutomationFlow[]>({
    queryKey: ["/api/automation-flows"],
  });

  const { data: outboundWebhooks = [] } = useQuery<OutboundWebhook[]>({
    queryKey: ["/api/webhooks/outbound"],
  });

  // Flow simulation
  const simulateFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/simulate-flow", {
        flowId: selectedFlowId,
        contactName: flowContactName,
        contactPhone: flowContactPhone,
        triggerMessage: flowTriggerMessage,
      });
      return res.json() as Promise<{ trace: FlowTrace[] }>;
    },
    onSuccess: (data) => {
      setFlowTrace(data.trace);
      toast({ title: "Fluxo simulado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao simular fluxo", description: err.message, variant: "destructive" });
    },
  });

  // TTS generation
  const ttsMutation = useMutation({
    mutationFn: async (): Promise<Blob> => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-tts", {
        text: ttsText,
        voice: ttsVoice,
      });
      return res.blob();
    },
    onSuccess: (blob: Blob) => {
      if (ttsAudioUrl) URL.revokeObjectURL(ttsAudioUrl);
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      toast({ title: "Áudio gerado! Use o player abaixo para ouvir." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar TTS", description: err.message, variant: "destructive" });
    },
  });

  // Image generation
  const imageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-image", { prompt: imagePrompt });
      return res.json() as Promise<{ imageUrl: string }>;
    },
    onSuccess: (data) => {
      setGeneratedImageUrl(data.imageUrl);
      toast({ title: "Imagem gerada com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar imagem", description: err.message, variant: "destructive" });
    },
  });

  // Webhook test
  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string): Promise<WebhookTestResult> => {
      const res = await apiRequest("POST", `/api/webhooks/outbound/${webhookId}/test`, {});
      const body = await res.json() as { ok: boolean; status: number };
      return { webhookId, ok: body.ok, status: body.status };
    },
    onSuccess: (data) => {
      setWebhookResults((prev) => ({
        ...prev,
        [data.webhookId]: data,
      }));
      setTestingWebhookId(null);
      toast({
        title: data.ok ? "Webhook OK!" : "Webhook retornou erro",
        description: `HTTP ${data.status}`,
        variant: data.ok ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      setTestingWebhookId(null);
      toast({ title: "Erro ao testar webhook", description: err.message, variant: "destructive" });
    },
  });

  // WhatsApp provider test
  const wpTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/test-whatsapp", {
        phone: wpPhone,
        message: wpMessage,
      });
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      setWpResult(data);
      toast({
        title: data.success ? "Mensagem enviada!" : "Falha no envio",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => {
      if (ttsAudioUrl) URL.revokeObjectURL(ttsAudioUrl);
    };
  }, []);

  const traceStatusIcon = (status: FlowTrace["status"]) => {
    switch (status) {
      case "ok":
      case "would_send":
      case "condition_true":
        return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
      case "skipped":
      case "condition_false":
        return <XCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <div>
            <h1 className="text-lg font-semibold">Laboratório de Testes</h1>
            <p className="text-xs text-muted-foreground">
              Ambiente seguro para testar funcionalidades sem afetar dados reais
            </p>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Tabs defaultValue="flow" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="flow" data-testid="tab-flow">Flow Sim</TabsTrigger>
              <TabsTrigger value="tts" data-testid="tab-tts">TTS</TabsTrigger>
              <TabsTrigger value="image" data-testid="tab-image">Imagem IA</TabsTrigger>
              <TabsTrigger value="webhook" data-testid="tab-webhook">Webhooks</TabsTrigger>
              <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
            </TabsList>

            {/* === FLOW SIMULATOR === */}
            <TabsContent value="flow" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Simulador de Fluxos (Dry-Run)
                  </CardTitle>
                  <CardDescription>
                    Execute um fluxo sem enviar mensagens reais. Veja o trace bloco a bloco.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                    <SelectTrigger data-testid="select-flow">
                      <SelectValue placeholder="Selecione um fluxo para simular" />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.map((flow) => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Nome do contato (fictício)</label>
                      <Input
                        value={flowContactName}
                        onChange={(e) => setFlowContactName(e.target.value)}
                        placeholder="Maria Silva"
                        data-testid="input-flow-contact-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Telefone (fictício)</label>
                      <Input
                        value={flowContactPhone}
                        onChange={(e) => setFlowContactPhone(e.target.value)}
                        placeholder="11999999999"
                        data-testid="input-flow-contact-phone"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Mensagem de trigger (fictícia)</label>
                    <Input
                      value={flowTriggerMessage}
                      onChange={(e) => setFlowTriggerMessage(e.target.value)}
                      placeholder="Olá, tenho interesse!"
                      data-testid="input-flow-trigger"
                    />
                  </div>

                  <Button
                    onClick={() => simulateFlowMutation.mutate()}
                    disabled={!selectedFlowId || simulateFlowMutation.isPending}
                    className="w-full"
                    data-testid="button-simulate-flow"
                  >
                    {simulateFlowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                    Simular Fluxo (Dry-Run)
                  </Button>

                  {flowTrace.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Trace de Execução ({flowTrace.length} blocos):</h3>
                      <ScrollArea className="h-64 border rounded p-2">
                        <div className="space-y-2">
                          {flowTrace.map((trace, idx) => (
                            <div key={idx} className="bg-muted p-3 rounded text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                {traceStatusIcon(trace.status)}
                                <Badge variant="outline" className="text-xs">{trace.blockType}</Badge>
                                <span className="font-mono text-xs text-muted-foreground">{trace.blockId}</span>
                              </div>
                              <p className="text-sm pl-6">{trace.result}</p>
                              {trace.wouldSend && (
                                <div className="pl-6 bg-blue-50 dark:bg-blue-950 p-2 rounded text-xs border border-blue-200 dark:border-blue-800">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">Enviaria: </span>
                                  {trace.wouldSend}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground pl-6">{trace.timestamp}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === TTS === */}
            <TabsContent value="tts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Gerador de Áudio TTS
                  </CardTitle>
                  <CardDescription>
                    Teste como o agente soará via áudio antes de usar em automações.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Texto para converter em áudio</label>
                    <Textarea
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder="Digite o texto para converter em áudio..."
                      className="min-h-24"
                      data-testid="input-tts-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Voz</label>
                    <Select value={ttsVoice} onValueChange={(v) => setTtsVoice(v as TtsVoice)}>
                      <SelectTrigger data-testid="select-tts-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Padrão)</SelectItem>
                        <SelectItem value="echo">Echo (Grave)</SelectItem>
                        <SelectItem value="fable">Fable (Narrativa)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => ttsMutation.mutate()}
                    disabled={!ttsText.trim() || ttsMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-tts"
                  >
                    {ttsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Volume2 className="h-4 w-4 mr-2" />
                    )}
                    Gerar Áudio
                  </Button>

                  {ttsAudioUrl && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Player de Áudio</label>
                      <audio
                        controls
                        src={ttsAudioUrl}
                        className="w-full"
                        data-testid="audio-tts-player"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === IMAGE AI === */}
            <TabsContent value="image" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Gerador de Imagens com IA
                  </CardTitle>
                  <CardDescription>
                    Gere imagens via DALL-E para usar em automações e campanhas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Descrição da imagem (prompt)</label>
                    <Textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Ex: Uma loja moderna de tecnologia com celulares expostos, estilo minimalista, tons de verde e branco"
                      className="min-h-20"
                      data-testid="input-image-prompt"
                    />
                  </div>

                  <Button
                    onClick={() => imageMutation.mutate()}
                    disabled={!imagePrompt.trim() || imageMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-image"
                  >
                    {imageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ImageIcon className="h-4 w-4 mr-2" />
                    )}
                    Gerar Imagem
                  </Button>

                  {generatedImageUrl && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Imagem Gerada</label>
                      <img
                        src={generatedImageUrl}
                        alt="Imagem gerada pela IA"
                        className="w-full rounded-lg border object-contain max-h-96"
                        data-testid="img-generated"
                      />
                      <a
                        href={generatedImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === WEBHOOK TEST === */}
            <TabsContent value="webhook" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Teste de Webhooks Outbound
                  </CardTitle>
                  <CardDescription>
                    Dispare um evento de teste para cada webhook configurado e veja o resultado HTTP.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {outboundWebhooks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum webhook configurado. Configure em Configurações {">"} Webhooks Outbound.
                    </p>
                  ) : (
                    <div className="space-y-3" data-testid="webhook-list">
                      {outboundWebhooks.map((webhook) => {
                        const result = webhookResults[webhook.id];
                        const isTesting = testingWebhookId === webhook.id && testWebhookMutation.isPending;
                        return (
                          <div key={webhook.id} className="border rounded p-3 space-y-2" data-testid={`webhook-item-${webhook.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{webhook.name || "Sem nome"}</p>
                                  <Badge variant={webhook.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                                    {webhook.isActive ? "Ativo" : "Inativo"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2 shrink-0"
                                onClick={() => {
                                  setTestingWebhookId(webhook.id);
                                  testWebhookMutation.mutate(webhook.id);
                                }}
                                disabled={isTesting}
                                data-testid={`button-test-webhook-${webhook.id}`}
                              >
                                {isTesting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Testar"
                                )}
                              </Button>
                            </div>

                            {result && (
                              <div className={`text-xs p-2 rounded border ${result.ok ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`} data-testid={`webhook-result-${webhook.id}`}>
                                <div className="flex items-center gap-1 font-medium">
                                  {result.ok ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-600" />
                                  )}
                                  HTTP {result.status} — {result.ok ? "Sucesso" : "Erro"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === WHATSAPP PROVIDER TEST === */}
            <TabsContent value="whatsapp" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Teste do Provedor WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Envie uma mensagem real para validar se a integração WhatsApp está funcionando.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Número de destino (com DDD e código do país)</label>
                    <Input
                      value={wpPhone}
                      onChange={(e) => setWpPhone(e.target.value)}
                      placeholder="5511999999999"
                      data-testid="input-wp-phone"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Mensagem de teste</label>
                    <Textarea
                      value={wpMessage}
                      onChange={(e) => setWpMessage(e.target.value)}
                      placeholder="Mensagem de teste..."
                      className="min-h-16"
                      data-testid="input-wp-message"
                    />
                  </div>

                  <Button
                    onClick={() => wpTestMutation.mutate()}
                    disabled={!wpPhone.trim() || !wpMessage.trim() || wpTestMutation.isPending}
                    className="w-full"
                    data-testid="button-send-wp-test"
                  >
                    {wpTestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Smartphone className="h-4 w-4 mr-2" />
                    )}
                    Enviar Mensagem de Teste
                  </Button>

                  {wpResult && (
                    <div className={`text-sm p-3 rounded border ${wpResult.success ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`} data-testid="wp-test-result">
                      <div className="flex items-center gap-2">
                        {wpResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">{wpResult.success ? "Enviado com sucesso!" : "Falha no envio"}</span>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{wpResult.message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
