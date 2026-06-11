import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Move, ZoomIn, RotateCcw } from "lucide-react";

interface LogoCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  /** proporção largura/altura do recorte (ex: 4 pra logo wide, 1 pra favicon quadrado) */
  aspectRatio?: number;
  /** dimensões finais da imagem exportada em pixels (para garantir qualidade) */
  outputWidth?: number;
  outputHeight?: number;
  /** callback com o blob processado (PNG) e um File pronto pra upload */
  onConfirm: (file: File) => void;
  /** rótulo opcional (ex: "Logo do Menu Lateral") */
  title?: string;
}

/**
 * Editor de logo estilo "foto de perfil do WhatsApp":
 * - Arraste com o mouse/touch para reposicionar
 * - Use o slider de zoom para ajustar
 * - Botão de reset volta ao padrão
 * - Ao confirmar, gera PNG transparente com as dimensões definidas
 */
export function LogoCropperDialog({
  open,
  onOpenChange,
  file,
  aspectRatio = 4,
  outputWidth = 800,
  outputHeight,
  onConfirm,
  title = "Ajustar imagem",
}: LogoCropperDialogProps) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [dragging, setDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Tamanho do canvas exibido no modal (pixel ratio será aplicado pra qualidade)
  const previewWidth = 480;
  const previewHeight = Math.round(previewWidth / aspectRatio);

  // Carrega o arquivo como dataURL
  useEffect(() => {
    if (!file) { setImgSrc(""); return; }
    const reader = new FileReader();
    reader.onload = () => setImgSrc(String(reader.result || ""));
    reader.readAsDataURL(file);
  }, [file]);

  // Quando abre ou troca a imagem, reseta posição e zoom
  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [open, imgSrc]);

  // Carrega a imagem e desenha o canvas sempre que mudar
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Densidade de pixels para nitidez no preview
    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewWidth * dpr;
    canvas.height = previewHeight * dpr;
    canvas.style.width = `${previewWidth}px`;
    canvas.style.height = `${previewHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fundo xadrez sutil pra indicar transparência (estilo Photoshop)
    const sq = 12;
    for (let yy = 0; yy < previewHeight; yy += sq) {
      for (let xx = 0; xx < previewWidth; xx += sq) {
        ctx.fillStyle = ((xx / sq + yy / sq) % 2 === 0) ? "#f3f4f6" : "#e5e7eb";
        ctx.fillRect(xx, yy, sq, sq);
      }
    }

    // Calcula escala base "fit" — imagem inteira cabe no canvas
    const scaleBase = Math.min(previewWidth / img.naturalWidth, previewHeight / img.naturalHeight);
    const scale = scaleBase * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = (previewWidth - drawW) / 2 + offsetX;
    const cy = (previewHeight - drawH) / 2 + offsetY;

    ctx.drawImage(img, cx, cy, drawW, drawH);
  }, [zoom, offsetX, offsetY, previewWidth, previewHeight]);

  useEffect(() => { draw(); }, [draw]);

  // Carrega a imagem quando o src muda
  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      draw();
    };
    img.src = imgSrc;
  }, [imgSrc, draw]);

  // Drag pra reposicionar
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart) return;
    setOffsetX(dragStart.ox + (e.clientX - dragStart.x));
    setOffsetY(dragStart.oy + (e.clientY - dragStart.y));
  };
  const onMouseUp = () => { setDragging(false); setDragStart(null); };

  // Touch pra mobile
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX, y: t.clientY, ox: offsetX, oy: offsetY });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !dragStart) return;
    const t = e.touches[0];
    setOffsetX(dragStart.ox + (t.clientX - dragStart.x));
    setOffsetY(dragStart.oy + (t.clientY - dragStart.y));
  };
  const onTouchEnd = () => { setDragging(false); setDragStart(null); };

  const reset = () => { setZoom(1); setOffsetX(0); setOffsetY(0); };

  // Gera o arquivo final no tamanho de saída desejado
  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || !file) return;

    const outW = outputWidth;
    const outH = outputHeight ?? Math.round(outputWidth / aspectRatio);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = outW;
    exportCanvas.height = outH;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Recalcula escala/posição na resolução final usando proporção preview→output
    const scaleBase = Math.min(previewWidth / img.naturalWidth, previewHeight / img.naturalHeight);
    const scale = scaleBase * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = (previewWidth - drawW) / 2 + offsetX;
    const cy = (previewHeight - drawH) / 2 + offsetY;

    // Razão preview→output (já que canvas final tem dimensões diferentes)
    const rx = outW / previewWidth;
    const ry = outH / previewHeight;

    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(img, cx * rx, cy * ry, drawW * rx, drawH * ry);

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      // Mantém a extensão png pra garantir transparência
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const newFile = new File([blob], `${baseName}.png`, { type: "image/png" });
      onConfirm(newFile);
      onOpenChange(false);
    }, "image/png");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Arraste para reposicionar e use o zoom para enquadrar. A área visível será exportada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="rounded-md overflow-hidden border-2 border-dashed border-border bg-muted/30 select-none"
            style={{ width: previewWidth, height: previewHeight, cursor: dragging ? "grabbing" : "grab" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>

          <div className="w-full max-w-[480px] flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom * 100]}
              min={20}
              max={400}
              step={1}
              onValueChange={(v) => setZoom((v[0] ?? 100) / 100)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground font-mono w-12 text-right">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="sm" onClick={reset} title="Resetar">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Move className="h-3 w-3" />
            Arraste a imagem para reposicionar
            {imgDims.w > 0 && (
              <span className="ml-1 opacity-70">· original {imgDims.w}×{imgDims.h}px</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>Aplicar e usar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
