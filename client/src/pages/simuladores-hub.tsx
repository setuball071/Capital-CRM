import { useState, useCallback, useEffect, useRef } from "react";
import SimuladorCompra from "@/pages/simulador-compra";
import SimuladorPortabilidadePage from "@/pages/simulador-portabilidade";
import CalculadoraRendaFixaPage from "@/pages/calculadora-renda-fixa";
import SimCriadorProposta from "@/pages/sim-criador-proposta";
import SimAmortizacaoAnual from "@/pages/sim-amortizacao-anual";
import { PropostaProvider, useProposta } from "@/contexts/proposta-context";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import { MatIcon } from "@/components/mat-icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  viabilidadeRef,
}: {
  portabilidadeRef: React.RefObject<HTMLIFrameElement>;
  contrachequeRef: React.RefObject<HTMLIFrameElement>;
  viabilidadeRef: React.RefObject<HTMLIFrameElement>;
}) {
  const { theme } = useTheme();
  const sendTheme = useCallback((frame: HTMLIFrameElement | null, t: string) => {
    try { frame?.contentWindow?.postMessage({ type: 'CAPITAL_CRM_THEME', theme: t }, '*'); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    sendTheme(portabilidadeRef.current, theme);
    sendTheme(contrachequeRef.current, theme);
    sendTheme(viabilidadeRef.current, theme);
  }, [theme, sendTheme, portabilidadeRef, contrachequeRef, viabilidadeRef]);
  return null;
}

// Ícones Material Symbols do design (Simuladores.dc.html → TAB_DEFS)
// perm = chave da permissão (MODULE_SUB_ITEMS.modulo_simulador). É o que permite
// liberar simulador por simulador em vez de tudo ou nada.
const TABS = [
  { id: "portabilidade", label: "Simulador de Portabilidade", icon: "sync_alt", perm: "simulador_portabilidade" },
  { id: "compra", label: "Simulador de Compra", icon: "shopping_cart", perm: "simulador_compra" },
  { id: "amortizacao", label: "Amortização", icon: "trending_down", perm: "simulador_amortizacao" },
  { id: "amortizacao-anual", label: "Amortização Anual", icon: "event_repeat", perm: "amortizacao_anual" },
  { id: "viabilidade-inter", label: "Viabilidade Inter", icon: "fact_check", perm: "viabilidade_inter" },
  { id: "contracheque", label: "Contracheque", icon: "description", perm: "calculadora_contracheque" },
  { id: "renda-fixa", label: "Renda Fixa", icon: "trending_up", perm: "renda_fixa" },
  { id: "proposta", label: "Criador de Proposta", icon: "description", perm: "criador_proposta" },
];

export default function SimuladoresHub() {
  // ?tab=<id> abre direto na aba pedida (ex.: a Consulta manda ?tab=portabilidade
  // ao levar os contratos marcados para o simulador em aba nova)
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    return tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "portabilidade";
  });
  const { theme } = useTheme();
  const { user, hasSubItemAccess } = useAuth();
  // Só as abas liberadas para o usuário. Sem permissão gravada, herda do módulo
  // (quem tem Simuladores continua vendo tudo), igual ao resto do sistema.
  const tabsPermitidas = TABS.filter((t) => hasSubItemAccess("modulo_simulador", t.perm));

  // Ordem das abas escolhida pelo usuario, guardada no banco para seguir ele em
  // qualquer computador. Aba nova (ou sem ordem salva) vai para o fim, na ordem
  // original — assim lancar um simulador novo nao bagunca quem ja organizou.
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery<{ ordemSimuladores?: string[] }>({
    queryKey: ["/api/preferencias"],
  });
  const ordemSalva = prefs?.ordemSimuladores;
  const tabsVisiveis = (() => {
    if (!Array.isArray(ordemSalva) || ordemSalva.length === 0) return tabsPermitidas;
    const porId = new Map(tabsPermitidas.map((t) => [t.id, t]));
    const ordenadas = ordemSalva.map((id) => porId.get(id)).filter(Boolean) as typeof tabsPermitidas;
    const restantes = tabsPermitidas.filter((t) => !ordemSalva.includes(t.id));
    return [...ordenadas, ...restantes];
  })();

  const arrastandoId = useRef<string | null>(null);
  const arrastou = useRef(false);

  const salvarOrdem = (novaOrdem: string[]) => {
    queryClient.setQueryData(["/api/preferencias"], (antigo: any) => ({
      ...(antigo || {}),
      ordemSimuladores: novaOrdem,
    }));
    apiRequest("PUT", "/api/preferencias", { ordemSimuladores: novaOrdem }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferencias"] });
    });
  };

  const soltarEm = (idDestino: string) => {
    const idOrigem = arrastandoId.current;
    arrastandoId.current = null;
    if (!idOrigem || idOrigem === idDestino) return;
    const ids = tabsVisiveis.map((t) => t.id);
    const de = ids.indexOf(idOrigem);
    const para = ids.indexOf(idDestino);
    if (de < 0 || para < 0) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    salvarOrdem(ids);
  };
  // Aba bloqueada (ou link direto com ?tab=) cai na primeira liberada; sem nenhuma
  // liberada, nenhum painel aparece.
  useEffect(() => {
    if (!tabsVisiveis.some((t) => t.id === activeTab)) {
      setActiveTab(tabsVisiveis[0]?.id ?? "");
    }
  }, [tabsVisiveis, activeTab]);
  const portabilidadeRef = useRef<HTMLIFrameElement>(null);
  const contrachequeRef = useRef<HTMLIFrameElement>(null);
  const viabilidadeRef = useRef<HTMLIFrameElement>(null);

  const navigateToProposta = useCallback(() => setActiveTab("proposta"), []);

  // "Validar no Inter": o simulador manda cliente + contratos, abrimos a aba e repassamos
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "CAPITAL_CRM_ABRIR_INTER" || !event.data?.payload) return;
      const payload = event.data.payload;
      setActiveTab("viabilidade-inter");
      // a aba já está montada (só escondida); um tique garante que o iframe recebeu o foco
      setTimeout(() => {
        try {
          viabilidadeRef.current?.contentWindow?.postMessage({ type: "CAPITAL_CRM_CONTRATOS_PORT", payload }, "*");
        } catch { /* ignore */ }
      }, 100);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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
    sendRoleToFrame(viabilidadeRef.current);
  }, [sendRoleToFrame]);

  return (
    <PropostaProvider onNavigateToProposta={navigateToProposta}>
      <IframeBridge />
      <IframeThemeSync
        portabilidadeRef={portabilidadeRef}
        contrachequeRef={contrachequeRef}
        viabilidadeRef={viabilidadeRef}
      />
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
          {tabsVisiveis.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                draggable
                onDragStart={() => { arrastandoId.current = tab.id; arrastou.current = false; }}
                onDragOver={(e) => { e.preventDefault(); arrastou.current = true; }}
                onDrop={(e) => { e.preventDefault(); soltarEm(tab.id); }}
                onDragEnd={() => { arrastandoId.current = null; setTimeout(() => { arrastou.current = false; }, 0); }}
                title="Arraste para reordenar"
                onClick={() => { if (!arrastou.current) setActiveTab(tab.id); }}
                style={{
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  padding: "10px 16px",
                  // "grab" avisa que a aba pode ser arrastada sem precisar de texto
                  cursor: "grab",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  transition: "color .15s, border-color .15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--primary))";
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

          {/* Viabilidade Inter — iframe (motor de taxa ponderada, leitura do extrato) */}
          <iframe
            ref={viabilidadeRef}
            src="/viabilidade-inter.html?v=20260911"
            title="Viabilidade Inter"
            style={{
              display: activeTab === "viabilidade-inter" ? "block" : "none",
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="same-origin"
            onLoad={() => {
              sendThemeToFrame(viabilidadeRef.current);
              sendRoleToFrame(viabilidadeRef.current);
            }}
          />

          {/* Simulador de Compra — native React */}
          <div style={{ display: activeTab === "compra" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <SimuladorCompra />
          </div>

          {/* Amortização — native React */}
          <div style={{ display: activeTab === "amortizacao" ? "block" : "none", height: "100%", overflow: "hidden" }}>
            <SimuladorPortabilidadePage />
          </div>

          {/* Amortização Anual — native React */}
          <div style={{ display: activeTab === "amortizacao-anual" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <SimAmortizacaoAnual />
          </div>

          {/* Renda Fixa — native React */}
          <div style={{ display: activeTab === "renda-fixa" ? "block" : "none", height: "100%", overflow: "auto" }}>
            <CalculadoraRendaFixaPage />
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
