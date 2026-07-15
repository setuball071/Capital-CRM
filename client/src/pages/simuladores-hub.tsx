import { useState, useCallback, useEffect, useRef } from "react";
import CalculatorPage from "@/pages/calculator";
import SimuladorPortabilidadePage from "@/pages/simulador-portabilidade";
import CalculadoraRendaFixaPage from "@/pages/calculadora-renda-fixa";
import SimCriadorProposta from "@/pages/sim-criador-proposta";
import SimPropostaIa from "@/pages/sim-proposta-ia";
import { PropostaProvider, useProposta } from "@/contexts/proposta-context";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import type { ModuleName } from "@shared/schema";
import { MatIcon } from "@/components/mat-icon";

// Escuta postMessage do iframe do Simulador de Portabilidade e redireciona para o Criador de Proposta nativo
function IframeBridge() {
  const ctx = useProposta();
  useEffect(() => {
    if (!ctx) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CAPITAL_CRM_PROPOSTA_FILL' && event.data?.payload) {
        ctx.sendToProposta(event.data.payload);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [ctx]);
  return null;
}

// Sincroniza o tema do CRM com os iframes filhos via postMessage
function IframeThemeSync({
  portabilidadeRef,
  contrachequeRef,
}: {
  portabilidadeRef: React.RefObject<HTMLIFrameElement>;
  contrachequeRef: React.RefObject<HTMLIFrameElement>;
}) {
  const { theme } = useTheme();
  const sendTheme = useCallback((frame: HTMLIFrameElement | null, t: string) => {
    try { frame?.contentWindow?.postMessage({ type: 'CAPITAL_CRM_THEME', theme: t }, '*'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    sendTheme(portabilidadeRef.current, theme);
    sendTheme(contrachequeRef.current, theme);
  }, [theme, sendTheme, portabilidadeRef, contrachequeRef]);
  return null;
}

// Ícones Material Symbols do design (Simuladores.dc.html → TAB_DEFS)
const TABS_BASE = [
  { id: "proposta", label: "Criador de Proposta", icon: "description", permKey: null },
  { id: "portabilidade", label: "Simulador de Portabilidade", icon: "sync_alt", permKey: null },
  { id: "compra", label: "Simulador de Compra", icon: "shopping_cart", permKey: null },
  { id: "amortizacao", label: "Amortização", icon: "trending_down", permKey: null },
  { id: "renda-fixa", label: "Renda Fixa", icon: "trending_up", permKey: null },
  { id: "contracheque", label: "Contracheque", icon: "description", permKey: null },
  { id: "proposta-ia", label: "Gerador de Proposta - IA", icon: "auto_awesome", permKey: "proposta_ia" },
];

export default function SimuladoresHub() {
  // ?tab=<id> abre direto na aba pedida (ex.: a Consulta manda ?tab=portabilidade
  // ao levar os contratos marcados para o simulador em aba nova)
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    return tabParam && TABS_BASE.some((t) => t.id === tabParam) ? tabParam : "proposta";
  });
  const [iaImportData, setIaImportData] = useState<any>(null);
  const { theme } = useTheme();
  const { user, hasSubItemAccess } = useAuth();

  const TABS = TABS_BASE.filter((tab) => {
    if (!tab.permKey) return true;
    return hasSubItemAccess("modulo_simulador" as ModuleName, tab.permKey);
  });

  // Recebe a cotação do Simulador de Portabilidade (iframe) e abre o Gerador de Proposta IA
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "CAPITAL_CRM_PROPOSTA_IA_FILL" && event.data?.payload) {
        setIaImportData(event.data.payload);
        setActiveTab("proposta-ia");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  const portabilidadeRef = useRef<HTMLIFrameElement>(null);
  const contrachequeRef = useRef<HTMLIFrameElement>(null);

  const navigateToProposta = useCallback(() => setActiveTab("proposta"), []);

  // Apenas master verdadeiro (system master OU role 'master' do tenant) pode editar regras.
  // Coordenacao/financeiro/vendedor recebem isMaster=false.
  const isMaster = Boolean(user?.isMaster || user?.role === "master");

  // Envia tema para um iframe assim que ele termina de carregar
  const sendThemeToFrame = useCallback((frame: HTMLIFrameElement | null) => {
    try { frame?.contentWindow?.postMessage({ type: 'CAPITAL_CRM_THEME', theme }, '*'); } catch { /* ignore */ }
  }, [theme]);

  // Envia role pro iframe (usado pela ferramenta de portabilidade pra liberar edição de regras de bancos)
  const sendRoleToFrame = useCallback((frame: HTMLIFrameElement | null) => {
    if (!user) return;
    try {
      frame?.contentWindow?.postMessage(
        { type: 'CAPITAL_CRM_ROLE', isMaster, userId: String(user.id), userEmail: user.email },
        '*',
      );
    } catch { /* ignore */ }
  }, [user, isMaster]);

  // Reenvia role se o user mudar (login/logout) ou se isMaster recalcular
  useEffect(() => {
    sendRoleToFrame(portabilidadeRef.current);
  }, [sendRoleToFrame]);

  return (
    <PropostaProvider onNavigateToProposta={navigateToProposta}>
      <IframeBridge />
      <IframeThemeSync portabilidadeRef={portabilidadeRef} contrachequeRef={contrachequeRef} />
      <div className="flex flex-col h-full w-full overflow-hidden">
        {/* ── SUB-TAB STRIP (Simuladores.dc.html) ── */}
        <div
          className="flex items-center border-b shrink-0 overflow-x-auto bg-sidebar"
          style={{
            borderColor: "hsl(var(--border))",
            paddingLeft: 24,
            paddingRight: 24,
            gap: 4,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: isActive ? "#6C2BD9" : "hsl(var(--muted-foreground))",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #6C2BD9" : "2px solid transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  transition: "color .15s, border-color .15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#6C2BD9";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "";
                }}
              >
                <MatIcon name={tab.icon} size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── PANELS ── */}
        <div className="flex-1 overflow-hidden relative">

          {/* Criador de Proposta — native React */}
          <div style={{ display: activeTab === "proposta" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <SimCriadorProposta />
          </div>

          {/* Simulador de Portabilidade — iframe (lógica complexa com PDF import, regras de bancos) */}
          <iframe
            ref={portabilidadeRef}
            src="/ferramentas-portabilidade.html?v=20260629#simulador"
            title="Simulador de Portabilidade"
            style={{
              display: activeTab === "portabilidade" ? "block" : "none",
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="same-origin"
            onLoad={() => {
              sendThemeToFrame(portabilidadeRef.current);
              sendRoleToFrame(portabilidadeRef.current);
            }}
          />

          {/* Simulador de Compra — native React */}
          <div style={{ display: activeTab === "compra" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <CalculatorPage />
          </div>

          {/* Amortização — native React */}
          <div style={{ display: activeTab === "amortizacao" ? "block" : "none", height: "100%", overflow: "hidden" }}>
            <SimuladorPortabilidadePage />
          </div>

          {/* Renda Fixa — native React */}
          <div style={{ display: activeTab === "renda-fixa" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <CalculadoraRendaFixaPage />
          </div>

          {/* Gerador de Proposta IA — native React */}
          <div style={{ display: activeTab === "proposta-ia" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <SimPropostaIa importData={iaImportData} onConsumed={() => setIaImportData(null)} />
          </div>

          {/* Contracheque — iframe */}
          <iframe
            ref={contrachequeRef}
            src="/simulador-contracheque.html"
            title="Cálculo de Contracheque"
            style={{
              display: activeTab === "contracheque" ? "block" : "none",
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="same-origin"
            onLoad={() => sendThemeToFrame(contrachequeRef.current)}
          />
        </div>
      </div>
    </PropostaProvider>
  );
}
