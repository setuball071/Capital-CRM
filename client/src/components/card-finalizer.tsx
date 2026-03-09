import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { X, Download, Upload, Loader2 } from "lucide-react";
import type { Creative } from "@shared/schema";

const ROLE_LABELS: Record<string, string> = {
  vendedor: "Consultor Financeiro",
  coordenacao: "Coordenador",
  master: "Gestor",
  operacional: "Operacional",
  atendimento: "Atendimento",
};


interface CardFinalizerProps {
  aberto: boolean;
  criativo: Creative;
  onClose: () => void;
}

export function CardFinalizer({ aberto, criativo, onClose }: CardFinalizerProps) {
  const { user } = useAuth();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [nome, setNome] = useState(user?.name || "");
  const [cargo, setCargo] = useState(ROLE_LABELS[user?.role || "vendedor"] || "Consultor Financeiro");
  const [whatsapp, setWhatsapp] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgLoading, setBgLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawPhoto, setRawPhoto] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState([1]);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const rawImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!aberto || !criativo.imageUrl) return;
    setBgLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { setBgImage(img); setBgLoading(false); };
    img.onerror = () => setBgLoading(false);
    img.src = criativo.imageUrl;
  }, [aberto, criativo.imageUrl]);

  useEffect(() => {
    if (!photoData) { setPhotoImg(null); return; }
    const img = new Image();
    img.onload = () => setPhotoImg(img);
    img.src = photoData;
  }, [photoData]);

  const drawPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !bgImage) return;
    const W = 400;
    const H = Math.round((bgImage.naturalHeight / bgImage.naturalWidth) * W);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await document.fonts.ready;
    await renderCardCalibrated(ctx, bgImage, W, H, photoImg, nome, cargo, whatsapp);
  }, [bgImage, photoImg, nome, cargo, whatsapp]);

  useEffect(() => {
    if (aberto && bgImage) drawPreview();
  }, [aberto, bgImage, drawPreview]);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (cropModalOpen) setCropModalOpen(false);
      else onClose();
    }
  }, [onClose, cropModalOpen]);

  useEffect(() => {
    if (aberto) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [aberto, handleEsc]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setRawPhoto(src);
      const img = new Image();
      img.onload = () => { rawImgRef.current = img; setCropOffset({ x: 0, y: 0 }); setCropZoom([1]); setCropModalOpen(true); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const drawCropPreview = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = rawImgRef.current;
    if (!canvas || !img) return;
    const size = 260;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const z = cropZoom[0];
    const scale = Math.max(size / img.width, size / img.height) * z;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (size - dw) / 2 + cropOffset.x;
    const dy = (size - dh) / 2 + cropOffset.y;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }, [cropZoom, cropOffset]);

  useEffect(() => {
    if (cropModalOpen) drawCropPreview();
  }, [cropModalOpen, drawCropPreview]);

  const confirmCrop = () => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    setPhotoData(canvas.toDataURL("image/png"));
    setCropModalOpen(false);
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - cropOffset.x, y: t.clientY - cropOffset.y });
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setCropOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const handleDownload = async () => {
    if (!criativo.imageUrl) return;
    setDownloading(true);
    try {
      await downloadCardCalibrated(
        criativo.imageUrl,
        photoData,
        nome,
        cargo,
        whatsapp,
        nome.replace(/\s+/g, "-").toLowerCase() || "card"
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      data-testid="finalizer-overlay"
    >
      <div
        className="bg-background rounded-2xl flex flex-col overflow-hidden"
        style={{ width: "min(95vw, 1000px)", height: "min(90vh, 750px)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="finalizer-content"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold truncate" data-testid="finalizer-title">
            {criativo.title}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="finalizer-close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Foto do Corretor</Label>
                <div className="flex items-center gap-3">
                  {photoData ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-muted flex-shrink-0">
                      <img src={photoData} alt="Foto" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer">
                      <Button size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          {photoData ? "Trocar foto" : "Enviar foto"}
                        </span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} data-testid="input-photo" />
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">Recorte circular</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  data-testid="input-nome"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Cargo</Label>
                <Input
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Consultor Financeiro"
                  data-testid="input-cargo"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">WhatsApp</Label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  data-testid="input-whatsapp"
                />
              </div>

              <Button
                className="w-full"
                disabled={downloading || bgLoading}
                onClick={handleDownload}
                style={{ background: "linear-gradient(90deg, #9b3dd6, #e91e8c)" }}
                data-testid="button-download"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar Card Finalizado
              </Button>
            </div>

            <div className="flex items-start justify-center">
              {bgLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <canvas
                  ref={previewCanvasRef}
                  className="rounded-lg border max-w-full"
                  style={{ maxHeight: "550px" }}
                  data-testid="preview-canvas"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {cropModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setCropModalOpen(false)}
        >
          <div
            className="bg-background rounded-xl p-6 space-y-4"
            style={{ width: "min(90vw, 400px)" }}
            onClick={(e) => e.stopPropagation()}
            data-testid="crop-modal"
          >
            <h3 className="text-sm font-semibold">Recortar Foto</h3>
            <div
              className="mx-auto rounded-full overflow-hidden border-2 border-muted cursor-grab active:cursor-grabbing"
              style={{ width: 260, height: 260, touchAction: "none" }}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onTouchStart={handleCropTouchStart}
              onTouchMove={handleCropTouchMove}
              onTouchEnd={() => setDragging(false)}
            >
              <canvas ref={cropCanvasRef} width={260} height={260} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zoom</Label>
              <Slider
                value={cropZoom}
                onValueChange={setCropZoom}
                min={1}
                max={3}
                step={0.1}
                data-testid="crop-zoom"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCropModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={confirmCrop} data-testid="button-confirm-crop">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWhatsappIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number
) {
  ctx.fillStyle = "#25D366";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  const p = new Path2D(
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
  );
  ctx.fill(p);
  ctx.restore();
}

async function renderCardCalibrated(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  W: number,
  H: number,
  photoImg: HTMLImageElement | null,
  nome: string,
  cargo: string,
  whatsapp: string
) {
  ctx.drawImage(bgImg, 0, 0, W, H);

  const marg = W * 0.03;
  const bH   = Math.round(H * 0.14);
  const sideMarg = Math.round(W * 0.06);
  const bX   = sideMarg;
  const bW   = W - sideMarg * 2;
  const bY   = H - bH - marg;

  ctx.fillStyle = "rgba(255,255,255,0.97)";
  roundRect(ctx, bX, bY, bW, bH, Math.round(W * 0.03));
  ctx.fill();

  const aR  = Math.round(bH * 0.65);
  const aX  = bX + Math.round(W * 0.015) + aR;
  const aY  = bY + bH - aR - Math.round(bH * 0.08);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = Math.round(W * 0.015);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(W * 0.004);
  ctx.beginPath();
  ctx.arc(aX, aY, aR, 0, Math.PI * 2);
  ctx.fillStyle = "#e0ccf5";
  ctx.fill();
  ctx.restore();

  if (photoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(aX, aY, aR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photoImg, aX - aR, aY - aR, aR * 2, aR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e0ccf5";
    ctx.beginPath();
    ctx.arc(aX, aY, aR, 0, Math.PI * 2);
    ctx.fill();
  }

  const tX = aX + aR + Math.round(W * 0.04);

  const fBadge = Math.round(W * 0.022);
  const fName  = Math.round(W * 0.036);
  const fRole  = Math.round(W * 0.018);
  const fPhone = Math.round(W * 0.026);
  const waSize = Math.round(W * 0.032);

  ctx.font = `700 ${fBadge}px Montserrat, sans-serif`;
  const badgeText = "Aproveite a menor taxa!";
  const bw  = ctx.measureText(badgeText).width + Math.round(W * 0.04);
  const bh  = Math.round(bH * 0.24);
  const bxp = tX;
  const byp = bY + Math.round(bH * 0.08);
  const grad = ctx.createLinearGradient(bxp, 0, bxp + bw, 0);
  grad.addColorStop(0, "#9b3dd6");
  grad.addColorStop(1, "#e91e8c");
  ctx.fillStyle = grad;
  roundRect(ctx, bxp, byp, bw, bh, Math.round(bh / 2));
  ctx.fill();
  ctx.fillStyle   = "#fff";
  ctx.textAlign   = "center";
  ctx.fillText(badgeText, bxp + bw / 2, byp + Math.round(bh * 0.64));

  ctx.textAlign   = "left";
  ctx.fillStyle   = "#1a0030";
  ctx.font        = `900 ${fName}px Montserrat, sans-serif`;
  ctx.fillText(nome || "Seu Nome", tX, bY + Math.round(bH * 0.52));

  ctx.fillStyle   = "#aaa";
  ctx.font        = `500 ${fRole}px Montserrat, sans-serif`;
  ctx.fillText((cargo || "Consultoria Financeira").toUpperCase(), tX, bY + Math.round(bH * 0.70));

  const waY   = bY + Math.round(bH * 0.88);
  const waTop = waY - waSize * 0.8;
  drawWhatsappIcon(ctx, tX, waTop, waSize);
  ctx.fillStyle = "#222";
  ctx.font      = `700 ${fPhone}px Montserrat, sans-serif`;
  ctx.fillText(
    whatsapp || "(48) 99999-9999",
    tX + waSize + Math.round(W * 0.01),
    waY
  );
}

async function downloadCardCalibrated(
  bgImageUrl: string,
  croppedPhotoUrl: string | null,
  nome: string,
  cargo: string,
  telefone: string,
  nomeArquivo: string
) {
  const bg = await loadImage(bgImageUrl);
  const W = bg.naturalWidth;
  const H = bg.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  let photoImg: HTMLImageElement | null = null;
  if (croppedPhotoUrl) {
    photoImg = await loadImage(croppedPhotoUrl);
  }

  await document.fonts.ready;
  await renderCardCalibrated(ctx, bg, W, H, photoImg, nome, cargo, telefone);

  const a = document.createElement("a");
  a.download = `card-capitalgo-${nomeArquivo}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}
