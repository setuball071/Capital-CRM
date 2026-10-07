import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Send, Loader2, CheckCircle2, Sparkles, FileSpreadsheet, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * "Montar lista com o Jarvis": a pessoa conversa com o agente do Bigdata e,
 * quando ele fecha a lista, transforma em campanha daqui mesmo.
 *
 * O CRM é só o cano. A conversa é transmitida ao vivo, palavra por palavra.
 */

type Mensagem =
  | { papel: "eu" | "jarvis"; texto: string }
  | { papel: "sistema"; texto: string; tom?: "ok" | "erro" };

type Status = {
  disponivel: boolean;
  motivo?: string;
  vistoEm?: string | null;
  modelo?: string | null;
  teto?: { limite: number | null; usados: number; restantes: number | null };
};

type ListaPronta = {
  nome: string;
  total: number;
  sem_telefone: number;
  resumo: {
    pessoas_unicas: number;
    removidos_obito: number;
    removidos_lista_anterior: number;
    com_telefone: number;
    sem_telefone: number;
    por_fonte?: Record<string, number>;
  };
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");

// Negrito simples (**assim**) e quebras de linha. Sem biblioteca de markdown.
function Texto({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </span>
  );
}

export function JarvisListas() {
  const { toast } = useToast();
  const [conversaId, setConversaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [lista, setLista] = useState<ListaPronta | null>(null);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [querExcel, setQuerExcel] = useState(false);
  const [criando, setCriando] = useState(false);
  const [criada, setCriada] = useState<{ campanhaId: number; leads: number; pedidoId: number | null; message: string } | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery<Status>({
    queryKey: ["/api/agente-listas/status"],
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, lista]);

  const acrescentarAoJarvis = (delta: string) =>
    setMensagens((ms) => {
      const ult = ms[ms.length - 1];
      if (ult && ult.papel === "jarvis") return [...ms.slice(0, -1), { papel: "jarvis", texto: ult.texto + delta }];
      return [...ms, { papel: "jarvis", texto: delta }];
    });
  const sistema = (t: string, tom?: "ok" | "erro") => setMensagens((ms) => [...ms, { papel: "sistema", texto: t, tom }]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto("");
    setMensagens((ms) => [...ms, { papel: "eu", texto: t }]);
    setEnviando(true);
    try {
      let id = conversaId;
      if (!id) {
        const r = await apiRequest("POST", "/api/agente-listas/conversas", {});
        id = (await r.json()).id as number;
        setConversaId(id);
      }
      const resp = await fetch(`/api/agente-listas/conversas/${id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texto: t }),
      });
      if (!resp.ok || !resp.body) {
        const corpo = await resp.json().catch(() => ({}));
        throw new Error(corpo.message || `Erro ${resp.status}`);
      }
      const leitor = resp.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const bloco = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
          if (!linha) continue;
          let ev: any;
          try { ev = JSON.parse(linha.slice(6)); } catch { continue; }
          if (ev.tipo === "texto") acrescentarAoJarvis(ev.texto);
          else if (ev.tipo === "ferramenta") {
            if (ev.status === "inicio") sistema(`Consultando a base: ${ev.resumo}`);
            else if (ev.status === "fim") sistema(`Pronto — ${ev.resumo}`, "ok");
            else if (ev.status === "erro") sistema(`A consulta falhou: ${ev.resumo}`, "erro");
          } else if (ev.tipo === "lista") {
            setLista(ev);
            setNomeCampanha(ev.nome || "");
            sistema(`Lista fechada: ${fmt(ev.total)} com telefone, ${fmt(ev.sem_telefone)} sem.`, "ok");
          } else if (ev.tipo === "erro") sistema(ev.mensagem, "erro");
        }
      }
    } catch (e: any) {
      sistema(e?.message || "Não consegui falar com o agente.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  async function criarCampanha() {
    if (!conversaId || criando) return;
    setCriando(true);
    try {
      const r = await apiRequest("POST", `/api/agente-listas/conversas/${conversaId}/campanha`, {
        nome: nomeCampanha.trim() || undefined,
        excel: querExcel,
      });
      const j = await r.json();
      setCriada(j);
      toast({ title: "Campanha criada", description: j.message });
    } catch (e: any) {
      toast({ title: "Não deu para criar a campanha", description: e?.message, variant: "destructive" });
    } finally {
      setCriando(false);
    }
  }

  const foraDoAr = status && !status.disponivel;

  return (
    <Card className="flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]" data-testid="card-jarvis-listas">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Montar lista com o Jarvis</span>
          {status && (
            <Badge variant={status.disponivel ? "secondary" : "destructive"} data-testid="badge-jarvis-status">
              {status.disponivel ? "no ar" : "fora do ar"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Diga o que quer vender e para quem. Ele conta, mostra o perfil e fecha a lista quando você mandar.
          {status?.teto?.limite != null && (
            <> Você ainda pode gerar <b>{fmt(status.teto.restantes)}</b> leads este mês.</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
        {foraDoAr && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            O montador de listas está fora do ar agora{status?.motivo ? ` (${status.motivo})` : ""}. Use o filtro ao lado ou tente mais tarde.
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[220px] max-h-[55vh] pr-1" data-testid="jarvis-mensagens">
          {mensagens.length === 0 && !foraDoAr && (
            <div className="text-sm text-muted-foreground space-y-2 p-2">
              <p className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Exemplos do que dá para pedir:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>"Servidores do Ministério da Saúde, aposentados, com margem acima de 300."</li>
                <li>"Quem tem contrato no Banco do Brasil com mais de 48 parcelas pagas, em MG."</li>
                <li>"Celetistas do SIAPE com cartão benefício livre."</li>
              </ul>
            </div>
          )}
          {mensagens.map((m, i) =>
            m.papel === "sistema" ? (
              <p key={i} className={`text-xs px-2 ${m.tom === "erro" ? "text-destructive" : m.tom === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {m.texto}
              </p>
            ) : (
              <div key={i} className={`flex ${m.papel === "eu" ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-lg px-3 py-2 text-sm max-w-[92%] ${m.papel === "eu" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Texto texto={m.texto} />
                </div>
              </div>
            ),
          )}
          {enviando && <p className="text-xs text-muted-foreground px-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> pensando...</p>}
          <div ref={fimRef} />
        </div>

        {lista && !criada && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30" data-testid="jarvis-lista-pronta">
            <div className="text-sm">
              <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Lista pronta: {fmt(lista.total)} pessoas com celular</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmt(lista.resumo.pessoas_unicas)} únicas · {fmt(lista.resumo.removidos_obito)} saíram por óbito · {fmt(lista.resumo.removidos_lista_anterior)} já estavam em lista recente · {fmt(lista.sem_telefone)} sem telefone (vão na aba à parte)
              </p>
              {lista.resumo.por_fonte && (
                <p className="text-xs text-muted-foreground">
                  Telefones: {Object.entries(lista.resumo.por_fonte).map(([f, n]) => `${f} ${fmt(n)}`).join(" · ")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jarvis-nome">Nome da campanha</Label>
              <Input id="jarvis-nome" value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} data-testid="input-jarvis-nome" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="jarvis-excel" checked={querExcel} onCheckedChange={(v) => setQuerExcel(v === true)} data-testid="checkbox-jarvis-excel" />
              <Label htmlFor="jarvis-excel" className="text-sm font-normal flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Também quero o Excel <span className="text-xs text-muted-foreground">(entra como pedido e depende de aprovação do master)</span>
              </Label>
            </div>
            <Button onClick={criarCampanha} disabled={criando} className="w-full" data-testid="button-jarvis-criar-campanha">
              {criando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
              Criar campanha com {fmt(lista.total)} leads
            </Button>
          </div>
        )}

        {criada && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm space-y-1" data-testid="jarvis-campanha-criada">
            <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {criada.message}</p>
            <p className="text-xs text-muted-foreground">
              Campanha #{criada.campanhaId}{criada.pedidoId ? ` · pedido de exportação #${criada.pedidoId} aguardando aprovação` : ""}.
              Para outra lista, é só continuar a conversa ou recarregar a página.
            </p>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={foraDoAr ? "Agente fora do ar" : "Descreva a lista que você quer..."}
            disabled={enviando || Boolean(foraDoAr)}
            rows={2}
            className="resize-none"
            data-testid="textarea-jarvis"
          />
          <Button onClick={enviar} disabled={enviando || !texto.trim() || Boolean(foraDoAr)} size="icon" aria-label="Enviar" data-testid="button-jarvis-enviar">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
