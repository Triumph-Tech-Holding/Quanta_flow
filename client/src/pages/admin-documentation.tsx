import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  DialogTrigger,
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
import { Download, Plus, Trash2, Eye } from "lucide-react";
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

const UserGuide = () => (
  <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
    <CardHeader>
      <CardTitle className="text-blue-900 dark:text-blue-100">📖 Guia do Usuário</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 text-sm text-blue-800 dark:text-blue-200">
      <div>
        <h3 className="font-semibold mb-2">🔍 Visualizar Documentação</h3>
        <p>Clique no botão "Visualizar" ao lado de qualquer versão para ler a documentação completa no navegador, sem precisar baixar.</p>
      </div>
      <div>
        <h3 className="font-semibold mb-2">📥 Baixar Documentação</h3>
        <p>Use o botão "Download" para salvar a documentação em formato Markdown (.md) no seu computador.</p>
      </div>
      <div>
        <h3 className="font-semibold mb-2">➕ Criar Nova Versão</h3>
        <p>Clique em "Nova Versão" para adicionar uma nova versão da documentação quando há mudanças no sistema. Cada versão fica registrada com data de criação.</p>
      </div>
      <div>
        <h3 className="font-semibold mb-2">🗑️ Deletar Versão</h3>
        <p>Use o botão vermelho "Deletar" para remover versões antigas que não são mais necessárias.</p>
      </div>
      <div>
        <h3 className="font-semibold mb-2">📋 Funcionalidades Principais</h3>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>Inbox:</strong> Centro de mensagens unificado com WhatsApp, Telegram, Instagram e Email</li>
          <li><strong>CRM:</strong> Gerenciamento de leads com pipeline Kanban e detecção de IA</li>
          <li><strong>Automação:</strong> Fluxos multi-etapa com acionadores e condições</li>
          <li><strong>Microlearning:</strong> Entrega automática de conteúdo por estágio de lead</li>
          <li><strong>Webhooks:</strong> Integração com Zapier, HubSpot e sistemas externos</li>
          <li><strong>Google Sheets:</strong> Sincronização automática de leads em planilhas</li>
        </ul>
      </div>
    </CardContent>
  </Card>
);

export default function AdminDocumentation() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentationVersion | null>(null);

  const { data: docs = [], isLoading } = useQuery<DocumentationVersion[]>({
    queryKey: ["/api/documentation/versions"],
  });

  const form = useForm<CreateDocForm>({
    resolver: zodResolver(createDocSchema),
    defaultValues: {
      version: "",
      title: "",
      description: "",
    },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📚 Documentação</h1>
          <p className="text-muted-foreground mt-2">Gerencie versões da documentação e visualize online</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Versão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Versão</DialogTitle>
              <DialogDescription>
                Crie uma nova versão da documentação do Quanta Flow
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Versão (ex: 5.1.0)</FormLabel>
                      <FormControl>
                        <Input placeholder="5.1.0" {...field} />
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
                        <Input placeholder="Documentação v5.1.0" {...field} />
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
                        <Textarea
                          placeholder="Mudanças nesta versão..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Versão"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <UserGuide />

      <Tabs defaultValue="versions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="versions">Versões</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
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
                      <p className="text-sm text-muted-foreground mt-2">
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={viewOpen && selectedDoc?.id === doc.id} onOpenChange={setViewOpen}>
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
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{selectedDoc?.title}</DialogTitle>
                          <DialogDescription>
                            Versão {selectedDoc?.version} • {new Date(selectedDoc?.createdAt || '').toLocaleString('pt-BR')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="prose dark:prose-invert max-w-full text-sm">
                          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap break-words">
                            {selectedDoc?.content}
                          </pre>
                        </div>
                      </DialogContent>
                    </Dialog>
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
    </div>
  );
}
