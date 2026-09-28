// Quem consultou a base de clientes, quando e por onde.
//
// A base é compartilhada entre os tenants de propósito — é ela que dá valor à
// assinatura. Esta tela é o contrapeso disso: mede o uso (para limitar ou cobrar
// por plano) e guarda a prova de quem acessou dado de servidor público.
//
// Os números vêm do audit_log, pelas ações consulta_cliente e consulta_siape.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Users, Fingerprint } from "lucide-react";

interface Resumo {
  dias: number;
  total: number;
  porDia: { dia: string; total: number; cpfs: number }[];
  porUsuario: { user_id: number | null; usuario: string | null; total: number; cpfs: number }[];
  porOrigem: { origem: string; total: number }[];
}

/** Nome de gente para cada porta de consulta — o banco guarda a chave curta. */
const ORIGENS: Record<string, string> = {
  "vendas-busca": "Busca do atendimento (CPF ou matrícula)",
  "siape-dados": "Dados do SIAPE",
  "siape-parcelas": "Parcelas do SIAPE",
  "port-cliente": "Simulador de portabilidade (nascimento)",
  "port-upag": "Simulador de portabilidade (UPAG)",
  "api-externa": "API externa (chave de integração)",
  consulta_siape: "Contracheque do SIAPE",
  consulta_cliente: "Consulta de cliente",
};

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};

export default function AdminConsultasBasePage() {
  const [dias, setDias] = useState("30");

  const { data, isLoading, isError } = useQuery<Resumo>({
    queryKey: [`/api/base/consultas?dias=${dias}`],
  });

  const cpfsDistintos = data
    ? data.porDia.reduce((a, d) => a + Number(d.cpfs || 0), 0)
    : 0;
  const pessoasQueConsultaram = data ? data.porUsuario.length : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Search className="h-6 w-6" /> Consultas à base de clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A base é compartilhada entre os ambientes. Aqui fica o registro de quem
            consultou qual CPF, por onde e quando.
          </p>
        </div>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-[170px]" data-testid="select-periodo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Não consegui carregar o registro. Esta tela é só do administrador master.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> Consultas no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold" data-testid="kpi-total">
                  {data.total.toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5" /> CPFs consultados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {cpfsDistintos.toLocaleString("pt-BR")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  soma dos distintos de cada dia
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Quem consultou
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{pessoasQueConsultaram}</div>
                <p className="text-xs text-muted-foreground mt-1">usuários distintos</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por usuário</CardTitle>
                <CardDescription>quem mais consultou no período</CardDescription>
              </CardHeader>
              <CardContent>
                {data.porUsuario.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma consulta no período.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-right">Consultas</TableHead>
                        <TableHead className="text-right">CPFs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porUsuario.map((u, i) => (
                        <TableRow key={`${u.user_id}-${i}`}>
                          <TableCell>{u.usuario || "— usuário removido —"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(u.total).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(u.cpfs).toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por onde</CardTitle>
                <CardDescription>qual tela ou integração originou a consulta</CardDescription>
              </CardHeader>
              <CardContent>
                {data.porOrigem.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma consulta no período.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Consultas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porOrigem.map((o) => (
                        <TableRow key={o.origem}>
                          <TableCell>{ORIGENS[o.origem] || o.origem}</TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(o.total).toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dia a dia</CardTitle>
              <CardDescription>
                use como medidor: é este número que vira limite ou cobrança por plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.porDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma consulta no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">Consultas</TableHead>
                      <TableHead className="text-right">CPFs distintos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.porDia.map((d) => (
                      <TableRow key={d.dia}>
                        <TableCell>{dataBR(d.dia)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(d.total).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(d.cpfs).toLocaleString("pt-BR")}
                        </TableCell>
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
