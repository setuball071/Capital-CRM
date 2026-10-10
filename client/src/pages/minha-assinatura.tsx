import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Download, Copy, ExternalLink, Loader2, CheckCircle2, Lock, MessageCircle } from "lucide-react";
import { STATUS_ASSINATURA, STATUS_COBRANCA, brl, dataBR } from "@/components/assinatura-usuario-dialog";

type Dados = {
  assinatura: {
    plano: string | null;
    status: string;
    valor_mensal: number;
    desconto: number;
    valor_final: number;
    desconto_motivo: string | null;
    proximo_vencimento: string | null;
    forma_pagamento: string | null;
    tolerancia_dias: number;
    isenta_ate: string | null;
    recursos: string[];
  };
  cobrancaAtual: any | null;
  historico: any[];
  prazo: { texto: string | null; diasVencimento: number | null; diasSuspensao: number | null };
  alerta: { nivel: string; texto: string } | null;
  whatsappSuporte: string | null;
} | null;

const FORMA: Record<string, string> = {
  boleto: "Boleto", pix: "Pix", transferencia: "Transferência", cartao: "Cartão", dinheiro: "Dinheiro",
};

const COR_ALERTA: Record<string, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  aviso: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  urgente: "border-orange-300 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  suspenso: "border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
};

/**
 * Área do próprio assinante. Só mostra a assinatura de quem está logado: a
 * rota não recebe id, então trocar número na URL não leva a outra pessoa.
 */
