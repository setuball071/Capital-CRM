import { Calculator, Users, FileText, Table, LogOut, User as UserIcon } from "lucide-react";
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

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const isMaster = user.role === "master";
  const isCoordinator = user.role === "coordenacao";
  const hasManagerAccess = isMaster || isCoordinator;

  const menuItems = [
    {
      title: "Simulador",
      url: "/",
      icon: Calculator,
      show: true,
    },
    {
      title: "Convênios",
      url: "/agreements",
      icon: FileText,
      show: isMaster,
    },
    {
      title: "Tabelas de Coeficientes",
      url: "/coefficient-tables",
      icon: Table,
      show: isMaster,
    },
    {
      title: "Usuários",
      url: "/users",
      icon: Users,
      show: hasManagerAccess,
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
                    {user.role === "master" ? "Administrador" : user.role === "coordenacao" ? "Coordenador" : "Vendedor"}
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
