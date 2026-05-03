import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

interface WorkspacesResponse {
  workspaces: WorkspaceItem[];
  currentWorkspaceId: string | null;
}

export function WorkspaceSwitcher() {
  const { setToken } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const { data, isLoading } = useQuery<WorkspacesResponse>({
    queryKey: ["/api/workspaces"],
  });

  const switchMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/switch`, {});
      return await res.json();
    },
    onSuccess: (result: { token: string; workspaceId: string }) => {
      setToken(result.token);
      queryClient.invalidateQueries();
      toast({ title: "Workspace alterado", description: "Dados recarregados para o novo workspace." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao trocar workspace", description: err?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string }) => {
      const res = await apiRequest("POST", "/api/workspaces", payload);
      return await res.json();
    },
    onSuccess: (ws: WorkspaceItem) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setCreateOpen(false);
      setName("");
      setSlug("");
      toast({ title: "Workspace criado", description: `${ws.name} pronto para uso.` });
      switchMutation.mutate(ws.id);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar workspace", description: err?.message || "Tente novamente", variant: "destructive" });
    },
  });

  const workspaces = data?.workspaces || [];
  const current = workspaces.find((w) => w.id === data?.currentWorkspaceId) || workspaces[0];

  if (isLoading || workspaces.length === 0) {
    return null;
  }

  const handleSlugFromName = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(
        value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60)
      );
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between gap-2 h-9"
            data-testid="button-workspace-switcher"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs font-medium" data-testid="text-current-workspace">
                {current?.name || "Workspace"}
              </span>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs">Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => ws.id !== current?.id && switchMutation.mutate(ws.id)}
              disabled={switchMutation.isPending}
              className="gap-2"
              data-testid={`item-workspace-${ws.id}`}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{ws.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {ws.role} · {ws.plan}
                </div>
              </div>
              {ws.id === current?.id && <Check className="h-4 w-4 text-primary" />}
              {switchMutation.isPending && switchMutation.variables === ws.id && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} data-testid="item-create-workspace">
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-sm">Novo workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo workspace</DialogTitle>
            <DialogDescription>
              Workspaces isolam dados (contatos, fluxos, campanhas) entre times ou clientes diferentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Nome</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => handleSlugFromName(e.target.value)}
                placeholder="Ex: Pizzaria do João"
                data-testid="input-workspace-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-slug">Slug (URL)</Label>
              <Input
                id="ws-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="pizzaria-joao"
                data-testid="input-workspace-slug"
              />
              <p className="text-[11px] text-muted-foreground">
                Apenas letras minúsculas, números e hífens.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} data-testid="button-cancel-workspace">
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate({ name, slug })}
              disabled={createMutation.isPending || !name || !slug}
              data-testid="button-create-workspace"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
