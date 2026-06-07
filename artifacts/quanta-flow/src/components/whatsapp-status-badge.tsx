import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface ProviderStatus {
  activeProvider: string;
  connected: boolean;
}

export function WhatsAppStatusBadge() {
  const { data } = useQuery<ProviderStatus>({
    queryKey: ["/api/whatsapp-provider"],
    refetchInterval: 30_000,
  });

  const connected = data?.connected ?? false;

  return (
    <Link href="/settings">
      <div
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors"
        title={connected ? "WhatsApp conectado — clique para configurar" : "WhatsApp desconectado — clique para configurar"}
        data-testid="whatsapp-status-badge"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          {connected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          )}
        </span>
        <span className={`text-xs font-medium truncate ${connected ? "text-green-600" : "text-red-500"}`}>
          {connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
        </span>
      </div>
    </Link>
  );
}
