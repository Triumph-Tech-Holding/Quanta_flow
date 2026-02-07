import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Star,
  Trash2,
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  AtSign,
  MessageSquare,
  ShoppingCart,
  HelpCircle,
  AlertTriangle,
  Headphones,
  CircleDot,
  Brain,
  Plus,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  TrendingUp,
  User,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PipelineStage = "novo" | "qualificado" | "proposta" | "negociacao" | "fechado_ganho" | "fechado_perdido";
type Temperature = "frio" | "morno" | "quente";

interface ContactIdentifier {
  id: string;
  channelType: string;
  identifier: string;
  displayName: string | null;
}

interface OmnichannelMessage {
  id: string;
  unifiedContactId: string;
  channelType: string;
  direction: string;
  content: string;
  mediaType: string | null;
  mediaUrl: string | null;
  detectedIntent: string | null;
  intentConfidence: string | null;
  timestamp: string;
}

interface ContactDetail {
  id: string;
  userId: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatarUrl: string | null;
  pipelineStage: PipelineStage;
  temperature: Temperature;
  lastIntent: string | null;
  notes: string | null;
  tags: string | null;
  score: number;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  identifiers: ContactIdentifier[];
  recentMessages: OmnichannelMessage[];
}

const STAGES: { key: PipelineStage; label: string; color: string }[] = [
  { key: "novo", label: "Novo", color: "#3B82F6" },
  { key: "qualificado", label: "Qualificado", color: "#F59E0B" },
  { key: "proposta", label: "Proposta", color: "#8B5CF6" },
  { key: "negociacao", label: "Negociação", color: "#F97316" },
  { key: "fechado_ganho", label: "Fechado Ganho", color: "#10B981" },
  { key: "fechado_perdido", label: "Fechado Perdido", color: "#EF4444" },
];

