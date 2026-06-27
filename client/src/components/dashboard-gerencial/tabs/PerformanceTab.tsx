import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardFilters } from "../useDashboardFilters";
import { DashboardFilters } from "../DashboardFilters";
import { KpiCard } from "../KpiCard";
import { fmtMoeda, fmtNum } from "../fmt";
import type { PerformanceResp, DashOpcoes, PerfDimItem } from "../types";

function TabelaDim({ titulo, itens }: { titulo: string; itens: PerfDimItem[] }) {
  return (
    <Card data-testid={`perf-${titulo}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.chave}>
                  <TableCell className="max-w-[200px] truncate">{i.chave}</TableCell>
                  <TableCell className="text-right">{fmtNum(i.qtd)}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(i.valor)}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(i.ticket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerformanceTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/performance?${queryString}`;
  const { data, isLoading } = useQuery<PerformanceResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar performance");
      return r.json();
    },
  });

  return (
    <div className="space-y-4" data-testid="tab-performance">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">Base: propostas pagas no período.</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Contratos / cliente" valor={data.porCliente.mediaContratos} formato="numero" sub={`${data.porCliente.clientes} clientes`} />
            <KpiCard titulo="Clientes com 1 produto" valor={data.porCliente.pctUmProduto} formato="percent" />
            <KpiCard titulo="Clientes com 2+ produtos" valor={data.porCliente.pctMultiProduto} formato="percent" />
            <KpiCard titulo="Clientes únicos" valor={data.porCliente.clientes} formato="numero" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <TabelaDim titulo="Produtos mais vendidos" itens={data.produto} />
            <TabelaDim titulo="Bancos mais utilizados" itens={data.banco} />
            <TabelaDim titulo="Convênios mais atendidos" itens={data.convenio} />
          </div>
        </>
      )}
    </div>
  );
}
