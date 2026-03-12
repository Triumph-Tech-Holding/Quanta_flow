import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus, Pencil, Trash2, Loader2, Zap, Download, Upload, Sparkles,
  MessageSquare, Music, Image, Clock, GitBranch, Bot, Webhook,
  Users, CheckCircle, BarChart3, Copy, LayoutGrid, ArrowLeft,
} from "lucide-react";

interface FlowBlock {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  nextBlockId?: string | null;
  conditionTrueId?: string | null;
  conditionFalseId?: string | null;
}

interface AutomationFlow {
  id: string;
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  isActive: boolean;
  blocks: FlowBlock[] | null;
  thumbnail: string | null;
  agentId: string | null;
  createdAt: string;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  blocks: FlowBlock[];
}

const BLOCK_TYPES = [
  { type: "text", label: "Texto", icon: MessageSquare, color: "#3b82f6", description: "Mensagem de texto" },
  { type: "audio_tts", label: "Áudio TTS", icon: Music, color: "#8b5cf6", description: "Gerar e enviar áudio" },
  { type: "image_ai", label: "Imagem IA", icon: Image, color: "#ec4899", description: "Gerar imagem DALL-E" },
  { type: "delay", label: "Delay", icon: Clock, color: "#f59e0b", description: "Pausa entre blocos" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "#10b981", description: "Bifurcação SIM/NÃO" },
  { type: "ai_agent", label: "Agente IA", icon: Bot, color: "#6366f1", description: "Resposta dinâmica IA" },
  { type: "webhook", label: "Webhook", icon: Webhook, color: "#64748b", description: "Chamar sistema externo" },
  { type: "queue_entry", label: "Fila", icon: Users, color: "#ef4444", description: "Atendimento humano" },
  { type: "resolve", label: "Resolver", icon: CheckCircle, color: "#22c55e", description: "Finalizar atendimento" },
  { type: "update_lead", label: "Atualizar Lead", icon: BarChart3, color: "#0ea5e9", description: "Mudar dados do lead" },
];

function getBlockStyle(type: string) {
  const bt = BLOCK_TYPES.find((b) => b.type === type);
  return { background: bt?.color || "#64748b", color: "#fff" };
}