const TEMPERATURE_CONFIG: Record<Temperature, { label: string; className: string; bgClass: string }> = {
  frio: { label: "Frio", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", bgClass: "bg-blue-500" },
  morno: { label: "Morno", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", bgClass: "bg-amber-500" },
  quente: { label: "Quente", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", bgClass: "bg-red-500" },
};

const INTENT_CONFIG: Record<string, { label: string; icon: typeof Brain; className: string }> = {
  compra_quente: { label: "Compra", icon: ShoppingCart, className: "text-emerald-600 dark:text-emerald-400" },
  duvida: { label: "Dúvida", icon: HelpCircle, className: "text-blue-600 dark:text-blue-400" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  suporte: { label: "Suporte", icon: Headphones, className: "text-amber-600 dark:text-amber-400" },
  elogio: { label: "Elogio", icon: Star, className: "text-violet-600 dark:text-violet-400" },
  indefinido: { label: "Indefinido", icon: CircleDot, className: "text-muted-foreground" },
};

const CHANNEL_TYPES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X (Twitter)" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

function getChannelIcon(channelType: string, size = "h-4 w-4") {
  switch (channelType) {
    case "whatsapp": return <MessageCircle className={size} />;
    case "instagram": return <Instagram className={size} />;
    case "facebook": return <Facebook className={size} />;
    case "linkedin": return <Linkedin className={size} />;
    case "youtube": return <Youtube className={size} />;
    case "email": return <AtSign className={size} />;
    case "sms": return <MessageSquare className={size} />;
    default: return <MessageCircle className={size} />;
  }
}

function getChannelLabel(channelType: string) {
  return CHANNEL_TYPES.find(c => c.value === channelType)?.label || channelType;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d atrás`;
  return formatDateShort(dateStr);
}

function AddChannelDialog({
  contactId,
  open,
  onOpenChange,
}: {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [channelType, setChannelType] = useState("whatsapp");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { channelType, identifier };
      if (displayName) body.displayName = displayName;
      await apiRequest("POST", `/api/crm/contacts/${contactId}/identifiers`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId] });
      toast({ title: "Canal adicionado" });
      setIdentifier("");
      setDisplayName("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar canal", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-channel">
        <DialogHeader>
          <DialogTitle>Adicionar Canal</DialogTitle>
          <DialogDescription>Conecte um novo canal a este contato</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select value={channelType} onValueChange={setChannelType}>
              <SelectTrigger data-testid="select-channel-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Identificador *</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ex: @usuario, +5511999999999"
              data-testid="input-channel-identifier"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Nome no Instagram"
              data-testid="input-channel-display-name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!identifier.trim() || createMutation.isPending}
            data-testid="button-submit-channel"
          >
            {createMutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageTimeline({ messages }: { messages: OmnichannelMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">Nenhuma mensagem registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="message-timeline">
      {messages.map((msg) => {
        const isIncoming = msg.direction === "incoming";
        const intentConfig = msg.detectedIntent ? INTENT_CONFIG[msg.detectedIntent] : null;
        const IntentIcon = intentConfig?.icon;

        return (
          <div key={msg.id} className="flex gap-3" data-testid={`message-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                isIncoming ? "bg-primary/10" : "bg-muted"
              }`}>
                {isIncoming ? (
                  <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">
                  {getChannelIcon(msg.channelType, "h-3 w-3")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getChannelLabel(msg.channelType)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(msg.timestamp)}
                </span>
                {intentConfig && IntentIcon && (
                  <Badge variant="outline" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${intentConfig.className}`}>
                    <IntentIcon className="h-3 w-3 mr-0.5" />
                    {intentConfig.label}
                    {msg.intentConfidence && (
                      <span className="ml-0.5 opacity-70">{Math.round(parseFloat(msg.intentConfidence) * 100)}%</span>
                    )}
                  </Badge>
                )}
              </div>
              <p className={`text-sm ${isIncoming ? "" : "text-muted-foreground"}`}>
                {msg.content}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function ContactProfile() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const contactQuery = useQuery<ContactDetail>({
    queryKey: ["/api/crm/contacts", contactId],
    enabled: !!contactId,
  });

  const messagesQuery = useQuery<OmnichannelMessage[]>({
    queryKey: ["/api/crm/contacts", contactId, "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/contacts/${contactId}/messages?limit=100`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const contact = contactQuery.data;

  useEffect(() => {
    if (contact && !notesInitialized) {
      setEditNotes(contact.notes || "");
      setNotesInitialized(true);
    }
  }, [contact, notesInitialized]);

  const updateContactMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Contato atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stage: PipelineStage) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contactId}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Estágio atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateTempMutation = useMutation({
    mutationFn: async (temperature: Temperature) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contactId}/temperature`, { temperature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Temperatura atualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crm/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Contato excluído" });
      navigate("/crm");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const tempConfig = contact ? TEMPERATURE_CONFIG[contact.temperature] : null;
  const intentConfig = contact?.lastIntent ? INTENT_CONFIG[contact.lastIntent] : null;
  const IntentIcon = intentConfig?.icon;
  const stageInfo = contact ? STAGES.find(s => s.key === contact.pipelineStage) : null;

  const intentSummary = (messagesQuery.data || []).reduce<Record<string, number>>((acc, msg) => {
    if (msg.detectedIntent) {
      acc[msg.detectedIntent] = (acc[msg.detectedIntent] || 0) + 1;
    }
    return acc;
  }, {});

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Link href="/crm">
                <Button variant="ghost" size="icon" data-testid="button-back-crm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <span className="text-lg font-semibold" data-testid="text-page-title">
                Perfil do Contato
              </span>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-y-auto">
            {contactQuery.isLoading ? (
              <ProfileLoadingSkeleton />
            ) : !contact ? (
              <div className="p-6 text-center space-y-4">
                <User className="h-12 w-12 mx-auto text-muted-foreground" />
                <h2 className="text-lg font-semibold">Contato não encontrado</h2>
                <Link href="/crm">
                  <Button variant="outline" data-testid="button-back-to-crm">Voltar ao CRM</Button>
                </Link>
              </div>
            ) : (
              <div className="p-6 space-y-6 max-w-5xl mx-auto">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-primary" data-testid="text-avatar-initial">
                        {contact.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold" data-testid="text-contact-name">{contact.nome}</h1>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`no-default-hover-elevate no-default-active-elevate ${tempConfig?.className}`}
                          data-testid="badge-temperature"
                        >
                          {tempConfig?.label}
                        </Badge>
                        {stageInfo && (
                          <Badge
                            variant="outline"
                            className="no-default-hover-elevate no-default-active-elevate"
                            style={{ borderColor: stageInfo.color, color: stageInfo.color }}
                            data-testid="badge-stage"
                          >
                            {stageInfo.label}
                          </Badge>
                        )}
                        {intentConfig && IntentIcon && (
                          <Badge
                            variant="outline"
                            className={`no-default-hover-elevate no-default-active-elevate ${intentConfig.className}`}
                            data-testid="badge-intent"
                          >
                            <IntentIcon className="h-3 w-3 mr-0.5" />
                            {intentConfig.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-delete-contact"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card data-testid="card-score">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-score">{contact.score}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-messages-count">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-messages-count">
                          {messagesQuery.data?.length || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Mensagens</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-last-contact">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold" data-testid="text-last-contact-time">
                          {timeAgo(contact.lastContactAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">Último contato</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <Card data-testid="card-messages">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          Timeline de Mensagens
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {messagesQuery.isLoading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="flex gap-3">
                                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                                <div className="space-y-2 flex-1">
                                  <Skeleton className="h-3 w-32" />
                                  <Skeleton className="h-4 w-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <MessageTimeline messages={messagesQuery.data || []} />
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card data-testid="card-info">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Informações</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Estágio</Label>
                          <Select
                            value={contact.pipelineStage}
                            onValueChange={(v) => updateStageMutation.mutate(v as PipelineStage)}
                          >
                            <SelectTrigger data-testid="select-profile-stage">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map(s => (
                                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Temperatura</Label>
                          <Select
                            value={contact.temperature}
                            onValueChange={(v) => updateTempMutation.mutate(v as Temperature)}
                          >
                            <SelectTrigger data-testid="select-profile-temperature">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="frio">Frio</SelectItem>
                              <SelectItem value="morno">Morno</SelectItem>
                              <SelectItem value="quente">Quente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <span data-testid="text-profile-email">{contact.email}</span>
                            </div>
                          )}
                          {contact.telefone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4 flex-shrink-0" />
                              <span data-testid="text-profile-phone">{contact.telefone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span data-testid="text-profile-created">
                              Criado em {formatDateShort(contact.createdAt)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-channels">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">Canais Conectados</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAddChannelOpen(true)}
                          data-testid="button-add-channel"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {contact.identifiers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">Nenhum canal conectado</p>
                        ) : (
                          <div className="space-y-2">
                            {contact.identifiers.map(ident => (
                              <div key={ident.id} className="flex items-center gap-2" data-testid={`channel-${ident.channelType}-${ident.id}`}>
                                <span className="text-muted-foreground">{getChannelIcon(ident.channelType)}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{getChannelLabel(ident.channelType)}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {ident.displayName || ident.identifier}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {Object.keys(intentSummary).length > 0 && (
                      <Card data-testid="card-intent-summary">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-muted-foreground" />
                            Intenções (IA)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(intentSummary)
                              .sort(([, a], [, b]) => b - a)
                              .map(([intent, count]) => {
                                const config = INTENT_CONFIG[intent] || INTENT_CONFIG.indefinido;
                                const Icon = config.icon;
                                return (
                                  <div key={intent} className="flex items-center justify-between" data-testid={`intent-summary-${intent}`}>
                                    <div className="flex items-center gap-2">
                                      <Icon className={`h-4 w-4 ${config.className}`} />
                                      <span className="text-sm">{config.label}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                                  </div>
                                );
                              })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card data-testid="card-notes">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Notas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Adicione notas sobre este contato..."
                          className="resize-none"
                          rows={4}
                          data-testid="textarea-profile-notes"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateContactMutation.mutate({ notes: editNotes })}
                          disabled={updateContactMutation.isPending}
                          data-testid="button-save-profile-notes"
                        >
                          {updateContactMutation.isPending ? "Salvando..." : "Salvar Notas"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </main>
        </SidebarInset>
      </div>

      <AddChannelDialog
        contactId={contactId || ""}
        open={addChannelOpen}
        onOpenChange={setAddChannelOpen}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O contato "{contact?.nome}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-profile"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
