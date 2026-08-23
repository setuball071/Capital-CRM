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

/**
 * Extrai as imagens embutidas na 1ª página do PDF, no tamanho NATIVO delas.
 *
 * Por que isso existe: numa CNH-e o documento é uma imagem de ~963x680 colada
 * numa página A4. Renderizar a página inteira e mandar pro modelo desperdiça
 * resolução — a margem branca ocupa espaço e o provedor ainda reduz tudo para
 * caber em 2048px, entregando a CNH com ~800px. Mandando a imagem embutida
 * direto, o documento chega com todos os pixels que existem.
 *
 * Retorna [] quando não há imagem grande (PDF de texto puro, ex.: contracheque)
 * — nesse caso o chamador cai no render da página.
 */
export async function extractPdfImages(file: File, minPx = 500): Promise<Blob[]> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const ops = await page.getOperatorList();

    // Nomes dos XObjects de imagem desenhados na página, na ordem em que aparecem
    const nomes: string[] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
        const nome = ops.argsArray[i]?.[0];
        if (typeof nome === "string" && !nomes.includes(nome)) nomes.push(nome);
      }
    }

    const blobs: Blob[] = [];
    for (const nome of nomes) {
      // Timeout obrigatório: se o objeto nunca resolver, o await ficaria pendurado
      // e travaria a tela de OCR. Sem resposta em 5s, desiste e usa o render da página.
      const img: any = await new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 5000);
        const ok = (v: any) => { clearTimeout(t); resolve(v); };
        try {
          page.objs.get(nome, ok);
        } catch {
          ok(null);
        }
      });
      if (!img?.width || !img?.height) continue;
      // Ignora ícones e foto 3x4 pelo tamanho...
      if (Math.max(img.width, img.height) < minPx) continue;
      // ...e o QR code pela proporção: documento é retangular (CNH ~1.42),
      // QR code é quadrado. Sem isso o QR entrava no lugar de um dos lados.
      const proporcao = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      if (proporcao < 1.2) continue;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (img.bitmap) {
        ctx.drawImage(img.bitmap, 0, 0);
      } else if (img.data) {
        // RGB(A) cru vindo do pdfjs → ImageData (canvas exige 4 canais)
        const n = img.width * img.height;
        const canais = img.data.length / n;
        const out = ctx.createImageData(img.width, img.height);
        for (let p = 0; p < n; p++) {
          const s = p * canais, d = p * 4;
          out.data[d] = img.data[s];
          out.data[d + 1] = canais >= 3 ? img.data[s + 1] : img.data[s];
          out.data[d + 2] = canais >= 3 ? img.data[s + 2] : img.data[s];
          out.data[d + 3] = canais === 4 ? img.data[s + 3] : 255;
        }
        ctx.putImageData(out, 0, 0);
      } else {
        continue;
      }

      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob((b) => r(b), "image/jpeg", 0.95),
      );
      if (blob) blobs.push(blob);
      if (blobs.length >= 2) break; // frente e verso bastam
    }
    return blobs;
  } catch {
    return []; // qualquer problema → chamador usa o render da página
  }
}

export async function renderPdfFirstPageToBlob(file: File, maxPx = 2800): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  // Renderiza grande o suficiente para o OCR ler textos pequenos (ex.: filiação na CNH-e)
  const scale = Math.min(4, maxPx / Math.max(base.width, base.height)) || 1;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  // Fundo branco (PDFs podem ter transparência)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // pdfjs v5: o parâmetro principal é `canvas` (canvasContext virou legado)
  await page.render({ canvas, viewport } as any).promise;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao renderizar PDF"))),
      "image/jpeg",
      0.9
    )
  );
}
