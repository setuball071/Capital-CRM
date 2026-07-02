import { useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";

interface CRMUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

// Mapeia URL para o tab do iframe
function tabFromLocation(location: string): string {
  if (location.includes("/producao")) return "producao";
  if (location.includes("/tabelas")) return "tabelas";
  if (location.includes("/configuracoes")) return "configuracoes";
  return "contratos";
}

export default function FinanceiroComissoes() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const { user } = useAuth();
  const [location] = useLocation();
  const tab = tabFromLocation(location);

  const { data: users } = useQuery<CRMUser[]>({
    queryKey: ["/api/users"],
    select: (all) => all.filter((u) => u.isActive),
  });

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    try {
      frameRef.current?.contentWindow?.postMessage({ type, ...payload }, "*");
    } catch { /* ignore */ }
  }, []);

  // Envia tema
  useEffect(() => {
    send("CAPITAL_CRM_THEME", { theme });
  }, [theme, send]);

  // Envia tab quando a rota muda
  useEffect(() => {
    send("CAPITAL_CRM_TAB", { tab });
  }, [tab, send]);

  // Envia usuários quando disponíveis
  useEffect(() => {
    if (!users) return;
    send("CAPITAL_CRM_USERS", {
      users: users.map((u) => ({
        id: String(u.id),
        nome: u.name,
        email: u.email,
        role: u.role,
        isAtivo: u.isActive,
      })),
    });
  }, [users, send]);

  // Envia role do usuário logado
  useEffect(() => {
    if (!user) return;
    send("CAPITAL_CRM_ROLE", { isMaster: user.isMaster || user.role === "master" || user.role === "coordenacao", userId: String(user.id), userEmail: user.email });
  }, [user, send]);

  const handleLoad = useCallback(() => {
    send("CAPITAL_CRM_THEME", { theme });
    send("CAPITAL_CRM_TAB", { tab });
    send("CAPITAL_CRM_ROLE", { isMaster: user?.isMaster || user?.role === "master" || user?.role === "coordenacao", userId: user ? String(user.id) : "", userEmail: user?.email || "" });
    if (users) {
      send("CAPITAL_CRM_USERS", {
        users: users.map((u) => ({
          id: String(u.id),
          nome: u.name,
          email: u.email,
          role: u.role,
          isAtivo: u.isActive,
        })),
      });
    }
  }, [theme, tab, user, users, send]);

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <iframe
        ref={frameRef}
        src="/financeiro-comissoes.html?v=20260702a"
        title="Financeiro — Comissões"
        style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        allow="same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}
