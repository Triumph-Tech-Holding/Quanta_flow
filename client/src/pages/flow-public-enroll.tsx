import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface FlowPublicInfo {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface BrandingData {
  companyName: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

export default function FlowPublicEnroll() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [enrolled, setEnrolled] = useState(false);

  const { data: branding } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
  });

  const { data: flow, isLoading, error } = useQuery<FlowPublicInfo>({
    queryKey: [`/api/public/flow/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/public/flow/${token}`);
      if (!res.ok) throw new Error("Fluxo não encontrado");
      return res.json();
    },
    retry: false,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/flow/${token}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao se inscrever");
      }
      return res.json();
    },
    onSuccess: () => setEnrolled(true),
  });

  const primaryColor = branding?.primaryColor || "#00A86B";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Fluxo não encontrado</h2>
            <p className="text-sm text-muted-foreground text-center">Este link pode estar expirado ou inativo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!flow.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <AlertCircle className="h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-semibold">Fluxo inativo</h2>
            <p className="text-sm text-muted-foreground text-center">Este fluxo está temporariamente inativo. Tente novamente mais tarde.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <CheckCircle className="h-12 w-12" style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold">Inscrição realizada!</h2>
            <p className="text-sm text-muted-foreground text-center">
              Você foi inscrito no fluxo <strong>{flow.name}</strong>. Aguarde o contato pelo WhatsApp.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.companyName || "Logo"} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="flex items-center justify-center gap-1 mb-3">
              <span className="text-xl font-bold" style={{ color: primaryColor }}>{branding?.companyName || "Quanta"}</span>
              <span className="text-xl font-light text-muted-foreground">FLOW</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="h-5 w-5" style={{ color: primaryColor }} />
            <CardTitle className="text-lg">{flow.name}</CardTitle>
          </div>
          {flow.description && (
            <CardDescription>{flow.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enroll-name">Seu nome</Label>
            <Input
              id="enroll-name"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-enroll-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enroll-phone">WhatsApp <span className="text-destructive">*</span></Label>
            <Input
              id="enroll-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-enroll-phone"
              required
            />
          </div>
          {enrollMutation.error && (
            <p className="text-sm text-destructive">{(enrollMutation.error as Error).message}</p>
          )}
          <Button
            className="w-full"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            onClick={() => enrollMutation.mutate()}
            disabled={!phone.trim() || enrollMutation.isPending}
            data-testid="button-enroll-flow"
          >
            {enrollMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inscrevendo...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Participar do Fluxo</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Ao se inscrever, você receberá mensagens automáticas pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
