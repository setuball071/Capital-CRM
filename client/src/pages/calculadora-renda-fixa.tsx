import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

interface Row {
  m: number;
  aporte: number;
  juros: number;
  saldo: number;
}

interface Resultado {
  montante: number;
  totalInvestido: number;
  totalJuros: number;
  rentabilidade: number;
  ganhoMes: number;
  pctInvest: number;
  rows: Row[];
}

export default function CalculadoraRendaFixa() {
  const [inicial, setInicial] = useState("");
  const [mensal, setMensal] = useState("");
  const [meses, setMeses] = useState("");
  const [taxa, setTaxa] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  function calcular() {
    const vInicial = parseFloat(inicial.replace(",", ".")) || 0;
    const vMensal  = parseFloat(mensal.replace(",", "."))  || 0;
    const vMeses   = parseInt(meses)   || 0;
    const vTaxa    = parseFloat(taxa.replace(",", "."))    || 0;

    if (vMeses < 1) { setErro("Informe o prazo em meses."); return; }
    if (vTaxa < 0)  { setErro("Taxa inválida."); return; }
    setErro("");

    const t = vTaxa / 100;
    let saldo = vInicial;
    let totalJuros = 0;
    const totalInvestido = vInicial + vMensal * vMeses;
    const rows: Row[] = [];

    for (let m = 1; m <= vMeses; m++) {
      saldo += vMensal;
      const juros = saldo * t;
      saldo += juros;
      totalJuros += juros;
      rows.push({ m, aporte: vMensal, juros, saldo });
    }

    const rentabilidade = totalInvestido > 0 ? (totalJuros / totalInvestido) * 100 : 0;
    const ganhoMes = vMeses > 0 ? totalJuros / vMeses : 0;
    const pctInvest = saldo > 0 ? (totalInvestido / saldo) * 100 : 100;

    setResultado({ montante: saldo, totalInvestido, totalJuros, rentabilidade, ganhoMes, pctInvest, rows });
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Calculadora de Renda Fixa</h1>
          <p className="text-muted-foreground text-sm">Juros compostos com aportes mensais</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Valor Inicial</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                className="pl-8"
                placeholder="0,00"
                value={inicial}
                onChange={e => setInicial(e.target.value)}
                onKeyDown={e => e.key === "Enter" && calcular()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aporte Mensal</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                className="pl-8"
                placeholder="0,00"
                value={mensal}
                onChange={e => setMensal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && calcular()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prazo (meses)</Label>
              <Input
                placeholder="12"
                value={meses}
                onChange={e => setMeses(e.target.value)}
                onKeyDown={e => e.key === "Enter" && calcular()}
              />
            </div>
            <div className="space-y-2">
              <Label>Taxa Mensal (%)</Label>
              <Input
                placeholder="1,00"
                value={taxa}
                onChange={e => setTaxa(e.target.value)}
                onKeyDown={e => e.key === "Enter" && calcular()}
              />
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button className="w-full" onClick={calcular}>Calcular</Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Montante destaque */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Montante Final</p>
              <p className="text-3xl font-bold text-green-500">{fmt(resultado.montante)}</p>
            </div>

            {/* Grid de métricas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Investido</p>
                <p className="text-lg font-semibold text-yellow-500">{fmt(resultado.totalInvestido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total em Juros</p>
                <p className="text-lg font-semibold text-blue-500">{fmt(resultado.totalJuros)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Rentabilidade</p>
                <p className="text-lg font-semibold">{fmtPct(resultado.rentabilidade)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ganho / Mês</p>
                <p className="text-lg font-semibold">{fmt(resultado.ganhoMes)}</p>
              </div>
            </div>

            {/* Barra investido vs juros */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Investido {fmtPct(resultado.pctInvest)}</span>
                <span>Juros {fmtPct(100 - resultado.pctInvest)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${resultado.pctInvest}%` }}
                />
              </div>
            </div>

            {/* Tabela mês a mês */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Evolução mês a mês</p>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="py-2 px-3 text-center text-muted-foreground font-medium">Mês</th>
                      <th className="py-2 px-3 text-right text-muted-foreground font-medium">Aporte</th>
                      <th className="py-2 px-3 text-right text-muted-foreground font-medium">Juros</th>
                      <th className="py-2 px-3 text-right text-muted-foreground font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.rows.map((r, i) => (
                      <tr
                        key={r.m}
                        className={i === resultado.rows.length - 1 ? "font-semibold" : "border-t border-border/50"}
                      >
                        <td className="py-1.5 px-3 text-center text-muted-foreground">{r.m}</td>
                        <td className="py-1.5 px-3 text-right">{fmt(r.aporte)}</td>
                        <td className="py-1.5 px-3 text-right text-blue-500">{fmt(r.juros)}</td>
                        <td className="py-1.5 px-3 text-right text-green-500">{fmt(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
