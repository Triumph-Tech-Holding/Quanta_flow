import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wifi, WifiOff, Settings } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QRCodeModal } from "./QRCodeModal";

const connectSchema = z.object({
  evolutionUrl: z.string().url("URL inválida"),
  globalToken: z.string().min(1, "Token obrigatório"),
});

type ConnectFormData = z.infer<typeof connectSchema>;

interface EvolutionStatus {
  status: "not_configured" | "disconnected" | "connecting" | "connected";
  instanceName?: string;
}

interface ConnectResponse {
  instanceName: string;
  qrCode?: string;
  status: string;
}

export function EvolutionConfig() {
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<EvolutionStatus>({
    queryKey: ["/api/evolution/status"],
  });

  const form = useForm<ConnectFormData>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      evolutionUrl: "",
      globalToken: "",
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (data: ConnectFormData) => {
      const response = await apiRequest("POST", "/api/evolution/connect", data);
      return response.json() as Promise<ConnectResponse>;
    },
    onSuccess: (data) => {
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQRModal(true);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/status"] });
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
      await apiRequest("POST", "/api/evolution/disconnect");
    },
    onSuccess: () => {
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/status"] });
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

  const handleSubmit = (data: ConnectFormData) => {
    connectMutation.mutate(data);
  };

  const handleQRModalClose = () => {
    setShowQRModal(false);
    setQrCode(null);
    queryClient.invalidateQueries({ queryKey: ["/api/evolution/status"] });
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
  const isConnecting = status?.status === "connecting";

  return (
    <>
      <Card data-testid="card-evolution-config">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Configurar WhatsApp</CardTitle>
            </div>
            <Badge
              variant={isConnected ? "default" : isConnecting ? "secondary" : "outline"}
              data-testid="badge-connection-status"
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Conectado
                </>
              ) : isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Conectando...
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
            Conecte sua conta do WhatsApp usando a Evolution API v2
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instância: <span className="font-medium">{status?.instanceName}</span>
              </p>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Desconectar WhatsApp
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="evolutionUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Evolution API</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://sua-evolution-api.com"
                          {...field}
                          data-testid="input-evolution-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="globalToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Global Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Seu token de acesso"
                          {...field}
                          data-testid="input-global-token"
                        />
                      </FormControl>
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
                  Conectar WhatsApp
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <QRCodeModal
        isOpen={showQRModal}
        onClose={handleQRModalClose}
        initialQRCode={qrCode}
      />
    </>
  );
}
