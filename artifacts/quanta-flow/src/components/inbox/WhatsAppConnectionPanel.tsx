import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Wifi, WifiOff, Copy, Check, ExternalLink, RefreshCw, QrCode, Smartphone, Cloud, Globe, RotateCcw,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const connectSchema = z.object({
  instanceId: z.string().min(1, "ID da instância obrigatório"),
  token: z.string().min(1, "Token obrigatório"),
  clientToken: z.string().min(1, "Client-Token obrigatório"),
});

type ConnectFormData = z.infer<typeof connectSchema>;

interface ZApiStatus {
  status: "not_configured" | "disconnected" | "connecting" | "connected";
  instanceName?: string;
  webhookUrl?: string;
}

interface ProviderStatus {
  activeProvider: string;
  connected: boolean;
}

interface QrStatus {
  qrCode: string | null;
  connected: boolean;
  message: string;
  phoneNumber?: string | null;
}

function ZApiSection() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<ZApiStatus>({
    queryKey: ["/api/zapi/status"],
  });

  const form = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
    defaultValues: { instanceId: "", token: "", clientToken: "" },
  });

  const connectMutation = useMutation({
    mutationFn: async (data: ConnectFormData) => {
      const response = await apiRequest("POST", "/api/zapi/connect", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Z-API conectada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-provider"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao conectar Z-API", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/zapi/disconnect"); },
    onSuccess: () => {
      toast({ title: "Z-API desconectada" });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-provider"] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
    },
  });

  const refreshWebhooksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zapi/refresh-webhooks");
      return response.json() as Promise<{ message: string; webhookUrl: string; failedCount: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Webhooks atualizados",
        description: data.failedCount === 0
          ? `Webhooks apontando para: ${data.webhookUrl}`
          : `${data.failedCount} webhook(s) falharam`,
        variant: data.failedCount > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar webhooks", description: error.message, variant: "destructive" });
    },
  });

  const copyWebhookUrl = () => {
    if (status?.webhookUrl) {
      navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "URL copiada!" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const isConnected = status?.status === "connected";

  return (
    <div className="space-y-4">
      {isConnected ? (
        <>
          <div className="flex items-center gap-2 text-green-600">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">Z-API conectada</span>
            {status?.instanceName && (
              <span className="text-sm text-muted-foreground">({status.instanceName})</span>
            )}
          </div>

          {status?.webhookUrl && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Webhook URL:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded-md break-all">
                  {status.webhookUrl}
                </code>
                <Button size="icon" variant="outline" onClick={copyWebhookUrl} data-testid="button-copy-webhook">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshWebhooksMutation.mutate()}
              disabled={refreshWebhooksMutation.isPending}
              data-testid="button-refresh-webhooks"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshWebhooksMutation.isPending ? "animate-spin" : ""}`} />
              Atualizar Webhooks
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-zapi"
            >
              {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Desconectar
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 bg-muted rounded-md text-sm space-y-1">
            <p className="font-medium">Como obter as credenciais Z-API:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Acesse o painel da Z-API</li>
              <li>Vá em "Instâncias Web" e selecione sua instância</li>
              <li>Copie o "ID da instância" e "Token da instância"</li>
              <li>Vá em "Configurações → Segurança" e copie o "Client-Token"</li>
            </ol>
            <a href="https://app.z-api.io/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
              Abrir Z-API <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => connectMutation.mutate(d))} className="space-y-3">
              <FormField control={form.control} name="instanceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>ID da Instância</FormLabel>
                  <FormControl>
                    <Input placeholder="3EE4BFCF60BA516A632B0A9F..." {...field} data-testid="input-instance-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="token" render={({ field }) => (
                <FormItem>
                  <FormLabel>Token da Instância</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="8CB19246E7B67A..." {...field} data-testid="input-token" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clientToken" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client-Token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Seu Client-Token de segurança" {...field} data-testid="input-client-token" />
                  </FormControl>
                  <FormDescription className="text-xs">Encontrado em "Configurações → Segurança" na Z-API</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={connectMutation.isPending} data-testid="button-connect-zapi">
                {connectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conectar Z-API
              </Button>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}

function BaileysSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: qrData, refetch: refetchQr } = useQuery<QrStatus>({
    queryKey: ["/api/whatsapp-local/qrcode"],
    refetchInterval: (query) => {
      const data = query.state.data as QrStatus | undefined;
      return data && !data.connected ? 3000 : false;
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp-local/connect"),
    onSuccess: () => {
      refetchQr();
      toast({ title: "Aguarde o QR Code aparecer abaixo..." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao iniciar", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp-local/disconnect"),
    onSuccess: () => {
      refetchQr();
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-provider"] });
      toast({ title: "WhatsApp Local desconectado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
    },
  });

  const resetSessionMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/whatsapp-local/session"),
    onSuccess: () => {
      toast({ title: "Sessão resetada", description: "Aguarde o novo QR Code aparecer..." });
      setTimeout(() => refetchQr(), 2500);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao resetar sessão", description: error.message, variant: "destructive" });
    },
  });

  const isConnected = qrData?.connected;
  const hasQr = !!qrData?.qrCode;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted rounded-md text-sm space-y-1">
        <p className="font-medium">Conexão direta — sem precisar de API externa</p>
        <p className="text-muted-foreground text-xs">
          Use o QR Code abaixo para conectar seu WhatsApp diretamente, igual ao WhatsApp Web.
          Nenhuma credencial necessária.
        </p>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">WhatsApp Local conectado!</span>
          </div>
          {qrData?.phoneNumber && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Número: <strong className="text-foreground">{qrData.phoneNumber}</strong></span>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            data-testid="button-disconnect-baileys"
          >
            {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Desconectar
          </Button>
        </div>
      ) : hasQr ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">Escaneie o QR Code com seu celular</p>
          <p className="text-xs text-muted-foreground text-center">
            Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho
          </p>
          <div className="flex justify-center">
            <img
              src={qrData.qrCode!}
              alt="QR Code WhatsApp"
              className="w-52 h-52 border-4 border-primary/20 rounded-xl shadow-md"
              data-testid="img-baileys-qrcode"
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs text-muted-foreground">Aguardando scan...</p>
            <Button variant="ghost" size="sm" onClick={() => refetchQr()} data-testid="button-refresh-qr">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4">
          <QrCode className="h-16 w-16 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Clique no botão abaixo para gerar o QR Code e conectar seu WhatsApp
          </p>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending || resetSessionMutation.isPending}
            size="lg"
            className="w-full"
            data-testid="button-generate-qr"
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <QrCode className="h-5 w-5 mr-2" />
            )}
            {connectMutation.isPending ? "Gerando QR Code..." : "Gerar QR Code"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetSessionMutation.mutate()}
            disabled={resetSessionMutation.isPending || connectMutation.isPending}
            className="w-full text-muted-foreground"
            data-testid="button-reset-baileys-session"
          >
            {resetSessionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            {resetSessionMutation.isPending ? "Resetando sessão..." : "Resetar sessão (QR não aparece?)"}
          </Button>
        </div>
      )}
    </div>
  );
}

function MetaSection() {
  const { data: providerData } = useQuery<ProviderStatus>({
    queryKey: ["/api/whatsapp-provider"],
  });

  const isMeta = providerData?.activeProvider === "meta";

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted rounded-md text-sm space-y-1">
        <p className="font-medium">WhatsApp Business Cloud API — API oficial da Meta</p>
        <p className="text-muted-foreground text-xs">
          {isMeta
            ? "A Meta Oficial está ativa. Configure as credenciais na página de Configurações."
            : "Para usar a Meta Oficial, selecione \"Meta Oficial (Cloud API)\" no seletor de provedor em Configurações."}
        </p>
      </div>

      {isMeta && (
        <div className="flex items-center gap-2 text-green-600">
          <Wifi className="h-5 w-5" />
          <span className="font-medium">Meta Oficial ativa</span>
        </div>
      )}

      <a
        href="https://developers.facebook.com/apps/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        data-testid="link-meta-developers"
      >
        Abrir Meta Developers Console <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export function WhatsAppConnectionPanel() {
  const [activeMethod, setActiveMethod] = useState<"baileys" | "zapi" | "meta">("baileys");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: providerData } = useQuery<ProviderStatus>({
    queryKey: ["/api/whatsapp-provider"],
  });

  const { data: zapiStatus } = useQuery<ZApiStatus>({
    queryKey: ["/api/zapi/status"],
  });

  const { data: qrData } = useQuery<QrStatus>({
    queryKey: ["/api/whatsapp-local/qrcode"],
  });

  const isZapiConnected = zapiStatus?.status === "connected";
  const isBaileysConnected = qrData?.connected;
  const isMetaActive = providerData?.activeProvider === "meta";
  const isAnyConnected = isZapiConnected || isBaileysConnected || isMetaActive;

  return (
    <div className="space-y-4" data-testid="panel-whatsapp-connection">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Conectar WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha como deseja conectar seu WhatsApp
          </p>
        </div>
        <Badge
          variant={isAnyConnected ? "default" : "outline"}
          className={isAnyConnected ? "bg-green-500/10 text-green-600 border-green-500/20" : ""}
          data-testid="badge-whatsapp-status"
        >
          {isAnyConnected ? (
            <><Wifi className="h-3 w-3 mr-1" />Conectado</>
          ) : (
            <><WifiOff className="h-3 w-3 mr-1" />Desconectado</>
          )}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setActiveMethod("baileys")}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${
            activeMethod === "baileys"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
          data-testid="button-select-baileys"
        >
          <Smartphone className={`h-8 w-8 ${activeMethod === "baileys" ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className="font-medium text-sm">WhatsApp Local</p>
            <p className="text-xs text-muted-foreground">QR Code direto</p>
          </div>
          {isBaileysConnected && (
            <div className="h-2 w-2 rounded-full bg-green-500 absolute top-2 right-2" />
          )}
        </button>

        <button
          onClick={() => setActiveMethod("zapi")}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${
            activeMethod === "zapi"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
          data-testid="button-select-zapi"
        >
          <Cloud className={`h-8 w-8 ${activeMethod === "zapi" ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className="font-medium text-sm">Z-API (Nuvem)</p>
            <p className="text-xs text-muted-foreground">Via credenciais</p>
          </div>
          {isZapiConnected && (
            <div className="h-2 w-2 rounded-full bg-green-500 absolute top-2 right-2" />
          )}
        </button>

        <button
          onClick={() => setActiveMethod("meta")}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${
            activeMethod === "meta"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
          data-testid="button-select-meta"
        >
          <Globe className={`h-8 w-8 ${activeMethod === "meta" ? "text-primary" : "text-muted-foreground"}`} />
          <div>
            <p className="font-medium text-sm">Meta Oficial</p>
            <p className="text-xs text-muted-foreground">Cloud API</p>
          </div>
          {isMetaActive && (
            <div className="h-2 w-2 rounded-full bg-green-500 absolute top-2 right-2" />
          )}
        </button>
      </div>

      <Separator />

      {activeMethod === "baileys" ? <BaileysSection /> : activeMethod === "zapi" ? <ZApiSection /> : <MetaSection />}
    </div>
  );
}
