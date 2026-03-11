import { useState } from "react";
import { Inbox as InboxIcon, Settings, User, Phone, Mail, Thermometer, ChevronRight, X, MessageSquare, Zap, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppConnectionPanel } from "@/components/inbox/WhatsAppConnectionPanel";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
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

interface QuickReply {
  id: string;
  userId: string;
  shortcut: string;
  response: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
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

function QuickRepliesManager() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formShortcut, setFormShortcut] = useState("");
  const [formResponse, setFormResponse] = useState("");
  const [formCategory, setFormCategory] = useState("geral");

  const { data: quickReplies, isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { shortcut: string; response: string; category: string }) => {
      const res = await apiRequest("POST", "/api/quick-replies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Resposta rápida criada" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { shortcut?: string; response?: string; category?: string; isActive?: boolean } }) => {
      const res = await apiRequest("PUT", `/api/quick-replies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Resposta rápida atualizada" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quick-replies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Resposta rápida excluída" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingReply(null);
    setFormShortcut("");
    setFormResponse("");
    setFormCategory("geral");
    setDialogOpen(true);
  };

  const openEditDialog = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormShortcut(reply.shortcut);
    setFormResponse(reply.response);
    setFormCategory(reply.category || "geral");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingReply(null);
    setFormShortcut("");
    setFormResponse("");
    setFormCategory("geral");
  };

  const handleSubmit = () => {
    if (!formShortcut.trim() || !formResponse.trim()) return;
    if (editingReply) {
      updateMutation.mutate({
        id: editingReply.id,
        data: { shortcut: formShortcut, response: formResponse, category: formCategory },
      });
    } else {
      createMutation.mutate({ shortcut: formShortcut, response: formResponse, category: formCategory });
    }
  };

  const handleToggleActive = (reply: QuickReply) => {
    updateMutation.mutate({
      id: reply.id,
      data: { isActive: !reply.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-quick-replies-heading">Respostas Rápidas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie atalhos para respostas frequentes
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-quick-reply">
          <Plus className="h-4 w-4 mr-1" />
          Nova Resposta
        </Button>
      </div>

      {quickReplies && quickReplies.length > 0 ? (
        <div className="space-y-2">
          {quickReplies.map((reply) => (
            <Card key={reply.id} className="p-4" data-testid={`quick-reply-card-${reply.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-shortcut-${reply.id}`}>
                      {reply.shortcut}
                    </span>
                    {reply.category && (
                      <Badge variant="outline" data-testid={`badge-category-${reply.id}`}>
                        {reply.category}
                      </Badge>
                    )}
                    <Badge
                      variant={reply.isActive ? "secondary" : "outline"}
                      className={reply.isActive ? "" : "opacity-50"}
                      data-testid={`badge-status-${reply.id}`}
                    >
                      {reply.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate" data-testid={`text-response-preview-${reply.id}`}>
                    {reply.response.length > 100 ? reply.response.slice(0, 100) + "..." : reply.response}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Switch
                    checked={reply.isActive}
                    onCheckedChange={() => handleToggleActive(reply)}
                    data-testid={`switch-active-${reply.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(reply)}
                    data-testid={`button-edit-${reply.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(reply.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${reply.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <div className="flex flex-col items-center text-center gap-2">
            <Zap className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-replies">
              Nenhuma resposta rápida cadastrada
            </p>
            <p className="text-xs text-muted-foreground">
              Crie atalhos para agilizar suas respostas
            </p>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-quick-reply">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingReply ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shortcut">Atalho</Label>
              <Input
                id="shortcut"
                value={formShortcut}
                onChange={(e) => setFormShortcut(e.target.value)}
                placeholder="/ola"
                data-testid="input-shortcut"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="response">Resposta</Label>
              <Textarea
                id="response"
                value={formResponse}
                onChange={(e) => setFormResponse(e.target.value)}
                placeholder="Digite a resposta completa..."
                rows={4}
                data-testid="input-response"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="geral"
                data-testid="input-category"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-dialog">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formShortcut.trim() || !formResponse.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-quick-reply"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {editingReply ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                    value="quick-replies"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    data-testid="tab-quick-replies"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Respostas Rápidas
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

              <TabsContent value="quick-replies" className="flex-1 m-0 p-6 overflow-auto">
                <QuickRepliesManager />
              </TabsContent>

              <TabsContent value="settings" className="flex-1 m-0 p-6 overflow-auto">
                <div className="max-w-xl mx-auto">
                  <WhatsAppConnectionPanel />
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
