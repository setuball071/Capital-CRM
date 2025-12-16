import { Calculator, Users, FileText, Table, LogOut, Home, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, Award, ChevronDown, Settings, Briefcase, Target, Headphones, Tag, Calendar, Kanban, BarChart3, Search, Settings2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ROLE_LABELS, type UserRole, type UserPermission } from "@shared/schema";
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
  modulo_simulador: ["/calculator", "/simulador-compra"],
  modulo_roteiros: ["/roteiros"],
  modulo_base_clientes: ["/bases-clientes"],
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
  const { user, logout } = useAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    principal: true,
    cadastros: false,
    clientes: false,
    admin: false,
    academia: false,
    crmvendas: false,
  });

  const { data: permissions = [] } = useQuery<UserPermission[]>({
    queryKey: ["/api/permissions/my"],
    enabled: !!user && user.role !== "master",
  });

  if (!user) return null;

  const userRole = user.role as UserRole;
  const isMaster = userRole === "master";

  const hasModulePermission = (module: string): boolean => {
    if (isMaster) return true;
    const permission = permissions.find(p => p.module === module);
    return permission?.canView === true;
  };

  const canShowMenuItem = (item: { url: string; masterOnly?: boolean }): boolean => {
    if (item.masterOnly && !isMaster) return false;
    const module = getModuleForUrl(item.url);
    if (!module) return true;
    return hasModulePermission(module);
  };

  const menuSections: MenuSection[] = [
    {
      title: "Principal",
      icon: Home,
      items: [
        { title: "Início", url: "/", icon: Home },
        { title: "Simulador Compra", url: "/simulador-compra", icon: Calculator, module: "modulo_simulador" },
      ],
    },
    {
      title: "Cadastros",
      icon: FileText,
      items: [
        { title: "Convênios", url: "/agreements", icon: FileText },
        { title: "Bancos", url: "/banks", icon: Landmark },
        { title: "Tabelas de Coeficientes", url: "/coefficient-tables", icon: Table },
        { title: "Roteiros Bancários", url: "/roteiros", icon: Map, module: "modulo_roteiros" },
      ],
    },
    {
      title: "Base de Clientes",
      icon: Database,
      items: [
        { title: "Importar Base", url: "/bases-clientes", icon: Database, module: "modulo_base_clientes" },
        { title: "Compra de Lista", url: "/compra-lista", icon: ShoppingCart, module: "modulo_compra_lista" },
        { title: "Consulta Cliente", url: "/consulta-cliente", icon: UserSearch, module: "modulo_base_clientes" },
      ],
    },
    {
      title: "Administração",
      icon: Settings,
      items: [
        { title: "Admin Pedidos", url: "/admin-pedidos-lista", icon: ShieldCheck },
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
      title: "CRM Vendas",
      icon: Target,
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

  const toggleSection = (sectionTitle: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionTitle.toLowerCase().replace(/ /g, '')]: !prev[sectionTitle.toLowerCase().replace(/ /g, '')]
    }));
  };

  const getSectionKey = (title: string) => title.toLowerCase().replace(/ /g, '');

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
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSections.map((section) => {
                const sectionKey = getSectionKey(section.title);
                const isOpen = openSections[sectionKey] ?? false;
                const hasActiveItem = section.items.some(item => location === item.url);

                return (
                  <Collapsible
                    key={section.title}
                    open={isOpen || hasActiveItem}
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
                            <span>{section.title}</span>
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              (isOpen || hasActiveItem) && "rotate-180"
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
