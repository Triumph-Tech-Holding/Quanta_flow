import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wifi, WifiOff, Settings, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
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

interface ConnectResponse {
  status: string;
  instanceName: string;
  webhookUrl: string;
}

export function ZApiConfig() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<ZApiStatus>({
    queryKey: ["/api/zapi/status"],
  });

  const form = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      instanceId: "",
      token: "",
      clientToken: "",
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (data: ConnectFormData) => {
      const response = await apiRequest("POST", "/api/zapi/connect", data);
      return response.json() as Promise<ConnectResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Conectado!",
        description: `Z-API configurada com sucesso. Status: ${data.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/zapi/disconnect");
    },
    onSuccess: () => {
      toast({
        title: "Desconectado",
        description: "Z-API desconectada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
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
          ? `Todos os webhooks apontando para: ${data.webhookUrl}`
          : `${data.failedCount} webhook(s) falharam`,
        variant: data.failedCount > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar webhooks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ConnectFormData) => {
    connectMutation.mutate(data);
  };

  const copyWebhookUrl = () => {
    if (status?.webhookUrl) {
      navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copiado!",
        description: "URL do webhook copiada para a área de transferência",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.status === "connected";

  return (
    <Card data-testid="card-zapi-config">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Configurar WhatsApp</CardTitle>
          </div>
          <Badge
            variant={isConnected ? "default" : "outline"}
            data-testid="badge-connection-status"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
        <CardDescription>
          Conecte sua conta do WhatsApp usando a Z-API
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Instância: <span className="font-medium">{status?.instanceName}</span>
              </p>
              {status?.webhookUrl && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Webhook URL:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded-md break-all">
                      {status.webhookUrl}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={copyWebhookUrl}
                      data-testid="button-copy-webhook"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => refreshWebhooksMutation.mutate()}
                disabled={refreshWebhooksMutation.isPending}
                data-testid="button-refresh-webhooks"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshWebhooksMutation.isPending ? "animate-spin" : ""}`} />
                Atualizar Webhooks
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Desconectar Z-API
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm space-y-2">
                <p className="font-medium">Como obter as credenciais:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Acesse o painel da Z-API</li>
                  <li>Vá em "Instâncias Web" e selecione sua instância</li>
                  <li>Copie o "ID da instância" e "Token da instância"</li>
                  <li>Vá em "Configurações &gt; Segurança" e copie o "Client-Token"</li>
                </ol>
                <a
                  href="https://app.z-api.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Abrir Z-API <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <FormField
                control={form.control}
                name="instanceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID da Instância</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="3EE4BFCF60BA516A632B0A9F1770609E"
                        {...field}
                        data-testid="input-instance-id"
                      />
                    </FormControl>
                    <FormDescription>
                      Encontrado em "Dados da instância" no painel Z-API
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da Instância</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="8CB19246E7B67A3EE25BDCF4"
                        {...field}
                        data-testid="input-token"
                      />
                    </FormControl>
                    <FormDescription>
                      Token de acesso da sua instância Z-API
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client-Token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Seu Client-Token de segurança"
                        {...field}
                        data-testid="input-client-token"
                      />
                    </FormControl>
                    <FormDescription>
                      Token de segurança - encontrado em "Configurações &gt; Segurança" no painel Z-API
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={connectMutation.isPending}
                data-testid="button-connect"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Conectar Z-API
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
