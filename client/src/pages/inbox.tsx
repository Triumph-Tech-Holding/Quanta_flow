import { useState } from "react";
import { Inbox as InboxIcon, Settings, User, Phone, Mail, Thermometer, ChevronRight, X, MessageSquare } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZApiConfig } from "@/components/inbox/ZApiConfig";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { useSocket } from "@/hooks/useSocket";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { SiWhatsapp, SiInstagram, SiFacebook, SiLinkedin, SiYoutube, SiTiktok } from "react-icons/si";
import type { Conversation } from "@shared/schema";

const STAGE_LABELS: Record<string, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado_ganho: "Fechado Ganho",
  fechado_perdido: "Fechado Perdido",
};

const TEMP_CONFIG: Record<string, { label: string; color: string }> = {
  frio: { label: "Frio", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  morno: { label: "Morno", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  quente: { label: "Quente", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

const CHANNEL_ICONS: Record<string, typeof SiWhatsapp> = {
  whatsapp: SiWhatsapp,
  instagram: SiInstagram,
  facebook: SiFacebook,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  tiktok: SiTiktok,
};

interface UnifiedContactWithDetails {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatarUrl: string | null;
  pipelineStage: string;
  temperature: string;
  lastIntent: string | null;
  notes: string | null;
  tags: string | null;
  score: number;
  lastContactAt: string | null;
  identifiers: Array<{ id: string; channelType: string; identifier: string; displayName: string | null }>;
}

function LeadCardPanel({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { toast } = useToast();
  const phone = conversation.contactPhone;

  const { data: contacts } = useQuery<UnifiedContactWithDetails[]>({
    queryKey: ["/api/crm/contacts"],
  });

  const matchedContact = contacts?.find(
    (c) =>
      (phone && c.telefone && (c.telefone.includes(phone) || phone.includes(c.telefone))) ||
      c.identifiers?.some((i) => i.channelType === "whatsapp" && i.identifier.includes(phone || ""))
  );

  const createContactMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/contacts", {
        nome: conversation.contactName || phone || "Contato",
        telefone: phone,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Contato criado no CRM" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stage: string) => {
      if (!matchedContact) return;
      await apiRequest("PATCH", `/api/crm/contacts/${matchedContact.id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Estágio atualizado" });
    },
  });

  const updateTempMutation = useMutation({
    mutationFn: async (temperature: string) => {
      if (!matchedContact) return;
      await apiRequest("PATCH", `/api/crm/contacts/${matchedContact.id}/temperature`, { temperature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Temperatura atualizada" });
    },
  });

  return (
    <div className="w-72 border-l flex-shrink-0 flex flex-col h-full bg-background" data-testid="lead-card-panel">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <User className="h-4 w-4" />
          Cartão do Lead
        </h3>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-lead-card">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {(conversation.contactName || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold" data-testid="text-lead-name">{conversation.contactName || "Desconhecido"}</p>
            {phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                <Phone className="h-3 w-3" />
                {phone}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {matchedContact ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Temperatura</label>
                <Select
                  value={matchedContact.temperature}
                  onValueChange={(val) => updateTempMutation.mutate(val)}
                  data-testid="select-temperature"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">Frio</SelectItem>
                    <SelectItem value="morno">Morno</SelectItem>
                    <SelectItem value="quente">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estágio</label>
                <Select
                  value={matchedContact.pipelineStage}
                  onValueChange={(val) => updateStageMutation.mutate(val)}
                  data-testid="select-pipeline-stage"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Score</label>
                <p className="text-lg font-bold" data-testid="text-lead-score">{matchedContact.score}</p>
              </div>

              {matchedContact.email && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <p className="text-sm flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {matchedContact.email}
                  </p>
                </div>
              )}

              {matchedContact.lastIntent && matchedContact.lastIntent !== "indefinido" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Última Intenção</label>
                  <Badge variant="outline" data-testid="badge-last-intent">{matchedContact.lastIntent}</Badge>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Canais Conectados</label>
              <div className="flex flex-wrap gap-2">
                {matchedContact.identifiers?.length > 0 ? (
                  matchedContact.identifiers.map((ident) => {
                    const Icon = CHANNEL_ICONS[ident.channelType];
                    return (
                      <Badge key={ident.id} variant="outline" className="gap-1" data-testid={`badge-channel-${ident.channelType}`}>
                        {Icon && <Icon className="h-3 w-3" />}
                        {ident.channelType}
                      </Badge>
                    );
                  })
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <SiWhatsapp className="h-3 w-3" />
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>

            {matchedContact.tags && (
              <>
                <Separator />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {matchedContact.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag.trim()}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center space-y-3 py-4">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este contato ainda não está no CRM.
            </p>
            <Button
              onClick={() => createContactMutation.mutate()}
              disabled={createContactMutation.isPending}
              data-testid="button-add-to-crm"
            >
              {createContactMutation.isPending ? "Adicionando..." : "Adicionar ao CRM"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showLeadCard, setShowLeadCard] = useState(true);
  useSocket();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <InboxIcon className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Inbox</h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedConversation && !showLeadCard && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLeadCard(true)}
                  data-testid="button-show-lead-card"
                >
                  <User className="h-4 w-4 mr-1" />
                  Lead
                </Button>
              )}
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            <Tabs defaultValue="chat" className="h-full flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-auto bg-transparent p-0">
                  <TabsTrigger
                    value="chat"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    data-testid="tab-chat"
                  >
                    Conversas
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    data-testid="tab-settings"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Configurações
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
                <div className="flex h-full">
                  <div className="w-80 border-r flex-shrink-0 overflow-hidden">
                    <ConversationList
                      selectedId={selectedConversation?.id}
                      onSelect={setSelectedConversation}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatWindow conversation={selectedConversation} />
                  </div>
                  {selectedConversation && showLeadCard && (
                    <LeadCardPanel
                      conversation={selectedConversation}
                      onClose={() => setShowLeadCard(false)}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 m-0 p-6 overflow-auto">
                <div className="max-w-xl mx-auto">
                  <ZApiConfig />
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
