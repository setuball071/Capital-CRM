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
                <TableHead className="text-right">Pago (qtd)</TableHead>
                <TableHead className="text-right">Pago (R$)</TableHead>
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
                  <TableCell className="text-right">{fmtNum(i.pagoQtd)}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(i.pagoValor)}</TableCell>
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
          {/* Produção Oficial (financeiro — inclui importado) */}
          <div>
            <div className="text-sm font-semibold">
              Produção Oficial <span className="text-muted-foreground font-normal">· financeiro (inclui contratos importados)</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Este mês inclui produção paga <strong>importada de outra plataforma</strong> (transição). Daqui pra frente, tudo nasce no CRM e o funil abaixo fica completo.
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard titulo="Produção (geral)" valor={data.oficial.geral} formato="moeda" sub={`${data.oficial.qtd} contratos · sem cartão`} />
              <KpiCard titulo="Produção total" valor={data.oficial.total} formato="moeda" />
              <KpiCard titulo="Cadastrado" valor={t!.cadValor} formato="moeda" sub={`${t!.cadQtd} propostas`} />
              <KpiCard titulo="Conversão (cad.→produção)" valor={data.conversaoOficial} formato="percent" />
            </div>
          </div>

          {/* Funil do CRM (propostas) */}
          <div>
            <div className="text-sm font-semibold">
              Funil do CRM <span className="text-muted-foreground font-normal">· propostas (cadastrado → pago)</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Mede só o que nasceu no CRM (cadastrado → pago). Pago aqui ≠ Produção Oficial enquanto houver importados.
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard titulo="Cadastrado" valor={t!.cadValor} formato="moeda" sub={`${t!.cadQtd} propostas`} />
              <KpiCard titulo="Pago (CRM)" valor={t!.pagoValor} formato="moeda" sub={`${t!.pagoQtd} contratos`} />
              <KpiCard titulo="Conversão (funil)" valor={t!.conversao} formato="percent" />
              <KpiCard titulo="Ticket médio (pago)" valor={t!.ticket} formato="moeda" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Contratos / cliente" valor={data.porCliente.mediaContratos} formato="numero" sub={`${data.porCliente.clientes} clientes pagantes`} />
            <KpiCard titulo="Clientes com 1 produto" valor={data.porCliente.pctUmProduto} formato="percent" />
            <KpiCard titulo="Clientes com 2+ produtos" valor={data.porCliente.pctMultiProduto} formato="percent" />
            <KpiCard titulo="Clientes pagantes" valor={data.porCliente.clientes} formato="numero" />
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
