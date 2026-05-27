import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, User, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@shared/schema";

interface CrmContact {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  pipelineStage: string;
  temperature: string;
  lastIntent: string | null;
  score: number;
  identifiers: Array<{ channelType: string; identifier: string }>;
}

const TEMP_DOT_COLORS: Record<string, string> = {
  frio: "bg-blue-500",
  morno: "bg-amber-500",
  quente: "bg-red-500",
};

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: contacts } = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts"],
  });

  const findMatchedContact = (conversation: Conversation): CrmContact | undefined => {
    if (!contacts || !conversation.contactPhone) return undefined;
    const phone = conversation.contactPhone;
    return contacts.find(
      (c) => c.telefone && (c.telefone.includes(phone) || phone.includes(c.telefone))
    );
  };

  const filteredConversations = conversations?.filter((conv) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const nameMatch = (conv.contactName || "").toLowerCase().includes(q);
    const phoneMatch = (conv.contactPhone || "").toLowerCase().includes(q);
    const lastMsgMatch = (conv.lastMessage || "").toLowerCase().includes(q);
    return nameMatch || phoneMatch || lastMsgMatch;
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar conversa..."
            className="pl-8 pr-8 h-8 text-sm"
            data-testid="input-search-conversations"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!filteredConversations?.length ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
          </p>
          {!searchTerm && (
            <p className="text-xs text-muted-foreground">
              As mensagens recebidas aparecerão aqui
            </p>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => {
              const isSelected = selectedId === conversation.id;
              const unreadCount = parseInt(conversation.unreadCount || "0");
              const matchedContact = findMatchedContact(conversation);

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover-elevate ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                  data-testid={`conversation-item-${conversation.id}`}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {matchedContact && TEMP_DOT_COLORS[matchedContact.temperature] && (
                          <span
                            className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${TEMP_DOT_COLORS[matchedContact.temperature]}`}
                            data-testid={`dot-temperature-${conversation.id}`}
                            title={matchedContact.temperature}
                          />
                        )}
                        <span className="font-medium truncate" data-testid={`text-contact-name-${conversation.id}`}>
                          {conversation.contactName || conversation.contactPhone || "Desconhecido"}
                        </span>
                        {matchedContact && matchedContact.score > 0 && (
                          <Badge variant="secondary" className="flex-shrink-0 text-xs" data-testid={`badge-score-${conversation.id}`}>
                            {matchedContact.score}
                          </Badge>
                        )}
                      </div>
                      {conversation.lastMessageAt && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessage || "Sem mensagens"}
                        </p>
                        {matchedContact && matchedContact.lastIntent && matchedContact.lastIntent !== "indefinido" && (
                          <Badge variant="outline" className="flex-shrink-0 text-xs" data-testid={`badge-intent-${conversation.id}`}>
                            {matchedContact.lastIntent}
                          </Badge>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <Badge variant="default" className="flex-shrink-0" data-testid={`badge-unread-${conversation.id}`}>
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
