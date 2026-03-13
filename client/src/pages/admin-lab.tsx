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
import { Loader2, Send, MessageCircle, Instagram } from "lucide-react";

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

export default function AdminLab() {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"whatsapp" | "instagram">("whatsapp");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/admin/agents"],
  });

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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
            <TabsList>
              <TabsTrigger value="chat">Chat Simulator</TabsTrigger>
              <TabsTrigger value="flow">Flow Simulator</TabsTrigger>
              <TabsTrigger value="webhook">Webhook Test</TabsTrigger>
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
                      <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
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
                      <div
                        key={msg.id}
                        className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.type === "user"
                              ? "bg-green-500 text-white rounded-br-none"
                              : "bg-gray-200 text-black rounded-bl-none dark:bg-gray-700 dark:text-white"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
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
                  <CardTitle>Flow Simulator</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Simulador de fluxos (em breve)
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhook" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Test</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Teste de webhooks (em breve)
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
