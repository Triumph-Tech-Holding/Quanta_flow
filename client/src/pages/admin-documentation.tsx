import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Presentation,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const createDocSchema = z.object({
  version: z.string().min(1, "Versão obrigatória"),
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().optional(),
});

type CreateDocForm = z.infer<typeof createDocSchema>;

interface DocumentationVersion {
  id: string;
  version: string;
  title: string;
  description?: string;
  content: string;
  format: string;
  createdAt: string;
  updatedAt: string;
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let key = 0;
  let inCode = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let isFirstTableRow = true;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    elements.push(
      <div key={key++} className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              {tableRows[0].map((cell, ci) => (
                <th key={ci} className="border border-border px-3 py-2 text-left font-semibold">
                  {cell.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(2).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/40"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-border px-3 py-2">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
    isFirstTableRow = true;
  };

  const applyInline = (text: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let k = 0;
    while (remaining.length > 0) {
      const boldIdx = remaining.indexOf("**");
      const codeIdx = remaining.indexOf("`");
      const first =
        boldIdx === -1 && codeIdx === -1
          ? -1
          : boldIdx === -1
          ? codeIdx
          : codeIdx === -1
          ? boldIdx
          : Math.min(boldIdx, codeIdx);
      if (first === -1) {
        parts.push(remaining);
        break;
      }
      if (first > 0) parts.push(remaining.slice(0, first));
      if (first === boldIdx) {
        const end = remaining.indexOf("**", first + 2);
        if (end === -1) { parts.push(remaining); break; }
        parts.push(<strong key={k++} className="font-semibold">{remaining.slice(first + 2, end)}</strong>);
        remaining = remaining.slice(end + 2);
      } else {
        const end = remaining.indexOf("`", first + 1);
        if (end === -1) { parts.push(remaining); break; }
        parts.push(<code key={k++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">{remaining.slice(first + 1, end)}</code>);
        remaining = remaining.slice(end + 1);
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
        if (inTable) { flushTable(); }
      } else {
        inCode = false;
        elements.push(
          <pre key={key++} className="bg-muted rounded-lg p-4 my-3 overflow-x-auto text-xs font-mono leading-relaxed border border-border whitespace-pre-wrap break-words">
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("|") && line.includes("|")) {
      inTable = true;
      const cells = line.split("|").slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="text-2xl font-bold mt-8 mb-3 text-foreground border-b border-border pb-2">
          {applyInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-xl font-bold mt-6 mb-2 text-foreground">
          {applyInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-base font-semibold mt-4 mb-1 text-foreground">
          {applyInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={key++} className="text-sm font-semibold mt-3 mb-1 text-muted-foreground uppercase tracking-wide">
          {applyInline(line.slice(5))}
        </h4>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={key++} className="ml-4 mb-1 text-sm text-foreground flex gap-2">
          <span className="text-muted-foreground mt-0.5">•</span>
          <span>{applyInline(line.slice(2))}</span>
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <li key={key++} className="ml-4 mb-1 text-sm text-foreground flex gap-2">
            <span className="text-primary font-semibold min-w-[1.2rem]">{match[1]}.</span>
            <span>{applyInline(match[2])}</span>
          </li>
        );
      }
    } else if (line.startsWith("---")) {
      elements.push(<hr key={key++} className="my-5 border-border" />);
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm text-foreground leading-relaxed mb-1">
          {applyInline(line)}
        </p>
      );
    }
  }

  if (inTable) flushTable();

  return elements;
}

export default function AdminDocumentation() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentationVersion | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);

  const { data: docs = [], isLoading } = useQuery<DocumentationVersion[]>({
    queryKey: ["/api/documentation/versions"],
  });

  const { data: manualContent, isLoading: loadingManual } = useQuery<string>({
    queryKey: ["/api/documentation/manual-md"],
    enabled: showGuide,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documentation/manual-md");
      return res.text();
    },
  });

  const form = useForm<CreateDocForm>({
    resolver: zodResolver(createDocSchema),
    defaultValues: { version: "", title: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDocForm) => {
      return apiRequest("POST", "/api/documentation/versions", {
        ...data,
        content: "# Documentação Quanta Flow\n\nConteúdo será adicionado aqui.",
        format: "markdown",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documentation/versions"] });
      toast({ title: "Documentação criada com sucesso!" });
      form.reset();
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar documentação", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/documentation/versions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documentation/versions"] });
      toast({ title: "Documentação deletada!" });
    },
  });

  const handleDownload = (doc: DocumentationVersion) => {
    const element = document.createElement("a");
    const file = new Blob([doc.content], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `QUANTA_FLOW_${doc.version}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadUserManualPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await apiRequest("GET", "/api/documentation/manual-pdf");
      if (!response.ok) throw new Error("Erro ao gerar PDF");
      const blob = await response.blob();
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = "QUANTA_FLOW_Manual_Completo.pdf";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast({ title: "Manual baixado com sucesso!" });
    } catch (err) {
      toast({
        title: "Erro ao baixar PDF",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadPptx = async () => {
    try {
      setDownloadingPptx(true);
      const response = await apiRequest("GET", "/api/documentation/presentation-pptx");
      if (!response.ok) throw new Error("Erro ao gerar apresentação");
      const blob = await response.blob();
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = "quanta-flow-apresentacao.pptx";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast({ title: "Apresentação baixada com sucesso!" });
    } catch (err) {
      toast({
        title: "Erro ao baixar apresentação",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setDownloadingPptx(false);
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-6">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📚 Documentação</h1>
          <p className="text-muted-foreground mt-2">Gerencie versões da documentação e visualize o guia completo online</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button className="gap-2" onClick={() => setOpen(true)} data-testid="button-new-version">
            <Plus className="w-4 h-4" />
            Nova Versão
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Versão</DialogTitle>
              <DialogDescription>
                Crie uma nova versão da documentação do Quanta Flow
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Versão (ex: 5.1.0)</FormLabel>
                      <FormControl>
                        <Input placeholder="5.1.0" {...field} data-testid="input-version" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Documentação v5.1.0" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Mudanças nesta versão..." {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-version">
                  {createMutation.isPending ? "Criando..." : "Criar Versão"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Manual Completo — destaque principal */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Manual Completo — Quanta Flow</CardTitle>
                <CardDescription className="mt-1 max-w-xl">
                  Guia didático com todos os 16 módulos da plataforma: Dashboard, Inbox Omnichannel, CRM/Kanban, Automação com Builder Visual e Simulador, Agentes IA, Campanhas, Fila, Microlearning, Webhooks, Google Sheets, Lab, Configurações, Branding e RBAC — com cenários práticos reais.
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowGuide((v) => !v)}
                data-testid="button-toggle-guide"
              >
                {showGuide ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Fechar
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Visualizar
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownloadUserManualPdf}
                disabled={downloadingPdf}
                className="gap-2"
                data-testid="button-download-manual-pdf"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Baixar PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {showGuide && (
          <CardContent>
            <div className="border border-border rounded-xl bg-background overflow-hidden shadow-inner">
              {/* Barra do leitor */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/70 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>MANUAL_DE_USO.md</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowGuide(false)}
                  data-testid="button-close-guide"
                >
                  <ChevronUp className="w-3 h-3" />
                  Fechar leitor
                </Button>
              </div>

              {/* Conteúdo renderizado */}
              <div className="max-h-[70vh] overflow-y-auto px-6 py-5" data-testid="guide-reader-content">
                {loadingManual ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Carregando manual...</span>
                  </div>
                ) : manualContent ? (
                  <div className="prose-sm max-w-none">
                    {renderMarkdown(manualContent)}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Não foi possível carregar o manual. Tente novamente.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Presentation className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Apresentação Comercial</CardTitle>
                <CardDescription className="mt-1">
                  Slides do Quanta Flow com identidade visual para apresentações e demos. Arquivo .pptx compatível com PowerPoint e Google Slides.
                </CardDescription>
              </div>
            </div>
            <div className="shrink-0">
              <Button
                onClick={handleDownloadPptx}
                disabled={downloadingPptx}
                variant="outline"
                className="gap-2"
                data-testid="button-download-pptx"
              >
                {downloadingPptx ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Baixar Apresentação (.pptx)
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="versions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="versions">Versões da Documentação</TabsTrigger>
          <TabsTrigger value="info">Informações do Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando versões...
            </div>
          ) : docs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  Nenhuma versão criada ainda. Clique em "Nova Versão" para começar!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {docs.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          v{doc.version}
                        </CardTitle>
                        <CardDescription>{doc.title}</CardDescription>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mt-2">{doc.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => { setSelectedDoc(doc); setViewOpen(true); }}
                          className="gap-2"
                          data-testid={`view-doc-${doc.id}`}
                        >
                          <Eye className="w-4 h-4" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          className="gap-2"
                          data-testid={`download-doc-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`delete-doc-${doc.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Criado em {new Date(doc.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sobre o Sistema de Documentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">🎯 Objetivo</h3>
                <p className="text-muted-foreground">Manter um histórico organizado de todas as versões da documentação técnica da plataforma Quanta Flow, facilitando o rastreamento de mudanças e acesso rápido às informações.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📦 O que está documentado</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Arquitetura do sistema completa</li>
                  <li>Schema do banco de dados com 20+ tabelas</li>
                  <li>80+ endpoints da API REST</li>
                  <li>Integração com 4 canais de comunicação</li>
                  <li>Fluxos de automação e microlearning</li>
                  <li>Webhooks e integrações externas</li>
                  <li>Setup, deployment e CI/CD</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🚀 Stack Tecnológico</h3>
                <p className="text-muted-foreground">Frontend: React 18 + Vite + TypeScript | Backend: Node.js + Express | Database: PostgreSQL + Drizzle ORM | Auth: JWT + bcrypt | Real-time: Socket.io | IA: OpenAI GPT-4o-mini</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📝 Versionamento</h3>
                <p className="text-muted-foreground">Cada versão documenta o estado da plataforma em um momento específico. Use "Nova Versão" quando há atualizações significativas no sistema.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de visualização de versão técnica */}
      <Dialog open={viewOpen} onOpenChange={(open) => { setViewOpen(open); if (!open) setSelectedDoc(null); }}>
        {selectedDoc && (
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedDoc.title}</DialogTitle>
              <DialogDescription>
                Versão {selectedDoc.version} • {new Date(selectedDoc.createdAt || "").toLocaleString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto border rounded-lg bg-muted p-4">
              <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                {selectedDoc.content || "Conteúdo não disponível"}
              </pre>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
