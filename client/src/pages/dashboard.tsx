import { useQuery } from "@tanstack/react-query";
import {
  Inbox,
  Users,
  Bot,
  Share2,
  Brain,
  Users2,
  TrendingUp,
  Activity,
  Clock,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const modules = [
  {
    title: "Inbox",
    description: "Central de mensagens unificada",
    icon: Inbox,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    module: 1,
  },
  {
    title: "CRM",
    description: "Gestão de relacionamento",
    icon: Users,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    module: 2,
  },
  {
    title: "Automação",
    description: "Fluxos automatizados",
    icon: Bot,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    module: 3,
  },
  {
    title: "Social/Ads",
    description: "Marketing e anúncios",
    icon: Share2,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    module: 4,
  },
  {
    title: "IA Brain",
    description: "Inteligência artificial",
    icon: Brain,
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    module: 5,
  },
  {
    title: "Tribos",
    description: "Comunidades e grupos",
    icon: Users2,
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    module: 6,
  },
];

const stats = [
  {
    title: "Total de Leads",
    value: "0",
    change: "+0%",
    icon: Users,
    description: "Nenhum lead cadastrado",
  },
  {
    title: "Conversões",
    value: "0",
    change: "+0%",
    icon: TrendingUp,
    description: "Aguardando primeiras vendas",
  },
  {
    title: "Taxa de Resposta",
    value: "0%",
    icon: Activity,
    description: "Configure o inbox para começar",
  },
  {
    title: "Tempo Médio",
    value: "0min",
    icon: Clock,
    description: "Tempo de resposta",
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getTipoAtorMessage(tipo: string) {
  switch (tipo) {
    case "consumidor":
      return "Descubra ofertas exclusivas e acompanhe seus pedidos.";
    case "agente_fidelizacao":
      return "Gerencie seus leads e potencialize suas conversões.";
    case "lojista":
      return "Administre sua loja e conquiste mais clientes.";
    default:
      return "Bem-vindo à sua central de operações.";
  }
}

export default function Dashboard() {
  const { user } = useAuth();

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

          <main className="flex-1 p-6 space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold" data-testid="text-greeting">
                  {getGreeting()}, {user?.nome?.split(" ")[0] || "Usuário"}!
                </h1>
              </div>
              <p className="text-muted-foreground" data-testid="text-welcome-message">
                {user?.tipoAtor ? getTipoAtorMessage(user.tipoAtor) : "Bem-vindo ao Quanta Shop."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <Card key={stat.title} data-testid={`card-stat-${index}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Módulos Disponíveis</h2>
                <p className="text-sm text-muted-foreground">
                  Explore os módulos do Quanta Shop para potencializar seu negócio
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                  <Card
                    key={module.title}
                    className="hover-elevate cursor-pointer transition-all group"
                    data-testid={`card-module-${module.module}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${module.color}`}>
                          <module.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">{module.title}</CardTitle>
                          <CardDescription className="text-xs">
                            Módulo {module.module}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                      <div className="mt-3">
                        <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                          Em breve
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Próximos Passos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-sm">Configure suas integrações</p>
                    <p className="text-xs text-muted-foreground">
                      Conecte Evolution API, OpenAI e Meta para habilitar os módulos
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-sm">Importe seus leads</p>
                    <p className="text-xs text-muted-foreground">
                      Adicione sua base de contatos para começar a gerenciar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-sm">Crie sua primeira automação</p>
                    <p className="text-xs text-muted-foreground">
                      Automatize respostas e fluxos de atendimento
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
