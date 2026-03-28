import { Calculator, Users, FileText, Table, LogOut, Home, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, ChevronDown, Settings, Briefcase, Target, Headphones, Tag, Calendar, Kanban, BarChart3, Search, Settings2, Building2, Palette, RefreshCw, Upload, FileBarChart, History, Receipt, Brain, Sparkles, FlaskConical, ScrollText, GitBranch, PlusCircle, BookMarked, Wrench, Moon, Sun, Bell } from "lucide-react";

import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
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
    subItem?: string;
    masterOnly?: boolean;
    roleOnly?: string;
    rolesAllowed?: string[];
    tenantFeature?: string;
  }[];
}

// Module URL mapping - matches new module structure
const MODULE_URL_MAPPING: Record<string, string[]> = {
  modulo_simulador: ["/calculator", "/simulador-compra", "/simulador-portabilidade"],
  modulo_roteiros: ["/roteiros"],
  modulo_base_clientes: ["/bases-clientes", "/split-txt-csv", "/compra-lista", "/consulta-cliente", "/nomenclaturas", "/dividir-csv", "/base-dashboard"],
  modulo_config_usuarios: ["/users", "/config-precos", "/pricing", "/admin-pedidos-lista", "/funcionarios"],
  modulo_academia: ["/academia", "/academia/fundamentos", "/academia/quiz", "/academia/roleplay", "/academia/abordagem", "/academia/admin", "/config-prompts", "/desenvolvimento/fundamentos", "/desenvolvimento/roleplay", "/desenvolvimento/abordagem", "/desenvolvimento/feedbacks", "/desenvolvimento/profiler", "/desenvolvimento/profiler-gestao"],
  modulo_alpha: ["/vendas/campanhas", "/vendas/atendimento", "/vendas/agenda", "/vendas/pipeline", "/vendas/consulta", "/vendas/gestao-pipeline", "/vendas/etiquetas", "/vendas/importar-higienizados"],
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
  const { user, logout, hasModuleAccess, hasSubItemAccess } = useAuth();
  const { tenant, logoUrl, logoHeight, sidebarGradient, useSidebarGradient, sidebarBgColor } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const [logoFailed, setLogoFailed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vendas: true,
    simuladores: false,
    operacional: false,
    referências: false,
    desenvolvimento: false,
    basedeclientes: false,
    administração: false,
    gestãocomercial: false,
  });

  const { data: feedbackUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/feedbacks/unread-count"],
    refetchInterval: 60000,
  });

  if (!user) return null;

  const userRole = user.role as UserRole;
  const isMaster = userRole === "master";

  const tenantName = (tenant?.name || "").toLowerCase().trim();
  const tenantFeatureFlags: Record<string, boolean> = {
    solicitar_boleto: tenantName.includes("capital"),
  };

  const canShowMenuItem = (item: { url: string; masterOnly?: boolean; module?: string; subItem?: string; roleOnly?: string; rolesAllowed?: string[]; tenantFeature?: string }): boolean => {
    if (item.tenantFeature && !tenantFeatureFlags[item.tenantFeature]) return false;
    if (item.masterOnly && !isMaster) return false;
    if (item.roleOnly && userRole !== item.roleOnly && !isMaster) return false;
    if (item.rolesAllowed && !item.rolesAllowed.includes(userRole) && !isMaster) return false;
    const module = item.module || getModuleForUrl(item.url);
    if (!module) return true;
    
    // If sub-item is specified, check granular permission
    if (item.subItem) {
      return hasSubItemAccess(module as ModuleName, item.subItem);
    }
    
    // Otherwise fall back to module-level access
    return hasModuleAccess(module as ModuleName);
  };

  const homeUrl = ["master", "coordenacao"].includes(userRole) ? "/dashboard" : "/dashboard-vendedor";

  const menuSections: MenuSection[] = [
    {
      title: "Vendas",
      icon: Kanban,
      items: [
        { title: "Pipeline", url: "/vendas/pipeline", icon: Kanban, module: "modulo_alpha", subItem: "pipeline" },
        { title: "Consulta Individual", url: "/vendas/consulta", icon: Search, module: "modulo_alpha", subItem: "consulta" },
        { title: "Lista Manual", url: "/vendas/atendimento", icon: Headphones, module: "modulo_alpha", subItem: "atendimento" },
        { title: "Etiquetas", url: "/vendas/etiquetas", icon: Tag, module: "modulo_alpha", subItem: "etiquetas" },
        { title: "Agenda", url: "/vendas/agenda", icon: Calendar, module: "modulo_alpha", subItem: "agenda" },
        { title: "Campanhas", url: "/vendas/campanhas", icon: Target, module: "modulo_alpha", subItem: "campanhas" },
        { title: "Gestão Pipeline", url: "/vendas/gestao-pipeline", icon: BarChart3, module: "modulo_alpha", subItem: "gestao_pipeline" },
        { title: "Importar Higienizados", url: "/vendas/importar-higienizados", icon: Sparkles, module: "modulo_alpha", subItem: "importacao_higienizados", rolesAllowed: ["master", "coordenacao"] },
      ],
    },
    {
      title: "Simuladores",
      icon: Calculator,
      items: [
        { title: "Simulador de Compra", url: "/simulador-compra", icon: Calculator, module: "modulo_simulador", subItem: "simulador_compra" },
        { title: "Simulador de Amortização", url: "/simulador-portabilidade", icon: RefreshCw, module: "modulo_simulador", subItem: "simulador_portabilidade" },
      ],
    },
    {
      title: "Operacional",
      icon: Wrench,
      items: [
        { title: "Nova Proposta", url: "/contratos/nova", icon: PlusCircle, rolesAllowed: ["master", "coordenacao", "vendedor"] },
        { title: "Minhas Propostas", url: "/contratos", icon: ScrollText },
        { title: "Solicitar Boleto", url: "/solicitar-boleto", icon: Receipt, module: "modulo_roteiros", tenantFeature: "solicitar_boleto" },
        { title: "Gestão de Fluxos", url: "/contratos/fluxos", icon: GitBranch, masterOnly: true },
      ],
    },
    {
      title: "Referências",
      icon: BookMarked,
      items: [
        { title: "Convênios", url: "/agreements", icon: FileText, module: "modulo_roteiros", subItem: "convenios" },
        { title: "Bancos", url: "/banks", icon: Landmark, module: "modulo_roteiros", subItem: "bancos" },
        { title: "Tabelas de Coeficientes", url: "/coefficient-tables", icon: Table, module: "modulo_roteiros", subItem: "tabelas_coeficientes" },
        { title: "Roteiros Bancários", url: "/roteiros", icon: Map, module: "modulo_roteiros", subItem: "roteiros_bancarios" },
        { title: "Material de Apoio", url: "/material-apoio", icon: FileText },
      ],
    },
    {
      title: "Desenvolvimento",
      icon: GraduationCap,
      items: [
        { title: "Profiler DISC", url: "/desenvolvimento/profiler", icon: Brain, module: "modulo_academia", subItem: "profiler" },
        { title: "Feedbacks", url: "/desenvolvimento/feedbacks", icon: ClipboardCheck, module: "modulo_academia", subItem: "feedbacks" },
        { title: "Fundamentos", url: "/desenvolvimento/fundamentos", icon: BookOpen, module: "modulo_academia", subItem: "fundamentos" },
        { title: "Roleplay IA", url: "/desenvolvimento/roleplay", icon: MessageSquare, module: "modulo_academia", subItem: "roleplay" },
        { title: "Abordagem IA", url: "/desenvolvimento/abordagem", icon: Wand2, module: "modulo_academia", subItem: "scripts" },
        { title: "Perfis da Equipe", url: "/desenvolvimento/profiler-gestao", icon: Users, module: "modulo_academia", subItem: "profiler", rolesAllowed: ["master", "coordenacao"] },
        { title: "Criador de Criativos IA", url: "/criador-criativos", icon: Sparkles, masterOnly: true },
      ],
    },
    {
      title: "Base de Clientes",
      icon: Database,
      items: [
        { title: "Dashboard", url: "/base-dashboard", icon: BarChart3, module: "modulo_base_clientes", subItem: "consulta" },
        { title: "Importar Base", url: "/bases-clientes", icon: Database, module: "modulo_base_clientes", subItem: "importacao" },
        { title: "Nomenclaturas", url: "/nomenclaturas", icon: Tag, masterOnly: true },
        { title: "Compra de Lista", url: "/compra-lista", icon: ShoppingCart, module: "modulo_base_clientes", subItem: "compra_lista" },
        { title: "Consulta Cliente", url: "/consulta-cliente", icon: UserSearch, module: "modulo_base_clientes", subItem: "consulta" },
      ],
    },
    {
      title: "Administração",
      icon: Settings,
      items: [
        { title: "Admin Pedidos", url: "/admin-pedidos-lista", icon: ShieldCheck, masterOnly: true },
        { title: "Ambientes", url: "/admin/tenants", icon: Building2, module: "modulo_config_usuarios", subItem: "ambientes" },
        { title: "Identidade Visual", url: "/admin/branding", icon: Palette, masterOnly: true },
        { title: "Config. Preços", url: "/config-precos", icon: DollarSign, module: "modulo_config_usuarios", subItem: "precos" },
        { title: "Usuários", url: "/users", icon: Users, module: "modulo_config_usuarios", subItem: "usuarios" },
        { title: "Funcionários", url: "/funcionarios", icon: Users, module: "modulo_config_usuarios", subItem: "usuarios" },
        { title: "Config. Prompts IA", url: "/config-prompts", icon: Settings2, module: "modulo_academia", subItem: "dashboard" },
        { title: "Central de Atualizações", url: "/admin/atualizacoes", icon: Bell, masterOnly: true },
        { title: "Regras de Carteira", url: "/admin/carteira-regras", icon: ShieldCheck, masterOnly: true },
      ],
    },
    {
      title: "Gestão Comercial",
      icon: Briefcase,
      items: [
        { title: "Dashboard da Empresa", url: "/vendas/gestao-comercial/dashboard", icon: BarChart3, rolesAllowed: ["master", "coordenacao"] },
        { title: "Equipes", url: "/equipes", icon: Users, rolesAllowed: ["master", "coordenacao"] },
        { title: "Metas Mensais", url: "/vendas/gestao-comercial/metas-mensais", icon: Target, rolesAllowed: ["master", "coordenacao"] },
        { title: "Importar Produção", url: "/vendas/gestao-comercial/importar-producao", icon: Upload, rolesAllowed: ["master", "coordenacao"] },
        { title: "Histórico Importações", url: "/vendas/gestao-comercial/historico-importacoes", icon: History, rolesAllowed: ["master", "coordenacao"] },
        { title: "Metas & Níveis", url: "/vendas/gestao-comercial/metas-niveis", icon: Target, rolesAllowed: ["master", "coordenacao"] },
        { title: "Regulamento", url: "/vendas/gestao-comercial/regulamento", icon: FileText, rolesAllowed: ["master", "coordenacao"] },
        { title: "Relatórios", url: "/vendas/gestao-comercial/relatorios", icon: FileBarChart, rolesAllowed: ["master", "coordenacao"] },
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

  // Generate sidebar background style
  // The Sidebar component uses bg-sidebar class on inner elements
  // We use CSS selector to override the inner element's background
  const hasSidebarGradient = useSidebarGradient && sidebarGradient;
  const hasCustomBgColor = sidebarBgColor && sidebarBgColor !== "#ffffff";
  
  // Create inline style tag for sidebar background override
  const sidebarBgStyle = (hasSidebarGradient || hasCustomBgColor) ? (
    <style>{`
      [data-slot="sidebar-inner"] {
        background: ${hasSidebarGradient ? sidebarGradient : sidebarBgColor} !important;
      }
    `}</style>
  ) : null;

  return (
    <>
      {sidebarBgStyle}
      <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border">
        <div 
          className="w-full flex items-center justify-center px-3 py-4"
          style={{ minHeight: `${Math.max(logoHeight + 16, 48)}px` }}
          data-testid="sidebar-logo-container"
        >
          {!logoFailed && logoUrl ? (
            <img 
              src={logoUrl} 
              alt={tenant?.name || "Logo"} 
              className={cn("max-w-full object-contain", theme === "dark" && "brightness-0 invert")}
              style={{ maxHeight: `${logoHeight}px`, display: 'block' }}
              onError={() => setLogoFailed(true)}
              data-testid="sidebar-logo-image"
            />
          ) : (
            <span className="text-lg font-semibold text-foreground text-center">
              {tenant?.name || "GoldCard"}
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === homeUrl || location === "/dashboard-vendedor" || location === "/dashboard"}
                  data-testid="sidebar-home"
                >
                  <button onClick={() => setLocation(homeUrl)} className="w-full">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {filteredSections.map((section) => {
                const sectionKey = getSectionKey(section.title);
                const isOpen = openSections[sectionKey] ?? false;
                const hasActiveItem = section.items.some(item => location === item.url);

                return (
                  <Collapsible
                    key={section.title}
                    open={isOpen}
                    onOpenChange={() => toggleSection(section.title)}
                  >
                    <SidebarMenuItem>
                      <div className={cn(
                        "transition-all duration-200 rounded-md",
                        isOpen && "border-l-2 border-primary"
                      )}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={cn(
                              "w-full justify-between transition-all duration-200 text-foreground",
                              isOpen ? "font-semibold" : "font-normal"
                            )}
                            style={isOpen ? { backgroundColor: 'rgba(108, 43, 217, 0.08)' } : undefined}
                            data-testid={`sidebar-section-${sectionKey}`}
                          >
                            <div className="flex items-center gap-2">
                              <section.icon className="h-4 w-4" />
                              <span>{section.title}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {section.title === "Desenvolvimento" && (feedbackUnread?.count || 0) > 0 && (
                                <span className="h-2 w-2 rounded-full bg-destructive" data-testid="badge-desenvolvimento-unread" />
                              )}
                              <ChevronDown 
                                className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  isOpen ? "rotate-180 text-primary" : "text-foreground/40"
                                )} 
                              />
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="transition-all duration-200">
                          <SidebarMenu className="ml-4 mt-1 border-l border-border pl-2">
                            {section.items.map((item) => {
                              const isActive = location === item.url;
                              return (
                                <SidebarMenuItem key={item.title}>
                                  <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    data-testid={`sidebar-${item.url.replace(/\//g, '-').slice(1) || "home"}`}
                                  >
                                    <button onClick={() => setLocation(item.url)} className={cn(
                                      "w-full",
                                      isActive && "font-medium"
                                    )}>
                                      <item.icon className="h-4 w-4" />
                                      <span className="flex-1">{item.title}</span>
                                      {item.url === "/desenvolvimento/feedbacks" && (feedbackUnread?.count || 0) > 0 && (
                                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold" data-testid="badge-feedbacks-unread">
                                          {feedbackUnread!.count}
                                        </Badge>
                                      )}
                                    </button>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </div>
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
              onClick={toggleTheme}
              className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user.isMaster && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/hub"}
                data-testid="sidebar-hub-beta"
              >
                <button onClick={() => setLocation("/hub")} className="w-full">
                  <FlaskConical className="h-4 w-4" />
                  <span>Layout Beta</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
    </>
  );
}
