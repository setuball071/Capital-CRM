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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !bgImage) return;
    const W = 400;
    const H = Math.round((bgImage.height / bgImage.width) * W);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderCard(ctx, bgImage, W, H, photoImg, nome, cargo, whatsapp);
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

  const downloadCard = async () => {
    if (!bgImage) return;
    setDownloading(true);
    try {
      const W = bgImage.width;
      const H = bgImage.height;
      const offscreen = document.createElement("canvas");
      offscreen.width = W;
      offscreen.height = H;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;
      renderCard(ctx, bgImage, W, H, photoImg, nome, cargo, whatsapp);
      const link = document.createElement("a");
      link.download = `card-${criativo.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = offscreen.toDataURL("image/png");
      link.click();
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
                onClick={downloadCard}
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

function renderCard(
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

  const footerH = H * 0.18;
  const footerY = H - footerH;
  const photoR = W * 0.065;
  const photoCY = footerY - photoR * 0.3;
  const photoCX = W * 0.12;
  const pad = W * 0.04;
  const radius = W * 0.02;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pad, footerY + radius);
  ctx.arcTo(pad, footerY, pad + radius, footerY, radius);
  ctx.lineTo(W - pad - radius, footerY);
  ctx.arcTo(W - pad, footerY, W - pad, footerY + radius, radius);
  ctx.lineTo(W - pad, H - pad - radius);
  ctx.arcTo(W - pad, H - pad, W - pad - radius, H - pad, radius);
  ctx.lineTo(pad + radius, H - pad);
  ctx.arcTo(pad, H - pad, pad, H - pad - radius, radius);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.restore();

  if (photoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photoImg, photoCX - photoR, photoCY - photoR, photoR * 2, photoR * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = W * 0.005;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
    ctx.fillStyle = "#e0d4f5";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = W * 0.005;
    ctx.stroke();
    ctx.restore();
  }

  const badgeW = W * 0.45;
  const badgeH = H * 0.03;
  const badgeX = W * 0.5 - badgeW / 2;
  const badgeY = footerY + footerH * 0.08;
  const badgeR = badgeH / 2;
  const grad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  grad.addColorStop(0, "#9b3dd6");
  grad.addColorStop(1, "#e91e8c");
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeR, badgeY);
  ctx.lineTo(badgeX + badgeW - badgeR, badgeY);
  ctx.arc(badgeX + badgeW - badgeR, badgeY + badgeR, badgeR, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(badgeX + badgeR, badgeY + badgeH);
  ctx.arc(badgeX + badgeR, badgeY + badgeR, badgeR, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.font = `bold ${W * 0.018}px Inter, Arial, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("Aproveite a menor taxa!", W * 0.5, badgeY + badgeH * 0.72);

  const textX = photoCX + photoR + W * 0.03;
  const nameY = footerY + footerH * 0.45;
  ctx.font = `bold ${W * 0.032}px Inter, Arial, sans-serif`;
  ctx.fillStyle = "#1a1a2e";
  ctx.textAlign = "left";
  ctx.fillText(nome || "Seu Nome", textX, nameY);

  ctx.font = `${W * 0.016}px Inter, Arial, sans-serif`;
  ctx.fillStyle = "#666";
  ctx.fillText((cargo || "Consultor Financeiro").toUpperCase(), textX, nameY + W * 0.03);

  if (whatsapp) {
    const wpY = nameY + W * 0.06;
    ctx.fillStyle = "#25D366";
    ctx.beginPath();
    const iconR = W * 0.012;
    ctx.arc(textX + iconR, wpY - iconR * 0.3, iconR, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${W * 0.011}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("W", textX + iconR, wpY + iconR * 0.15);
    ctx.textAlign = "left";
    ctx.font = `${W * 0.018}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#333";
    ctx.fillText(whatsapp, textX + iconR * 3, wpY);
  }
}
