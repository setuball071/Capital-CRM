import { useRef, useCallback, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

export default function FinanceiroComissoes() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();

  const sendTheme = useCallback((frame: HTMLIFrameElement | null, t: string) => {
    try {
      frame?.contentWindow?.postMessage({ type: "CAPITAL_CRM_THEME", theme: t }, "*");
    } catch { /* ignore */ }
  }, []);

  // Sincroniza tema ao trocar
  useEffect(() => {
    sendTheme(frameRef.current, theme);
  }, [theme, sendTheme]);

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <iframe
        ref={frameRef}
        src="/financeiro-comissoes.html"
        title="Gestão Financeira — Comissões"
        style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        allow="same-origin"
        onLoad={() => sendTheme(frameRef.current, theme)}
      />
    </div>
  );
}
