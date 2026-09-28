import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Sparkles, Upload, AlertCircle } from "lucide-react";
import { isPdf, extractPdfImages, renderPdfPagesToBlobs } from "@/lib/pdf-render";

export interface PaletaLida {
  cores: Record<string, string>;
  fontFamily: string | null;
  encontradas: string[];
  avisos: string[];
}

// Nome amigável de cada campo, para o gestor conferir antes de aplicar.
const ROTULOS: Record<string, string> = {
  primaryColor: "Primária",
  secondaryColor: "Secundária",
  loginBgColor: "Fundo do login",
  textColor: "Texto principal",
  borderColor: "Bordas",
  fontColor: "Fonte",
  successColor: "Sucesso",
  errorColor: "Erro",
  warningColor: "Alerta",
  sidebarBgColor: "Fundo do menu",
  sidebarFontColor: "Texto do menu",
};

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    fr.readAsDataURL(blob);
  });
}

export function BrandbookReaderDialog({
  open,
  onOpenChange,
  onAplicar,
  onUsarLogo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAplicar: (p: PaletaLida) => void;
  onUsarLogo: (file: File) => void;
}) {
  const { toast } = useToast();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState<PaletaLida | null>(null);
  // Imagens embutidas no PDF que podem ser a logo — o gestor escolhe qual é.
  const [candidatasLogo, setCandidatasLogo] = useState<{ url: string; file: File }[]>([]);

  const limpar = () => {
    setArquivo(null);
    setTexto("");
    setResultado(null);
    setCandidatasLogo([]);
  };

  const ler = async () => {
    if (!arquivo && !texto.trim()) {
      toast({ title: "Falta o material", description: "Suba o brandbook ou cole as cores.", variant: "destructive" });
      return;
    }
    setLendo(true);
    setResultado(null);
    setCandidatasLogo([]);
    try {
      const imagensBase64: string[] = [];
      const logos: { url: string; file: File }[] = [];

      if (arquivo) {
        if (isPdf(arquivo)) {
          const paginas = await renderPdfPagesToBlobs(arquivo, 4, 1600);
          for (const p of paginas) imagensBase64.push(await blobParaDataUrl(p));
          // Imagens nativas do PDF servem de candidata a logo (qualidade original).
          const embutidas = await extractPdfImages(arquivo, 200);
          embutidas.slice(0, 6).forEach((b, i) => {
            logos.push({
              url: URL.createObjectURL(b),
              file: new File([b], `logo-${i + 1}.png`, { type: b.type || "image/png" }),
            });
          });
        } else {
          imagensBase64.push(await blobParaDataUrl(arquivo));
          logos.push({ url: URL.createObjectURL(arquivo), file: arquivo });
        }
      }

      const resp = await apiRequest("POST", "/api/tenant/branding/extrair", {
        imagensBase64,
        texto: texto.trim() || undefined,
      });
      const dados: PaletaLida = await resp.json();
      setResultado(dados);
      setCandidatasLogo(logos);
    } catch (e: any) {
      toast({ title: "Não consegui ler", description: e?.message || "Tente outro arquivo ou cole as cores.", variant: "destructive" });
    } finally {
      setLendo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) limpar(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Ler do brandbook
          </DialogTitle>
          <DialogDescription>
            Suba o manual da marca (PDF ou imagem) ou cole a lista de cores. A IA preenche os
            campos da paleta e você revisa antes de salvar. Nada é gravado aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="brandbook-file">Arquivo do brandbook (PDF, PNG ou JPG)</Label>
            <input
              id="brandbook-file"
              type="file"
              accept="application/pdf,image/*"
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              data-testid="input-brandbook-file"
            />
            {arquivo && (
              <p className="text-xs text-muted-foreground mt-1">
                {arquivo.name} — {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                {isPdf(arquivo) ? " (as 4 primeiras páginas serão lidas)" : ""}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="brandbook-texto">Ou cole as cores</Label>
            <Textarea
              id="brandbook-texto"
              rows={3}
              placeholder="Ex.: primária #2ECC9B, escura #121212, apoio #7B2FF7, fonte Poppins"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1"
              data-testid="input-brandbook-texto"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pode usar os dois juntos: o texto ajuda a IA a não errar o tom lido da imagem.
            </p>
          </div>

          <Button onClick={ler} disabled={lendo} className="w-full" data-testid="button-ler-brandbook">
            {lendo ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lendo o material...</>) : (<><Upload className="h-4 w-4 mr-2" />Ler</>)}
          </Button>

          {resultado && (
            <div className="space-y-4 border-t pt-4">
              {resultado.avisos.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1">
                  {resultado.avisos.map((a, i) => (
                    <p key={i} className="text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {a}
                    </p>
                  ))}
                </div>
              )}

              <div>
                <Label>Como ficaram os campos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {Object.entries(resultado.cores).map(([campo, hex]) => (
                    <div key={campo} className="flex items-center gap-2 text-sm">
                      <span className="h-6 w-6 rounded border shrink-0" style={{ backgroundColor: hex }} />
                      <span className="truncate">
                        <span className="block text-xs text-muted-foreground">{ROTULOS[campo] || campo}</span>
                        <span className="font-mono text-xs">{hex}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {resultado.encontradas.length > 0 && (
                <div>
                  <Label>Cores vistas no material</Label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {resultado.encontradas.map((hex, i) => (
                      <span key={i} className="h-6 w-6 rounded border" style={{ backgroundColor: hex }} title={hex} />
                    ))}
                  </div>
                </div>
              )}

              {resultado.fontFamily && (
                <p className="text-sm">
                  Fonte citada no material: <strong>{resultado.fontFamily}</strong>
                </p>
              )}

              {candidatasLogo.length > 0 && (
                <div>
                  <Label>Achei estas imagens. Qual é a logo?</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {candidatasLogo.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { onUsarLogo(c.file); toast({ title: "Logo escolhida", description: "Ajuste o recorte na janela que abriu." }); }}
                        className="h-16 w-24 rounded border bg-[repeating-conic-gradient(#e5e7eb_0_25%,transparent_0_50%)] bg-[length:12px_12px] hover:ring-2 hover:ring-primary overflow-hidden"
                        data-testid={`button-logo-candidata-${i}`}
                      >
                        <img src={c.url} alt={`Imagem ${i + 1}`} className="h-full w-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => { onAplicar(resultado); onOpenChange(false); limpar(); }}
                className="w-full"
                data-testid="button-aplicar-brandbook"
              >
                Aplicar nos campos
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Aplicar só preenche a tela. O que vale é o botão de salvar da página.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
