import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useTenant } from "@/components/tenant-theme-provider";

// Rota → [Seção, Página] no padrão "Financeiro › Tabelas".
const MAP: Record<string, [string, string]> = {
  "/": ["Geral", "Home"],
  "/dashboard": ["Vendas", "Visão geral"],
  "/dashboard-vendedor": ["Geral", "Meu Painel"],
  "/simuladores": ["Geral", "Simuladores"],
  "/contratos": ["Operacional", "Minhas Propostas"],
  "/contratos/nova": ["Operacional", "Nova Proposta"],
  "/solicitacoes-boleto": ["Operacional", "Solicitar Boleto"],
  "/vendas/pipeline": ["Vendas", "Pipeline"],
  "/vendas/consulta": ["Vendas", "Consulta Individual"],
  "/consulta-cliente": ["Vendas", "Perfil do cliente"],
  "/vendas/gestao-pipeline": ["Vendas", "Gestão Pipeline"],
  "/vendas/minha-carteira": ["Vendas", "Minha Carteira"],
  "/vendas/campanhas": ["Vendas", "Campanhas"],
  "/vendas/agenda": ["Vendas", "Agenda"],
  "/financeiro/tabelas": ["Financeiro", "Tabelas"],
  "/financeiro/pagamentos": ["Financeiro", "Pagamentos"],
  "/financeiro/producao": ["Financeiro", "Produção"],
  "/financeiro/proventos": ["Financeiro", "Proventos e Descontos"],
  "/financeiro/contratos": ["Financeiro", "Contratos"],
  "/financeiro/comissoes": ["Financeiro", "Comissões"],
};

function prettify(seg: string): string {
  const s = seg.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HeaderBreadcrumb() {
  const [location] = useLocation();
  // Rota fora do mapa caia num "Capital Go" fixo, que aparecia dentro de
  // qualquer ambiente de cliente. Usa o nome do ambiente.
  const { tenant } = useTenant();
  const entry = MAP[location];
  const segs = location.split("/").filter(Boolean);
  const secao = entry ? entry[0] : (segs.length > 1 ? prettify(segs[0]) : (tenant?.name || "Sistema"));
  const pagina = entry ? entry[1] : prettify(segs[segs.length - 1] || "Home");

  return (
    <div className="hidden lg:flex items-center gap-1.5 text-sm min-w-0" data-testid="header-breadcrumb">
      <span className="text-muted-foreground shrink-0">{secao}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      <span className="font-bold text-foreground truncate">{pagina}</span>
    </div>
  );
}
