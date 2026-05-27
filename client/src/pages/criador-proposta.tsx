import { useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";

export default function CriadorPropostaPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  const { theme } = useTheme();
  const isMaster = Boolean(user?.isMaster || user?.role === "master");

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
        src="/ferramentas-portabilidade.html#proposta"
        title="Criador de Proposta"
        className="w-full flex-1 border-0"
        style={{ height: "100%" }}
        allow="same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}
