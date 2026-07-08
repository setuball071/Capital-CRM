import { Users, FileText, Table, Landmark, Map, Database, ShoppingCart, UserSearch, ShieldCheck, DollarSign, GraduationCap, BookOpen, ClipboardCheck, MessageSquare, Wand2, Settings, Briefcase, Target, Headphones, Tag, Calendar, Kanban, BarChart3, Search, Settings2, Building2, Palette, Upload, FileBarChart, History, Receipt, Brain, Sparkles, FlaskConical, ScrollText, BookMarked, Wrench, Bell, FileSignature, FileSpreadsheet, TrendingUp, CreditCard, KeyRound } from "lucide-react";

import { useLocation } from "wouter";
import { useState, useEffect, useRef, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { MatIcon } from "@/components/mat-icon";

// Ícones Material Symbols Rounded — nomes das seções conforme o design (.dc.html)
const MS_SECTION: Record<string, string> = {
  "Operacional": "settings_suggest",
  "Vendas": "trending_up",
  "Referências": "hub",
  "Desenvolvimento": "code",
  "Base de Clientes": "groups",
  "Administração": "admin_panel_settings",
  "Gestão Comercial": "work",
  "Financeiro": "payments",
};

// Itens: os de Vendas vêm do design; demais seguem o mesmo vocabulário Material
const MS_ITEM: Record<string, string> = {
  // Vendas (exato do design)
  "Pipeline": "view_kanban",
  "Consulta Individual": "person_search",
  "Lista Manual": "list_alt",
  "Tags": "sell",
  "Agenda": "calendar_month",
  "Campanhas": "campaign",
  "Gestão Pipeline": "leaderboard",
  "Minha Carteira": "account_balance_wallet",
  // Operacional
  "Minhas Propostas": "description",
  "Solicitar Boleto": "receipt_long",
  "Nota Promissória": "edit_document",
  "Base de Conhecimento": "menu_book",
  "Configurações": "settings",
  // Referências
  "Convênios": "handshake",
  "Bancos": "account_balance",
  "Tabelas de Coeficientes": "table_chart",
  "Roteiros Bancários": "map",
  "Material de Apoio": "folder_open",
  // Desenvolvimento
  "Profiler DISC": "psychology",
  "Feedbacks": "rate_review",
  "Fundamentos": "menu_book",
  "Roleplay IA": "forum",
  "Abordagem IA": "auto_awesome",
  "Perfis da Equipe": "groups",
  "Criador de Criativos IA": "brush",
  // Base de Clientes
  "Dashboard": "monitoring",
  "Importar Base": "database",
  "Nomenclaturas": "sell",
  "Filtros de Base": "filter_alt",
  "Consulta Cliente": "person_search",
  "Enriquecer Base": "auto_awesome",
  "Importar Higienizados": "cleaning_services",
  "Dados Complementares": "post_add",
  "Observações por CPF": "sticky_note_2",
  // Administração
  "Assinaturas": "credit_card",
  "Minha Assinatura": "credit_card",
  "Admin Pedidos": "verified_user",
  "Ambientes": "apartment",
  "Identidade Visual": "palette",
  "Config. Preços": "attach_money",
  "Config. Dados": "database",
  "Usuários": "person",
  "Funcionários": "badge",
  "Config. Prompts IA": "tune",
  "Central de Atualizações": "notifications",
  "Regras de Carteira": "shield",
  "API Keys Externas": "key",
  // Gestão Comercial
  "Dashboard da Empresa": "monitoring",
  "Equipes": "groups",
  "Metas Mensais": "flag",
  "Importar Produção": "upload",
  "Histórico Importações": "history",
  "Metas & Níveis": "military_tech",
  "Regulamento": "gavel",
  "Relatórios": "bar_chart",
  // Financeiro
  "Pagamentos": "receipt_long",
  "Produção": "bar_chart",
  "Proventos e Descontos": "account_balance_wallet",
  "Tabelas": "table_chart",
};

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
  modulo_simulador: ["/simuladores", "/calculator", "/simulador-compra", "/simulador-portabilidade", "/calculadora-contracheque", "/simulador-port-completo", "/criador-proposta"],
  modulo_roteiros: ["/roteiros"],
  modulo_base_clientes: ["/bases-clientes", "/split-txt-csv", "/compra-lista", "/consulta-cliente", "/nomenclaturas", "/dividir-csv", "/base-dashboard", "/enriquecer-base", "/importar-dados-complementares", "/admin/importar-observacoes"],
  modulo_config_usuarios: ["/users", "/config-precos", "/pricing", "/admin-pedidos-lista", "/funcionarios"],
  modulo_academia: ["/academia", "/academia/fundamentos", "/academia/quiz", "/academia/roleplay", "/academia/abordagem", "/academia/admin", "/config-prompts", "/desenvolvimento/fundamentos", "/desenvolvimento/roleplay", "/desenvolvimento/abordagem", "/desenvolvimento/feedbacks", "/desenvolvimento/profiler", "/desenvolvimento/profiler-gestao"],
  modulo_alpha: ["/vendas/campanhas", "/vendas/atendimento", "/vendas/agenda", "/vendas/pipeline", "/vendas/consulta", "/vendas/gestao-pipeline", "/vendas/etiquetas", "/vendas/importar-higienizados", "/vendas/minha-carteira"],
  modulo_financeiro: ["/financeiro/contratos", "/financeiro/producao", "/financeiro/proventos", "/financeiro/tabelas", "/financeiro/configuracoes"],
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
    operacional: false,
    referências: false,
    desenvolvimento: false,
    basedeclientes: false,
    administração: false,
    gestãocomercial: false,
    financeiro: false,
  });

  const { data: feedbackUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/feedbacks/unread-count"],
    refetchInterval: 60000,
  });

  // Pendências do corretor — badge em "Minhas Propostas" + toast
  const { toast } = useToast();
  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ["/api/contracts/pending-count"],
    refetchInterval: 60000,
  });
  const pendingCount = pendingData?.count || 0;
  const prevPendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (pendingData == null) return;
    const prev = prevPendingRef.current;
    // 1º carregamento com pendência, ou aumento de pendências → toast
    if (pendingCount > 0 && (prev === null || pendingCount > prev)) {
      toast({
        title: "Você tem contratos que precisam da sua atenção",
        description: `${pendingCount} contrato(s) pendente(s) em "Minhas Propostas".`,
      });
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, pendingData, toast]);

  if (!user) return null;

  const userRole = user.role as UserRole;
  const isMaster = userRole === "master";

  const tenantName = (tenant?.name || "").toLowerCase().trim();
  // tenantFeatureFlags: controla features por tenant
  // solicitar_boleto: disponível se o tenant existir (master pode sempre ver)
  const tenantFeatureFlags: Record<string, boolean> = {
    solicitar_boleto: !!tenant,
  };

  const canShowMenuItem = (item: { url: string; masterOnly?: boolean; module?: string; subItem?: string; roleOnly?: string; rolesAllowed?: string[]; tenantFeature?: string }): boolean => {
    // Master sempre vê tudo, inclusive itens com tenantFeature
    if (item.tenantFeature && !isMaster && !tenantFeatureFlags[item.tenantFeature]) return false;
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
      title: "Operacional",
      icon: Wrench,
      items: [
        { title: "Minhas Propostas", url: "/contratos", icon: ScrollText },
        { title: "Solicitar Boleto", url: "/solicitar-boleto", icon: Receipt, module: "modulo_roteiros", tenantFeature: "solicitar_boleto" },
        { title: "Nota Promissória", url: "/nota-promissoria", icon: FileSignature, rolesAllowed: ["master", "coordenacao"] },
        { title: "Base de Conhecimento", url: "/base-conhecimento", icon: BookMarked, module: "modulo_assistente", subItem: "base_conhecimento" },
        { title: "Configurações", url: "/contratos/configuracoes", icon: Settings, rolesAllowed: ["master", "operacional"] },
      ],
    },
    {
      title: "Vendas",
      icon: Kanban,
      items: [
        { title: "Pipeline", url: "/vendas/pipeline", icon: Kanban, module: "modulo_alpha", subItem: "pipeline" },
        { title: "Consulta Individual", url: "/vendas/consulta", icon: Search, module: "modulo_alpha", subItem: "consulta" },
        { title: "Lista Manual", url: "/vendas/atendimento", icon: Headphones, module: "modulo_alpha", subItem: "atendimento" },
        { title: "Tags", url: "/vendas/etiquetas", icon: Tag, module: "modulo_alpha", subItem: "etiquetas" },
        { title: "Agenda", url: "/vendas/agenda", icon: Calendar, module: "modulo_alpha", subItem: "agenda" },
        { title: "Campanhas", url: "/vendas/campanhas", icon: Target, module: "modulo_alpha", subItem: "campanhas" },
        { title: "Gestão Pipeline", url: "/vendas/gestao-pipeline", icon: BarChart3, module: "modulo_alpha", subItem: "gestao_pipeline" },
        { title: "Minha Carteira", url: "/vendas/minha-carteira", icon: Upload, module: "modulo_alpha", subItem: "minha_carteira" },
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
        { title: "Filtros de Base", url: "/compra-lista", icon: ShoppingCart, module: "modulo_base_clientes", subItem: "compra_lista" },
        { title: "Consulta Cliente", url: "/consulta-cliente", icon: UserSearch, module: "modulo_base_clientes", subItem: "consulta" },
        { title: "Enriquecer Base", url: "/enriquecer-base", icon: Sparkles, module: "modulo_base_clientes", subItem: "importacao" },
        { title: "Importar Higienizados", url: "/vendas/importar-higienizados", icon: Sparkles, module: "modulo_alpha", subItem: "importacao_higienizados", rolesAllowed: ["master", "coordenacao"] },
        { title: "Dados Complementares", url: "/importar-dados-complementares", icon: FileSpreadsheet, rolesAllowed: ["master", "coordenacao"] },
        { title: "Observações por CPF", url: "/admin/importar-observacoes", icon: FileText, rolesAllowed: ["master", "coordenacao", "financeiro"] },
      ],
    },
    {
      title: "Administração",
      icon: Settings,
      items: [
        { title: "Assinaturas", url: "/admin/assinaturas", icon: CreditCard, masterOnly: true },
        { title: "Minha Assinatura", url: "/assinatura", icon: CreditCard, rolesAllowed: ["coordenacao", "vendedor", "financeiro"] },
        { title: "Admin Pedidos", url: "/admin-pedidos-lista", icon: ShieldCheck, masterOnly: true },
        { title: "Ambientes", url: "/admin/tenants", icon: Building2, module: "modulo_config_usuarios", subItem: "ambientes" },
        { title: "Identidade Visual", url: "/admin/branding", icon: Palette, masterOnly: true },
        { title: "Config. Preços", url: "/config-precos", icon: DollarSign, module: "modulo_config_usuarios", subItem: "precos" },
        { title: "Config. Dados", url: "/admin/configuracoes-dados", icon: Database, masterOnly: true },
        { title: "Usuários", url: "/users", icon: Users, module: "modulo_config_usuarios", subItem: "usuarios" },
        { title: "Funcionários", url: "/funcionarios", icon: Users, module: "modulo_config_usuarios", subItem: "usuarios" },
        { title: "Config. Prompts IA", url: "/config-prompts", icon: Settings2, module: "modulo_academia", subItem: "dashboard" },
        { title: "Central de Atualizações", url: "/admin/atualizacoes", icon: Bell, masterOnly: true },
        { title: "Regras de Carteira", url: "/admin/carteira-regras", icon: ShieldCheck, masterOnly: true },
        { title: "API Keys Externas", url: "/admin/api-keys", icon: KeyRound, masterOnly: true },
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
    {
      title: "Financeiro",
      icon: TrendingUp,
      items: [
        { title: "Pagamentos", url: "/financeiro/contratos", icon: FileText, module: "modulo_financeiro", subItem: "contratos" },
        { title: "Produção", url: "/financeiro/producao", icon: BarChart3, module: "modulo_financeiro", subItem: "producao" },
        { title: "Proventos e Descontos", url: "/financeiro/proventos", icon: Receipt, module: "modulo_financeiro", subItem: "proventos" },
        { title: "Tabelas", url: "/financeiro/tabelas", icon: Table, module: "modulo_financeiro", subItem: "tabelas" },
        { title: "Configurações", url: "/financeiro/configuracoes", icon: Settings2, module: "modulo_financeiro", subItem: "configuracoes" },
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
      <SidebarHeader>
        {/* Logo: 52px, alinhada à esquerda — padding 24/20/18 (design) */}
        <div
          className="w-full flex items-center justify-start"
          style={{ padding: "24px 20px 18px" }}
          data-testid="sidebar-logo-container"
        >
          {!logoFailed && logoUrl ? (
            <img
              src={logoUrl}
              alt={tenant?.name || "Logo"}
              className={cn("max-w-full object-contain", theme === "dark" && "brightness-0 invert")}
              style={{ height: 52, display: 'block' }}
              onError={() => setLogoFailed(true)}
              data-testid="sidebar-logo-image"
            />
          ) : (
            <img
              src={theme === "dark" ? "/capital-go-white.png" : "/capital-go-gradient.png"}
              alt={tenant?.name || "Capital Go"}
              className="max-w-full object-contain"
              style={{ height: 52, display: "block" }}
              data-testid="sidebar-logo-fallback"
            />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground group-data-[collapsible=icon]:hidden" style={{ padding: "6px 12px 6px" }}>
                GERAL
              </div>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === homeUrl || location === "/dashboard-vendedor" || location === "/dashboard"}
                  data-testid="sidebar-home"
                >
                  <button onClick={() => setLocation(homeUrl)} className="w-full text-[14.5px]">
                    <MatIcon name="home" />
                    <span>Home</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {hasModuleAccess("modulo_simulador" as ModuleName) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/simuladores"}
                    data-testid="sidebar-simuladores"
                  >
                    <button onClick={() => setLocation("/simuladores")} className="w-full text-[14.5px]">
                      <MatIcon name="calculate" />
                      <span>Simuladores</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {(() => {
                let ultimoGrupo = "";
                return filteredSections.map((section) => {
                const sectionKey = getSectionKey(section.title);
                const isOpen = openSections[sectionKey] ?? false;
                const hasActiveItem = section.items.some(item => location === item.url);
                const grupoSuper = /Administra|Gest|Financ/i.test(section.title) ? "GESTÃO" : "OPERAÇÃO";
                const mostrarGrupo = grupoSuper !== ultimoGrupo;
                ultimoGrupo = grupoSuper;

                return (
                  <Fragment key={section.title}>
                  {mostrarGrupo && (
                    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground group-data-[collapsible=icon]:hidden" style={{ padding: "14px 12px 6px" }}>
                      {grupoSuper}
                    </div>
                  )}
                  <Collapsible
                    open={isOpen}
                    onOpenChange={() => toggleSection(section.title)}
                  >
                    <SidebarMenuItem>
                      <div className="rounded-md">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={hasActiveItem}
                            className={cn(
                              "w-full justify-between text-[14.5px]",
                              hasActiveItem ? "font-semibold" : "font-medium"
                            )}
                            data-testid={`sidebar-section-${sectionKey}`}
                          >
                            <div className="flex items-center gap-2">
                              <MatIcon name={MS_SECTION[section.title] ?? "folder"} className={hasActiveItem ? undefined : "text-muted-foreground"} />
                              <span>{section.title}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {section.title === "Desenvolvimento" && (feedbackUnread?.count || 0) > 0 && (
                                <span className="h-2 w-2 rounded-full bg-destructive" data-testid="badge-desenvolvimento-unread" />
                              )}
                              <MatIcon
                                name="expand_more"
                                size={18}
                                className={cn(
                                  "text-muted-foreground transition-transform duration-200",
                                  isOpen && "rotate-180"
                                )}
                              />
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="transition-all duration-200">
                          <SidebarMenu className="mt-0.5">
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
                                      "w-full pl-7 text-sm",
                                      isActive ? "font-semibold" : "font-normal"
                                    )}>
                                      <MatIcon name={MS_ITEM[item.title] ?? "chevron_right"} size={18} className={isActive ? undefined : "text-muted-foreground"} />
                                      <span className="flex-1">{item.title}</span>
                                      {item.url === "/desenvolvimento/feedbacks" && (feedbackUnread?.count || 0) > 0 && (
                                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold" data-testid="badge-feedbacks-unread">
                                          {feedbackUnread!.count}
                                        </Badge>
                                      )}
                                      {item.url === "/contratos" && pendingCount > 0 && (
                                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold" data-testid="badge-pendencias-corretor">
                                          {pendingCount > 9 ? "9+" : pendingCount}
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
                  </Fragment>
                );
                });
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-1 pb-1 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1 p-1 rounded-[10px] bg-muted/60 border border-sidebar-border">
                <button
                  onClick={() => { if (theme === "dark") toggleTheme(); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-semibold transition-colors",
                    theme !== "dark" ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground hover:text-sidebar-foreground"
                  )}
                  style={{ padding: "7px 0" }}
                  data-testid="button-theme-light"
                >
                  <MatIcon name="light_mode" size={16} /> Claro
                </button>
                <button
                  onClick={() => { if (theme !== "dark") toggleTheme(); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-semibold transition-colors",
                    theme === "dark" ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground hover:text-sidebar-foreground"
                  )}
                  style={{ padding: "7px 0" }}
                  data-testid="button-theme-dark"
                >
                  <MatIcon name="dark_mode" size={16} /> Escuro
                </button>
              </div>
            </div>
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
              <button onClick={() => setLocation("/profile")} className="w-full !h-auto py-1.5">
                <Avatar className="h-[34px] w-[34px]">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: "var(--grad-go)" }}>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-[13px] font-semibold truncate w-full">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[userRole]}
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="button-logout">
              <button onClick={handleLogout} className="w-full text-[14px] font-medium" style={{ color: "#E53935" }}>
                <MatIcon name="logout" size={19} />
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
