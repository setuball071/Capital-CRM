import { Calculator, Users, FileText, Table, LogOut, Home, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, Award, ChevronDown, Settings, Briefcase } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
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
import { ROLE_LABELS, type UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MenuSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    show: boolean;
  }[];
  show: boolean;
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
  });

  if (!user) return null;

  const userRole = user.role as UserRole;
  
  const isMaster = userRole === "master";
  const isAtendimento = userRole === "atendimento";
  const isCoordenacao = userRole === "coordenacao";
  const isOperacional = userRole === "operacional";
  
  const canAccessAgreements = isMaster || isAtendimento || isOperacional;
  const canAccessBanks = isMaster;
  const canAccessCoefficientTables = isMaster || isAtendimento || isOperacional;
  const canAccessUsers = isMaster || isAtendimento || isCoordenacao;
  const canAccessRoteiros = isMaster || isAtendimento || isOperacional;
  const canAccessBasesClientes = isMaster;
  const canAccessCompraLista = isMaster;
  const canAccessConsultaCliente = isMaster;

  const menuSections: MenuSection[] = [
    {
      title: "Principal",
      icon: Home,
      show: true,
      items: [
        { title: "Início", url: "/", icon: Home, show: true },
        { title: "Simulador Compra", url: "/simulador-compra", icon: Calculator, show: true },
      ],
    },
    {
      title: "Cadastros",
      icon: FileText,
      show: canAccessAgreements || canAccessBanks || canAccessCoefficientTables || canAccessRoteiros,
      items: [
        { title: "Convênios", url: "/agreements", icon: FileText, show: canAccessAgreements },
        { title: "Bancos", url: "/banks", icon: Landmark, show: canAccessBanks },
        { title: "Tabelas de Coeficientes", url: "/coefficient-tables", icon: Table, show: canAccessCoefficientTables },
        { title: "Roteiros Bancários", url: "/roteiros", icon: Map, show: canAccessRoteiros },
      ],
    },
    {
      title: "Base de Clientes",
      icon: Database,
      show: canAccessBasesClientes || canAccessCompraLista || canAccessConsultaCliente,
      items: [
        { title: "Importar Base", url: "/bases-clientes", icon: Database, show: canAccessBasesClientes },
        { title: "Compra de Lista", url: "/compra-lista", icon: ShoppingCart, show: canAccessCompraLista },
        { title: "Consulta Cliente", url: "/consulta-cliente", icon: UserSearch, show: canAccessConsultaCliente },
      ],
    },
    {
      title: "Administração",
      icon: Settings,
      show: isMaster || canAccessUsers,
      items: [
        { title: "Admin Pedidos", url: "/admin-pedidos-lista", icon: ShieldCheck, show: isMaster },
        { title: "Config. Preços", url: "/config-precos", icon: DollarSign, show: isMaster },
        { title: "Usuários", url: "/users", icon: Users, show: canAccessUsers },
      ],
    },
    {
      title: "Academia ConsigOne",
      icon: GraduationCap,
      show: true,
      items: [
        { title: "Fundamentos", url: "/academia/fundamentos", icon: BookOpen, show: true },
        { title: "Quiz", url: "/academia/quiz", icon: ClipboardCheck, show: true },
        { title: "Roleplay IA", url: "/academia/roleplay", icon: MessageSquare, show: true },
        { title: "Abordagem IA", url: "/academia/abordagem", icon: Wand2, show: true },
        { title: "Admin Academia", url: "/academia/admin", icon: Award, show: isMaster },
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuSections
                .filter((section) => section.show)
                .map((section) => {
                  const visibleItems = section.items.filter(item => item.show);
                  if (visibleItems.length === 0) return null;
                  
                  const sectionKey = getSectionKey(section.title);
                  const isOpen = openSections[sectionKey] ?? false;
                  const hasActiveItem = visibleItems.some(item => location === item.url);

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
                            {visibleItems.map((item) => (
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
