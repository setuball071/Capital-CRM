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
import { fmtMoeda, fmtNum, fmtPercent } from "../fmt";
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
                <TableHead className="text-right">Cad. (qtd)</TableHead>
                <TableHead className="text-right">Cad. (R$)</TableHead>
                <TableHead className="text-right">Produção (qtd)</TableHead>
                <TableHead className="text-right">Produção (R$)</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.chave}>
                  <TableCell className="max-w-[180px] truncate">{i.chave}</TableCell>
                  <TableCell className="text-right">{fmtNum(i.cadQtd)}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(i.cadValor)}</TableCell>
                  <TableCell className="text-right">{fmtNum(i.prodQtd)}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(i.prodValor)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtPercent(i.conversao)}</TableCell>
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

  const t = data?.totais;

  return (
    <div className="space-y-4" data-testid="tab-performance">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              <strong>Cadastrado</strong> = R$ das propostas criadas no período · <strong>Produção</strong> = R$ pago no financeiro (inclui o do CRM + os importados) · <strong>Conversão</strong> = Produção R$ ÷ Cadastrado R$.
            </div>
            <div>
              Conversão acima de 100% = aquele banco/produto produziu mais do que foi cadastrado aqui (contratos <strong>importados</strong> na transição). Daqui pra frente tende a ≤100% e vira a conversão real do funil.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Cadastrado" valor={t!.cadValor} formato="moeda" sub={`${t!.cadQtd} propostas`} />
            <KpiCard titulo="Produção (pago)" valor={t!.prodValor} formato="moeda" sub={`${t!.prodQtd} contratos`} />
            <KpiCard titulo="Conversão" valor={t!.conversao} formato="percent" />
            <KpiCard titulo="Ticket médio" valor={t!.ticket} formato="moeda" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Contratos / cliente" valor={data.porCliente.mediaContratos} formato="numero" sub={`${data.porCliente.clientes} clientes`} />
            <KpiCard titulo="Clientes com 1 produto" valor={data.porCliente.pctUmProduto} formato="percent" />
            <KpiCard titulo="Clientes com 2+ produtos" valor={data.porCliente.pctMultiProduto} formato="percent" />
            <KpiCard titulo="Clientes que produziram" valor={data.porCliente.clientes} formato="numero" />
          </div>

          <div className="space-y-3">
            <TabelaDim titulo="Por Produto" itens={data.produto} />
            <TabelaDim titulo="Por Banco" itens={data.banco} />
            <TabelaDim titulo="Por Convênio" itens={data.convenio} />
          </div>
        </>
      )}
    </div>
  );
}
