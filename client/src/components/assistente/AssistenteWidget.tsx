import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAssistenteChat } from "./useAssistenteChat";
import { useAssistenteAvisos, type Aviso } from "./useAssistenteAvisos";
import { NOME_MASCOTE, AVATAR_URL } from "./config";
import {
  MessageCircle,
  X,
  Send,
  Mic,
  Square,
  ImagePlus,
  ThumbsUp,
  ThumbsDown,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";

export default function AssistenteWidget() {
  const { user, hasSubItemAccess } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [modoCaptura, setModoCaptura] = useState(false);
  const [gravando, setGravando] = useState(false);
  const { mensagens, carregando, enviar, darFeedback, novaConversa } = useAssistenteChat();
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Guardar conhecimento grava na base → só master (bate com podeGerenciarKb no backend)
  const podeCaptura = !!user && (user.isMaster || user.role === "master");

  const podeUsarChat =
    !!user &&
    (user.isMaster ||
      ["master", "operacional"].includes(user.role) ||
      hasSubItemAccess("modulo_assistente", "chat"));

  const { count, avisos, marcarLidas } = useAssistenteAvisos(podeUsarChat);
  const [avisosPainel, setAvisosPainel] = useState<Aviso[]>([]);
  const avisosSnapshotDone = useRef(false);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Ao abrir: tira uma "foto" dos avisos não lidos e a mantém visível durante a
  // sessão. Marcar como lido limpa a bolinha, mas NÃO apaga o que está na tela
  // (a lista do backend só traz não lidos, então sem a foto os avisos sumiriam).
  useEffect(() => {
    if (!aberto) {
      avisosSnapshotDone.current = false;
      setAvisosPainel([]);
      return;
    }
    if (!avisosSnapshotDone.current && avisos.length > 0) {
      avisosSnapshotDone.current = true;
      setAvisosPainel(avisos);
      marcarLidas.mutate(avisos.map((a) => a.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, avisos]);

  if (!user || !podeUsarChat) return null;

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t || carregando) return;
    setTexto("");
    enviar(t, undefined, modoCaptura);
  };

  const toggleGravacao = async () => {
    if (gravando) {
      recorderRef.current?.stop();
      setGravando(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const partes: BlobPart[] = [];
      rec.ondataavailable = (e) => partes.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes, { type: "audio/webm" });
        enviar(texto.trim(), blob, modoCaptura);
        setTexto("");
      };
      recorderRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      alert("Não consegui acessar o microfone");
    }
  };

  return (
    <>
      {/* balão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-5 right-5 z-50 h-16 w-16 transition hover:scale-110"
          title={`Perguntar pro ${NOME_MASCOTE}`}
        >
          <img
            src={AVATAR_URL}
            alt={NOME_MASCOTE}
            className="h-full w-full object-contain drop-shadow-lg"
          />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      )}

      {/* painel de chat */}
      {aberto && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <img src={AVATAR_URL} alt={NOME_MASCOTE} className="h-9 w-9 shrink-0 object-contain" />
              <div>
                <div className="text-sm font-semibold">{NOME_MASCOTE}</div>
                <div className="text-xs text-muted-foreground">Assistente da equipe</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Nova conversa" onClick={novaConversa}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAberto(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {avisosPainel.length > 0 && (
              <div className="space-y-2">
                {avisosPainel.map((a) => (
                  <div key={a.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <div className="font-medium">{a.titulo}</div>
                    <div className="text-muted-foreground">{a.mensagem}</div>
                    {a.proposalId && (
                      <a href={`/contratos/${a.proposalId}`} className="mt-1 inline-block text-xs text-primary underline">
                        Ver proposta
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {mensagens.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                <img src={AVATAR_URL} alt={NOME_MASCOTE} className="h-8 w-8 shrink-0 object-contain" />
                <span>Oi {user.name?.split(" ")[0] || ""}! O que você precisa? Como posso te ajudar?</span>
              </div>
            )}
            {mensagens.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  <div className="whitespace-pre-wrap">{m.texto || "…"}</div>
                  {m.role === "assistant" && m.mensagemId && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => darFeedback(m.mensagemId!, "up")}
                        className={m.feedback === "up" ? "text-green-600" : "text-muted-foreground hover:text-foreground"}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => darFeedback(m.mensagemId!, "down")}
                        className={m.feedback === "down" ? "text-red-600" : "text-muted-foreground hover:text-foreground"}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          <div className="border-t p-2">
            {podeCaptura && (
              <label className="mb-1 flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={modoCaptura}
                  onChange={(e) => setModoCaptura(e.target.checked)}
                />
                <BookmarkPlus className="h-3.5 w-3.5" />
                Guardar como conhecimento (vai pra fila de aprovação)
              </label>
            )}
            <div className="flex items-end gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviar(texto.trim(), f, modoCaptura);
                  setTexto("");
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" size="icon" title="Enviar imagem" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                variant={gravando ? "destructive" : "ghost"}
                size="icon"
                title={gravando ? "Parar e enviar" : "Gravar áudio"}
                onClick={toggleGravacao}
              >
                {gravando ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarTexto();
                  }
                }}
                rows={1}
                placeholder={modoCaptura ? "Descreva o conhecimento pra guardar..." : `Pergunta pro ${NOME_MASCOTE}...`}
                className="max-h-24 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button size="icon" disabled={carregando} onClick={enviarTexto}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
