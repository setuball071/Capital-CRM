import { AlertTriangle, Target, FileInput } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ObsOportunidade {
  id: number;
  observation: string;
  imported_at: string;
  filename?: string | null;
  categoria?: string | null;
  etiqueta?: string | null;
  dados?: Record<string, string> | null;
}

// Chaves de controle: já são usadas no cabeçalho/alerta, não viram card de detalhe
const CHAVES_CONTROLE = new Set(["TEM_OBITO", "TEM_PROCESSO", "MES_REF", "CPF", "NOME"]);

// MARGEM_DISP -> "Margem disp"
function rotular(chave: string): string {
  const s = chave.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Os números do corte vêm com ponto decimal (3403.43). Formata em BR, sem inventar
// "R$": não dá pra saber o que é dinheiro e o que é contagem (QTD_CONTRATOS=2).
// A frase do RESUMO já traz os valores formatados.
function formatarValor(valor: string): string {
  const v = (valor || "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(v)) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const casas = v.includes(".") ? 2 : 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// "2026-06" -> "06/2026"
function formatarMesRef(mes: string): string {
  const m = (mes || "").match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : mes;
}

export function OportunidadePopup({ obs, onClose }: { obs: ObsOportunidade; onClose: () => void }) {
  const dados = obs.dados || {};
  const temObito = String(dados.TEM_OBITO || "").toUpperCase() === "SIM";
  const temProcesso = String(dados.TEM_PROCESSO || "").toUpperCase() === "SIM";
  const mesRef = dados.MES_REF ? formatarMesRef(dados.MES_REF) : null;

  const detalhes = Object.entries(dados).filter(([k, v]) => !CHAVES_CONTROLE.has(k) && v);

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col" data-testid="dialog-oportunidade">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Oportunidade identificada</DialogTitle>
              <DialogDescription className="text-xs">
                {obs.etiqueta ? "Do corte de base" : "Informação importada"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Risco vem ANTES de tudo: não pode aparecer depois da venda */}
          {(temObito || temProcesso) && (
            <div
              className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 dark:bg-red-950/30 dark:border-red-900"
              data-testid="alerta-risco-oportunidade"
            >
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-400">
                <p className="font-semibold">Atenção — verifique antes de ofertar</p>
                <p className="text-xs mt-0.5">
                  {[temObito && "Indício de óbito", temProcesso && "Processo identificado"].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {obs.etiqueta && (
              <Badge variant="default" data-testid="badge-etiqueta-oportunidade">{obs.etiqueta}</Badge>
            )}
            {mesRef && (
              <span className="text-xs text-muted-foreground">dados de {mesRef}</span>
            )}
          </div>

          <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
            <p className="text-[15px] leading-relaxed" data-testid="text-resumo-oportunidade">
              {obs.observation}
            </p>
          </div>

          {detalhes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {detalhes.map(([chave, valor]) => (
                <div key={chave} className="rounded-md bg-muted/50 p-2.5" data-testid={`campo-${chave}`}>
                  <p className="text-[11px] text-muted-foreground leading-tight">{rotular(chave)}</p>
                  <p className="text-sm font-semibold mt-0.5 break-words">{formatarValor(valor)}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <FileInput className="h-3 w-3 flex-shrink-0" />
            {obs.filename || "Importação"} · {new Date(obs.imported_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="flex-shrink-0 pt-2">
          <Button className="w-full" onClick={onClose} data-testid="button-entendi-oportunidade">
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