function blocksToNodesEdges(blocks: FlowBlock[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = blocks.map((block) => ({
    id: block.id,
    type: "default",
    position: block.position || { x: 250, y: 50 },
    data: {
      label: (
        <div className="flex items-center gap-2 px-1">
          <span className="text-lg">{getBlockEmoji(block.type)}</span>
          <span className="font-medium text-xs">{block.label || block.type}</span>
        </div>
      ),
      blockType: block.type,
      config: block.config,
    },
    style: {
      ...getBlockStyle(block.type),
      borderRadius: "8px",
      border: "2px solid rgba(255,255,255,0.3)",
      padding: "8px 12px",
      fontSize: "12px",
      minWidth: "150px",
    },
  }));

  const edges: Edge[] = [];
  for (const block of blocks) {
    if (block.nextBlockId) {
      edges.push({
        id: `e-${block.id}-${block.nextBlockId}`,
        source: block.id,
        target: block.nextBlockId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      });
    }
    if (block.conditionTrueId) {
      edges.push({
        id: `e-${block.id}-true-${block.conditionTrueId}`,
        source: block.id,
        target: block.conditionTrueId,
        label: "SIM",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#22c55e", strokeWidth: 2 },
      });
    }
    if (block.conditionFalseId) {
      edges.push({
        id: `e-${block.id}-false-${block.conditionFalseId}`,
        source: block.id,
        target: block.conditionFalseId,
        label: "NÃO",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#ef4444", strokeWidth: 2 },
      });
    }
  }

  return { nodes, edges };
}

function getBlockEmoji(type: string): string {
  const map: Record<string, string> = {
    text: "💬", audio_tts: "🎵", image_ai: "🖼️", delay: "⏱️",
    condition: "🔀", ai_agent: "🤖", webhook: "🔗", queue_entry: "🚦",
    resolve: "✅", update_lead: "📊",
  };
  return map[type] || "📦";
}

function nodesEdgesToBlocks(nodes: Node[], edges: Edge[]): FlowBlock[] {
  return nodes.map((node) => {
    const nextEdge = edges.find((e) => e.source === node.id && !e.label);
    const trueEdge = edges.find((e) => e.source === node.id && e.label === "SIM");
    const falseEdge = edges.find((e) => e.source === node.id && e.label === "NÃO");

    return {
      id: node.id,
      type: (node.data as Record<string, unknown>).blockType as string,
      label: typeof (node.data as Record<string, unknown>).label === "string"
        ? (node.data as Record<string, unknown>).label as string
        : ((node.data as Record<string, unknown>).blockType as string),
      config: ((node.data as Record<string, unknown>).config as Record<string, unknown>) || {},
      position: node.position,
      nextBlockId: nextEdge?.target || null,
      conditionTrueId: trueEdge?.target || null,
      conditionFalseId: falseEdge?.target || null,
    };
  });
}

export default function AdminFlowsPage() {
  const { toast } = useToast();
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [flowName, setFlowName] = useState("");
  const [flowKeywords, setFlowKeywords] = useState("");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [blockConfigOpen, setBlockConfigOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const blockLabelRefs = useRef<Record<string, string>>({});

  const { data: flows, isLoading } = useQuery<AutomationFlow[]>({
    queryKey: ["/api/automation-flows"],
  });

  const { data: templates } = useQuery<FlowTemplate[]>({
    queryKey: ["/api/admin/flows/templates"],
  });

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find((n) => n.id === params.source);
    const sourceType = sourceNode ? (sourceNode.data as Record<string, unknown>).blockType : null;

    if (sourceType === "condition") {
      const existingEdges = edges.filter((e) => e.source === params.source);
      const hasSim = existingEdges.some((e) => e.label === "SIM");
      const hasNao = existingEdges.some((e) => e.label === "NÃO");

      if (!hasSim) {
        setEdges((eds) => addEdge({
          ...params,
          label: "SIM",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#22c55e", strokeWidth: 2 },
        }, eds));
      } else if (!hasNao) {
        setEdges((eds) => addEdge({
          ...params,
          label: "NÃO",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#ef4444", strokeWidth: 2 },
        }, eds));
      }
      return;
    }

    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }, eds));
  }, [nodes, edges, setEdges]);

  const addBlock = useCallback((type: string) => {
    const id = `block_${Date.now()}`;
    const bt = BLOCK_TYPES.find((b) => b.type === type);
    const yPos = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.y)) + 150 : 50;
    const newNode: Node = {
      id,
      type: "default",
      position: { x: 250, y: yPos },
      data: {
        label: (
          <div className="flex items-center gap-2 px-1">
            <span className="text-lg">{getBlockEmoji(type)}</span>
            <span className="font-medium text-xs">{bt?.label || type}</span>
          </div>
        ),
        blockType: type,
        config: {},
      },
      style: {
        ...getBlockStyle(type),
        borderRadius: "8px",
        border: "2px solid rgba(255,255,255,0.3)",
        padding: "8px 12px",
        fontSize: "12px",
        minWidth: "150px",
      },
    };
    blockLabelRefs.current[id] = bt?.label || type;
    setNodes((nds) => [...nds, newNode]);

    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const hasEdge = edges.some((e) => e.source === lastNode.id);
      if (!hasEdge) {
        setEdges((eds) => [...eds, {
          id: `e-${lastNode.id}-${id}`,
          source: lastNode.id,
          target: id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
        }]);
      }
    }
  }, [nodes, edges, setNodes, setEdges]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setBlockConfigOpen(false);
  }, [selectedNode, setNodes, setEdges]);

  const updateBlockConfig = useCallback((nodeId: string, config: Record<string, unknown>, label?: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const blockType = (n.data as Record<string, unknown>).blockType as string;
      const displayLabel = label || blockLabelRefs.current[nodeId] || blockType;
      blockLabelRefs.current[nodeId] = displayLabel;
      return {
        ...n,
        data: {
          ...n.data,
          config,
          label: (
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg">{getBlockEmoji(blockType)}</span>
              <span className="font-medium text-xs">{displayLabel}</span>
            </div>
          ),
        },
      };
    }));
  }, [setNodes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const blocks = nodesEdgesToBlocks(nodes, edges).map((b) => ({
        ...b,
        label: blockLabelRefs.current[b.id] || b.label,
      }));
      const payload = {
        name: flowName,
        triggerKeywords: flowKeywords,
        responseTemplate: " ",
        blocks,
        isActive: editingFlow?.isActive ?? true,
      };
      if (editingFlow) {
        const res = await apiRequest("PUT", `/api/automation-flows/${editingFlow.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/automation-flows", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: editingFlow ? "Fluxo atualizado" : "Fluxo criado com sucesso" });
      closeEditor();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar fluxo", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automation-flows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Fluxo excluído" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/automation-flows/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", "/api/admin/flows/generate", { description });
      return res.json();
    },
    onSuccess: (data: { blocks: FlowBlock[] }) => {
      const { nodes: newNodes, edges: newEdges } = blocksToNodesEdges(data.blocks);
      data.blocks.forEach((b) => { blockLabelRefs.current[b.id] = b.label || b.type; });
      setNodes(newNodes);
      setEdges(newEdges);
      setAiDialogOpen(false);
      setAiPrompt("");
      toast({ title: "Fluxo gerado com IA!", description: `${data.blocks.length} blocos criados` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar fluxo", description: error.message, variant: "destructive" });
    },
  });

  function openEditor(flow?: AutomationFlow) {
    if (flow) {
      setEditingFlow(flow);
      setFlowName(flow.name);
      setFlowKeywords(flow.triggerKeywords);
      if (flow.blocks && flow.blocks.length > 0) {
        const { nodes: n, edges: e } = blocksToNodesEdges(flow.blocks);
        flow.blocks.forEach((b) => { blockLabelRefs.current[b.id] = b.label || b.type; });
        setNodes(n);
        setEdges(e);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } else {
      setEditingFlow(null);
      setFlowName("");
      setFlowKeywords("");
      setNodes([]);
      setEdges([]);
      blockLabelRefs.current = {};
    }
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingFlow(null);
    setSelectedNode(null);
    setBlockConfigOpen(false);
  }

  function applyTemplate(template: FlowTemplate) {
    const { nodes: n, edges: e } = blocksToNodesEdges(template.blocks);
    template.blocks.forEach((b) => { blockLabelRefs.current[b.id] = b.label || b.type; });
    setNodes(n);
    setEdges(e);
    setFlowName(template.name);
    setFlowKeywords("");
    setTemplateDialogOpen(false);
    toast({ title: `Template "${template.name}" aplicado` });
  }

  async function exportFlow(flow: AutomationFlow) {
    try {
      const res = await apiRequest("POST", `/api/automation-flows/${flow.id}/export`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flow-${flow.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar fluxo", variant: "destructive" });
    }
  }

  async function handleImport() {
    try {
      const data = JSON.parse(importJson);
      const res = await apiRequest("POST", "/api/automation-flows/import", data);
      await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      setImportDialogOpen(false);
      setImportJson("");
      toast({ title: "Fluxo importado com sucesso" });
    } catch (err) {
      toast({ title: "Erro ao importar", description: err instanceof Error ? err.message : "JSON inválido", variant: "destructive" });
    }
  }

  async function duplicateFlow(flow: AutomationFlow) {
    try {
      const res = await apiRequest("POST", `/api/automation-flows/${flow.id}/export`);
      const data = await res.json();
      data.name = `${flow.name} (cópia)`;
      await apiRequest("POST", "/api/automation-flows/import", data);
      queryClient.invalidateQueries({ queryKey: ["/api/automation-flows"] });
      toast({ title: "Fluxo duplicado" });
    } catch {
      toast({ title: "Erro ao duplicar", variant: "destructive" });
    }
  }

  if (editorOpen) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex items-center justify-between p-3 border-b flex-shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={closeEditor} data-testid="button-back-flows">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Nome do fluxo"
              className="w-48 h-8"
              data-testid="input-flow-name"
            />
            <Input
              value={flowKeywords}
              onChange={(e) => setFlowKeywords(e.target.value)}
              placeholder="Palavras-chave (separadas por vírgula)"
              className="w-64 h-8"
              data-testid="input-flow-keywords"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTemplateDialogOpen(true)} data-testid="button-templates">
              <LayoutGrid className="h-4 w-4 mr-1" /> Templates
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAiDialogOpen(true)} data-testid="button-ai-generate">
              <Sparkles className="h-4 w-4 mr-1" /> Gerar com IA
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!flowName.trim() || saveMutation.isPending}
              data-testid="button-save-flow"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-48 border-r p-2 space-y-1 overflow-y-auto flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">BLOCOS</p>
            {BLOCK_TYPES.map((bt) => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent text-left text-xs transition-colors"
                  data-testid={`button-add-block-${bt.type}`}
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: bt.color }}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium">{bt.label}</div>
                    <div className="text-[10px] text-muted-foreground">{bt.description}</div>
                  </div>
                </button>
              );
            })}
          </aside>

          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, node) => {
                setSelectedNode(node);
                setBlockConfigOpen(true);
              }}
              fitView
              deleteKeyCode="Delete"
              className="bg-muted/30"
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap
                style={{ height: 80, width: 120 }}
                nodeStrokeWidth={3}
              />
              <Panel position="top-right">
                {selectedNode && (
                  <Button size="sm" variant="destructive" onClick={deleteSelectedNode} data-testid="button-delete-block">
                    <Trash2 className="h-3 w-3 mr-1" /> Remover Bloco
                  </Button>
                )}
              </Panel>
            </ReactFlow>
          </div>

          {blockConfigOpen && selectedNode && (
            <BlockConfigPanel
              node={selectedNode}
              onUpdate={updateBlockConfig}
              onClose={() => { setBlockConfigOpen(false); setSelectedNode(null); }}
              savedLabel={blockLabelRefs.current[selectedNode.id]}
            />
          )}
        </div>

        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar Fluxo com IA</DialogTitle></DialogHeader>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Descreva o fluxo que deseja criar. Ex: 'Quero um fluxo para qualificar leads de e-commerce que perguntam sobre frete'"
              rows={4}
              data-testid="textarea-ai-prompt"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => aiGenerateMutation.mutate(aiPrompt)}
                disabled={!aiPrompt.trim() || aiGenerateMutation.isPending}
                data-testid="button-generate-ai-flow"
              >
                {aiGenerateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Gerar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Templates de Fluxo</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {templates?.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => applyTemplate(t)} data-testid={`card-template-${t.id}`}>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{t.blocks.length} blocos</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Zap className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Flow Builder</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} data-testid="button-import-flow">
                <Upload className="h-4 w-4 mr-1" /> Importar
              </Button>
              <Button onClick={() => openEditor()} data-testid="button-new-flow">
                <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
                </div>
              ) : !flows?.length ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <h3 className="font-medium text-lg mb-1">Nenhum fluxo criado</h3>
                    <p className="text-sm text-muted-foreground mb-4">Crie fluxos visuais para automatizar o atendimento</p>
                    <Button onClick={() => openEditor()} data-testid="button-new-flow-empty">
                      <Plus className="h-4 w-4 mr-1" /> Criar primeiro fluxo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {flows.map((flow) => (
                    <Card key={flow.id} className="hover:shadow-md transition-shadow" data-testid={`card-flow-${flow.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="truncate" data-testid={`text-flow-name-${flow.id}`}>{flow.name}</span>
                            </CardTitle>
                          </div>
                          <Switch
                            checked={flow.isActive}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: flow.id, isActive: checked })}
                            data-testid={`switch-flow-${flow.id}`}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={flow.isActive ? "default" : "secondary"} className="text-[10px]">
                            {flow.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                          {flow.blocks && (
                            <Badge variant="outline" className="text-[10px]">
                              {flow.blocks.length} blocos
                            </Badge>
                          )}
                          {flow.triggerKeywords && (
                            <Badge variant="outline" className="text-[10px] max-w-[200px] truncate">
                              {flow.triggerKeywords}
                            </Badge>
                          )}
                        </div>
                        {flow.thumbnail ? (
                          <img src={flow.thumbnail} alt="Flow preview" className="rounded border h-20 object-contain bg-muted/50" data-testid={`img-thumbnail-${flow.id}`} />
                        ) : flow.blocks && flow.blocks.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {flow.blocks.slice(0, 6).map((b) => (
                              <span key={b.id} className="text-sm" title={b.label || b.type}>{getBlockEmoji(b.type)}</span>
                            ))}
                            {flow.blocks.length > 6 && <span className="text-xs text-muted-foreground">+{flow.blocks.length - 6}</span>}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditor(flow)} data-testid={`button-edit-flow-${flow.id}`}>
                            <Pencil className="h-3 w-3 mr-1" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => duplicateFlow(flow)} data-testid={`button-duplicate-flow-${flow.id}`}>
                            <Copy className="h-3 w-3 mr-1" /> Duplicar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => exportFlow(flow)} data-testid={`button-export-flow-${flow.id}`}>
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(flow.id)} data-testid={`button-delete-flow-${flow.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importar Fluxo</DialogTitle></DialogHeader>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Cole o JSON do fluxo aqui..."
            rows={8}
            className="font-mono text-xs"
            data-testid="textarea-import-json"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importJson.trim()} data-testid="button-confirm-import">
              <Upload className="h-4 w-4 mr-1" /> Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function BlockConfigPanel({
  node,
  onUpdate,
  onClose,
  savedLabel,
}: {
  node: Node;
  onUpdate: (nodeId: string, config: Record<string, unknown>, label?: string) => void;
  onClose: () => void;
  savedLabel?: string;
}) {
  const blockType = (node.data as Record<string, unknown>).blockType as string;
  const initialConfig = ((node.data as Record<string, unknown>).config as Record<string, unknown>) || {};
  const [config, setConfig] = useState<Record<string, unknown>>(initialConfig);
  const [label, setLabel] = useState(savedLabel || blockType);

  const bt = BLOCK_TYPES.find((b) => b.type === blockType);

  function save() {
    onUpdate(node.id, config, label);
    onClose();
  }

  return (
    <aside className="w-72 border-l p-4 overflow-y-auto flex-shrink-0 bg-background">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: bt?.color || "#64748b" }}>
            {bt && <bt.icon className="h-3.5 w-3.5 text-white" />}
          </div>
          <h3 className="font-medium text-sm">{bt?.label || blockType}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Rótulo</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-xs" data-testid="input-block-label" />
        </div>

        {blockType === "text" && (
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={(config.message as string) || ""}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              rows={3}
              className="text-xs"
              placeholder="Use {nome}, {telefone} para variáveis"
              data-testid="textarea-block-message"
            />
          </div>
        )}

        {blockType === "audio_tts" && (
          <>
            <div>
              <Label className="text-xs">Texto para TTS</Label>
              <Textarea
                value={(config.message as string) || ""}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                rows={3}
                className="text-xs"
                data-testid="textarea-block-tts-text"
              />
            </div>
            <div>
              <Label className="text-xs">Voz</Label>
              <Select value={(config.voice as string) || "nova"} onValueChange={(v) => setConfig({ ...config, voice: v })}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-block-voice"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {blockType === "image_ai" && (
          <div>
            <Label className="text-xs">Prompt DALL-E</Label>
            <Textarea
              value={(config.prompt as string) || ""}
              onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
              rows={3}
              className="text-xs"
              placeholder="Descreva a imagem a ser gerada"
              data-testid="textarea-block-image-prompt"
            />
          </div>
        )}

        {blockType === "delay" && (
          <>
            <div>
              <Label className="text-xs">Tempo</Label>
              <Input
                type="number"
                value={(config.delaySeconds as number) || 30}
                onChange={(e) => setConfig({ ...config, delaySeconds: parseInt(e.target.value) || 30 })}
                className="h-8 text-xs"
                data-testid="input-block-delay"
              />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={(config.delayUnit as string) || "seconds"} onValueChange={(v) => setConfig({ ...config, delayUnit: v })}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-delay-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {blockType === "condition" && (
          <>
            <div>
              <Label className="text-xs">Tipo de Condição</Label>
              <Select
                value={(config.conditionType as string) || "keyword"}
                onValueChange={(v) => setConfig({ ...config, conditionType: v })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-condition-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="intent">Intenção</SelectItem>
                  <SelectItem value="temperature">Temperatura do Lead</SelectItem>
                  <SelectItem value="score">Score do Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                value={(config.conditionValue as string) || ""}
                onChange={(e) => setConfig({ ...config, conditionValue: e.target.value })}
                className="h-8 text-xs"
                placeholder={config.conditionType === "keyword" ? "palavras separadas por vírgula" : "valor"}
                data-testid="input-condition-value"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Conecte as saídas SIM e NÃO a outros blocos usando as alças de conexão.</p>
          </>
        )}

        {blockType === "ai_agent" && (
          <div>
            <Label className="text-xs">ID do Agente (opcional)</Label>
            <Input
              value={(config.agentId as string) || ""}
              onChange={(e) => setConfig({ ...config, agentId: e.target.value })}
              className="h-8 text-xs"
              placeholder="Deixe vazio para IA genérica"
              data-testid="input-block-agent-id"
            />
          </div>
        )}

        {blockType === "webhook" && (
          <>
            <div>
              <Label className="text-xs">URL do Webhook</Label>
              <Input
                value={(config.webhookUrl as string) || ""}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                className="h-8 text-xs"
                placeholder="https://..."
                data-testid="input-webhook-url"
              />
            </div>
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={(config.webhookMethod as string) || "POST"} onValueChange={(v) => setConfig({ ...config, webhookMethod: v })}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-webhook-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {blockType === "queue_entry" && (
          <div>
            <Label className="text-xs">SLA (minutos)</Label>
            <Input
              type="number"
              value={(config.slaMinutes as number) || 60}
              onChange={(e) => setConfig({ ...config, slaMinutes: parseInt(e.target.value) || 60 })}
              className="h-8 text-xs"
              data-testid="input-sla-minutes"
            />
          </div>
        )}

        {blockType === "update_lead" && (
          <>
            <div>
              <Label className="text-xs">Estágio do Pipeline</Label>
              <Select value={(config.leadStage as string) || ""} onValueChange={(v) => setConfig({ ...config, leadStage: v || undefined })}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-lead-stage"><SelectValue placeholder="Manter atual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                  <SelectItem value="fechado_ganho">Fechado (Ganho)</SelectItem>
                  <SelectItem value="fechado_perdido">Fechado (Perdido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Temperatura</Label>
              <Select value={(config.leadTemperature as string) || ""} onValueChange={(v) => setConfig({ ...config, leadTemperature: v || undefined })}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-lead-temperature"><SelectValue placeholder="Manter atual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frio">Frio</SelectItem>
                  <SelectItem value="morno">Morno</SelectItem>
                  <SelectItem value="quente">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tag</Label>
              <Input
                value={(config.leadTag as string) || ""}
                onChange={(e) => setConfig({ ...config, leadTag: e.target.value })}
                className="h-8 text-xs"
                placeholder="Tag do lead"
                data-testid="input-lead-tag"
              />
            </div>
          </>
        )}

        <Button size="sm" className="w-full" onClick={save} data-testid="button-save-block-config">
          Aplicar
        </Button>
      </div>
    </aside>
  );
}
