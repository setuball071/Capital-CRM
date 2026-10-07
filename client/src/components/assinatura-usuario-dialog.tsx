import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Paperclip, Download, CheckCircle2, Plus } from "lucide-react";

// ── formato ─────────────────────────────────────────────────────────────────
export const brl = (v: unknown) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (iso?: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";

export const STATUS_ASSINATURA: Record<string, { rotulo: string; classe: string }> = {
  ativa: { rotulo: "Ativa", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", classe: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  em_atraso: { rotulo: "Em atraso", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  suspensao_programada: { rotulo: "Suspensão programada", classe: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  suspensa: { rotulo: "Suspensa", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  cancelada: { rotulo: "Cancelada", classe: "bg-muted text-muted-foreground" },
  isenta: { rotulo: "Isenta / cortesia", classe: "bg-primary/10 text-primary" },
};

export const STATUS_COBRANCA: Record<string, { rotulo: string; classe: string }> = {
  aberta: { rotulo: "Em aberto", classe: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  paga: { rotulo: "Paga", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  vencida: { rotulo: "Vencida", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  cancelada: { rotulo: "Cancelada", classe: "bg-muted text-muted-foreground" },
  isenta: { rotulo: "Isenta", classe: "bg-primary/10 text-primary" },
  estornada: { rotulo: "Estornada", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

const ROTULO_EVENTO: Record<string, string> = {
  criada: "Assinatura criada",
  plano_alterado: "Plano ou valor alterado",
  desconto_alterado: "Desconto alterado",
  situacao_alterada: "Situação alterada",
  vencimento_alterado: "Vencimento ou regra alterada",
  dados_alterados: "Dados alterados",
  cobranca_gerada: "Mensalidade gerada",
  cobranca_alterada: "Mensalidade alterada",
  cobranca_cancelada: "Mensalidade cancelada",
  cobranca_isenta: "Mensalidade isentada",
  cobranca_estornada: "Mensalidade estornada",
  boleto_anexado: "Boleto anexado",
  comprovante_anexado: "Comprovante anexado",
  pagamento_confirmado: "Pagamento confirmado",
};

const FORMAS = [
  ["", "—"],
  ["boleto", "Boleto"],
  ["pix", "Pix"],
  ["transferencia", "Transferência"],
  ["cartao", "Cartão"],
  ["dinheiro", "Dinheiro"],
] as const;

const vazio = {
  plano_id: "",
  status: "ativa",
  valor_mensal: "",
  dia_vencimento: "10",
  data_inicio: "",
  proximo_vencimento: "",
  desconto_tipo: "",
  desconto_valor: "",
  desconto_inicio: "",
  desconto_fim: "",
  desconto_parcelas: "",
  desconto_motivo: "",
  tolerancia_dias: "3",
  suspensao_automatica: true,
  forma_pagamento: "",
  isenta_ate: "",
  observacoes: "",
};

/**
 * Seção "Assinatura e acesso" de um usuário. Abre a partir do cadastro de
 * usuários e da central de assinaturas — é a mesma tela nos dois lugares.
 */
export function AssinaturaUsuarioDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: number | null;
  userName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const chave = ["/api/admin/assinaturas/usuario", userId];
  const { data, isLoading } = useQuery<{ assinatura: any; cobrancas: any[]; eventos: any[] }>({
    queryKey: chave,
    enabled: open && !!userId,
  });
  const { data: planos = [] } = useQuery<any[]>({ queryKey: ["/api/admin/planos"], enabled: open });

  const [form, setForm] = useState<any>(vazio);
  const [criando, setCriando] = useState(false);
  const a = data?.assinatura;

  useEffect(() => {
    if (!open) return;
    setCriando(false);
    if (a) {
      setForm({
        ...vazio,
        ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === null ? "" : String(v)])),
        desconto_parcelas: a.desconto_parcelas_restantes === null ? "" : String(a.desconto_parcelas_restantes),
        suspensao_automatica: a.suspensao_automatica !== false,
      });
    } else {
      setForm(vazio);
    }
  }, [a?.id, a?.updated_at, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/assinaturas"] });
  };

  const salvar = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/admin/assinaturas/usuario/${userId}`, form),
    onSuccess: () => {
      recarregar();
      toast({ title: "Assinatura salva" });
    },
    onError: (e: any) => toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" }),
  });

  const planoEscolhido = planos.find((p) => String(p.id) === String(form.plano_id));
  const valorBase = Number(form.valor_mensal || planoEscolhido?.valor || planoEscolhido?.preco_mensal || 0);
  const descontoPrevisto = !form.desconto_tipo || !form.desconto_valor ? 0
    : form.desconto_tipo === "percentual"
      ? Math.min(valorBase, (valorBase * Number(form.desconto_valor)) / 100)
      : Math.min(valorBase, Number(form.desconto_valor));

  const mostrarForm = !!a || criando;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinatura e acesso</DialogTitle>
          <DialogDescription>
            {userName ? `${userName} · ` : ""}a assinatura é desta pessoa, não do ambiente: suspender aqui não afeta os colegas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !mostrarForm ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Este usuário não é assinante. Sem assinatura, o acesso segue como hoje.</p>
            <Button onClick={() => setCriando(true)} data-testid="button-tornar-assinante">Tornar assinante</Button>
          </div>
        ) : (
          <Tabs defaultValue="assinatura">
            <TabsList>
              <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
              <TabsTrigger value="cobrancas" disabled={!a}>Mensalidades{data?.cobrancas?.length ? ` (${data.cobrancas.length})` : ""}</TabsTrigger>
              <TabsTrigger value="historico" disabled={!a}>Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="assinatura" className="space-y-5 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Campo rotulo="Plano">
                  <select className={sel} value={form.plano_id} data-testid="select-plano"
                    onChange={(e) => {
                      const p = planos.find((x) => String(x.id) === e.target.value);
                      setForm((f: any) => ({ ...f, plano_id: e.target.value,
                        valor_mensal: f.valor_mensal || String(p?.valor ?? p?.preco_mensal ?? "") }));
                    }}>
                    <option value="">Escolha…</option>
                    {planos.filter((p) => p.ativo !== false).map((p) => (
                      <option key={p.id} value={p.id}>{p.nome} — {brl(p.valor ?? p.preco_mensal)}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Situação">
                  <select className={sel} value={form.status} onChange={(e) => set("status", e.target.value)} data-testid="select-situacao">
                    {Object.entries(STATUS_ASSINATURA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Valor mensal (R$)" nota="Vazio = valor do plano">
                  <Input inputMode="decimal" value={form.valor_mensal} onChange={(e) => set("valor_mensal", e.target.value.replace(",", "."))} />
                </Campo>
                <Campo rotulo="Dia de vencimento">
                  <Input type="number" min={1} max={28} value={form.dia_vencimento} onChange={(e) => set("dia_vencimento", e.target.value)} />
                </Campo>
                <Campo rotulo="Data de início">
                  <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
                </Campo>
                <Campo rotulo="Próxima cobrança (vencimento)" nota="Vazio = calcula pelo dia">
                  <Input type="date" value={form.proximo_vencimento} onChange={(e) => set("proximo_vencimento", e.target.value)} />
                </Campo>
                <Campo rotulo="Forma de pagamento">
                  <select className={sel} value={form.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)}>
                    {FORMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Tolerância após vencimento (dias)">
                  <Input type="number" min={0} max={60} value={form.tolerancia_dias} onChange={(e) => set("tolerancia_dias", e.target.value)} />
                </Campo>
                {form.status === "isenta" && (
                  <Campo rotulo="Isenta até" nota="Vazio = sem prazo">
                    <Input type="date" value={form.isenta_ate} onChange={(e) => set("isenta_ate", e.target.value)} />
                  </Campo>
                )}
              </div>

              <label className="flex items-center gap-3 text-sm">
                <Switch checked={form.suspensao_automatica} onCheckedChange={(v) => set("suspensao_automatica", v)} />
                Suspender automaticamente ao fim da tolerância
              </label>

              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Desconto</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Campo rotulo="Tipo">
                    <select className={sel} value={form.desconto_tipo} onChange={(e) => set("desconto_tipo", e.target.value)}>
                      <option value="">Sem desconto</option>
                      <option value="valor">Valor (R$)</option>
                      <option value="percentual">Percentual (%)</option>
                    </select>
                  </Campo>
                  {form.desconto_tipo && (<>
                    <Campo rotulo={form.desconto_tipo === "percentual" ? "Percentual" : "Valor (R$)"}>
                      <Input inputMode="decimal" value={form.desconto_valor} onChange={(e) => set("desconto_valor", e.target.value.replace(",", "."))} />
                    </Campo>
                    <Campo rotulo="Quantidade de mensalidades" nota="Vazio = permanente">
                      <Input type="number" min={0} value={form.desconto_parcelas} onChange={(e) => set("desconto_parcelas", e.target.value)} />
                    </Campo>
                    <Campo rotulo="Vale a partir de">
                      <Input type="date" value={form.desconto_inicio} onChange={(e) => set("desconto_inicio", e.target.value)} />
                    </Campo>
                    <Campo rotulo="Vale até">
                      <Input type="date" value={form.desconto_fim} onChange={(e) => set("desconto_fim", e.target.value)} />
                    </Campo>
                    <Campo rotulo="Motivo">
                      <Input value={form.desconto_motivo} onChange={(e) => set("desconto_motivo", e.target.value)} placeholder="Ex.: Elite com desconto especial" />
                    </Campo>
                  </>)}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>Valor original: <b>{brl(valorBase)}</b></span>
                  <span>Desconto: <b>{brl(descontoPrevisto)}</b></span>
                  <span>Valor final: <b>{brl(valorBase - descontoPrevisto)}</b></span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mudar valor ou desconto vale só para as próximas mensalidades. As já geradas mantêm o valor delas.
                </p>
              </div>

              <Campo rotulo="Observações administrativas">
                <Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
              </Campo>

              <div className="flex justify-end gap-2">
                {!a && <Button variant="outline" onClick={() => setCriando(false)}>Cancelar</Button>}
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.plano_id} data-testid="button-salvar-assinatura">
                  {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {a ? "Salvar alterações" : "Criar assinatura"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="cobrancas" className="pt-3">
              {a && <Cobrancas assinatura={a} cobrancas={data?.cobrancas || []} onMudou={recarregar} />}
            </TabsContent>

            <TabsContent value="historico" className="pt-3">
              <div className="space-y-2">
                {(data?.eventos || []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
                {(data?.eventos || []).map((e: any) => (
                  <div key={e.id} className="rounded-md border p-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <b>{ROTULO_EVENTO[e.acao] || e.acao}</b>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.criado_em).toLocaleString("pt-BR")} · {e.por_nome || "sistema"}
                      </span>
                    </div>
                    {e.antes && Object.keys(e.antes).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">antes: {resumo(e.antes)}</p>
                    )}
                    {e.depois && (
                      <p className="text-xs mt-0.5">{e.antes ? "depois: " : ""}{resumo(e.depois)}</p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function Campo({ rotulo, nota, children }: { rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{rotulo}</Label>
      {children}
      {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

function resumo(o: Record<string, any>) {
  return Object.entries(o)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(" · ");
}

// ── Mensalidades ────────────────────────────────────────────────────────────
function Cobrancas({ assinatura, cobrancas, onMudou }: { assinatura: any; cobrancas: any[]; onMudou: () => void }) {
  const { toast } = useToast();
  const [aberta, setAberta] = useState<number | null>(null);

  const gerar = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/assinaturas/${assinatura.id}/cobrancas`, {}),
    onSuccess: () => { onMudou(); toast({ title: "Mensalidade gerada" }); },
    onError: (e: any) => toast({ title: "Não consegui gerar", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Próximo vencimento: <b className="text-foreground">{dataBR(assinatura.proximo_vencimento)}</b>
        </p>
        <Button size="sm" onClick={() => gerar.mutate()} disabled={gerar.isPending} data-testid="button-gerar-mensalidade">
          <Plus className="h-4 w-4 mr-1" /> Gerar mensalidade
        </Button>
      </div>
      {cobrancas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensalidade gerada.</p>}
      {cobrancas.map((c) => (
        <div key={c.id} className="rounded-md border">
          <button type="button" className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left text-sm"
            onClick={() => setAberta(aberta === c.id ? null : c.id)}>
            <b>{c.competencia.slice(5, 7)}/{c.competencia.slice(0, 4)}</b>
            <span>vence {dataBR(c.vencimento)}</span>
            <span>{brl(c.valor_final)}{Number(c.desconto) > 0 && <span className="text-muted-foreground"> (de {brl(c.valor_original)})</span>}</span>
            <Badge className={`${STATUS_COBRANCA[c.status]?.classe} border-0`}>{STATUS_COBRANCA[c.status]?.rotulo || c.status}</Badge>
            {(c.tem_boleto_arquivo || c.boleto_link || c.linha_digitavel || c.pix_copia_cola)
              ? <span className="text-xs text-emerald-700 dark:text-emerald-400">boleto disponível</span>
              : <span className="text-xs text-muted-foreground">sem boleto</span>}
            {c.pago_em && <span className="text-xs text-muted-foreground">pago em {dataBR(c.pago_em)}</span>}
          </button>
          {aberta === c.id && <DetalheCobranca c={c} onMudou={onMudou} />}
        </div>
      ))}
    </div>
  );
}

function DetalheCobranca({ c, onMudou }: { c: any; onMudou: () => void }) {
  const { toast } = useToast();
  const [dados, setDados] = useState({
    boleto_link: c.boleto_link || "",
    linha_digitavel: c.linha_digitavel || "",
    pix_copia_cola: c.pix_copia_cola || "",
    observacoes: c.observacoes || "",
  });
  const [pagto, setPagto] = useState({
    pago_em: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10),
    valor_pago: String(c.valor_final),
    forma_pagamento: "",
    observacoes: "",
  });
  const [enviando, setEnviando] = useState<string | null>(null);
  const arqBoleto = useRef<HTMLInputElement>(null);
  const arqComprovante = useRef<HTMLInputElement>(null);
  const emAberto = c.status === "aberta" || c.status === "vencida";

  const salvar = useMutation({
    mutationFn: async (extra: any) => apiRequest("PATCH", `/api/admin/cobrancas/${c.id}`, { ...dados, ...extra }),
    onSuccess: () => { onMudou(); toast({ title: "Mensalidade atualizada" }); },
    onError: (e: any) => toast({ title: "Não consegui salvar", description: e?.message, variant: "destructive" }),
  });
  const pagar = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/cobrancas/${c.id}/pagar`, pagto),
    onSuccess: () => { onMudou(); toast({ title: "Pagamento confirmado", description: "Próximo vencimento atualizado." }); },
    onError: (e: any) => toast({ title: "Não confirmei", description: e?.message, variant: "destructive" }),
  });

  const anexar = async (tipo: "boleto" | "comprovante", arquivo?: File) => {
    if (!arquivo) return;
    setEnviando(tipo);
    try {
      const fd = new FormData();
      fd.append("file", arquivo);
      const r = await fetch(`/api/admin/cobrancas/${c.id}/arquivo?tipo=${tipo}`, { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Falha no envio");
      onMudou();
      toast({ title: tipo === "boleto" ? "Boleto anexado" : "Comprovante anexado",
        description: tipo === "boleto" ? "Anexar não marca como paga." : undefined });
    } catch (e: any) {
      toast({ title: "Não consegui anexar", description: e?.message, variant: "destructive" });
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="border-t p-3 space-y-4 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Campo rotulo="Link do boleto / pagamento">
          <Input value={dados.boleto_link} onChange={(e) => setDados({ ...dados, boleto_link: e.target.value })} placeholder="https://…" />
        </Campo>
        <Campo rotulo="Linha digitável">
          <Input value={dados.linha_digitavel} onChange={(e) => setDados({ ...dados, linha_digitavel: e.target.value })} />
        </Campo>
        <Campo rotulo="Pix copia e cola">
          <Input value={dados.pix_copia_cola} onChange={(e) => setDados({ ...dados, pix_copia_cola: e.target.value })} />
        </Campo>
        <Campo rotulo="Observações">
          <Input value={dados.observacoes} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
        </Campo>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => salvar.mutate({})} disabled={salvar.isPending}>Salvar dados</Button>
        <input ref={arqBoleto} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => anexar("boleto", e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => arqBoleto.current?.click()} disabled={enviando !== null}>
          {enviando === "boleto" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}
          {c.tem_boleto_arquivo ? "Trocar boleto (arquivo)" : "Anexar boleto (arquivo)"}
        </Button>
        {c.tem_boleto_arquivo && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/cobrancas/${c.id}/arquivo/boleto`} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" />Ver boleto</a>
          </Button>
        )}
        <input ref={arqComprovante} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => anexar("comprovante", e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => arqComprovante.current?.click()} disabled={enviando !== null}>
          {enviando === "comprovante" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}
          Anexar comprovante
        </Button>
        {c.tem_comprovante && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/cobrancas/${c.id}/arquivo/comprovante`} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" />Ver comprovante</a>
          </Button>
        )}
      </div>

      {emAberto && (
        <div className="rounded-md border border-emerald-300 dark:border-emerald-800 p-3 space-y-3">
          <p className="font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Confirmar pagamento</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Campo rotulo="Data do pagamento">
              <Input type="date" value={pagto.pago_em} onChange={(e) => setPagto({ ...pagto, pago_em: e.target.value })} />
            </Campo>
            <Campo rotulo="Valor recebido (R$)">
              <Input inputMode="decimal" value={pagto.valor_pago} onChange={(e) => setPagto({ ...pagto, valor_pago: e.target.value.replace(",", ".") })} />
            </Campo>
            <Campo rotulo="Forma">
              <select className={sel} value={pagto.forma_pagamento} onChange={(e) => setPagto({ ...pagto, forma_pagamento: e.target.value })}>
                {FORMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Observação">
            <Input value={pagto.observacoes} onChange={(e) => setPagto({ ...pagto, observacoes: e.target.value })} />
          </Campo>
          <Button size="sm" onClick={() => pagar.mutate()} disabled={pagar.isPending} data-testid="button-confirmar-pagamento">
            {pagar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Marcar como paga
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {emAberto && <Button size="sm" variant="ghost" onClick={() => salvar.mutate({ status: "isenta" })}>Isentar</Button>}
        {emAberto && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => salvar.mutate({ status: "cancelada" })}>Cancelar mensalidade</Button>}
        {c.status === "paga" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => salvar.mutate({ status: "estornada" })}>Estornar</Button>}
      </div>
    </div>
  );
}
