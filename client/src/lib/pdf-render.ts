// Renderiza a primeira página de um PDF para imagem (JPEG Blob).
// Usado para permitir OCR de documentos enviados em PDF (scan ou CNH digital),
// já que o modelo de visão só aceita imagens.

import * as pdfjsLib from "pdfjs-dist";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function renderPdfFirstPageToBlob(file: File, maxPx = 1600): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxPx / Math.max(base.width, base.height)) || 1;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  // Fundo branco (PDFs podem ter transparência)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport } as any).promise;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao renderizar PDF"))),
      "image/jpeg",
      0.9
    )
  );
}
