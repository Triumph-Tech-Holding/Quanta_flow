import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, Loader2, User, MessageCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Message } from "@shared/schema";

interface QuickReply {
  id: string;
  shortcut: string;
  response: string;
  category: string | null;
  isActive: boolean;
}

interface ChatWindowProps {
  conversation: Conversation | null;
}

export function ChatWindow({ conversation }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [showSlashSuggestions, setShowSlashSuggestions] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversation?.id, "messages"],
    enabled: !!conversation?.id,
  });

  const { data: quickReplies } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
  });

  const activeQuickReplies = useMemo(
    () => quickReplies?.filter((qr) => qr.isActive) || [],
    [quickReplies]
  );

  const filteredSlashReplies = useMemo(() => {
    if (!slashFilter) return activeQuickReplies;
    return activeQuickReplies.filter((qr) =>
      qr.shortcut.toLowerCase().includes(slashFilter.toLowerCase())
    );
  }, [activeQuickReplies, slashFilter]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(
        "POST",
        `/api/conversations/${conversation?.id}/messages`,
        { content }
      );
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversation?.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !conversation) return;
    sendMutation.mutate(message);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);

    if (val.startsWith("/")) {
      setShowSlashSuggestions(true);
      setSlashFilter(val.slice(1));
    } else {
      setShowSlashSuggestions(false);
      setSlashFilter("");
    }
  };

  const handleSelectQuickReply = (qr: QuickReply) => {
    setMessage(qr.response);
    setQuickReplyOpen(false);
    setShowSlashSuggestions(false);
    setSlashFilter("");
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (showSlashSuggestions && filteredSlashReplies.length > 0) {
        e.preventDefault();
        handleSelectQuickReply(filteredSlashReplies[0]);
        return;
      }
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && showSlashSuggestions) {
      setShowSlashSuggestions(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="font-medium text-lg">Nenhuma conversa selecionada</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Selecione uma conversa para ver as mensagens
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium" data-testid="text-contact-name">
            {conversation.contactName || conversation.contactPhone || "Desconhecido"}
          </h3>
          <p className="text-xs text-muted-foreground">{conversation.contactPhone}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className="h-16 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        ) : messages?.length ? (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOutgoing = msg.direction === "outgoing";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isOutgoing
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {format(new Date(msg.timestamp), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem nesta conversa
            </p>
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <div className="relative">
          {showSlashSuggestions && filteredSlashReplies.length > 0 && (
            <div
              className="absolute bottom-full left-0 right-0 mb-1 border rounded-md bg-popover text-popover-foreground shadow-md max-h-48 overflow-y-auto z-50"
              data-testid="slash-suggestions"
            >
              {filteredSlashReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => handleSelectQuickReply(qr)}
                  className="w-full text-left px-3 py-2 hover-elevate flex flex-col gap-0.5"
                  data-testid={`slash-suggestion-${qr.id}`}
                >
                  <span className="text-sm font-medium">{qr.shortcut}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {qr.response.length > 60 ? qr.response.slice(0, 60) + "..." : qr.response}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Popover open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  data-testid="button-quick-replies"
                  title="Respostas rápidas"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start" side="top">
                <div className="p-2 border-b">
                  <p className="text-sm font-medium" data-testid="text-quick-replies-title">Respostas Rápidas</p>
                </div>
                <ScrollArea className="max-h-64">
                  {activeQuickReplies.length > 0 ? (
                    <div className="p-1">
                      {activeQuickReplies.map((qr) => (
                        <button
                          key={qr.id}
                          onClick={() => handleSelectQuickReply(qr)}
                          className="w-full text-left px-3 py-2 rounded-md hover-elevate flex flex-col gap-0.5"
                          data-testid={`quick-reply-item-${qr.id}`}
                        >
                          <span className="text-sm font-medium">{qr.shortcut}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {qr.response.length > 80 ? qr.response.slice(0, 80) + "..." : qr.response}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-quick-replies">
                      Nenhuma resposta rápida cadastrada
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem... (/ para atalhos)"
              disabled={sendMutation.isPending}
              data-testid="input-message"
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
              size="icon"
              data-testid="button-send"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
