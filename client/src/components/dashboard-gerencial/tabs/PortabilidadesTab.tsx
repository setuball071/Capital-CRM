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
import type { PortabilidadesResp, DashOpcoes } from "../types";

const fmtDias = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;

export default function PortabilidadesTab() {
  const { filtros, setFiltros, queryString } = useDashboardFilters();

  const { data: opcoes } = useQuery<DashOpcoes>({
    queryKey: ["/api/gestao-comercial/dashboard/opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/gestao-comercial/dashboard/opcoes", { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar opções");
      return r.json();
    },
  });

  const url = `/api/gestao-comercial/dashboard/portabilidades?${queryString}`;
  const { data, isLoading } = useQuery<PortabilidadesResp>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar portabilidades");
      return r.json();
    },
  });

  const k = data?.kpis;

  return (
    <div className="space-y-4" data-testid="tab-portabilidades">
      <DashboardFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Sem dados.</div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Base: propostas com produto <strong>Portabilidade</strong> criadas no período (funil do CRM). Banco de origem e saldos aparecem conforme forem preenchidos na ficha.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Portabilidades" valor={k!.valor} formato="moeda" sub={`${k!.total} no total`} />
            <KpiCard titulo="Concluídas (pagas)" valor={k!.pagas} formato="numero" sub={fmtMoeda(k!.valorPagas)} />
            <KpiCard titulo="Efetividade" valor={k!.efetividade} formato="percent" />
            <KpiCard titulo="Em andamento" valor={k!.emAndamento} formato="numero" sub={`${k!.canceladas} canceladas/perdidas`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard titulo="Saldo informado" valor={k!.saldoInformado} formato="moeda" />
            <KpiCard titulo="Saldo pago" valor={k!.saldoPago} formato="moeda" />
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo até conclusão</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasAtePago)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tempo CIP → saldo</div><div className="text-2xl font-semibold mt-1">{fmtDias(k!.diasCipSaldo)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Funil por status</CardTitle></CardHeader>
            <CardContent>
              {data.funil.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Sem portabilidades no período</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.funil.map((f) => (
                      <TableRow key={f.key}>
                        <TableCell>{f.label}</TableCell>
                        <TableCell className="text-right">{fmtNum(f.qtd)}</TableCell>
                        <TableCell className="text-right">{fmtMoeda(f.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por banco (destino) — efetividade</CardTitle></CardHeader>
            <CardContent>
              {data.bancoDestino.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Sem dados</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Efetividade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bancoDestino.map((b) => (
                      <TableRow key={b.chave}>
                        <TableCell>{b.chave}</TableCell>
                        <TableCell className="text-right">{fmtNum(b.qtd)}</TableCell>
                        <TableCell className="text-right">{fmtMoeda(b.valor)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtPercent(b.efetividade || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por banco de origem (portado)</CardTitle></CardHeader>
            <CardContent>
              {data.bancoOrigem.length === 0 || (data.bancoOrigem.length === 1 && data.bancoOrigem[0].chave === "Não informado") ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Ainda sem banco de origem preenchido — começa a popular quando o operacional informar na ficha.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco de origem</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bancoOrigem.map((b) => (
                      <TableRow key={b.chave}>
                        <TableCell>{b.chave}</TableCell>
                        <TableCell className="text-right">{fmtNum(b.qtd)}</TableCell>
                        <TableCell className="text-right">{fmtMoeda(b.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
