import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";

export default function SimuladorPortCompletoPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  const { theme } = useTheme();
  const [, navigate] = useLocation();
  const isMaster = Boolean(user?.isMaster || user?.role === "master");

  // Captura payload do simulador e redireciona para o criador de proposta
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CAPITAL_CRM_PROPOSTA_FILL' && e.data?.payload) {
        try {
          sessionStorage.setItem('proposta_fill_pending', JSON.stringify(e.data.payload));
        } catch {}
        navigate('/criador-proposta');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const handleLoad = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: "CAPITAL_CRM_THEME", theme }, "*");
      if (user) {
        win.postMessage(
          { type: "CAPITAL_CRM_ROLE", isMaster, userId: String(user.id), userEmail: user.email },
          "*",
        );
      }
    } catch { /* ignore */ }
  }, [theme, user, isMaster]);

  return (
    <div className="flex flex-col h-full w-full" style={{ height: "calc(100vh - 60px)" }}>
      <iframe
        ref={frameRef}
        src="/ferramentas-portabilidade.html#simulador"
        title="Simulador de Portabilidade"
        className="w-full flex-1 border-0"
        style={{ height: "100%" }}
        allow="same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}
