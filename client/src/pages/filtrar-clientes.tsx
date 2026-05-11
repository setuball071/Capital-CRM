import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Filter, Search, X, ChevronLeft, ChevronRight,
  Loader2, Users, TrendingUp, Building2, MapPin,
  CreditCard, Banknote, RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FiltroState {
  base_referencia: string;
  tipo_relacao: string;
  orgao: string;
  uf: string;
  situacao_funcional: string;
  mg35_min: string;
  mg35_max: string;
  mg70_min: string;
  mg70_max: string;
  mg5cc_min: string;
  mg5cc_max: string;
  mg5cb_min: string;
  mg5cb_max: string;
  sem_contratos: boolean;
  banco: string;
  tipo_contrato: string;
  qtd_contratos_min: string;
  qtd_contratos_max: string;
  parcela_min: string;
  parcela_max: string;
  prazo_min: string;
  prazo_max: string;
}

interface ResultadoCliente {
  cpf: string;
  nome: string;
  tipo_relacao: string;
  orgao_nome: string;
  mes_pagamento: string;
  total_bruto: string;
  total_liquido: string;
  base_calculo: string;
  mg35_disp: string;
  mg35_bruta: string;
  mg70_disp: string;
  mg5cc_disp: string;
  mg5cb_disp: string;
  uf: string;
  situacao_funcional: string;
  qtd_contratos: number;
}

interface FiltroOpcoes {
  orgaos: string[];
  ufs: string[];
  situacoes: string[];
  meses: string[];
}

