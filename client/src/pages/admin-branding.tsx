import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, Loader2, Building2, Image, Upload, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface BrandingData {
  companyName: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

function ImageUpload({
  label,
  value,
  onChange,
  previewSize = "h-20 w-20",
  testIdPrefix,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  previewSize?: string;
  testIdPrefix: string;
}) {
  const { token } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro no upload");
      }

      const { url } = await res.json();
      onChange(url);
      toast({ title: "Imagem enviada com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        {value ? (
          <div className="relative group">
            <img
              src={value}
              alt={label}
              className={`${previewSize} object-contain rounded-md border bg-muted/30`}
              onError={(e) => {
                e.currentTarget.src = "";
                e.currentTarget.style.display = "none";
              }}
              data-testid={`${testIdPrefix}-preview`}
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={() => onChange("")}
              data-testid={`${testIdPrefix}-remove`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            className={`${previewSize} rounded-md border border-dashed flex items-center justify-center bg-muted/30 cursor-pointer`}
            onClick={() => fileInputRef.current?.click()}
            data-testid={`${testIdPrefix}-placeholder`}
          >
            <Image className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid={`${testIdPrefix}-file-input`}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid={`${testIdPrefix}-upload-btn`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Enviando..." : "Enviar imagem"}
          </Button>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou cole a URL da imagem"
            className="text-xs"
            data-testid={`${testIdPrefix}-url-input`}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminBranding() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00A86B");
  const [secondaryColor, setSecondaryColor] = useState("#1B3A57");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: branding, isLoading } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
  });

  useEffect(() => {
    if (branding && !initialized) {
      setCompanyName(branding.companyName || "");
      setPrimaryColor(branding.primaryColor || "#00A86B");
      setSecondaryColor(branding.secondaryColor || "#1B3A57");
      setLogoUrl(branding.logoUrl || "");
      setFaviconUrl(branding.faviconUrl || "");
      setInitialized(true);
    }
  }, [branding, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/branding", {
        companyName: companyName || null,
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Branding salvo com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Palette className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Branding</h1>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Identidade da Empresa
                  </CardTitle>
                  <CardDescription>Configure o nome e as cores da sua marca</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nome da Empresa</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Quanta Flow"
                      data-testid="input-company-name"
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Cor Primaria</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="primary-color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-9 w-12 rounded-md border cursor-pointer"
                          data-testid="input-primary-color"
                        />
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#00A86B"
                          className="flex-1"
                          data-testid="input-primary-color-hex"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Cor Secundaria</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="secondary-color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="h-9 w-12 rounded-md border cursor-pointer"
                          data-testid="input-secondary-color"
                        />
                        <Input
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          placeholder="#1B3A57"
                          className="flex-1"
                          data-testid="input-secondary-color-hex"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                    <div
                      className="h-10 w-10 rounded-md border"
                      style={{ backgroundColor: primaryColor }}
                      data-testid="preview-primary"
                    />
                    <div
                      className="h-10 w-10 rounded-md border"
                      style={{ backgroundColor: secondaryColor }}
                      data-testid="preview-secondary"
                    />
                    <span className="text-sm text-muted-foreground">Preview das cores</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Logo e Favicon
                  </CardTitle>
                  <CardDescription>Envie as imagens da sua marca</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ImageUpload
                    label="Logo da Empresa"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    previewSize="h-20 w-48"
                    testIdPrefix="logo"
                  />

                  <Separator />

                  <ImageUpload
                    label="Favicon"
                    value={faviconUrl}
                    onChange={setFaviconUrl}
                    previewSize="h-12 w-12"
                    testIdPrefix="favicon"
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || isLoading}
                  data-testid="button-save-branding"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Branding
                </Button>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
