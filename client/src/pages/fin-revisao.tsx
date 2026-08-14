// Revisão de Custos — leitura de faturas por IA + cruzamentos que apontam
// duplicidades, aumentos e assinaturas a revisar.
// Fase 4 do Financeiro Empresarial (Master-only).
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SearchCheck, Upload, Copy, TrendingUp, Repeat, RefreshCw } from "lucide-react";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

interface Oportunidade { tipo: "duplicidade" | "aumento" | "recorrencia"; titulo: string; detalhe: string; custoAnual: number; }

const TIPO_CFG = {
  duplicidade: { label: "Duplicidade", cls: "bg-red-500/15 text-red-600", Icon: Copy },
  aumento: { label: "Aumento", cls: "bg-amber-500/15 text-amber-600", Icon: TrendingUp },
  recorrencia: { label: "Recorrência", cls: "bg-primary/15 text-primary", Icon: Repeat },
} as const;

export default function FinRevisao() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const { data: analise, isLoading, refetch } = useQuery<{ oportunidades: Oportunidade[]; economiaPotencial: number; baseAnalisada: number }>({
    queryKey: ["fin-revisao"],
    queryFn: async () => {
      const r = await fetch("/api/fin/revisao-analise", { credentials: "include" });
      if (!r.ok) throw new Error("Erro na análise");
      return r.json();
    },
  });

  async function analisar(criar: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast({ title: "Selecione a fatura ou boleto", variant: "destructive" }); return; }
    setAnalisando(true);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      if (criar) fd.append("criar", "1");
      const r = await fetch("/api/fin/analisar-fatura", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Erro");
      setResultado(d);
      if (d.contaCriada) {
        toast({ title: "Conta a pagar criada", description: `${d.dados.descricao} · ${fmtBRL(d.dados.valor)} · vence ${fmtData(d.dados.vencimento)}` });
        qc.invalidateQueries({ queryKey: ["fin-cp"] });
      } else {
        toast({ title: "Fatura lida", description: "Confira os dados e crie a conta se quiser." });
      }
    } catch (e: any) {
      toast({ title: "Erro na leitura", description: e.message, variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><SearchCheck className="h-6 w-6 text-primary" /> Revisão de Custos</h1>
          <p className="text-sm text-muted-foreground">A IA lê suas faturas e o histórico aponta o que dá para cortar</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Reanalisar</Button>
      </div>

      {/* Leitor de faturas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">📄 Ler fatura ou boleto (IA)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Label>Arquivo (foto, print ou PDF)</Label>
              <Input ref={fileRef} type="file" accept="image/*,.pdf" />
            </div>
            <Button variant="outline" disabled={analisando} onClick={() => analisar(false)}>
              {analisando ? "Lendo..." : "Só ler"}
            </Button>
            <Button disabled={analisando} onClick={() => analisar(true)}>
              <Upload className="h-4 w-4 mr-1" /> Ler e criar conta a pagar
            </Button>
          </div>
          {resultado?.dados && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm grid gap-1.5 sm:grid-cols-2">
              <div><span className="text-muted-foreground">Descrição:</span> <b>{resultado.dados.descricao || "—"}</b></div>
              <div><span className="text-muted-foreground">Fornecedor:</span> <b>{resultado.dados.fornecedor || "—"}</b></div>
              <div><span className="text-muted-foreground">Valor:</span> <b>{resultado.dados.valor ? fmtBRL(resultado.dados.valor) : "—"}</b></div>
              <div><span className="text-muted-foreground">Vencimento:</span> <b>{fmtData(resultado.dados.vencimento)}</b></div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Categoria sugerida:</span> <b>{resultado.dados.categoriasugerida || "—"}</b></div>
              {resultado.dados.observacoes && <div className="sm:col-span-2 text-muted-foreground text-xs">{resultado.dados.observacoes}</div>}
              {resultado.contaCriada && <div className="sm:col-span-2 text-green-600 font-semibold text-xs">✓ Conta a pagar criada — veja em Contas a Pagar</div>}
            </div>
          )}

          {/* Detalhamento da fatura: onde a revisão de custos realmente acontece */}
          {resultado?.analiseItens && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between flex-wrap gap-2 border-t pt-3">
                <p className="font-semibold text-sm">
                  📑 {resultado.analiseItens.totalItens} compras nesta fatura
                </p>
                <p className="text-xs text-muted-foreground">
                  soma dos itens {fmtBRL(resultado.analiseItens.somaItens)}
                  {resultado.analiseItens.divergencia != null && Math.abs(resultado.analiseItens.divergencia) > 0.5 && (
                    <span className="text-amber-600 font-semibold"> · difere do total em {fmtBRL(Math.abs(resultado.analiseItens.divergencia))}</span>
                  )}
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {resultado.analiseItens.repetidos?.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
                      Cobrado mais de uma vez — possíveis assinaturas
                    </p>
                    <div className="space-y-2">
                      {resultado.analiseItens.repetidos.map((r: any, i: number) => (
                        <div key={i} className={`rounded-md px-2 py-1.5 ${r.valorRepetido ? "bg-red-500/5 border border-red-500/30" : ""}`}>
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="truncate font-medium" title={r.descricao}>
                              {r.descricao} <span className="text-muted-foreground font-normal">({r.ocorrencias}×)</span>
                              {r.valorRepetido && <span className="ml-1 text-red-600 font-semibold">· mesmo valor repetido</span>}
                            </span>
                            <span className="font-mono font-semibold shrink-0">{fmtBRL(r.total)}</span>
                          </div>
                          {r.detalhe?.length > 0 && (
                            <div className="mt-1 pl-2 border-l-2 border-muted space-y-0.5">
                              {r.detalhe.map((o: any, j: number) => (
                                <div key={j} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                                  <span>{o.data ? fmtData(o.data) : "sem data"}</span>
                                  <span className="font-mono">{fmtBRL(o.valor)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resultado.analiseItens.parcelados?.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">
                      Parcelamentos em curso — comprometem os próximos meses
                    </p>
                    <div className="space-y-1">
                      {resultado.analiseItens.parcelados.map((r: any, i: number) => (
                        <div key={i} className="flex justify-between gap-2 text-xs">
                          <span className="truncate" title={r.descricao}>{r.descricao}</span>
                          <span className="font-mono font-semibold shrink-0">{fmtBRL(r.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {resultado.analiseItens.maiores?.length > 0 && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide select-none">
                    Maiores gastos da fatura ({resultado.analiseItens.maiores.length})
                  </summary>
                  <div className="space-y-1 mt-2">
                    {resultado.analiseItens.maiores.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <span className="truncate" title={r.descricao}>
                          {r.data && <span className="text-muted-foreground mr-1.5">{fmtData(r.data)}</span>}
                          {r.descricao}
                        </span>
                        <span className="font-mono font-semibold shrink-0">{fmtBRL(r.valor)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oportunidades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>💡 Oportunidades encontradas</span>
            {analise && (
              <span className="text-sm font-normal text-muted-foreground">
                {analise.baseAnalisada} débitos analisados · potencial de{" "}
                <b className="text-green-600">{fmtBRL(analise.economiaPotencial)}/ano</b> em duplicidades e aumentos
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cruzando seu histórico...</p>
          ) : (analise?.oportunidades?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nada suspeito ainda — a análise fica melhor conforme você importa extratos (precisa de ~3 meses de histórico para detectar recorrências e aumentos).
            </p>
          ) : (
            <div className="space-y-2">
              {analise!.oportunidades.map((o, i) => {
                const cfg = TIPO_CFG[o.tipo];
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                      <cfg.Icon className="h-3 w-3" /> {cfg.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" title={o.titulo}>{o.titulo}</p>
                      <p className="text-xs text-muted-foreground">{o.detalhe}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono">{fmtBRL(o.custoAnual)}</p>
                      <p className="text-[10px] text-muted-foreground">{o.tipo === "duplicidade" ? "cobrado a mais" : "por ano"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
