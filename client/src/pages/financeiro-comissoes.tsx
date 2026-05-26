import { useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/theme-provider";

interface CRMUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function FinanceiroComissoes() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();

  // Busca usuários ativos do CRM
  const { data: users } = useQuery<CRMUser[]>({
    queryKey: ["/api/users"],
    select: (all) => all.filter((u) => u.isActive),
  });

  const sendTheme = useCallback((frame: HTMLIFrameElement | null, t: string) => {
    try {
      frame?.contentWindow?.postMessage({ type: "CAPITAL_CRM_THEME", theme: t }, "*");
    } catch { /* ignore */ }
  }, []);

  const sendUsers = useCallback((frame: HTMLIFrameElement | null, userList: CRMUser[] | undefined) => {
    if (!frame || !userList) return;
    try {
      frame.contentWindow?.postMessage({
        type: "CAPITAL_CRM_USERS",
        users: userList.map((u) => ({
          id: String(u.id),
          nome: u.name,
          email: u.email,
          role: u.role,
          isAtivo: u.isActive,
        })),
      }, "*");
    } catch { /* ignore */ }
  }, []);

  // Envia tema ao mudar
  useEffect(() => {
    sendTheme(frameRef.current, theme);
  }, [theme, sendTheme]);

  // Envia usuários quando lista muda
  useEffect(() => {
    sendUsers(frameRef.current, users);
  }, [users, sendUsers]);

  const handleLoad = useCallback(() => {
    sendTheme(frameRef.current, theme);
    sendUsers(frameRef.current, users);
  }, [theme, users, sendTheme, sendUsers]);

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <iframe
        ref={frameRef}
        src="/financeiro-comissoes.html"
        title="Gestão Financeira — Comissões"
        style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        allow="same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}
