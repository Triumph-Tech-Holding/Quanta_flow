import { useState } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Radio, Instagram, Mail, Info } from "lucide-react";
import { SiTelegram } from "react-icons/si";

// ─── Telegram ─────────────────────────────────────────────────────────────────

function TelegramCard() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [connectionInfo, setConnectionInfo] = useState<{ botName?: string } | null>(null);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/telegram/connect", { botToken });
      return res.json() as Promise<{ ok: boolean; botName?: string; description?: string }>;
    },
    onSuccess: (data) => {
      if (data.ok) {
        setConnectionInfo({ botName: data.botName });
        toast({ title: "Telegram conectado!", description: `Bot: @${data.botName}` });
      } else {
        toast({ title: "Falha ao conectar", description: data.description, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Erro ao conectar Telegram", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <SiTelegram className="h-4 w-4 text-sky-500" />
          Telegram
          {connectionInfo && (
            <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              @{connectionInfo.botName}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Receba e responda mensagens via bot do Telegram, com toda a automação de IA do Quanta Flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Bot Token</Label>
          <Input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            data-testid="input-telegram-token"
          />
          <p className="text-[11px] text-muted-foreground">
            Obtenha o token no <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a> do Telegram.
          </p>
        </div>
        <Button
          onClick={() => connectMutation.mutate()}
          disabled={!botToken.trim() || connectMutation.isPending}
          data-testid="button-connect-telegram"
        >
          {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Conectar bot
        </Button>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1"><Info className="h-3 w-3" /> Como criar um bot:</p>
          <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside">
            <li>Abra o Telegram e procure por <strong>@BotFather</strong></li>
            <li>Envie <code className="bg-muted px-1 rounded">/newbot</code> e siga as instruções</li>
            <li>Copie o token gerado e cole acima</li>
            <li>Clique em "Conectar bot" — o webhook será registrado automaticamente</li>
            <li>Requer que <strong>WEBHOOK_BASE_URL</strong> esteja configurado nas Configurações</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Instagram ────────────────────────────────────────────────────────────────

function InstagramCard() {
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState("");
  const [connected, setConnected] = useState<{ name?: string } | null>(null);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/instagram/connect", { accessToken });
      return res.json() as Promise<{ ok: boolean; name?: string; id?: string }>;
    },
    onSuccess: (data) => {
      if (data.ok) {
        setConnected({ name: data.name });
        toast({ title: "Instagram conectado!", description: `Página: ${data.name}` });
      } else {
        toast({ title: "Falha ao conectar", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Erro ao verificar token", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          Instagram (Meta)
          {connected && (
            <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {connected.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Receba mensagens diretas do Instagram e responda automaticamente via IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Page Access Token</Label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAxxxxxx..."
            data-testid="input-instagram-token"
          />
          <p className="text-[11px] text-muted-foreground">
            Obtenha em: <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-primary underline">Meta for Developers</a>
          </p>
        </div>
        <Button
          onClick={() => connectMutation.mutate()}
          disabled={!accessToken.trim() || connectMutation.isPending}
          data-testid="button-connect-instagram"
        >
          {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Verificar e conectar
        </Button>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1"><Info className="h-3 w-3" /> Configuração Meta:</p>
          <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside">
            <li>Acesse <strong>developers.facebook.com</strong> e crie um app</li>
            <li>Adicione o produto <strong>Instagram Graph API</strong></li>
            <li>Configure webhook com URL: <code className="bg-muted px-1 rounded">/api/webhooks/instagram</code></li>
            <li>Token de verificação: <code className="bg-muted px-1 rounded">quanta_flow_ig</code></li>
            <li>Cole o Page Access Token acima e clique em conectar</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── E-mail ───────────────────────────────────────────────────────────────────

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  imapHost: string;
  imapPort: number;
  isActive: boolean;
}

function EmailCard() {
  const { toast } = useToast();
  const [form, setForm] = useState<EmailConfig>({
    smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "",
    imapHost: "", imapPort: 993, isActive: false,
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: existingConfig } = useQuery<EmailConfig | null>({
    queryKey: ["/api/settings/email"],
    select: (d) => d || null,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/email", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({ title: "Configuração de e-mail salva!" });
    },
    onError: () => toast({ title: "Erro ao salvar configuração", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/email/test", {
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpUser: form.smtpUser,
        smtpPass: form.smtpPass,
      });
      return res.json() as Promise<{ ok: boolean; message: string }>;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.ok) toast({ title: "Conexão SMTP bem-sucedida!" });
      else toast({ title: "Falha na conexão SMTP", description: data.message, variant: "destructive" });
    },
    onError: () => toast({ title: "Erro ao testar conexão", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-500" />
          E-mail (SMTP)
          {existingConfig && (
            <Badge variant="secondary" className="text-[10px]">Configurado</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure envio de e-mails automáticos. Respostas de fluxos serão enviadas por SMTP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Host SMTP</Label>
            <Input value={form.smtpHost} onChange={(e) => setForm((p) => ({ ...p, smtpHost: e.target.value }))}
              placeholder="smtp.gmail.com" data-testid="input-smtp-host" />
          </div>
          <div className="space-y-1.5">
            <Label>Porta SMTP</Label>
            <Input type="number" value={form.smtpPort} onChange={(e) => setForm((p) => ({ ...p, smtpPort: Number(e.target.value) }))}
              placeholder="587" data-testid="input-smtp-port" />
          </div>
          <div className="space-y-1.5">
            <Label>Usuário</Label>
            <Input value={form.smtpUser} onChange={(e) => setForm((p) => ({ ...p, smtpUser: e.target.value }))}
              placeholder="seu@email.com" data-testid="input-smtp-user" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Senha</Label>
            <Input type="password" value={form.smtpPass} onChange={(e) => setForm((p) => ({ ...p, smtpPass: e.target.value }))}
              placeholder="Senha ou App Password" data-testid="input-smtp-pass" />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Host IMAP (opcional)</Label>
            <Input value={form.imapHost} onChange={(e) => setForm((p) => ({ ...p, imapHost: e.target.value }))}
              placeholder="imap.gmail.com" data-testid="input-imap-host" />
          </div>
          <div className="space-y-1.5">
            <Label>Porta IMAP</Label>
            <Input type="number" value={form.imapPort} onChange={(e) => setForm((p) => ({ ...p, imapPort: Number(e.target.value) }))}
              placeholder="993" data-testid="input-imap-port" />
          </div>
        </div>

        {testResult && (
          <div className={`text-xs rounded-lg p-2.5 flex items-center gap-1.5 ${testResult.ok ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}`}>
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            onClick={() => testMutation.mutate()}
            disabled={!form.smtpHost || !form.smtpUser || !form.smtpPass || testMutation.isPending}
            data-testid="button-test-smtp">
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Radio className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.smtpHost || !form.smtpUser || !form.smtpPass || saveMutation.isPending}
            data-testid="button-save-email">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsChannelsPage() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Radio className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Canais de Comunicação</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <TelegramCard />
              <InstagramCard />
              <EmailCard />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
