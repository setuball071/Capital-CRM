import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, PlayCircle } from "lucide-react";

/** Id do vídeo de qualquer formato de link do YouTube (watch, youtu.be, shorts, embed, live). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    /* não é URL */
  }
  return null;
}

/**
 * Botão "Abrir" de um material. Link do YouTube toca DENTRO do sistema, numa
 * janela, sem levar a pessoa para o YouTube. O resto abre em nova aba.
 */
export function BotaoAbrirMaterial({ mat, size = "sm", testId }: { mat: any; size?: "sm" | "default"; testId?: string }) {
  const [tocando, setTocando] = useState(false);
  const yt = mat.storageKey ? null : youtubeId(mat.url);
  const estilo = { background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.72))" };

  if (!yt) {
    return (
      <Button size={size} className="flex-1" style={estilo} data-testid={testId}
        onClick={() => window.open(mat.storageKey ? `/api/materials/${mat.id}/file` : mat.url || "", "_blank")}>
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        Abrir
      </Button>
    );
  }
  return (
    <>
      <Button size={size} className="flex-1" style={estilo} onClick={() => setTocando(true)} data-testid={testId}>
        <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
        Assistir
      </Button>
      <Dialog open={tocando} onOpenChange={setTocando}>
        <DialogContent className="max-w-4xl p-4">
          <DialogHeader>
            <DialogTitle className="text-base pr-6">{mat.title}</DialogTitle>
          </DialogHeader>
          {/* Só monta o player com a janela aberta: fechar para o vídeo. */}
          {tocando && (
            <div className="relative w-full overflow-hidden rounded-md bg-black" style={{ paddingTop: "56.25%" }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1&rel=0&modestbranding=1`}
                title={mat.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          )}
          {mat.description && <p className="text-sm text-muted-foreground">{mat.description}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Selo dos materiais que aparecem em todos os ambientes. */
export function SeloOficial({ mat }: { mat: any }) {
  if (!mat.global) return null;
  return <Badge variant="outline" className="text-[10px]">Oficial</Badge>;
}