interface FiltroResultado {
  total: number;
  page: number;
  limit: number;
  resultados: ResultadoCliente[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILTRO_VAZIO: FiltroState = {
  base_referencia: "mais_recente",
  tipo_relacao: "",
  orgao: "",
  uf: "",
  situacao_funcional: "",
  mg35_min: "",  mg35_max: "",
  mg70_min: "",  mg70_max: "",
  mg5cc_min: "", mg5cc_max: "",
  mg5cb_min: "", mg5cb_max: "",
  sem_contratos: false,
  banco: "",
  tipo_contrato: "",
  qtd_contratos_min: "", qtd_contratos_max: "",
  parcela_min: "",       parcela_max: "",
  prazo_min: "",         prazo_max: "",
};

function brl(v: string | number | null | undefined): string {
  const n = parseFloat(String(v ?? "0")) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function maskCpf(cpf: string): string {
  const c = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9,11)}`;
}

function tipoBadge(tipo: string) {
  const map: Record<string, string> = {
    SERVIDOR:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
    APOSENTADO: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    PENSAO:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  return map[tipo] ?? "bg-gray-500/20 text-gray-300";
}

// ── Componente de input de range ──────────────────────────────────────────────

function RangeInput({
  label, minKey, maxKey, prefix = "R$",
  filters, onChange,
}: {
  label: string;
  minKey: keyof FiltroState;
  maxKey: keyof FiltroState;
  prefix?: string;
  filters: FiltroState;
  onChange: (key: keyof FiltroState, val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={prefix ? `Mín` : "Mín"}
          value={filters[minKey] as string}
          onChange={e => onChange(minKey, e.target.value)}
          className="h-9 text-sm bg-background/50"
        />
        <Input
          placeholder={prefix ? `Máx` : "Máx"}
          value={filters[maxKey] as string}
          onChange={e => onChange(maxKey, e.target.value)}
          className="h-9 text-sm bg-background/50"
        />
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FiltrarClientesPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<FiltroState>(FILTRO_VAZIO);
  const [page, setPage] = useState(1);
  const [resultado, setResultado] = useState<FiltroResultado | null>(null);
  const LIMIT = 50;

  // Opções dos dropdowns
  const { data: opcoes } = useQuery<FiltroOpcoes>({
    queryKey: ["siape-filtros-opcoes"],
    queryFn: () => apiRequest("GET", "/api/siape/filtros/opcoes").then(r => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  const filtrarMutation = useMutation({
    mutationFn: (p: number) => {
      const body: any = { ...filters, page: p, limit: LIMIT };
      // limpar strings vazias
      Object.keys(body).forEach(k => {
        if (body[k] === "") delete body[k];
      });
      return apiRequest("POST", "/api/siape/filtrar", body).then(r => r.json());
    },
    onSuccess: (data: FiltroResultado) => setResultado(data),
  });

  function handleChange(key: keyof FiltroState, val: string | boolean) {
    setFilters(prev => ({ ...prev, [key]: val }));
  }

  function handleSimular(p = 1) {
    setPage(p);
    filtrarMutation.mutate(p);
  }

  function handleLimpar() {
    setFilters(FILTRO_VAZIO);
    setResultado(null);
    setPage(1);
  }

  const totalPages = resultado ? Math.ceil(resultado.total / LIMIT) : 0;

  // Conta filtros ativos
  const filtrosAtivos = Object.entries(filters).filter(([k, v]) => {
    if (k === "base_referencia") return false;
    if (typeof v === "boolean") return v;
    return v !== "";
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Filter className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Filtros</h1>
          <p className="text-sm text-muted-foreground">
            Selecione os filtros para encontrar os clientes desejados
          </p>
        </div>
        {filtrosAtivos > 0 && (
          <Badge className="ml-auto bg-primary/20 text-primary border-primary/30">
            {filtrosAtivos} filtro{filtrosAtivos > 1 ? "s" : ""} ativo{filtrosAtivos > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Painel de filtros */}
      <Card className="border border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-5 space-y-6">

          {/* Base de Referência */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Base de Referência</Label>
            <Select
              value={filters.base_referencia}
              onValueChange={v => handleChange("base_referencia", v)}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mais_recente">Mais Recente</SelectItem>
                {(opcoes?.meses ?? []).map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define qual competência será usada para filtrar folha e contratos
            </p>
          </div>

          <Separator className="opacity-30" />

          {/* Linha 1: Convênio / Órgão / UF */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de Relação</Label>
              <Select
                value={filters.tipo_relacao || "__all__"}
                onValueChange={v => handleChange("tipo_relacao", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="SERVIDOR">Servidor</SelectItem>
                  <SelectItem value="APOSENTADO">Aposentado</SelectItem>
                  <SelectItem value="PENSAO">Pensionista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Órgão</Label>
              <Select
                value={filters.orgao || "__all__"}
                onValueChange={v => handleChange("orgao", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Todos os órgãos" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__all__">Todos os órgãos</SelectItem>
                  {(opcoes?.orgaos ?? []).map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">UF</Label>
              <Select
                value={filters.uf || "__all__"}
                onValueChange={v => handleChange("uf", v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {(opcoes?.ufs ?? []).map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Situação Funcional */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Situação Funcional</Label>
            <Select
              value={filters.situacao_funcional || "__all__"}
              onValueChange={v => handleChange("situacao_funcional", v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as situações</SelectItem>
                {(opcoes?.situacoes ?? []).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="opacity-30" />

          {/* Filtros de Contrato */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-4">Filtros de Contrato</p>

            {/* Bancos + Sem Contratos + Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Bancos</Label>
                  <button
                    onClick={() => handleChange("sem_contratos", !filters.sem_contratos)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      filters.sem_contratos
                        ? "bg-red-500/20 text-red-300 border-red-500/40"
                        : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60"
                    }`}
                  >
                    Sem Contratos
                  </button>
                </div>
                <Input
                  placeholder="Ex: CEF, BB, PAN..."
                  value={filters.banco}
                  onChange={e => handleChange("banco", e.target.value)}
                  disabled={filters.sem_contratos}
                  className="h-9 text-sm bg-background/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Contrato</Label>
                <Select
                  value={filters.tipo_contrato || "__all__"}
                  onValueChange={v => handleChange("tipo_contrato", v === "__all__" ? "" : v)}
                  disabled={filters.sem_contratos}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os tipos</SelectItem>
                    <SelectItem value="EMPRESTIMO_35">Empréstimo 35%</SelectItem>
                    <SelectItem value="CARTAO_CREDITO_5">Cartão Crédito 5%</SelectItem>
                    <SelectItem value="CARTAO_BENEFICIO_5">Cartão Benefício 5%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Qtd. Contratos</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Mín"
                    value={filters.qtd_contratos_min}
                    onChange={e => handleChange("qtd_contratos_min", e.target.value)}
                    disabled={filters.sem_contratos}
                    className="h-9 text-sm bg-background/50"
                  />
                  <Input
                    placeholder="Máx"
                    value={filters.qtd_contratos_max}
                    onChange={e => handleChange("qtd_contratos_max", e.target.value)}
                    disabled={filters.sem_contratos}
                    className="h-9 text-sm bg-background/50"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RangeInput
                label="Parcela (R$)"
                minKey="parcela_min"
                maxKey="parcela_max"
                filters={filters}
                onChange={handleChange}
              />
              <RangeInput
                label="Parcelas Restantes"
                minKey="prazo_min"
                maxKey="prazo_max"
                prefix=""
                filters={filters}
                onChange={handleChange}
              />
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Filtros de Margem */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-4">Filtros de Margem (Saldos)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RangeInput label="Margem 70%"           minKey="mg70_min"  maxKey="mg70_max"  filters={filters} onChange={handleChange} />
              <RangeInput label="Margem 35%"           minKey="mg35_min"  maxKey="mg35_max"  filters={filters} onChange={handleChange} />
              <RangeInput label="Cartão Crédito 5%"    minKey="mg5cc_min" maxKey="mg5cc_max" filters={filters} onChange={handleChange} />
              <RangeInput label="Cartão Benefício 5%"  minKey="mg5cb_min" maxKey="mg5cb_max" filters={filters} onChange={handleChange} />
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Botões */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleSimular(1)}
              disabled={filtrarMutation.isPending}
              className="gap-2"
            >
              {filtrarMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
                : <><Search className="h-4 w-4" /> Simular</>
              }
            </Button>
            <Button
              variant="outline"
              onClick={handleLimpar}
              className="gap-2"
            >
              <X className="h-4 w-4" /> Limpar Filtros
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <Card className="border border-border/50 bg-card/60">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Resultados</CardTitle>
              <Badge variant="secondary" className="font-mono">
                {resultado.total.toLocaleString("pt-BR")} clientes
              </Badge>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  disabled={page <= 1 || filtrarMutation.isPending}
                  onClick={() => handleSimular(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>Página {page} de {totalPages}</span>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  disabled={page >= totalPages || filtrarMutation.isPending}
                  onClick={() => handleSimular(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-xs pl-4">Nome / CPF</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Órgão</TableHead>
                    <TableHead className="text-xs">UF</TableHead>
                    <TableHead className="text-xs text-right">Base</TableHead>
                    <TableHead className="text-xs text-right">M. 35%</TableHead>
                    <TableHead className="text-xs text-right">M. 70%</TableHead>
                    <TableHead className="text-xs text-right">5% CC</TableHead>
                    <TableHead className="text-xs text-right">Contratos</TableHead>
                    <TableHead className="text-xs text-right pr-4">Ref.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.resultados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        Nenhum cliente encontrado com esses filtros
                      </TableCell>
                    </TableRow>
                  ) : resultado.resultados.map((r) => (
                    <TableRow
                      key={r.cpf}
                      className="border-border/30 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/consulta-cliente?cpf=${r.cpf}`)}
                    >
                      <TableCell className="pl-4">
                        <div className="font-medium text-sm">{r.nome || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{maskCpf(r.cpf)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${tipoBadge(r.tipo_relacao)}`}>
                          {r.tipo_relacao === "SERVIDOR" ? "SERV"
                            : r.tipo_relacao === "APOSENTADO" ? "APOS"
                            : r.tipo_relacao === "PENSAO" ? "PENS"
                            : r.tipo_relacao}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="text-xs truncate block" title={r.orgao_nome}>{r.orgao_nome || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">{r.uf || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {brl(r.base_calculo)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-xs font-semibold ${
                          parseFloat(r.mg35_disp) > 0 ? "text-green-400" : "text-muted-foreground"
                        }`}>
                          {brl(r.mg35_disp)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-xs ${
                          parseFloat(r.mg70_disp) > 0 ? "text-blue-400" : "text-muted-foreground"
                        }`}>
                          {brl(r.mg70_disp)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {brl(r.mg5cc_disp)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-medium ${
                          r.qtd_contratos === 0 ? "text-green-400" : "text-muted-foreground"
                        }`}>
                          {r.qtd_contratos}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <span className="text-xs text-muted-foreground">{r.mes_pagamento}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação inferior */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  Mostrando {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT, resultado.total)} de {resultado.total.toLocaleString("pt-BR")}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={page <= 1 || filtrarMutation.isPending}
                    onClick={() => handleSimular(page - 1)}
                    className="h-8 gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" /> Anterior
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={page >= totalPages || filtrarMutation.isPending}
                    onClick={() => handleSimular(page + 1)}
                    className="h-8 gap-1"
                  >
                    Próxima <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
