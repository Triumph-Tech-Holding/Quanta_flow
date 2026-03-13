import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageCircle, Instagram, PlayCircle, Volume2, Zap, CheckCircle2 } from "lucide-react";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Agent {
  id: string;
  name: string;
}

interface FlowTrace {
  blockId: string;
  blockType: string;
  result: string;
  timestamp: string;
}

type ChannelType = "whatsapp" | "instagram";

export default function AdminLab() {
  const { toast } = useToast();
  const [channel, setChannel] = useState<ChannelType>("whatsapp");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [flowTrace, setFlowTrace] = useState<FlowTrace[]>([]);
  const [ttsText, setTtsText] = useState("Olá! Como posso ajudá-lo?");
  const [selectedVoice, setSelectedVoice] = useState<"alloy" | "echo" | "fable">("alloy");
  const [playingAudio, setPlayingAudio] = useState(false);
  const [webhookList, setWebhookList] = useState<any[]>([]);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/admin/agents"],
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["/api/automation/flows"],
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ["/api/settings/webhooks"],
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setWebhookList(webhooks);
  }, [webhooks]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/admin/lab/simulate-chat", {
        agentId: selectedAgentId,
        userMessage: message,
        channel,
      });
      return res.json();
    },
    onSuccess: (data: { reply: string }) => {
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        type: "user",
        content: inputValue,
        timestamp: new Date(),
      };
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        type: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setInputValue("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const simulateFlowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/simulate-flow", {
        flowId: selectedFlowId,
        testData: { nome: "Cliente Teste", telefone: "11999999999", email: "teste@test.com" },
      });
      return res.json();
    },
    onSuccess: (data: { trace: FlowTrace[] }) => {
      setFlowTrace(data.trace);
      toast({ title: "Fluxo simulado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao simular fluxo", description: err.message, variant: "destructive" });
    },
  });

  const ttsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-tts", {
        text: ttsText,
        voice: selectedVoice,
      });
      return res.blob();
    },
    onSuccess: (blob: Blob) => {
      const audio = new Audio(URL.createObjectURL(blob));
      setPlayingAudio(true);
      audio.onended = () => setPlayingAudio(false);
      audio.play();
      toast({ title: "Áudio gerado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar TTS", description: err.message, variant: "destructive" });
    },
  });

  const imageMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/admin/lab/generate-image", {
        prompt,
      });
      return res.json();
    },
    onSuccess: (data: { imageUrl: string }) => {
      toast({ title: "Imagem gerada com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar imagem", description: err.message, variant: "destructive" });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await apiRequest("POST", `/api/settings/webhooks/${webhookId}/test`, {
        testEvent: "lead.created",
      });
      return res.json();
    },
    onSuccess: (data: { status: number; message: string }) => {
      toast({ 
        title: "Webhook testado!", 
        description: `Status: ${data.status}` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao testar webhook", description: err.message, variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || !selectedAgentId) return;
    sendMessageMutation.mutate(inputValue);
  };

  const getChannelIcon = () => {
    return channel === "whatsapp" ? (
      <MessageCircle className="h-4 w-4" />
    ) : (
      <Instagram className="h-4 w-4" />
    );
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Laboratório de Testes</h1>
        </header>

        <main className="flex-1 p-6">
          <Tabs defaultValue="chat" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="flow">Flow</TabsTrigger>
              <TabsTrigger value="tts">TTS</TabsTrigger>
              <TabsTrigger value="image">Imagem IA</TabsTrigger>
              <TabsTrigger value="webhook">Webhooks</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-4">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getChannelIcon()}
                      {channel === "whatsapp" ? "WhatsApp" : "Instagram"} Chat
                    </CardTitle>
                    <div className="flex gap-2">
                      <Select value={channel} onValueChange={(v) => setChannel(v as ChannelType)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Selecione um agente" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Selecione um agente e comece a conversar...
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.type === "user"
                              ? "bg-green-500 text-white rounded-br-none"
                              : "bg-gray-200 text-black rounded-bl-none dark:bg-gray-700 dark:text-white"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                <CardContent className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Digite uma mensagem..."
                      disabled={!selectedAgentId || sendMessageMutation.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!selectedAgentId || !inputValue.trim() || sendMessageMutation.isPending}
                      size="sm"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flow" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Simulador de Fluxos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fluxo para simular" />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.map((flow: any) => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={() => simulateFlowMutation.mutate()} 
                    disabled={!selectedFlowId || simulateFlowMutation.isPending}
                    className="w-full"
                  >
                    {simulateFlowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                    Simular Fluxo
                  </Button>

                  {flowTrace.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h3 className="font-semibold text-sm">Trace de Execução:</h3>
                      {flowTrace.map((trace, idx) => (
                        <div key={idx} className="bg-muted p-3 rounded text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{trace.blockType}: {trace.blockId}</span>
                          </div>
                          <p className="text-muted-foreground">{trace.result}</p>
                          <p className="text-xs text-muted-foreground">{trace.timestamp}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Gerador de Áudio (TTS)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    placeholder="Digite o texto para converter em áudio..."
                    className="w-full p-3 border rounded min-h-24"
                  />
                  
                  <Select value={selectedVoice} onValueChange={(v) => setSelectedVoice(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma voz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alloy">Alloy (Padrão)</SelectItem>
                      <SelectItem value="echo">Echo (Grave)</SelectItem>
                      <SelectItem value="fable">Fable (Narrativa)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button 
                    onClick={() => ttsMutation.mutate()} 
                    disabled={!ttsText.trim() || ttsMutation.isPending || playingAudio}
                    className="w-full"
                  >
                    {ttsMutation.isPending || playingAudio ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Volume2 className="h-4 w-4 mr-2" />
                    )}
                    {playingAudio ? "Reproduzindo..." : "Gerar e Reproduzir Áudio"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="image" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gerador de Imagens (IA)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Descreva a imagem que deseja gerar..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        imageMutation.mutate((e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                  
                  <Button 
                    onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement);
                      if (input?.value) imageMutation.mutate(input.value);
                    }}
                    disabled={imageMutation.isPending}
                    className="w-full"
                  >
                    {imageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Gerar Imagem
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Nota: Geração de imagens utiliza DALL-E 3. Descrições detalhadas geram melhores resultados.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhook" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Teste de Webhooks</CardTitle>
                </CardHeader>
                <CardContent>
                  {webhookList.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum webhook configurado. Configure em Configurações > Webhooks</p>
                  ) : (
                    <div className="space-y-3">
                      {webhookList.map((webhook) => (
                        <div key={webhook.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium text-sm">{webhook.name || webhook.url}</p>
                            <p className="text-xs text-muted-foreground">{webhook.url}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setTestingWebhookId(webhook.id);
                              testWebhookMutation.mutate(webhook.id);
                            }}
                            disabled={testingWebhookId === webhook.id && testWebhookMutation.isPending}
                          >
                            {testingWebhookId === webhook.id && testWebhookMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Testar"
                            )}
                          </Button>
                        </div>
                      ))}
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
