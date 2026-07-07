import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAssistenteChat } from "./useAssistenteChat";
import { NOME_MASCOTE, EMOJI_MASCOTE, PERGUNTAS_SUGERIDAS } from "./config";
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
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [modoCaptura, setModoCaptura] = useState(false);
  const [gravando, setGravando] = useState(false);
  const { mensagens, carregando, enviar, darFeedback, novaConversa } = useAssistenteChat();
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const podeCaptura = !!user && (user.isMaster || ["master", "operacional"].includes(user.role));

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  if (!user) return null;

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
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl shadow-lg transition hover:scale-110"
          title={`Perguntar pro ${NOME_MASCOTE}`}
        >
          {EMOJI_MASCOTE}
        </button>
      )}

      {/* painel de chat */}
      {aberto && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{EMOJI_MASCOTE}</span>
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
            {mensagens.length === 0 && (
              <div className="space-y-2">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  Oi! Eu sou o {NOME_MASCOTE} {EMOJI_MASCOTE}. Me pergunta qualquer coisa sobre
                  regras de banco, roteiros e o sistema!
                </div>
                {PERGUNTAS_SUGERIDAS.map((p) => (
                  <button
                    key={p}
                    onClick={() => enviar(p)}
                    className="block w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
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
