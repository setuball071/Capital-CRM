import { Info } from "lucide-react";
import { AVISO_SIMULADOR } from "@shared/avisos-legais";

/**
 * Aviso ao lado do resultado de um simulador.
 *
 * O texto e igual em todo lugar de proposito: e o mesmo compromisso juridico,
 * e versoes diferentes por tela foi justamente o que gerou divergencia no
 * rodape dos documentos.
 */
export function AvisoSimulacao({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 ${className}`}
      data-testid="aviso-simulacao"
    >
      <Info className="h-4 w-4 mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed">{AVISO_SIMULADOR}</p>
    </div>
  );
}
