import { Calculator, Users, FileText, Table, LogOut, User as UserIcon, Home, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, Award } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS, type UserRole } from "@shared/schema";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const userRole = user.role as UserRole;
  
  // Permission checks based on role hierarchy
  const isMaster = userRole === "master";
  const isAtendimento = userRole === "atendimento";
  const isCoordenacao = userRole === "coordenacao";
  const isOperacional = userRole === "operacional";
  const isVendedor = userRole === "vendedor";
  
  // Access rules:
  // - master: all screens
  // - atendimento: Simulator, Agreements, Coefficient Tables, Users
  // - coordenacao: Simulator, Users (restricted to their team)
  // - operacional: Simulator, Agreements, Coefficient Tables
  // - vendedor: Simulator only
  
  const canAccessAgreements = isMaster || isAtendimento || isOperacional;
  const canAccessBanks = isMaster; // Only master can manage banks
  const canAccessCoefficientTables = isMaster || isAtendimento || isOperacional;
  const canAccessUsers = isMaster || isAtendimento || isCoordenacao;
  const canAccessRoteiros = isMaster || isAtendimento || isOperacional;
  const canAccessBasesClientes = isMaster; // Only master can import bases
  const canAccessCompraLista = isMaster; // Only master can access - restricted for publishing
  const canAccessConsultaCliente = isMaster; // Only master can access - restricted for publishing

  const menuItems = [
    {
      title: "Início",
      url: "/",
      icon: Home,
      show: true,
    },
    {
      title: "Simulador Compra",
      url: "/simulador-compra",
      icon: Calculator,
      show: true,
    },
    {
      title: "Convênios",
      url: "/agreements",
      icon: FileText,
      show: canAccessAgreements,
    },
    {
      title: "Bancos",
      url: "/banks",
      icon: Landmark,
      show: canAccessBanks,
    },
    {
      title: "Tabelas de Coeficientes",
      url: "/coefficient-tables",
      icon: Table,
      show: canAccessCoefficientTables,
    },
    {
      title: "Roteiros Bancários",
      url: "/roteiros",
      icon: Map,
      show: canAccessRoteiros,
    },
    {
      title: "Base de Clientes",
      url: "/bases-clientes",
      icon: Database,
      show: canAccessBasesClientes,
    },
    {
      title: "Compra de Lista",
      url: "/compra-lista",
      icon: ShoppingCart,
      show: canAccessCompraLista,
    },
    {
      title: "Consulta Cliente",
      url: "/consulta-cliente",
      icon: UserSearch,
      show: canAccessConsultaCliente, // Only master can access - restricted for publishing
    },
    {
      title: "Admin Pedidos",
      url: "/admin-pedidos-lista",
      icon: ShieldCheck,
      show: isMaster, // Only master can access admin panel
    },
    {
      title: "Config. Preços",
      url: "/config-precos",
      icon: DollarSign,
      show: isMaster, // Only master can configure pricing
    },
    {
      title: "Usuários",
      url: "/users",
      icon: Users,
      show: canAccessUsers,
    },
  ];

  // Academia ConsigOne menu items - available to all logged in users
  const academiaItems = [
    {
      title: "Fundamentos",
      url: "/academia/fundamentos",
      icon: BookOpen,
      show: true,
    },
    {
      title: "Quiz",
      url: "/academia/quiz",
      icon: ClipboardCheck,
      show: true,
    },
    {
      title: "Roleplay IA",
      url: "/academia/roleplay",
      icon: MessageSquare,
      show: true,
    },
    {
      title: "Abordagem IA",
      url: "/academia/abordagem",
      icon: Wand2,
      show: true,
    },
    {
      title: "Admin Academia",
      url: "/academia/admin",
      icon: Award,
      show: isMaster,
    },
  ];

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
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => item.show)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`sidebar-${item.url.replace("/", "") || "home"}`}
                    >
                      <button onClick={() => setLocation(item.url)} className="w-full">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Academia ConsigOne Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Academia ConsigOne
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {academiaItems
                .filter((item) => item.show)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`sidebar-academia-${item.url.split("/").pop()}`}
                    >
                      <button onClick={() => setLocation(item.url)} className="w-full">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
