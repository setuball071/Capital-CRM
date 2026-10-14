import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Clock, Info, Lock, X } from "lucide-react";

type Alerta = {
  nivel: "info" | "aviso" | "urgente" | "suspenso";
  texto: string;
  diasVencimento?: number | null;
  diasSuspensao?: number | null;
};

/**
 * Mesma regra do contador CIP da portabilidade: quanto mais perto do prazo,
 * mais forte o destaque. Degraus por dias até o vencimento e, depois de
 * vencida, por dias até o bloqueio. O último dia antes do bloqueio pisca.
 */
export function intensidadeAviso(a: Alerta): { classe: string; forte: boolean; piscar: boolean } {
  if (a.nivel === "suspenso") {
    return { classe: "bg-red-600 text-white border-red-700", forte: true, piscar: false };
  }
  const dv = a.diasVencimento ?? null;
  const ds = a.diasSuspensao ?? null;
  if (dv !== null && dv >= 3) {
    return { classe: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900", forte: false, piscar: false };
  }
  if (dv !== null && dv >= 1) {
    return { classe: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800", forte: false, piscar: false };
  }
  if (dv === 0) {
    return { classe: "bg-amber-300 text-amber-950 border-amber-400 dark:bg-amber-600/60 dark:text-amber-50 dark:border-amber-600", forte: true, piscar: false };
  }
  // Vencida: conta até o bloqueio.
  if (ds !== null && ds > 2) {
    return { classe: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-800", forte: true, piscar: false };
  }
  if (ds !== null && ds === 2) {
    return { classe: "bg-orange-300 text-orange-950 border-orange-400 dark:bg-orange-600/60 dark:text-orange-50 dark:border-orange-600", forte: true, piscar: false };
  }
  // Último dia para pagar (ou tolerância já encerrada).
  return { classe: "bg-red-500 text-white border-red-600", forte: true, piscar: true };
}

const ICONE: Record<Alerta["nivel"], typeof Info> = {
  info: Info, aviso: Clock, urgente: AlertTriangle, suspenso: Lock,
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

  const Icone = ICONE[alerta.nivel];
  const { classe, forte, piscar } = intensidadeAviso(alerta);
  return (
    <div className={`flex items-start gap-3 border-b px-6 py-2.5 text-sm ${classe} ${piscar ? "motion-safe:animate-pulse" : ""}`} role="status" data-testid="aviso-assinatura">
      <Icone className="h-4 w-4 mt-0.5 shrink-0" />
      <p className={`flex-1 ${forte ? "font-semibold" : ""}`}>{alerta.texto}</p>
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
