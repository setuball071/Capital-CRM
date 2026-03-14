import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
import {
  Target,
  Calculator,
  BookOpen,
  Database,
  GraduationCap,
  Briefcase,
  LayoutDashboard,
  Map,
  ChevronRight,
  GripVertical,
  FlaskConical,
  ArrowLeft,
  Bell,
  User,
  LogOut,
  Wrench,
  Megaphone,
  Users,
  Kanban,
  UserSearch,
  Tag,
  Calendar,
  BarChart3,
  Upload,
  ClipboardCheck,
  FileText,
  ShoppingCart,
  Scissors,
  BookMarked,
  Landmark,
  Globe,
  MessageSquare,
  Wand2,
  Brain,
  Flag,
  TrendingUp,
  History,
  Import,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { ModuleName } from "@shared/schema";

interface SubItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
}

interface HubModule {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  module?: ModuleName;
  color: string;
  badge?: string;
  subItems: SubItem[];
}

const ALL_MODULES: HubModule[] = [
  {
    id: "alpha",
    title: "ALPHA",
    description: "CRM de vendas, campanhas e leads",
    icon: Target,
    module: "modulo_alpha",
    color: "#f59e0b",
    badge: "CRM",
    subItems: [
      { id: "campanhas", title: "Campanhas", description: "Gerenciar campanhas ativas", icon: Megaphone, route: "/vendas/campanhas" },
      { id: "atendimento", title: "Lista Manual", description: "Leads para atendimento direto", icon: Users, route: "/vendas/atendimento" },
      { id: "pipeline", title: "Pipeline", description: "Funil de oportunidades", icon: Kanban, route: "/vendas/pipeline" },
      { id: "consulta", title: "Consulta por CPF", description: "Busca individual de cliente", icon: UserSearch, route: "/vendas/consulta" },
      { id: "etiquetas", title: "Etiquetas", description: "Tags de organização", icon: Tag, route: "/vendas/etiquetas" },
      { id: "agenda", title: "Agenda", description: "Compromissos e agendamentos", icon: Calendar, route: "/vendas/agenda" },
      { id: "gestao-pipeline", title: "Gestão Pipeline", description: "Visão do gestor", icon: BarChart3, route: "/vendas/gestao-pipeline" },
      { id: "importar", title: "Importar Higienizados", description: "Upload de leads enriquecidos", icon: Upload, route: "/vendas/importar-higienizados" },
    ],
  },
  {
    id: "simuladores",
    title: "Simuladores",
    description: "Margem, portabilidade e amortização",
    icon: Calculator,
    module: "modulo_simulador",
    color: "#3b82f6",
    subItems: [
      { id: "simulador-compra", title: "Simulador de Compra", description: "Cálculo de margem e oferta", icon: Calculator, route: "/simulador-compra" },
      { id: "portabilidade", title: "Portabilidade", description: "Simulador de portabilidade", icon: TrendingUp, route: "/simulador-portabilidade" },
    ],
  },
  {
    id: "base-clientes",
    title: "Base de Clientes",
    description: "Importação, consulta e listas",
    icon: Database,
    module: "modulo_base_clientes",
    color: "#10b981",
    subItems: [
      { id: "base-dashboard", title: "Dashboard Base", description: "Visão geral da base", icon: LayoutDashboard, route: "/base-dashboard" },
      { id: "consulta-cliente", title: "Consulta de Cliente", description: "Busca na base própria", icon: UserSearch, route: "/consulta-cliente" },
      { id: "compra-lista", title: "Compra de Lista", description: "Solicitar listas de clientes", icon: ShoppingCart, route: "/compra-lista" },
      { id: "dividir-csv", title: "Dividir CSV", description: "Fatiar arquivos grandes", icon: Scissors, route: "/dividir-csv" },
      { id: "split-txt", title: "Split TXT/CSV", description: "Separar por coluna", icon: FileText, route: "/split-txt-csv" },
      { id: "nomenclaturas", title: "Nomenclaturas", description: "Padronização de campos", icon: ClipboardCheck, route: "/nomenclaturas" },
    ],
  },
  {
    id: "roteiros",
    title: "Roteiro Bancário",
    description: "Procedimentos e consulta por banco",
    icon: Map,
    module: "modulo_roteiros",
    color: "#8b5cf6",
    subItems: [
      { id: "roteiros-page", title: "Roteiros", description: "Procedimentos por banco", icon: Map, route: "/roteiros" },
      { id: "convenios", title: "Convênios", description: "Convênios cadastrados", icon: Landmark, route: "/agreements" },
      { id: "bancos", title: "Bancos", description: "Bancos operados", icon: Globe, route: "/banks" },
      { id: "tabelas-coef", title: "Tabelas de Coeficiente", description: "Coeficientes por prazo", icon: BarChart3, route: "/coefficient-tables" },
      { id: "boletos", title: "Boletos", description: "Solicitações de boleto", icon: FileText, route: "/solicitar-boleto" },
    ],
  },
  {
    id: "desenvolvimento",
    title: "Desenvolvimento",
    description: "Treinamentos, perfil DISC e feedback",
    icon: GraduationCap,
    module: "modulo_academia",
    color: "#ec4899",
    subItems: [
      { id: "fundamentos", title: "Fundamentos", description: "Módulos de aprendizado", icon: BookMarked, route: "/desenvolvimento/fundamentos" },
      { id: "roleplay", title: "Roleplay IA", description: "Treino de venda com IA", icon: MessageSquare, route: "/desenvolvimento/roleplay" },
      { id: "abordagem", title: "Abordagem IA", description: "Scripts e abordagem", icon: Wand2, route: "/desenvolvimento/abordagem" },
      { id: "profiler", title: "Perfil DISC", description: "Análise comportamental", icon: Brain, route: "/desenvolvimento/profiler" },
      { id: "feedbacks", title: "Feedbacks", description: "Avaliações e comentários", icon: Flag, route: "/desenvolvimento/feedbacks" },
    ],
  },
  {
    id: "material-apoio",
    title: "Material de Apoio",
    description: "Tabelas, criativos e processos",
    icon: BookOpen,
    color: "#06b6d4",
    subItems: [
      { id: "material-apoio-page", title: "Material de Apoio", description: "Tabelas, criativos e tutoriais", icon: BookOpen, route: "/material-apoio" },
    ],
  },
  {
    id: "gestao-comercial",
    title: "Gestão Comercial",
    description: "Dashboard, metas e relatórios",
    icon: Briefcase,
    color: "#f97316",
    subItems: [
      { id: "gestao-dashboard", title: "Dashboard", description: "Métricas do time", icon: LayoutDashboard, route: "/vendas/gestao-comercial/dashboard" },
      { id: "metas-mensais", title: "Metas Mensais", description: "Metas individuais e equipe", icon: Target, route: "/vendas/gestao-comercial/metas-mensais" },
      { id: "relatorios", title: "Relatórios", description: "Histórico de produção", icon: BarChart3, route: "/vendas/gestao-comercial/relatorios" },
      { id: "importar-producao", title: "Importar Produção", description: "Upload de planilhas", icon: Upload, route: "/vendas/gestao-comercial/importar-producao" },
      { id: "historico-importacoes", title: "Histórico Importações", description: "Importações anteriores", icon: History, route: "/vendas/gestao-comercial/historico-importacoes" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Visão geral e métricas do time",
    icon: LayoutDashboard,
    color: "#64748b",
    subItems: [
      { id: "dashboard-gestor", title: "Dashboard Gestor", description: "Visão do gestor de equipe", icon: BarChart3, route: "/dashboard" },
      { id: "dashboard-vendedor", title: "Meu Painel", description: "Metas e ranking pessoal", icon: Target, route: "/dashboard-vendedor" },
    ],
  },
  {
    id: "config",
    title: "Configurações",
    description: "Usuários, equipes e permissões",
    icon: Wrench,
    module: "modulo_config_usuarios",
    color: "#94a3b8",
    subItems: [
      { id: "usuarios", title: "Usuários", description: "Gerenciar acessos", icon: Users, route: "/users" },
      { id: "funcionarios", title: "Funcionários", description: "Cadastro de funcionários", icon: UserSearch, route: "/funcionarios" },
      { id: "equipes", title: "Equipes", description: "Times comerciais", icon: Target, route: "/equipes" },
    ],
  },
];

const STORAGE_KEY = "hub_beta_card_order";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOrder(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function HubBetaPage() {
  const { user, hasModuleAccess, logout } = useAuth();
  const { logoUrl, primaryColor, tenant } = useTenant();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const visibleModules = ALL_MODULES.filter(
    (m) => !m.module || hasModuleAccess(m.module)
  );

  const initCards = useCallback(() => {
    const savedOrder = loadOrder();
    if (!savedOrder) return visibleModules;
    const ordered: HubModule[] = [];
    savedOrder.forEach((id) => {
      const m = visibleModules.find((c) => c.id === id);
      if (m) ordered.push(m);
    });
    visibleModules.forEach((m) => {
      if (!ordered.find((o) => o.id === m.id)) ordered.push(m);
    });
    return ordered;
  }, []);

  const [modules, setModules] = useState<HubModule[]>(initCards);
  const [activeModule, setActiveModule] = useState<HubModule | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    setDraggingId(modules[index].id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggingId(null);
      setOverIndex(null);
      return;
    }
    const newModules = [...modules];
    const [moved] = newModules.splice(dragIndex, 1);
    newModules.splice(dropIndex, 0, moved);
    setModules(newModules);
    saveOrder(newModules.map((m) => m.id));
    dragIndexRef.current = null;
    setDraggingId(null);
    setOverIndex(null);
    toast({ title: "Ordem salva", description: "Cards reorganizados com sucesso." });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const ModuleIcon = activeModule?.icon;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-12 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt={tenant?.name || "Logo"} className="h-7 max-w-[120px] object-contain" />
          <Badge
            variant="outline"
            className="gap-1 text-[10px] font-semibold"
            style={{ color: primaryColor, borderColor: primaryColor + "40" }}
          >
            <FlaskConical className="h-3 w-3" />
            Layout Beta
          </Badge>

          {/* Breadcrumb */}
          {activeModule && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
              <button
                onClick={() => setActiveModule(null)}
                className="hover:text-foreground transition-colors font-medium"
                data-testid="hub-breadcrumb-home"
              >
                Hub
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-semibold">{activeModule.title}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1.5 text-muted-foreground"
            data-testid="hub-back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao layout padrão
          </Button>
          <Button variant="ghost" size="icon" data-testid="hub-bell-button">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} data-testid="hub-profile-button">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {user ? getInitials(user.name) : <User className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive" data-testid="hub-logout-button">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── LEVEL 1: Home ── */}
      {!activeModule && (
        <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              Olá, {user?.name?.split(" ")[0] || "Admin"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {" · "}
              <span className="font-medium" style={{ color: primaryColor }}>{tenant?.name}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5" />
            <span>Arraste os cards para reorganizar como preferir. A ordem é salva automaticamente.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((mod, index) => {
              const Icon = mod.icon;
              const isDragging = draggingId === mod.id;
              const isOver = overIndex === index && draggingId !== mod.id;

              return (
                <div
                  key={mod.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => !draggingId && setActiveModule(mod)}
                  data-testid={`hub-card-${mod.id}`}
                  className={[
                    "group relative flex flex-col p-5 rounded-xl border bg-card cursor-pointer select-none transition-all duration-200",
                    isDragging ? "opacity-40 scale-95 rotate-1" : "hover:-translate-y-0.5 hover:shadow-md",
                    isOver ? "ring-2 ring-offset-1" : "",
                  ].join(" ")}
                >
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ backgroundColor: mod.color }} />

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: mod.color + "18", color: mod.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm leading-tight">{mod.title}</h3>
                    {mod.badge && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 h-4 font-bold"
                        style={{ backgroundColor: mod.color + "18", color: mod.color }}
                      >
                        {mod.badge}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{mod.description}</p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: mod.color + "cc" }}>
                      {mod.subItems.length} {mod.subItems.length === 1 ? "funcionalidade" : "funcionalidades"}
                    </span>
                    <ChevronRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      style={{ color: mod.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setModules(visibleModules);
                toast({ title: "Ordem resetada", description: "Voltou para a ordem padrão." });
              }}
              data-testid="hub-reset-order"
            >
              Resetar ordem dos cards
            </Button>
          </div>
        </main>
      )}

      {/* ── LEVEL 2: Inside a module ── */}
      {activeModule && (
        <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
          {/* Module hero */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setActiveModule(null)}
              className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
              data-testid="hub-module-back"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: activeModule.color + "18", color: activeModule.color }}
            >
              {ModuleIcon && <ModuleIcon className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{activeModule.title}</h1>
              <p className="text-sm text-muted-foreground">{activeModule.description}</p>
            </div>
          </div>

          {/* Sub-items grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeModule.subItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.route)}
                  data-testid={`hub-subitem-${item.id}`}
                  className="group relative flex items-center gap-4 p-4 rounded-xl border bg-card text-left hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: activeModule.color + "18", color: activeModule.color }}
                  >
                    <ItemIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    style={{ color: activeModule.color + "99" }}
                  />
                </button>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
