import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
import {
  Target,
  Calculator,
  BookOpen,
  Database,
  Shield,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { ModuleName } from "@shared/schema";

interface HubCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  module?: ModuleName;
  color: string;
  badge?: string;
}

const ALL_CARDS: HubCard[] = [
  {
    id: "alpha",
    title: "ALPHA",
    description: "CRM de vendas, campanhas e leads",
    icon: Target,
    route: "/vendas/campanhas",
    module: "modulo_alpha",
    color: "#f59e0b",
    badge: "CRM",
  },
  {
    id: "simuladores",
    title: "Simuladores",
    description: "Margem, portabilidade e amortização",
    icon: Calculator,
    route: "/simulador-compra",
    module: "modulo_simulador",
    color: "#3b82f6",
  },
  {
    id: "base-clientes",
    title: "Base de Clientes",
    description: "Importação, consulta e listas",
    icon: Database,
    route: "/base-dashboard",
    module: "modulo_base_clientes",
    color: "#10b981",
  },
  {
    id: "roteiros",
    title: "Roteiro Bancário",
    description: "Procedimentos e consulta por banco",
    icon: Map,
    route: "/roteiros",
    module: "modulo_roteiros",
    color: "#8b5cf6",
  },
  {
    id: "desenvolvimento",
    title: "Desenvolvimento",
    description: "Treinamentos, perfil DISC e feedback",
    icon: GraduationCap,
    route: "/desenvolvimento/fundamentos",
    module: "modulo_academia",
    color: "#ec4899",
  },
  {
    id: "material-apoio",
    title: "Material de Apoio",
    description: "Tabelas, criativos e processos",
    icon: BookOpen,
    route: "/material-apoio",
    color: "#06b6d4",
  },
  {
    id: "gestao-comercial",
    title: "Gestão Comercial",
    description: "Dashboard, metas e relatórios",
    icon: Briefcase,
    route: "/vendas/gestao-comercial/dashboard",
    color: "#f97316",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Visão geral e métricas do time",
    icon: LayoutDashboard,
    route: "/dashboard",
    color: "#64748b",
  },
  {
    id: "config",
    title: "Configurações",
    description: "Usuários, equipes e permissões",
    icon: Wrench,
    route: "/users",
    module: "modulo_config_usuarios",
    color: "#94a3b8",
  },
];

const STORAGE_KEY = "hub_beta_card_order";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
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

  const visibleCards = ALL_CARDS.filter(
    (c) => !c.module || hasModuleAccess(c.module)
  );

  const initCards = useCallback(() => {
    const savedOrder = loadOrder();
    if (!savedOrder) return visibleCards;
    const ordered: HubCard[] = [];
    savedOrder.forEach((id) => {
      const card = visibleCards.find((c) => c.id === id);
      if (card) ordered.push(card);
    });
    visibleCards.forEach((c) => {
      if (!ordered.find((o) => o.id === c.id)) ordered.push(c);
    });
    return ordered;
  }, []);

  const [cards, setCards] = useState<HubCard[]>(initCards);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    setDraggingId(cards[index].id);
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
    const newCards = [...cards];
    const [moved] = newCards.splice(dragIndex, 1);
    newCards.splice(dropIndex, 0, moved);
    setCards(newCards);
    saveOrder(newCards.map((c) => c.id));
    dragIndexRef.current = null;
    setDraggingId(null);
    setOverIndex(null);
    toast({ title: "Ordem salva", description: "Os cards foram reorganizados." });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleCardClick = (card: HubCard) => {
    navigate(card.route);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-12 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt={tenant?.name || "Logo"}
            className="h-7 max-w-[120px] object-contain"
          />
          <Badge variant="outline" className="gap-1 text-[10px] font-semibold" style={{ color: primaryColor, borderColor: primaryColor + "40" }}>
            <FlaskConical className="h-3 w-3" />
            Layout Beta
          </Badge>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            data-testid="hub-profile-button"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {user ? getInitials(user.name) : <User className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-destructive"
            data-testid="hub-logout-button"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            Olá, {user?.name?.split(" ")[0] || "Admin"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" · "}
            <span className="font-medium" style={{ color: primaryColor }}>
              {tenant?.name}
            </span>
          </p>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
          <GripVertical className="h-3.5 w-3.5" />
          <span>Arraste os cards para reorganizar como preferir. A ordem é salva automaticamente.</span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card, index) => {
            const Icon = card.icon;
            const isDragging = draggingId === card.id;
            const isOver = overIndex === index && draggingId !== card.id;

            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => !draggingId && handleCardClick(card)}
                data-testid={`hub-card-${card.id}`}
                className={[
                  "group relative flex flex-col p-5 rounded-xl border bg-card cursor-pointer select-none transition-all duration-200",
                  isDragging
                    ? "opacity-40 scale-95 rotate-1"
                    : "hover:-translate-y-0.5 hover:shadow-md",
                  isOver
                    ? "ring-2 ring-offset-1"
                    : "",
                ].join(" ")}
                style={isOver ? { ringColor: card.color } : {}}
              >
                {/* Left accent */}
                <div
                  className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                  style={{ backgroundColor: card.color }}
                />

                {/* Drag handle */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: card.color + "18", color: card.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Title + badge */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm leading-tight">{card.title}</h3>
                  {card.badge && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 h-4 font-bold"
                      style={{ backgroundColor: card.color + "18", color: card.color }}
                    >
                      {card.badge}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {card.description}
                </p>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-medium" style={{ color: card.color + "cc" }}>
                    Abrir módulo
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    style={{ color: card.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset order */}
        <div className="mt-8 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setCards(visibleCards);
              toast({ title: "Ordem resetada", description: "Voltou para a ordem padrão." });
            }}
            data-testid="hub-reset-order"
          >
            Resetar ordem dos cards
          </Button>
        </div>
      </main>
    </div>
  );
}
