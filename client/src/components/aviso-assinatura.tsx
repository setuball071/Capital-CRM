import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Clock, Info, Lock, X } from "lucide-react";

type Alerta = {
  nivel: "info" | "aviso" | "urgente" | "suspenso";
  texto: string;
};

const ESTILO: Record<Alerta["nivel"], { classe: string; Icone: typeof Info }> = {
  info: { classe: "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900", Icone: Info },
  aviso: { classe: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900", Icone: Clock },
  urgente: { classe: "bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900", Icone: AlertTriangle },
  suspenso: { classe: "bg-red-50 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900", Icone: Lock },
};

// Só o aviso "info" (vence em X dias) pode ser dispensado, e só até o dia
// seguinte. Atraso e suspensão ficam sempre visíveis.
const CHAVE = "aviso-assinatura-oculto";
const hoje = () => new Date().toISOString().slice(0, 10);
function lerOculto(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
function gravarOculto(v: string) {
  try { localStorage.setItem(CHAVE, v); } catch { /* navegador sem storage: só não lembra */ }
}

/**
 * Faixa no topo de toda tela de quem tem assinatura: vencimento próximo,
 * atraso, suspensão. Quem não é assinante não vê nada (a rota devolve null).
 */
export function AvisoAssinatura() {
  const [location, navigate] = useLocation();
  const { data } = useQuery<{ alerta: Alerta | null } | null>({
    queryKey: ["/api/minha-assinatura"],
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  const [oculto, setOculto] = useState(lerOculto);

  const alerta = data?.alerta;
  const suspenso = alerta?.nivel === "suspenso";
  // Acesso suspenso: o servidor já barra as outras telas, então leva direto
  // para Minha assinatura em vez de deixar a pessoa diante de telas vazias.
  useEffect(() => {
    if (suspenso && !location.startsWith("/assinatura")) navigate("/assinatura");
  }, [suspenso, location, navigate]);
  if (!alerta) return null;
  // Na própria Minha assinatura a informação já está na tela.
  if (location.startsWith("/assinatura")) return null;
  const marca = `${hoje()}|${alerta.texto}`;
  if (alerta.nivel === "info" && oculto === marca) return null;

  const { classe, Icone } = ESTILO[alerta.nivel];
  return (
    <div className={`flex items-start gap-3 border-b px-6 py-2.5 text-sm ${classe}`} role="status" data-testid="aviso-assinatura">
      <Icone className="h-4 w-4 mt-0.5 shrink-0" />
      <p className="flex-1">{alerta.texto}</p>
      <button
        type="button"
        onClick={() => navigate("/assinatura")}
        className="shrink-0 font-semibold underline underline-offset-2"
        data-testid="link-aviso-minha-assinatura"
      >
        Ver minha assinatura
      </button>
      {alerta.nivel === "info" && (
        <button
          type="button"
          aria-label="Dispensar até amanhã"
          title="Dispensar até amanhã"
          onClick={() => { gravarOculto(marca); setOculto(marca); }}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