export default function MinhaAssinaturaPage() {
  const { data, isLoading } = useQuery<Dados>({ queryKey: ["/api/minha-assinatura"] });

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!data) {
    return (
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Minha assinatura</h1>
        <p className="text-sm text-muted-foreground mt-2">Você não possui uma assinatura própria. Seu acesso segue normalmente.</p>
      </div>
    );
  }

  const { assinatura: a, cobrancaAtual: c, historico, prazo, alerta, whatsappSuporte } = data;
  const st = STATUS_ASSINATURA[a.status];
  const suspensa = a.status === "suspensa";

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Minha assinatura</h1>
        <p className="text-sm text-muted-foreground">Plano, mensalidades e boletos da sua conta.</p>
      </div>

      {suspensa ? (
        <AcessoSuspenso cobranca={c} />
      ) : alerta && (
        <div className={`rounded-md border px-4 py-3 text-sm ${COR_ALERTA[alerta.nivel] || ""}`} data-testid="alerta-minha-assinatura">
          {alerta.texto}
        </div>
      )}

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-3">
            Plano {a.plano || "—"}
            {st && <Badge className={`${st.classe} border-0`}>{st.rotulo}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Info rotulo="Valor normal" valor={brl(a.valor_mensal)} />
            <Info rotulo="Desconto" valor={a.desconto > 0 ? brl(a.desconto) : "—"} nota={a.desconto_motivo || undefined} />
            <Info rotulo="Valor da mensalidade" valor={brl(a.valor_final)} destaque />
            <Info
              rotulo={a.status === "isenta" ? "Cortesia até" : "Próximo vencimento"}
              valor={dataBR(a.status === "isenta" ? a.isenta_ate : (c?.vencimento || a.proximo_vencimento))}
              nota={a.status !== "isenta" && a.status !== "cancelada" ? prazo?.texto || undefined : undefined}
            />
            <Info rotulo="Forma de pagamento" valor={(a.forma_pagamento && FORMA[a.forma_pagamento]) || "—"} />
            <Info rotulo="Tolerância após o vencimento" valor={`${a.tolerancia_dias} ${a.tolerancia_dias === 1 ? "dia" : "dias"}`} />
          </div>
          {a.recursos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Incluído no seu plano</p>
              <div className="flex flex-wrap gap-1.5">
                {a.recursos.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cobrança atual */}
      <Card id="mensalidade-aberta">
        <CardHeader className="pb-3"><CardTitle className="text-base">Mensalidade em aberto</CardTitle></CardHeader>
        <CardContent>
          {!c ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensalidade em aberto no momento.</p>
          ) : (
            <CobrancaAtual c={c} whatsapp={whatsappSuporte} />
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Histórico financeiro</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há mensalidades anteriores.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Competência</th>
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3">Pago em</th>
                  <th className="py-2">Documentos</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{h.competencia.slice(5, 7)}/{h.competencia.slice(0, 4)}</td>
                    <td className="py-2 pr-3">{dataBR(h.vencimento)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {brl(h.valor_final)}
                      {Number(h.desconto) > 0 && <span className="block text-xs text-muted-foreground">desconto {brl(h.desconto)}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={`${STATUS_COBRANCA[h.status]?.classe} border-0`}>{STATUS_COBRANCA[h.status]?.rotulo || h.status}</Badge>
                    </td>
                    <td className="py-2 pr-3">{dataBR(h.pago_em)}</td>
                    <td className="py-2 space-x-3 whitespace-nowrap">
                      {h.tem_boleto_arquivo && <a className="text-primary underline" href={`/api/cobrancas/${h.id}/arquivo/boleto`} target="_blank" rel="noreferrer">boleto</a>}
                      {h.tem_comprovante && <a className="text-primary underline" href={`/api/cobrancas/${h.id}/arquivo/comprovante`} target="_blank" rel="noreferrer">comprovante</a>}
                      {!h.tem_boleto_arquivo && !h.tem_comprovante && <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={destaque ? "text-lg font-bold" : "font-medium"}>{valor}</p>
      {nota && <p className="text-xs text-muted-foreground mt-0.5">{nota}</p>}
    </div>
  );
}

/** Acesso suspenso: só dá para pagar ou cancelar. */
function AcessoSuspenso({ cobranca }: { cobranca: any | null }) {
  const { toast } = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const cancelar = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/minha-assinatura/cancelar", { confirmar: true }),
    onSuccess: () => { window.location.href = "/login"; },
    onError: (e: any) => toast({ title: "Não foi possível cancelar", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-md border border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 p-4 space-y-3" data-testid="acesso-suspenso">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="text-sm space-y-1">
          <p className="font-semibold">Seu acesso está suspenso</p>
          <p>
            A mensalidade está em aberto e o prazo de tolerância terminou. Para voltar a usar o sistema, pague a
            mensalidade abaixo. Se preferir não continuar, você pode cancelar a assinatura.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-8">
        {/* Pagar agora abre direto o meio de pagamento: link primeiro, depois o
            boleto anexado; sem nenhum dos dois, leva até a mensalidade (linha/Pix). */}
        {cobranca?.boleto_link ? (
          <Button asChild size="sm" data-testid="button-pagar-agora">
            <a href={cobranca.boleto_link} target="_blank" rel="noreferrer">Pagar agora</a>
          </Button>
        ) : cobranca?.tem_boleto_arquivo ? (
          <Button asChild size="sm" data-testid="button-pagar-agora">
            <a href={`/api/cobrancas/${cobranca.id}/arquivo/boleto`} target="_blank" rel="noreferrer">Pagar agora</a>
          </Button>
        ) : cobranca ? (
          <Button size="sm" onClick={() => document.getElementById("mensalidade-aberta")?.scrollIntoView({ behavior: "smooth" })}
            data-testid="button-pagar-agora">
            Pagar agora
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="bg-transparent" onClick={() => setConfirmando(true)} data-testid="button-cancelar-assinatura">
          Cancelar assinatura
        </Button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar sua assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu acesso ao sistema será encerrado agora e você sairá da sua conta. Seus dados não são apagados:
              para voltar, fale com a nossa equipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelar.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelar.isPending}
              onClick={(e) => { e.preventDefault(); cancelar.mutate(); }}
              data-testid="button-confirmar-cancelamento"
            >
              {cancelar.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Sim, cancelar assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CobrancaAtual({ c, whatsapp }: { c: any; whatsapp: string | null }) {
  const { toast } = useToast();
  const [informado, setInformado] = useState(!!c.pagamento_informado_em);
  const informar = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/minha-assinatura/informar-pagamento", {}),
    onSuccess: () => setInformado(true),
    onError: (e: any) => toast({ title: "Não foi possível enviar o aviso", description: e?.message, variant: "destructive" }),
  });
  const competencia = `${c.competencia.slice(5, 7)}/${c.competencia.slice(0, 4)}`;
  const linkWhats = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Segue o comprovante da minha mensalidade ${competencia}.`)}`
    : null;
  const copiar = async (texto: string, oque: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: `${oque} copiado` });
    } catch {
      toast({ title: "Não consegui copiar", description: "Selecione o texto e copie manualmente.", variant: "destructive" });
    }
  };
  const temAlgum = c.tem_boleto_arquivo || c.boleto_link || c.linha_digitavel || c.pix_copia_cola;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span>Competência <b>{c.competencia.slice(5, 7)}/{c.competencia.slice(0, 4)}</b></span>
        <span>Vencimento <b>{dataBR(c.vencimento)}</b></span>
        <span>Valor <b>{brl(c.valor_final)}</b>{Number(c.desconto) > 0 && <span className="text-muted-foreground"> (de {brl(c.valor_original)})</span>}</span>
        <Badge className={`${STATUS_COBRANCA[c.status]?.classe} border-0`}>{STATUS_COBRANCA[c.status]?.rotulo}</Badge>
      </div>

      {!temAlgum && (
        <p className="text-muted-foreground">O boleto desta mensalidade ainda não foi disponibilizado. Ele aparecerá aqui assim que estiver pronto.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {c.tem_boleto_arquivo && (
          <Button asChild size="sm" data-testid="button-baixar-boleto">
            <a href={`/api/cobrancas/${c.id}/arquivo/boleto`} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1.5" />Baixar boleto</a>
          </Button>
        )}
        {c.boleto_link && (
          <Button asChild size="sm" variant="outline">
            <a href={c.boleto_link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" />Abrir link de pagamento</a>
          </Button>
        )}
      </div>

      {c.linha_digitavel && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Linha digitável</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 rounded border bg-muted/40 px-2 py-1.5 text-xs break-all">{c.linha_digitavel}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(c.linha_digitavel, "Linha digitável")}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      {c.pix_copia_cola && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Pix copia e cola</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 rounded border bg-muted/40 px-2 py-1.5 text-xs break-all">{c.pix_copia_cola}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(c.pix_copia_cola, "Código Pix")}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {!informado ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3">
          <p className="flex-1 text-xs text-muted-foreground min-w-[200px]">
            Já pagou? Avise a nossa equipe para conferirmos o pagamento.
          </p>
          <Button size="sm" variant="outline" onClick={() => informar.mutate()} disabled={informar.isPending} data-testid="button-ja-paguei">
            {informar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Já paguei
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900 p-3 space-y-2" data-testid="pagamento-informado">
          <p className="font-medium">Recebemos o seu aviso.</p>
          <p className="text-xs">
            O pagamento será verificado em até 24 horas e o acesso é liberado assim que for confirmado.
            {linkWhats ? " Para liberação imediata, envie o comprovante pelo nosso WhatsApp." : ""}
          </p>
          {linkWhats && (
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <a href={linkWhats} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1.5" />Enviar comprovante pelo WhatsApp</a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
