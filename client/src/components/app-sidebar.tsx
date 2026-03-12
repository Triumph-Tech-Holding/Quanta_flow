import { Link, useLocation } from "wouter";
import {
  Inbox,
  Users,
  Bot,
  Share2,
  Brain,
  Users2,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  ScrollText,
  Palette,
  GraduationCap,
  Webhook,
  Table2,
  Radio,
  BookOpen,
  Zap,
  Megaphone,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
];

const modulesMenuItems = [
  {
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
    module: 1,
    enabled: true,
    permission: "view_inbox",
  },
  {
    title: "CRM",
    url: "/crm",
    icon: Users,
    module: 2,
    enabled: true,
    permission: "view_leads",
  },
  {
    title: "Automação",
    url: "/automation",
    icon: Bot,
    module: 3,
    enabled: true,
  },
  {
    title: "Microlearning",
    url: "/learning-tracks",
    icon: GraduationCap,
    module: 7,
    enabled: true,
  },
  {
    title: "Social/Ads",
    url: "/social",
    icon: Share2,
    module: 4,
    badge: "Em breve",
  },
  {
    title: "IA Brain",
    url: "/ai-brain",
    icon: Brain,
    module: 5,
    badge: "Em breve",
  },
  {
    title: "Tribos",
    url: "/tribes",
    icon: Users2,
    module: 6,
    badge: "Em breve",
  },
];

const adminMenuItems = [
  {
    title: "Configurações API",
    url: "/settings",
    icon: Settings,
    permission: "view_settings",
  },
  {
    title: "Branding",
    url: "/admin/branding",
    icon: Palette,
    permission: "edit_settings",
  },
  {
    title: "Usuários",
    url: "/admin/users",
    icon: Shield,
    permission: "view_users",
  },
  {
    title: "Audit Logs",
    url: "/admin/audit-logs",
    icon: ScrollText,
    permission: "view_audit_logs",
  },
  {
    title: "Canais",
    url: "/settings/channels",
    icon: Radio,
    permission: "edit_settings",
  },
  {
    title: "Webhooks",
    url: "/settings/webhooks",
    icon: Webhook,
    permission: "edit_settings",
  },
  {
    title: "Integrações",
    url: "/settings/integrations",
    icon: Table2,
    permission: "edit_settings",
  },
  {
    title: "Documentação",
    url: "/admin/documentation",
    icon: BookOpen,
    permission: "edit_settings",
  },
  {
    title: "Agentes IA",
    url: "/admin/agents",
    icon: Brain,
    permission: "edit_settings",
  },
  {
    title: "Flow Builder",
    url: "/admin/flows",
    icon: Zap,
    permission: "edit_settings",
  },
  {
    title: "Campanhas",
    url: "/admin/campaigns",
    icon: Megaphone,
    permission: "edit_settings",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getTipoAtorLabel(tipo: string) {
  switch (tipo) {
    case "consumidor":
      return "Consumidor";
    case "agente_fidelizacao":
      return "Agente de Fidelização";
    case "lojista":
      return "Lojista";
    case "admin":
      return "Administrador";
    default:
      return tipo;
  }
}

interface BrandingData {
  companyName: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, hasPermission, hasRole } = useAuth();

  const { data: branding } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
  });

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const isAdmin = user?.tipoAtor === "admin" || hasRole("super_admin") || hasRole("admin");
  const visibleAdminItems = adminMenuItems.filter(
    (item) => hasPermission(item.permission) || isAdmin
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-center">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName || "Logo"}
              className="h-10 w-auto max-w-[180px] object-contain"
              data-testid="sidebar-logo"
            />
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold" style={{ color: branding?.primaryColor || "#00A86B" }}>
                {branding?.companyName || "Quanta"}
              </span>
              <span className="text-lg font-light text-muted-foreground">FLOW</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modulesMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.enabled ? (
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\//g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="opacity-60 cursor-not-allowed"
                      data-testid={`nav-${item.title.toLowerCase().replace(/\//g, "-")}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdminItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administração</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleAdminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-admin-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 w-full p-2 rounded-lg hover-elevate active-elevate-2 transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {user?.nome ? getInitials(user.nome) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user?.nome || "Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.tipoAtor ? getTipoAtorLabel(user.tipoAtor) : ""}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild data-testid="menu-settings">
              <Link href="/user-settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
