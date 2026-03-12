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
import { Download, Plus, Trash2 } from "lucide-react";

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

export default function AdminDocumentation() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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
          <p className="text-muted-foreground mt-2">Gerencie versões da documentação do sistema</p>
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
    </div>
  );
}
