import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { fmtMoeda, fmtNum, fmtPercent, variacao } from "./fmt";

type Formato = "moeda" | "numero" | "percent";

function formatar(v: number, formato: Formato): string {
  if (formato === "moeda") return fmtMoeda(v);
  if (formato === "percent") return fmtPercent(v);
  return fmtNum(v);
}

interface Props {
  titulo: string;
  valor: number;
  formato: Formato;
  /** valor do período anterior, para mostrar a variação */
  anterior?: number;
  /** subtítulo opcional (ex.: "qtd: 12") */
  sub?: string;
}

export function KpiCard({ titulo, valor, formato, anterior, sub }: Props) {
  const variP = anterior != null ? variacao(valor, anterior) : null;
  const sobe = variP != null && variP >= 0;
  return (
    <Card data-testid={`kpi-${titulo}`}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{titulo}</div>
        <div className="text-2xl font-semibold mt-1">{formatar(valor, formato)}</div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          {variP != null && (
            <span className={`flex items-center gap-0.5 ${sobe ? "text-green-600" : "text-red-600"}`}>
              {sobe ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {fmtPercent(Math.abs(variP))}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
