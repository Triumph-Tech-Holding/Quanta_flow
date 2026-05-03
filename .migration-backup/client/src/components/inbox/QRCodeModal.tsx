import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQRCode?: string | null;
}

interface EvolutionStatus {
  status: string;
  instanceName?: string;
}

interface QRCodeResponse {
  qrCode: string;
}

export function QRCodeModal({ isOpen, onClose, initialQRCode }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(initialQRCode || null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [expired, setExpired] = useState(false);
  const queryClient = useQueryClient();

  const { data: status } = useQuery<EvolutionStatus>({
    queryKey: ["/api/evolution/status"],
    refetchInterval: isOpen ? 5000 : false,
    enabled: isOpen,
  });

  useEffect(() => {
    if (initialQRCode) {
      setQrCode(initialQRCode);
      setTimeLeft(60);
      setExpired(false);
    }
  }, [initialQRCode]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, qrCode]);

  useEffect(() => {
    if (status?.status === "connected") {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/status"] });
      setTimeout(onClose, 1500);
    }
  }, [status?.status, onClose, queryClient]);

  const refreshQRCode = async () => {
    try {
      const response = await apiRequest("GET", "/api/evolution/qrcode");
      const data = await response.json() as QRCodeResponse;
      setQrCode(data.qrCode);
      setTimeLeft(60);
      setExpired(false);
    } catch (error) {
      console.error("Failed to refresh QR code:", error);
    }
  };

  const isConnected = status?.status === "connected";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="modal-qrcode">
        <DialogHeader>
          <DialogTitle>
            {isConnected ? "WhatsApp Conectado!" : "Escaneie o QR Code"}
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? "Seu WhatsApp foi conectado com sucesso."
              : "Abra o WhatsApp no seu celular e escaneie o código QR abaixo."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4">
          {isConnected ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
            </div>
          ) : expired ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">QR Code expirado</p>
              <Button onClick={refreshQRCode} variant="outline" data-testid="button-refresh-qr">
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar novo QR Code
              </Button>
            </div>
          ) : qrCode ? (
            <>
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                  data-testid="img-qrcode"
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguardando conexão... ({timeLeft}s)</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando QR Code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
