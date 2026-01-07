import { Calculator, Users, FileText, Table, LogOut, Home, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, Award, ChevronDown, Settings, Briefcase, Target, Headphones, Tag, Calendar, Kanban, BarChart3, Search, Settings2, Building2, Scissors, Palette, TrendingDown, RefreshCw, Zap, CircleDot } from "lucide-react";
import wolfLogoUrl from "@assets/Design_sem_nome_(1)_1767752468659.png";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ROLE_LABELS, type UserRole, type ModuleName } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MenuSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    module?: string;
    masterOnly?: boolean;
  }[];
}

const MODULE_URL_MAPPING: Record<string, string[]> = {
  modulo_simulador: ["/calculator", "/simulador-compra", "/simulador-amortizacao", "/simulador-portabilidade"],
  modulo_roteiros: ["/roteiros"],
  modulo_base_clientes: ["/bases-clientes", "/split-txt-csv"],
  modulo_compra_lista: ["/compra-lista"],
  modulo_crm_vendas_campanhas: ["/vendas/campanhas", "/vendas/gestao-pipeline"],
  modulo_crm_vendas_atendimento: ["/vendas/atendimento", "/vendas/agenda", "/vendas/pipeline", "/vendas/consulta"],
  modulo_academia: ["/academia", "/academia/fundamentos", "/academia/quiz", "/academia/roleplay", "/academia/abordagem", "/academia/admin"],
  modulo_config_usuarios: ["/users"],
  modulo_config_precos: ["/config-precos", "/pricing"],
};

