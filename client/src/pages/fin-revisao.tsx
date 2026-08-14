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
import { SearchCheck, Upload, Copy, TrendingUp, Repeat, RefreshCw, CreditCard } from "lucide-react";

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
    const files = Array.from(fileRef.current?.files ?? []);
    if (!files.length) { toast({ title: "Selecione a(s) fatura(s)", variant: "destructive" }); return; }
    setAnalisando(true);
    setResultado(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("arquivos", f);
      if (criar) fd.append("criar", "1");
      const r = await fetch("/api/fin/analisar-fatura", { method: "POST", body: fd, credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Erro");
      setResultado(d);
      const criadas = (d.faturas || []).filter((f: any) => f.contaCriada).length;
      toast({
        title: `${d.faturas.length} documento(s) lido(s)`,
        description: criadas ? `${criadas} conta(s) a pagar criada(s) — veja em Contas a Pagar` : "Confira os dados abaixo.",
      });
      if (criadas) qc.invalidateQueries({ queryKey: ["fin-cp"] });
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
        <CardHeader className="pb-2"><CardTitle className="text-base">📄 Ler faturas e boletos (IA)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Label>Arquivos — pode mandar várias faturas juntas</Label>
              <Input ref={fileRef} type="file" accept="image/*,.pdf" multiple />
            </div>
            <Button variant="outline" disabled={analisando} onClick={() => analisar(false)}>
              {analisando ? "Lendo..." : "Só ler"}
            </Button>
            <Button disabled={analisando} onClick={() => analisar(true)}>
              <Upload className="h-4 w-4 mr-1" /> Ler e criar contas a pagar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mandando as faturas dos seus cartões de uma vez, a análise cruza todos: assinatura
            cobrada em mais de um cartão aparece destacada.
          </p>

          {resultado?.erros?.length > 0 && (
            <p className="text-xs text-amber-600">Não consegui ler: {resultado.erros.join(" · ")}</p>
          )}

          {resultado?.faturas?.length > 0 && (
            <div className="space-y-2">
              {resultado.faturas.map((f: any, i: number) => (
                <div key={i} className="rounded-lg border bg-muted/40 p-3 text-sm grid gap-1.5 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center gap-2 font-semibold">
                    <CreditCard className="h-4 w-4 text-primary shrink-0" />
                    {f.dados.descricao || f.arquivo}
                    {f.qtdItens > 0 && <span className="text-xs font-normal text-muted-foreground">· {f.qtdItens} compras</span>}
                  </div>
                  <div><span className="text-muted-foreground">Fornecedor:</span> <b>{f.dados.fornecedor || "—"}</b></div>
                  <div><span className="text-muted-foreground">Valor:</span> <b>{f.dados.valor ? fmtBRL(f.dados.valor) : "—"}</b></div>
                  <div><span className="text-muted-foreground">Vencimento:</span> <b>{fmtData(f.dados.vencimento)}</b></div>
                  <div><span className="text-muted-foreground">Categoria sugerida:</span> <b>{f.dados.categoriasugerida || "—"}</b></div>
                  {f.dados.observacoes && <div className="sm:col-span-2 text-muted-foreground text-xs">{f.dados.observacoes}</div>}
                  {f.contaCriada && <div className="sm:col-span-2 text-green-600 font-semibold text-xs">✓ Conta a pagar criada</div>}
                </div>
              ))}
            </div>
          )}

          {/* Detalhamento consolidado: onde a revisão de custos realmente acontece */}
          {resultado?.analiseItens && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between flex-wrap gap-2 border-t pt-3">
                <p className="font-semibold text-sm">
                  📑 {resultado.analiseItens.totalItens} compras
                  {resultado.faturas?.length > 1 ? ` em ${resultado.faturas.length} faturas` : " nesta fatura"}
                </p>
                <p className="text-xs text-muted-foreground">
                  soma dos itens {fmtBRL(resultado.analiseItens.somaItens)}
                  {resultado.analiseItens.totalFaturas > 0 && Math.abs(resultado.analiseItens.totalFaturas - resultado.analiseItens.somaItens) > 0.5 && (
                    <span className="text-amber-600 font-semibold"> · total das faturas {fmtBRL(resultado.analiseItens.totalFaturas)}</span>
                  )}
                </p>
              </div>

              {resultado.analiseItens.porCartao?.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {resultado.analiseItens.porCartao.map((c: any, i: number) => (
                    <div key={i} className="rounded-md border px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{c.origem}</span>{" "}
                      <b className="font-mono">{fmtBRL(c.total)}</b>{" "}
                      <span className="text-muted-foreground">({c.itens})</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {resultado.analiseItens.repetidos?.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
                      Cobrado mais de uma vez — possíveis assinaturas
                    </p>
                    <div className="space-y-2">
                      {resultado.analiseItens.repetidos.map((r: any, i: number) => (
                        <div key={i} className={`rounded-md px-2 py-1.5 ${r.multiCartao ? "bg-amber-500/10 border border-amber-500/40" : r.valorRepetido ? "bg-red-500/5 border border-red-500/30" : ""}`}>
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="truncate font-medium" title={r.descricao}>
                              {r.descricao} <span className="text-muted-foreground font-normal">({r.ocorrencias}×)</span>
                              {r.multiCartao && <span className="ml-1 text-amber-700 dark:text-amber-500 font-semibold">· em {r.cartoes?.length} cartões</span>}
                              {!r.multiCartao && r.valorRepetido && <span className="ml-1 text-red-600 font-semibold">· mesmo valor repetido</span>}
                            </span>
                            <span className="font-mono font-semibold shrink-0">{fmtBRL(r.total)}</span>
                          </div>
                          {r.detalhe?.length > 0 && (
                            <div className="mt-1 pl-2 border-l-2 border-muted space-y-0.5">
                              {r.detalhe.map((o: any, j: number) => (
                                <div key={j} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                                  <span className="truncate">
                                    {o.data ? fmtData(o.data) : "sem data"}
                                    {resultado.faturas?.length > 1 && o.origem && <span className="ml-1.5 opacity-70">· {o.origem}</span>}
                                  </span>
                                  <span className="font-mono shrink-0">{fmtBRL(o.valor)}</span>
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
                          <span className="truncate" title={r.descricao}>
                            {r.descricao}
                            {resultado.faturas?.length > 1 && r.origem && <span className="ml-1.5 text-muted-foreground">· {r.origem}</span>}
                          </span>
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
                    Maiores gastos ({resultado.analiseItens.maiores.length})
                  </summary>
                  <div className="space-y-1 mt-2">
                    {resultado.analiseItens.maiores.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <span className="truncate" title={r.descricao}>
                          {r.data && <span className="text-muted-foreground mr-1.5">{fmtData(r.data)}</span>}
                          {r.descricao}
                          {resultado.faturas?.length > 1 && r.origem && <span className="ml-1.5 text-muted-foreground">· {r.origem}</span>}
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
