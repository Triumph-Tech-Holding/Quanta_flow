import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Phone,
  Mail,
  Calendar,
  Star,
  Trash2,
  GripVertical,
  MessageCircle,
  UserCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  AtSign,
  MessageSquare,
  Search,
  Filter,
  ShoppingCart,
  HelpCircle,
  AlertTriangle,
  Headphones,
  CircleDot,
  Brain,
  ExternalLink,
  X,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
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

interface UnifiedContact {
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
  assignedToUserId: string | null;
  assignedAgent?: { nome: string; email: string } | null;
}

const STAGES: { key: PipelineStage; label: string; color: string }[] = [
  { key: "novo", label: "Novo", color: "#3B82F6" },
  { key: "qualificado", label: "Qualificado", color: "#F59E0B" },
  { key: "proposta", label: "Proposta", color: "#8B5CF6" },
  { key: "negociacao", label: "Negociação", color: "#F97316" },
  { key: "fechado_ganho", label: "Fechado Ganho", color: "#10B981" },
  { key: "fechado_perdido", label: "Fechado Perdido", color: "#EF4444" },
];

const TEMPERATURE_CONFIG: Record<Temperature, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  frio: { label: "Frio", variant: "secondary", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  morno: { label: "Morno", variant: "secondary", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  quente: { label: "Quente", variant: "secondary", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

const INTENT_CONFIG: Record<string, { label: string; icon: typeof Brain; className: string }> = {
  compra_quente: { label: "Compra", icon: ShoppingCart, className: "text-emerald-600 dark:text-emerald-400" },
  duvida: { label: "Dúvida", icon: HelpCircle, className: "text-blue-600 dark:text-blue-400" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  suporte: { label: "Suporte", icon: Headphones, className: "text-amber-600 dark:text-amber-400" },
  elogio: { label: "Elogio", icon: Star, className: "text-violet-600 dark:text-violet-400" },
  indefinido: { label: "Indefinido", icon: CircleDot, className: "text-muted-foreground" },
};

function getChannelIcon(channelType: string) {
  switch (channelType) {
    case "whatsapp": return <MessageCircle className="h-3 w-3" />;
    case "instagram": return <Instagram className="h-3 w-3" />;
    case "facebook": return <Facebook className="h-3 w-3" />;
    case "linkedin": return <Linkedin className="h-3 w-3" />;
    case "youtube": return <Youtube className="h-3 w-3" />;
    case "email": return <AtSign className="h-3 w-3" />;
    case "sms": return <MessageSquare className="h-3 w-3" />;
    default: return <MessageCircle className="h-3 w-3" />;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ContactCard({
  contact,
  onDragStart,
  onClick,
}: {
  contact: UnifiedContact;
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onClick: () => void;
}) {
  const tempConfig = TEMPERATURE_CONFIG[contact.temperature];
  const intentConfig = contact.lastIntent ? INTENT_CONFIG[contact.lastIntent] : null;
  const IntentIcon = intentConfig?.icon;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, contact.id)}
      onClick={onClick}
      className="cursor-grab active:cursor-grabbing hover-elevate transition-all"
      data-testid={`card-contact-${contact.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm truncate" data-testid={`text-contact-name-${contact.id}`}>
              {contact.nome}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] flex-shrink-0 no-default-hover-elevate no-default-active-elevate ${tempConfig.className}`}
            data-testid={`badge-temperature-${contact.id}`}
          >
            {tempConfig.label}
          </Badge>
        </div>

        {intentConfig && IntentIcon && (
          <div className="flex items-center gap-1.5">
            <IntentIcon className={`h-3 w-3 ${intentConfig.className}`} />
            <span className={`text-[11px] ${intentConfig.className}`} data-testid={`text-intent-${contact.id}`}>
              {intentConfig.label}
            </span>
          </div>
        )}

        <div className="space-y-1">
          {contact.telefone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate" data-testid={`text-phone-${contact.id}`}>{contact.telefone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate" data-testid={`text-email-${contact.id}`}>{contact.email}</span>
            </div>
          )}
        </div>

        {contact.assignedToUserId && contact.assignedAgent && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`badge-agent-${contact.id}`}>
            <UserCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{contact.assignedAgent.nome}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {contact.identifiers?.map((ident) => (
              <span
                key={ident.id}
                className="text-muted-foreground"
                title={`${ident.channelType}: ${ident.identifier}`}
                data-testid={`icon-channel-${ident.channelType}-${contact.id}`}
              >
                {getChannelIcon(ident.channelType)}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {contact.lastContactAt && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1" data-testid={`text-last-contact-${contact.id}`}>
                <Calendar className="h-3 w-3" />
                {formatDate(contact.lastContactAt)}
              </span>
            )}
            {contact.score > 0 && (
              <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`badge-score-${contact.id}`}>
                <Star className="h-3 w-3 mr-0.5" />
                {contact.score}
              </Badge>
            )}
            {(contact as any).queueStatus === "waiting" && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-queue-${contact.id}`}>
                Aguardando
              </Badge>
            )}
            {(contact as any).queueStatus === "assigned" && (
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-queue-${contact.id}`}>
                Atribuído
              </Badge>
            )}
            {(contact as any).slaBreached && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 border-red-300 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-sla-${contact.id}`}>
                ⚠️ SLA
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  stage,
  contacts,
  onDragStart,
  onDrop,
  onCardClick,
  dragOverStage,
  onDragOver,
  onDragLeave,
}: {
  stage: (typeof STAGES)[number];
  contacts: UnifiedContact[];
  onDragStart: (e: React.DragEvent, contactId: string) => void;
  onDrop: (e: React.DragEvent, targetStage: PipelineStage) => void;
  onCardClick: (contact: UnifiedContact) => void;
  dragOverStage: PipelineStage | null;
  onDragOver: (e: React.DragEvent, stage: PipelineStage) => void;
  onDragLeave: () => void;
}) {
  const isDragOver = dragOverStage === stage.key;
  const totalScore = contacts.reduce((sum, c) => sum + c.score, 0);

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] rounded-md border transition-colors ${
        isDragOver ? "bg-accent/50 border-accent" : "bg-muted/30"
      }`}
      onDragOver={(e) => onDragOver(e, stage.key)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.key)}
      data-testid={`column-${stage.key}`}
    >
      <div
        className="p-3 rounded-t-md border-b"
        style={{ borderTopWidth: 3, borderTopColor: stage.color }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">{stage.label}</span>
          <div className="flex items-center gap-1.5">
            {totalScore > 0 && (
              <span className="text-[10px] text-muted-foreground" data-testid={`score-total-${stage.key}`}>
                {totalScore} pts
              </span>
            )}
            <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid={`badge-count-${stage.key}`}>
              {contacts.length}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground" data-testid={`empty-column-${stage.key}`}>
            Nenhum contato
          </div>
        ) : (
          contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onDragStart={onDragStart}
              onClick={() => onCardClick(contact)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("novo");
  const [temperature, setTemperature] = useState<Temperature>("frio");

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { nome, pipelineStage, temperature };
      if (email) body.email = email;
      if (telefone) body.telefone = telefone;
      await apiRequest("POST", "/api/crm/contacts", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Contato criado com sucesso" });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar contato", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNome("");
    setEmail("");
    setTelefone("");
    setPipelineStage("novo");
    setTemperature("frio");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-contact">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
          <DialogDescription>Adicione um novo contato ao pipeline</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do contato"
              data-testid="input-nome"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55 (11) 99999-9999"
              data-testid="input-telefone"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estágio</Label>
              <Select value={pipelineStage} onValueChange={(v) => setPipelineStage(v as PipelineStage)}>
                <SelectTrigger data-testid="select-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key} data-testid={`option-stage-${s.key}`}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Select value={temperature} onValueChange={(v) => setTemperature(v as Temperature)}>
                <SelectTrigger data-testid="select-temperature">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frio">Frio</SelectItem>
                  <SelectItem value="morno">Morno</SelectItem>
                  <SelectItem value="quente">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add">
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!nome.trim() || createMutation.isPending}
            data-testid="button-submit-add"
          >
            {createMutation.isPending ? "Criando..." : "Criar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactDetailDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: UnifiedContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [editNotes, setEditNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState<Temperature>("frio");
  const [selectedStage, setSelectedStage] = useState<PipelineStage>("novo");

  const detailQuery = useQuery<UnifiedContact>({
    queryKey: ["/api/crm/contacts", contact?.id],
    enabled: !!contact?.id && open,
  });

  const activeContact = detailQuery.data || contact;

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && contact) {
      setEditNotes(contact.notes || "");
      setSelectedTemp(contact.temperature);
      setSelectedStage(contact.pipelineStage);
    }
    onOpenChange(isOpen);
  }, [contact, onOpenChange]);

  const updateTemperatureMutation = useMutation({
    mutationFn: async (temperature: Temperature) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contact?.id}/temperature`, { temperature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Temperatura atualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar temperatura", description: error.message, variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stage: PipelineStage) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contact?.id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Estágio atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar estágio", description: error.message, variant: "destructive" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("PATCH", `/api/crm/contacts/${contact?.id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Notas salvas" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar notas", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/crm/contacts/${contact?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
      toast({ title: "Contato excluído" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir contato", description: error.message, variant: "destructive" });
    },
  });

  if (!contact) return null;

  const intentConfig = activeContact?.lastIntent ? INTENT_CONFIG[activeContact.lastIntent] : null;
  const IntentIcon = intentConfig?.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg" data-testid="dialog-contact-detail">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle data-testid="text-detail-name">{activeContact?.nome}</DialogTitle>
              <Link href={`/crm/contact/${contact.id}`}>
                <Button variant="ghost" size="icon" title="Ver perfil completo" data-testid="button-view-profile">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <DialogDescription>Detalhes do contato</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estágio</Label>
                <Select
                  value={selectedStage}
                  onValueChange={(v) => {
                    const stage = v as PipelineStage;
                    setSelectedStage(stage);
                    updateStageMutation.mutate(stage);
                  }}
                >
                  <SelectTrigger data-testid="select-detail-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Select
                  value={selectedTemp}
                  onValueChange={(v) => {
                    const temp = v as Temperature;
                    setSelectedTemp(temp);
                    updateTemperatureMutation.mutate(temp);
                  }}
                >
                  <SelectTrigger data-testid="select-detail-temperature">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">Frio</SelectItem>
                    <SelectItem value="morno">Morno</SelectItem>
                    <SelectItem value="quente">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              {activeContact?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span data-testid="text-detail-email">{activeContact.email}</span>
                </div>
              )}
              {activeContact?.telefone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span data-testid="text-detail-phone">{activeContact.telefone}</span>
                </div>
              )}
              {activeContact?.lastContactAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span data-testid="text-detail-last-contact">
                    Último contato: {formatDate(activeContact.lastContactAt)}
                  </span>
                </div>
              )}
              {activeContact?.score !== undefined && activeContact.score > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="h-4 w-4 flex-shrink-0" />
                  <span data-testid="text-detail-score">Score: {activeContact.score}</span>
                </div>
              )}
              {intentConfig && IntentIcon && (
                <div className="flex items-center gap-2">
                  <IntentIcon className={`h-4 w-4 flex-shrink-0 ${intentConfig.className}`} />
                  <span className={`${intentConfig.className}`} data-testid="text-detail-intent">
                    Intenção: {intentConfig.label}
                  </span>
                </div>
              )}
            </div>

            {activeContact?.identifiers && activeContact.identifiers.length > 0 && (
              <div className="space-y-2">
                <Label>Canais</Label>
                <div className="flex flex-wrap gap-2">
                  {activeContact.identifiers.map((ident) => (
                    <Badge
                      key={ident.id}
                      variant="outline"
                      className="no-default-hover-elevate no-default-active-elevate"
                      data-testid={`badge-channel-${ident.channelType}-${ident.id}`}
                    >
                      {getChannelIcon(ident.channelType)}
                      <span className="ml-1 text-xs">{ident.displayName || ident.identifier}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Adicione notas sobre este contato..."
                className="resize-none"
                rows={3}
                data-testid="textarea-notes"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateNotesMutation.mutate(editNotes)}
                disabled={updateNotesMutation.isPending}
                data-testid="button-save-notes"
              >
                {updateNotesMutation.isPending ? "Salvando..." : "Salvar Notas"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-contact"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-detail">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O contato "{contact.nome}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-4 p-4 overflow-x-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="min-w-[280px] w-[280px] space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function CrmPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<UnifiedContact | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTemp, setFilterTemp] = useState<Temperature | "all">("all");
  const [filterIntent, setFilterIntent] = useState<string>("all");

  const contactsQuery = useQuery<UnifiedContact[]>({
    queryKey: ["/api/crm/contacts"],
  });

  const filteredContacts = useMemo(() => {
    if (!contactsQuery.data) return [];
    let results = contactsQuery.data;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefone?.includes(q)
      );
    }

    if (filterTemp !== "all") {
      results = results.filter(c => c.temperature === filterTemp);
    }

    if (filterIntent !== "all") {
      results = results.filter(c => c.lastIntent === filterIntent);
    }

    return results;
  }, [contactsQuery.data, searchQuery, filterTemp, filterIntent]);

  const hasActiveFilters = searchQuery.trim() !== "" || filterTemp !== "all" || filterIntent !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterTemp("all");
    setFilterIntent("all");
  };

  const moveStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      await apiRequest("PATCH", `/api/crm/contacts/${id}/stage`, { stage });
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/contacts"] });
      const previousContacts = queryClient.getQueryData<UnifiedContact[]>(["/api/crm/contacts"]);
      queryClient.setQueryData<UnifiedContact[]>(["/api/crm/contacts"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, pipelineStage: stage } : c))
      );
      return { previousContacts };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(["/api/crm/contacts"], context.previousContacts);
      }
      toast({ title: "Erro ao mover contato", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard"] });
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent, contactId: string) => {
    e.dataTransfer.setData("contactId", contactId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStage: PipelineStage) => {
      e.preventDefault();
      setDragOverStage(null);
      const contactId = e.dataTransfer.getData("contactId");
      if (!contactId) return;

      const contacts = contactsQuery.data || [];
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact || contact.pipelineStage === targetStage) return;

      moveStageMutation.mutate({ id: contactId, stage: targetStage });
    },
    [contactsQuery.data, moveStageMutation]
  );

  const handleCardClick = useCallback((contact: UnifiedContact) => {
    setDetailContact(contact);
    setDetailDialogOpen(true);
  }, []);

  const contactsByStage = (stage: PipelineStage): UnifiedContact[] => {
    return filteredContacts.filter((c) => c.pipelineStage === stage);
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Users className="h-5 w-5" />
              <h1 className="text-lg font-semibold" data-testid="text-page-title">CRM Pipeline</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Contato
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <div className="flex items-center gap-2 px-4 py-2 border-b bg-background flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={filterTemp} onValueChange={(v) => setFilterTemp(v as Temperature | "all")}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-temp">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="morno">Morno</SelectItem>
                <SelectItem value="frio">Frio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterIntent} onValueChange={(v) => setFilterIntent(v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-intent">
                <SelectValue placeholder="Intenção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="compra_quente">Compra</SelectItem>
                <SelectItem value="duvida">Dúvida</SelectItem>
                <SelectItem value="reclamacao">Reclamação</SelectItem>
                <SelectItem value="suporte">Suporte</SelectItem>
                <SelectItem value="elogio">Elogio</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            {hasActiveFilters && (
              <span className="text-xs text-muted-foreground" data-testid="text-filter-count">
                {filteredContacts.length} contato{filteredContacts.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <main className="flex-1 overflow-x-auto overflow-y-hidden">
            {contactsQuery.isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="flex gap-4 p-4 h-full" data-testid="kanban-board">
                {STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage.key}
                    stage={stage}
                    contacts={contactsByStage(stage.key)}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onCardClick={handleCardClick}
                    dragOverStage={dragOverStage}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  />
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>

      <AddContactDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <ContactDetailDialog
        contact={detailContact}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </SidebarProvider>
  );
}
