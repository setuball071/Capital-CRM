import { useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatIcon } from "@/components/mat-icon";
import FinanceiroComissoes from "@/pages/financeiro-comissoes";

interface Props {
  aberto: boolean;
  onClose: () => void;
}

// Modal do atalho "Tabelas" no cabeçalho — mostra a aba Tabelas do Financeiro
// sem tirar o corretor da tela onde ele está. A tela cheia oficial continua
// acessível pelo menu lateral (Financeiro → Tabelas).
// Maior que os outros modais: o financeiro é uma planilha densa.
export function FinanceiroTabelasModal({ aberto, onClose }: Props) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (aberto) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [aberto, handleEsc]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      data-testid="modal-tabelas-overlay"
    >
      <div
        className="bg-background rounded-2xl flex flex-col overflow-hidden"
        style={{ width: "min(95vw, 1400px)", height: "min(92vh, 900px)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-tabelas-content"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
              <MatIcon name="table_chart" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold" data-testid="modal-tabelas-title">
                Tabelas
              </h2>
              <p className="text-xs text-muted-foreground">Tabelas de comissão do Financeiro</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="modal-tabelas-close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* A URL não muda dentro do modal, então a aba vai por prop */}
        <div className="flex-1 min-h-0">
          <FinanceiroComissoes tabForcado="tabelas" />
        </div>
      </div>
    </div>
  );
}
