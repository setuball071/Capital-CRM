import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Loader2 } from "lucide-react";

/**
 * Recorte de foto de perfil estilo WhatsApp: máscara circular, imagem arrastável
 * (pan) + zoom (slider e scroll). Gera um quadrado 256×256 e devolve o Blob.
 */
const BOX = 288; // lado do viewport de recorte (px)
const OUT = 256; // lado da imagem final (px)

export function AvatarCropper({
  imageSrc,
  onCancel,
  onSave,
}: {
  imageSrc: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  // baseScale = "cover" (menor dimensão preenche o box)
  const baseScale = nat ? BOX / Math.min(nat.w, nat.h) : 1;
  const scale = baseScale * zoom;
  const dispW = nat ? nat.w * scale : 0;
  const dispH = nat ? nat.h * scale : 0;

  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(0, (dispW - BOX) / 2);
      const maxY = Math.max(0, (dispH - BOX) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
    },
    [dispW, dispH],
  );

  useEffect(() => {
    const im = new Image();
    im.onload = () => { imgRef.current = im; setNat({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.src = imageSrc;
  }, [imageSrc]);

  // Reposiciona dentro dos limites quando o zoom muda
  useEffect(() => { setOffset((o) => clamp(o.x, o.y)); }, [zoom, clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.startX);
    const ny = drag.current.oy + (e.clientY - drag.current.startY);
    setOffset(clamp(nx, ny));
  };
  const onPointerUp = () => { drag.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)));
  };

  const displayLeft = BOX / 2 - dispW / 2 + offset.x;
  const displayTop = BOX / 2 - dispH / 2 + offset.y;

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Mapeia a região visível do box para pixels naturais da imagem
      const sx = -displayLeft / scale;
      const sy = -displayTop / scale;
      const sSize = BOX / scale;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (blob) await onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onCancel(); }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-full bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: BOX, height: BOX, boxShadow: "0 0 0 2px hsl(var(--border))" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
          >
            {nat && (
              <img
                src={imageSrc}
                alt="Recorte"
                draggable={false}
                style={{ position: "absolute", left: displayLeft, top: displayTop, width: dispW, height: dispH, maxWidth: "none" }}
              />
            )}
          </div>

          <div className="flex items-center gap-3 w-full px-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range" min={1} max={4} step={0.01} value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-primary cursor-pointer"
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Arraste para posicionar · role para dar zoom</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nat}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando…</> : "Salvar foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