function getModuleForUrl(url: string): string | undefined {
  for (const [module, urls] of Object.entries(MODULE_URL_MAPPING)) {
    if (urls.includes(url) || urls.some(u => url.startsWith(u + "/"))) {
      return module;
    }
  }
  return undefined;
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout, hasModuleAccess } = useAuth();
  const { tenant, logoUrl } = useTenant();
  const [logoFailed, setLogoFailed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    principal: true,
    simuladores: false,
    operacional: false,
    clientes: false,
    admin: false,
    academia: false,
    alpha: false,
  });

  if (!user) return null;

  const userRole = user.role as UserRole;
  const isMaster = userRole === "master";

  const canShowMenuItem = (item: { url: string; masterOnly?: boolean; module?: string }): boolean => {
    if (item.masterOnly && !isMaster) return false;
    const module = item.module || getModuleForUrl(item.url);
    if (!module) return true;
    return hasModuleAccess(module as ModuleName);
  };

  // Wolf icon component - larger than other icons, preserves aspect ratio
  const WolfIcon = ({ className }: { className?: string }) => (
    <div className="relative flex items-center justify-center h-4 w-4 overflow-visible" style={{ marginLeft: '-6px', marginRight: '-6px' }}>
      <img 
        src={wolfLogoUrl} 
        alt="Alpha" 
        className="max-h-9 max-w-9 object-contain"
      />
    </div>
  );

  const menuSections: MenuSection[] = [
    {
      title: "Principal",
      icon: Home,
      items: [
        // "Início" removido pois é redundante estar dentro de "Principal"
      ],
    },
    {
      title: "Simuladores",
      icon: Calculator,
      items: [
        { title: "Simulador de Compra", url: "/simulador-compra", icon: Calculator, module: "modulo_simulador" },
        { title: "Simulador de Amortização", url: "/simulador-amortizacao", icon: TrendingDown, module: "modulo_simulador" },
        { title: "Simulador de Portabilidade", url: "/simulador-portabilidade", icon: RefreshCw, module: "modulo_simulador" },
      ],
    },
    {
      title: "Operacional",
      icon: FileText,
      items: [
        { title: "Convênios", url: "/agreements", icon: FileText, masterOnly: true },
        { title: "Bancos", url: "/banks", icon: Landmark, masterOnly: true },
        { title: "Tabelas de Coeficientes", url: "/coefficient-tables", icon: Table, masterOnly: true },
        { title: "Roteiros Bancários", url: "/roteiros", icon: Map, module: "modulo_roteiros" },
      ],
    },
    {
      title: "Base de Clientes",
      icon: Database,
      items: [
        { title: "Importar Base", url: "/bases-clientes", icon: Database, module: "modulo_base_clientes" },
        { title: "Nomenclaturas", url: "/nomenclaturas", icon: Tag, masterOnly: true },
        { title: "Compra de Lista", url: "/compra-lista", icon: ShoppingCart, module: "modulo_compra_lista" },
        { title: "Consulta Cliente", url: "/consulta-cliente", icon: UserSearch, module: "modulo_base_clientes" },
      ],
    },
    {
      title: "Administração",
      icon: Settings,
      items: [
        { title: "Admin Pedidos", url: "/admin-pedidos-lista", icon: ShieldCheck, masterOnly: true },
        { title: "Ambientes", url: "/admin/tenants", icon: Building2, masterOnly: true },
        { title: "Identidade Visual", url: "/admin/branding", icon: Palette, masterOnly: true },
        { title: "Config. Preços", url: "/config-precos", icon: DollarSign, module: "modulo_config_precos" },
        { title: "Usuários", url: "/users", icon: Users, module: "modulo_config_usuarios" },
        { title: "Config. Prompts IA", url: "/config-prompts", icon: Settings2, module: "modulo_academia" },
      ],
    },
    {
      title: "Treinamento",
      icon: GraduationCap,
      items: [
        { title: "Fundamentos", url: "/academia/fundamentos", icon: BookOpen, module: "modulo_academia" },
        { title: "Quiz", url: "/academia/quiz", icon: ClipboardCheck, module: "modulo_academia" },
        { title: "Roleplay IA", url: "/academia/roleplay", icon: MessageSquare, module: "modulo_academia" },
        { title: "Abordagem IA", url: "/academia/abordagem", icon: Wand2, module: "modulo_academia" },
        { title: "Admin Treinamento", url: "/academia/admin", icon: Award, module: "modulo_academia" },
      ],
    },
    {
      title: "ALPHA",
      icon: WolfIcon,
      items: [
        { title: "Campanhas", url: "/vendas/campanhas", icon: Target, module: "modulo_crm_vendas_campanhas" },
        { title: "Atendimento", url: "/vendas/atendimento", icon: Headphones, module: "modulo_crm_vendas_atendimento" },
        { title: "Pipeline", url: "/vendas/pipeline", icon: Kanban, module: "modulo_crm_vendas_atendimento" },
        { title: "Consulta", url: "/vendas/consulta", icon: Search, module: "modulo_crm_vendas_atendimento" },
        { title: "Agenda", url: "/vendas/agenda", icon: Calendar, module: "modulo_crm_vendas_atendimento" },
        { title: "Gestão Pipeline", url: "/vendas/gestao-pipeline", icon: BarChart3, module: "modulo_crm_vendas_campanhas", masterOnly: false },
      ],
    },
  ];

  const getSectionKey = (title: string) => title.toLowerCase().replace(/ /g, '');

  const toggleSection = (sectionTitle: string) => {
    const key = getSectionKey(sectionTitle);
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getFilteredSections = () => {
    return menuSections.map(section => {
      const visibleItems = section.items.filter(item => canShowMenuItem(item));
      return { ...section, items: visibleItems };
    }).filter(section => section.items.length > 0);
  };

  const filteredSections = getFilteredSections();

  return (
    <Sidebar className="border-r border-border bg-background">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          {!logoFailed && (
            <img 
              src={logoUrl} 
              alt={tenant?.name || "Logo"} 
              className="h-8 w-auto max-w-[140px] object-contain"
              onError={() => setLogoFailed(true)}
            />
          )}
          {(logoFailed || !tenant?.logoUrl) && (
            <span className="text-base font-semibold text-foreground">
              {tenant?.name || "GoldCard"}
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSections.map((section) => {
                const sectionKey = getSectionKey(section.title);
                const isOpen = openSections[sectionKey] ?? false;

                return (
                  <Collapsible
                    key={section.title}
                    open={isOpen}
                    onOpenChange={() => toggleSection(section.title)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className="w-full justify-between font-medium"
                          data-testid={`sidebar-section-${sectionKey}`}
                        >
                          <div className="flex items-center gap-2">
                            <section.icon className="h-4 w-4" />
                            <span className={section.title === "ALPHA" ? "font-bold" : ""}>
                              {section.title}
                            </span>
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isOpen && "rotate-180"
                            )} 
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="ml-4 mt-1 border-l border-border pl-2">
                          {section.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton
                                asChild
                                isActive={location === item.url}
                                data-testid={`sidebar-${item.url.replace(/\//g, '-').slice(1) || "home"}`}
                              >
                                <button onClick={() => setLocation(item.url)} className="w-full">
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </button>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/profile"}
              data-testid="sidebar-profile"
            >
              <button onClick={() => setLocation("/profile")} className="w-full">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[userRole]}
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="button-logout">
              <button onClick={handleLogout} className="w-full text-destructive">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
