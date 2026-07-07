import { useCallback, useRef, useState } from "react";

export type MsgChat = {
  id: string;
  role: "user" | "assistant";
  texto: string;
  mensagemId?: number;
  fontes?: { artigoId: number; titulo: string }[];
  feedback?: "up" | "down";
  captura?: boolean;
};

export function useAssistenteChat() {
  const [mensagens, setMensagens] = useState<MsgChat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const conversaIdRef = useRef<number | null>(null);

  const novaConversa = useCallback(() => {
    conversaIdRef.current = null;
    setMensagens([]);
  }, []);

  /** Envia texto e/ou arquivo (áudio/imagem). modoCaptura=true = gestor guardando conhecimento. */
  const enviar = useCallback(
    async (texto: string, arquivo?: File | Blob, modoCaptura?: boolean) => {
      if (carregando) return;
      const idUser = crypto.randomUUID();
      const rotulo =
        texto ||
        (arquivo && (arquivo as File).type?.startsWith("audio/") ? "🎤 (áudio)" : "🖼️ (imagem)");
      setMensagens((m) => [...m, { id: idUser, role: "user", texto: rotulo }]);
      setCarregando(true);

      const idBot = crypto.randomUUID();
      try {
        let res: Response;
        if (arquivo) {
          const fd = new FormData();
          if (texto) fd.append("mensagem", texto);
          if (conversaIdRef.current) fd.append("conversaId", String(conversaIdRef.current));
          if (modoCaptura) fd.append("modoCaptura", "1");
          fd.append("arquivo", arquivo, (arquivo as File).name || "midia");
          res = await fetch("/api/assistente/chat", { method: "POST", credentials: "include", body: fd });
        } else if (modoCaptura) {
          const fd = new FormData();
          fd.append("mensagem", texto);
          fd.append("modoCaptura", "1");
          res = await fetch("/api/assistente/chat", { method: "POST", credentials: "include", body: fd });
        } else {
          res = await fetch("/api/assistente/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ mensagem: texto, conversaId: conversaIdRef.current }),
          });
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          // modo captura retorna JSON simples
          const data = await res.json();
          setMensagens((m) => [
            ...m,
            { id: idBot, role: "assistant", texto: data.resumo || "Guardado!", captura: true },
          ]);
          return;
        }

        // SSE
        setMensagens((m) => [...m, { id: idBot, role: "assistant", texto: "" }]);
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const linhas = buffer.split("\n\n");
          buffer = linhas.pop() || "";
          for (const linha of linhas) {
            if (!linha.startsWith("data: ")) continue;
            let ev: any;
            try {
              ev = JSON.parse(linha.slice(6));
            } catch {
              continue;
            }
            if (ev.delta) {
              setMensagens((m) =>
                m.map((msg) => (msg.id === idBot ? { ...msg, texto: msg.texto + ev.delta } : msg)),
              );
            }
            if (ev.done) {
              if (ev.conversaId) conversaIdRef.current = ev.conversaId;
              setMensagens((m) =>
                m.map((msg) =>
                  msg.id === idBot
                    ? { ...msg, mensagemId: ev.mensagemId, fontes: ev.fontes || [] }
                    : msg,
                ),
              );
            }
          }
        }
      } catch (e: any) {
        setMensagens((m) => [
          ...m.filter((x) => x.id !== idBot),
          { id: idBot, role: "assistant", texto: `Deu ruim aqui: ${e.message}. Tenta de novo!` },
        ]);
      } finally {
        setCarregando(false);
      }
    },
    [carregando],
  );

  const darFeedback = useCallback(async (mensagemId: number, feedback: "up" | "down") => {
    setMensagens((m) => m.map((msg) => (msg.mensagemId === mensagemId ? { ...msg, feedback } : msg)));
    await fetch("/api/assistente/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mensagemId, feedback }),
    }).catch(() => {});
  }, []);

  return { mensagens, carregando, enviar, darFeedback, novaConversa };
}
