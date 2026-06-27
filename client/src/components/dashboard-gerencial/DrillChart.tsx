import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuebraItem } from "./types";
import { fmtMoeda } from "./fmt";

const CORES = ["#7C3AED", "#EC4899", "#2563EB", "#059669", "#D97706", "#DC2626", "#0891B2", "#9333EA", "#65A30D", "#E11D48", "#0D9488", "#7E22CE"];

interface Props {
  titulo: string;
  tipo: "barra" | "pizza";
  dados: QuebraItem[];
  /** clique numa barra/fatia → drill-down */
  onSlice?: (chave: string) => void;
}

export function DrillChart({ titulo, tipo, dados, onSlice }: Props) {
  const vazio = !dados || dados.length === 0;
  return (
    <Card data-testid={`chart-${titulo}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {vazio ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {tipo === "barra" ? (
              <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => fmtMoeda(v)} hide />
                <YAxis type="category" dataKey="chave" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                <Bar
                  dataKey="valor"
                  radius={[0, 4, 4, 0]}
                  cursor={onSlice ? "pointer" : "default"}
                  onClick={(d: any) => onSlice && d?.chave && onSlice(d.chave)}
                >
                  {dados.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Tooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="chave"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e: any) => e.chave}
                  cursor={onSlice ? "pointer" : "default"}
                  onClick={(d: any) => onSlice && d?.chave && onSlice(d.chave)}
                >
                  {dados.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
