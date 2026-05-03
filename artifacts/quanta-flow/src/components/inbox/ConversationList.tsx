import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  if (!conversations?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhuma conversa ainda
        </p>
        <p className="text-xs text-muted-foreground">
          As mensagens recebidas aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => {
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
  );
}
