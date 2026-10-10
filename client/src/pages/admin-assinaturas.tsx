import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Plus, Loader2, Search, RefreshCw } from "lucide-react";
import {
  AssinaturaUsuarioDialog,
  STATUS_ASSINATURA,
  STATUS_COBRANCA,
  brl,
  dataBR,
} from "@/components/assinatura-usuario-dialog";

/**
 * Central de assinaturas e cobranças. A assinatura é do USUÁRIO; o ambiente
 * aparece só como informação. Daqui não se define assinatura "do ambiente".
 */
export default function AdminAssinaturasPage() {
  const { data: lista = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/assinaturas"] });
  const [aberto, setAberto] = useState<{ id: number; name: string } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [filtro, setFiltro] = useState("");

  const ativas = lista.filter((a) => a.status !== "cancelada");
  const contar = (...st: string[]) => lista.filter((a) => st.includes(a.status)).length;
  const receitaPrevista = ativas
    .filter((a) => a.status !== "isenta")
    .reduce((s, a) => s + (Number(a.valor_final) || 0), 0);

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return lista;
    return lista.filter((a) =>
      [a.usuario_nome, a.usuario_email, a.ambientes, a.plano_nome].some((v) => String(v || "").toLowerCase().includes(f)),
    );
  }, [lista, filtro]);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Assinaturas</h1>
          <p className="text-sm text-muted-foreground">
            Cada assinatura é de uma pessoa. O ambiente aparece só como referência.
          </p>
        </div>
        <Button onClick={() => setEscolhendo(true)} data-testid="button-nova-assinatura">
          <Plus className="h-4 w-4 mr-1.5" /> Nova assinatura
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Resumo titulo="Assinantes" valor={ativas.length} />
        <Resumo titulo="Ativas" valor={contar("ativa", "aguardando_pagamento")} />
        <Resumo titulo="Em atraso" valor={contar("em_atraso", "suspensao_programada")} cor="text-amber-600" />
        <Resumo titulo="Suspensas" valor={contar("suspensa")} cor="text-red-600" />
        <Resumo titulo="Receita mensal prevista" valor={brl(receitaPrevista)} />
      </div>

      <RotinaDiaria />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Assinaturas</CardTitle>
          <div className="relative w-64 max-w-full">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar pessoa, ambiente ou plano" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma assinatura cadastrada. Use "Nova assinatura" ou o botão Assinatura em Usuários.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Assinante</th>
                  <th className="py-2 pr-3">Plano</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Próximo vencimento</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3">Cobrança atual</th>
                  <th className="py-2 pr-3">Último pagamento</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((a) => {
                  const venc = a.cob_vencimento || a.proximo_vencimento;
                  return (
                    <tr key={a.id} className="border-b last:border-0 align-top">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{a.usuario_nome}</div>
                        <div className="text-xs text-muted-foreground">{a.ambientes || "sem ambiente"}</div>
                      </td>
                      <td className="py-2.5 pr-3">{a.plano_nome || "—"}</td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                        <div className="font-medium">{brl(a.valor_final)}</div>
                        {a.desconto_aplicado > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {brl(a.valor_mensal)} − {brl(a.desconto_aplicado)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div>{dataBR(venc)}</div>
                        {a.prazo?.texto && a.status !== "cancelada" && a.status !== "isenta" && (
                          <div className={`text-xs ${a.prazo.diasVencimento < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {a.prazo.texto}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge className={`${STATUS_ASSINATURA[a.status]?.classe} border-0`}>
                          {STATUS_ASSINATURA[a.status]?.rotulo || a.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        {a.cob_id ? (
                          <div className="space-y-0.5">
                            <Badge className={`${STATUS_COBRANCA[a.cob_status]?.classe} border-0`}>
                              {STATUS_COBRANCA[a.cob_status]?.rotulo}
                            </Badge>
                            <div className={`text-xs ${a.cob_tem_boleto ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                              {a.cob_tem_boleto ? "boleto disponível" : "sem boleto"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">nenhuma em aberto</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {a.ultimo_pagamento ? (
                          <>
                            <div>{dataBR(a.ultimo_pagamento)}</div>
                            <div className="text-xs text-muted-foreground">{brl(a.ultimo_valor)}</div>
                          </>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => setAberto({ id: a.user_id, name: a.usuario_nome })}
                          data-testid={`button-abrir-assinatura-${a.id}`}>
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <EscolherUsuario
        open={escolhendo}
        onOpenChange={setEscolhendo}
        jaAssinantes={new Set(lista.map((a) => a.user_id))}
        onEscolher={(u) => { setEscolhendo(false); setAberto(u); }}
      />

      <AssinaturaUsuarioDialog
        userId={aberto?.id ?? null}
        userName={aberto?.name}
        open={aberto !== null}
        onOpenChange={(v) => { if (!v) setAberto(null); }}
      />
    </div>
  );
}

function Resumo({ titulo, valor, cor }: { titulo: string; valor: number | string; cor?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${cor || ""}`}>{valor}</div>
        <div className="text-xs text-muted-foreground">{titulo}</div>
      </CardContent>
    </Card>
  );
}

function EscolherUsuario({ open, onOpenChange, jaAssinantes, onEscolher }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jaAssinantes: Set<number>;
  onEscolher: (u: { id: number; name: string }) => void;
}) {
  const { data: usuarios = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/users"], enabled: open });
  const [busca, setBusca] = useState("");
  const f = busca.trim().toLowerCase();
  const filtrados = usuarios
    .filter((u) => u.isActive !== false && !u.isMaster)
    .filter((u) => !f || `${u.name} ${u.email}`.toLowerCase().includes(f))
    .slice(0, 50);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
          <DialogDescription>Escolha a pessoa que vai assinar.</DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="max-h-80 overflow-y-auto divide-y">
          {isLoading && <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {filtrados.map((u) => (
            <button key={u.id} type="button" className="w-full text-left py-2 px-1 hover:bg-muted/50 flex justify-between gap-2"
              onClick={() => onEscolher({ id: u.id, name: u.name })}>
              <span>
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="block text-xs text-muted-foreground">{u.email}</span>
              </span>
              {jaAssinantes.has(u.id) && <span className="text-xs text-muted-foreground self-center">já assina</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Última execução da rotina diária + botão para rodar agora. */
function RotinaDiaria() {
  const { toast } = useToast();
  const { data: execucoes = [] } = useQuery<any[]>({ queryKey: ["/api/admin/assinaturas/rotina/execucoes"] });
  const executar = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/assinaturas/rotina/executar", {})).json(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assinaturas/rotina/execucoes"] });
      toast({
        title: "Rotina executada",
        description: `${r?.geradas?.length || 0} mensalidades geradas, ${r?.mudancas?.length || 0} mudanças de situação, ${r?.avisos || 0} avisos enviados.`,
      });
    },
    onError: (e: any) => toast({ title: "Erro ao executar a rotina", description: e?.message, variant: "destructive" }),
  });
  const ultima = execucoes[0];
  const r = ultima?.resultado;
  const quando = ultima ? new Date(ultima.iniciada_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <Card>
      <CardContent className="pt-5 space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Rotina diária</p>
            <p className="text-xs text-muted-foreground">
              Todo dia depois das 6h: gera a mensalidade 5 dias antes, marca as vencidas, atualiza a situação e avisa o cliente.
              {r?.simulacao !== false && " Suspensão em modo simulação: ninguém é bloqueado."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => executar.mutate()} disabled={executar.isPending} data-testid="button-executar-rotina">
            {executar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Executar agora
          </Button>
        </div>
        {!ultima ? (
          <p className="text-xs text-muted-foreground">Ainda não rodou.</p>
        ) : ultima.erro ? (
          <p className="text-xs text-red-600">Última execução ({quando}) falhou: {ultima.erro}</p>
        ) : r ? (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Última execução: {quando} ({ultima.origem === "manual" ? "manual" : "automática"})</p>
            {r.geradas?.length > 0 && <p>Geradas: {r.geradas.join(", ")}</p>}
            {r.mudancas?.length > 0 && <p>Mudanças: {r.mudancas.join("; ")}</p>}
            {r.semBoleto?.length > 0 && <p className="text-amber-700 dark:text-amber-400">Sem boleto ou link (cliente não avisado): {r.semBoleto.join(", ")}</p>}
            {r.seriamSuspensos?.length > 0 && (
              <p className="text-orange-700 dark:text-orange-400">
                {r.simulacao ? "Seriam suspensos (simulação)" : "Suspensos"}: {r.seriamSuspensos.join(", ")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Em execução desde {quando}.</p>
        )}
      </CardContent>
    </Card>
  );
}
