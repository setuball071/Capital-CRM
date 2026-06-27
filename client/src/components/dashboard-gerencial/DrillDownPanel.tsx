import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DrillItem, DrillMetrica, DrillDim } from "./types";
import { fmtMoeda } from "./fmt";

interface Props {
  aberto: boolean;
  onClose: () => void;
  titulo: string;
  queryString: string; // filtros globais já serializados
  metrica: DrillMetrica;
  dim?: DrillDim;
  valor?: string;
}

function baixarCSV(itens: DrillItem[], nome: string) {
  const head = ["Cliente", "CPF", "Corretor", "Banco", "Produto", "Convênio", "Valor", "Status", "Cadastro", "Pagamento"].join(";");
  const linhas = itens.map((i) =>
    [
      i.cliente ?? "",
      i.cpf ?? "",
      i.corretor ?? "",
      i.banco ?? "",
      i.produto ?? "",
      i.convenio ?? "",
      (Number(i.valor) || 0).toFixed(2).replace(".", ","),
      i.status ?? "",
      i.criadoEm ?? "",
      i.pagoEm ?? "",
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(";"),
  );
  const csv = "﻿" + head + "\r\n" + linhas.join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DrillDownPanel({ aberto, onClose, titulo, queryString, metrica, dim, valor }: Props) {
  const params = new URLSearchParams(queryString);
  params.set("metrica", metrica);
  if (dim && valor != null) {
    params.set("dim", dim);
    params.set("valor", valor);
  }
  const url = `/api/gestao-comercial/dashboard/visao-geral/drill?${params.toString()}`;

  const { data, isLoading } = useQuery<{ itens: DrillItem[] }>({
    queryKey: [url],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar detalhe");
      return r.json();
    },
    enabled: aberto,
  });

  const itens = data?.itens || [];

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="drilldown-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{titulo}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!itens.length}
              onClick={() => baixarCSV(itens, `detalhe-${(dim || metrica)}-${valor || ""}`)}
              data-testid="button-export-drill"
            >
              Exportar CSV
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando…</div>
          ) : itens.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhuma proposta.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{metrica === "pago" ? "Pagamento" : "Cadastro"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[180px] truncate">{i.cliente}</TableCell>
                    <TableCell>{i.corretor || "—"}</TableCell>
                    <TableCell>{i.banco || "—"}</TableCell>
                    <TableCell>{i.produto || "—"}</TableCell>
                    <TableCell>{i.convenio || "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoeda(i.valor)}</TableCell>
                    <TableCell>{i.status}</TableCell>
                    <TableCell>{metrica === "pago" ? i.pagoEm : i.criadoEm}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="text-xs text-muted-foreground pt-2">{itens.length} proposta(s) {itens.length === 1000 ? "(limite de 1000)" : ""}</div>
      </DialogContent>
    </Dialog>
  );
}
