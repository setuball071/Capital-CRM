import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, CalendarDays } from "lucide-react";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function mondayOf(base: Date) {
  const x = new Date(base);
  x.setHours(0, 0, 0, 0);
  const wd = x.getDay();
  x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd));
  return x;
}
const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Linha { dia: string; vendorId: number | null; vendorNome: string; total: number; qtd: number; }

export default function DigitacaoSemanal() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [semanaBase, setSemanaBase] = useState<Date>(() => mondayOf(new Date()));
  const semana = ymd(semanaBase);
  const [metaInput, setMetaInput] = useState("");

  const { data } = useQuery<{ semana: string; meta: number; linhas: Linha[] }>({
    queryKey: ["/api/metas/digitacao-semanal", semana],
    queryFn: async () => {
      const res = await fetch(`/api/metas/digitacao-semanal/${semana}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar digitação");
      return res.json();
    },
  });

  useEffect(() => { setMetaInput(data ? String(data.meta || "") : ""); }, [data?.meta, semana]);

  const saveMeta = useMutation({
    mutationFn: async () =>
      apiRequest("PUT", "/api/metas/digitacao-semanal", {
        semana,
        meta: parseFloat(metaInput.replace(/\./g, "").replace(",", ".")) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/metas/digitacao-semanal", semana] });
      toast({ title: "Meta semanal salva" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  const linhas = data?.linhas ?? [];
  const meta = data?.meta ?? 0;

  // Produção por dia (Seg..Sáb)
  const dias = useMemo(() => {
    const arr: { date: Date; key: string; valor: number; qtd: number; top: { nome: string; valor: number } | null }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(semanaBase);
      d.setDate(d.getDate() + i);
      const key = ymd(d);
      const ls = linhas.filter((l) => l.dia === key);
      const valor = ls.reduce((s, l) => s + l.total, 0);
      const qtd = ls.reduce((s, l) => s + l.qtd, 0);
      const top = ls.length ? ls.reduce((a, b) => (b.total > a.total ? b : a)) : null;
      arr.push({ date: d, key, valor, qtd, top: top ? { nome: top.vendorNome, valor: top.total } : null });
    }
    return arr;
  }, [linhas, semana]);

  const totalSemana = linhas.reduce((s, l) => s + l.total, 0);
  const qtdSemana = linhas.reduce((s, l) => s + l.qtd, 0);
  const falta = Math.max(0, meta - totalSemana);

  // Ranking de vendedores (destaque da semana)
  const ranking = useMemo(() => {
    const map: Record<string, { nome: string; valor: number; qtd: number }> = {};
    for (const l of linhas) {
      const k = l.vendorNome;
      map[k] = map[k] || { nome: k, valor: 0, qtd: 0 };
      map[k].valor += l.total;
      map[k].qtd += l.qtd;
    }
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [linhas]);

  // Dias úteis restantes (hoje..sexta) para a média necessária
  const diasRestantes = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let count = 0;
    for (let i = 0; i < 5; i++) {
      const d = new Date(semanaBase);
      d.setDate(d.getDate() + i);
      if (d >= hoje) count++;
    }
    return Math.max(1, count);
  }, [semana]);
  const mediaNecessaria = falta / diasRestantes;

  const fimSemana = new Date(semanaBase);
  fimSemana.setDate(fimSemana.getDate() + 5);
  const periodoLabel = `${semanaBase.toLocaleDateString("pt-BR")} – ${fimSemana.toLocaleDateString("pt-BR")}`;
  const pctMeta = meta > 0 ? Math.min(100, Math.round((totalSemana / meta) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Navegação da semana + meta */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d); }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium min-w-[210px] text-center flex items-center gap-2 justify-center">
            <CalendarDays className="w-4 h-4" /> {periodoLabel}
          </span>
          <Button size="icon" variant="outline" onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d); }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSemanaBase(mondayOf(new Date()))}>Semana atual</Button>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Meta semanal (R$)</p>
            <Input value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="0,00" className="w-36" />
          </div>
          <Button size="sm" onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>
            {saveMeta.isPending ? "Salvando..." : "Salvar meta"}
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Meta semanal</p><p className="text-xl font-bold">{fmtBRL(meta)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Digitado na semana</p><p className="text-xl font-bold">{fmtBRL(totalSemana)}</p><p className="text-xs text-muted-foreground">{qtdSemana} proposta(s)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falta para a meta</p><p className="text-xl font-bold text-amber-600">{fmtBRL(falta)}</p>{meta > 0 && <p className="text-xs text-muted-foreground">{pctMeta}% da meta</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Média diária necessária</p><p className="text-xl font-bold">{fmtBRL(mediaNecessaria)}</p><p className="text-xs text-muted-foreground">{diasRestantes} dia(s) útil(eis) restante(s)</p></CardContent></Card>
      </div>

      {/* Produção por dia */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Produção por dia</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {dias.map((d) => (
              <div key={d.key} className="rounded-lg border p-3">
                <p className="text-xs font-semibold">{DIAS[d.date.getDay()]}</p>
                <p className="text-[10px] text-muted-foreground">{d.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                <p className="text-base font-bold mt-1">{fmtBRL(d.valor)}</p>
                <p className="text-[10px] text-muted-foreground">{d.qtd} prop.</p>
                {d.top && d.valor > 0 && (
                  <p className="text-[10px] mt-1 flex items-center gap-1 text-amber-600">
                    <Trophy className="w-3 h-3" /> {d.top.nome.split(" ")[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Destaques / ranking */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Destaques da semana</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma digitação nesta semana.</p>
          ) : (
            <div className="space-y-1.5">
              {ranking.map((r, i) => (
                <div key={r.nome} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-xs ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                    {r.nome}
                  </span>
                  <span className="font-medium">{fmtBRL(r.valor)} <span className="text-xs text-muted-foreground">({r.qtd})</span></span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
