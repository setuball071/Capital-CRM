import { useState } from "react";
import CalculatorPage from "@/pages/calculator";
import SimuladorPortabilidadePage from "@/pages/simulador-portabilidade";
import CalculadoraRendaFixaPage from "@/pages/calculadora-renda-fixa";

const TABS = [
  {
    id: "compra",
    label: "Simulador de Compra",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
  },
  {
    id: "amortizacao",
    label: "Amortização",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: "portabilidade",
    label: "Portabilidade / Proposta",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    ),
  },
  {
    id: "renda-fixa",
    label: "Renda Fixa",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
  {
    id: "contracheque",
    label: "Contracheque",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

export default function SimuladoresHub() {
  const [activeTab, setActiveTab] = useState("compra");

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* ── TABS BAR ── */}
      <div
        className="flex items-center border-b shrink-0 overflow-x-auto"
        style={{
          background: "#ffffff",
          borderColor: "#E8E8F0",
          boxShadow: "0 1px 0 #E8E8F0, 0 2px 8px rgba(0,0,0,.04)",
          height: 48,
          paddingLeft: 16,
          paddingRight: 16,
          gap: 2,
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
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#7C3AED" : "#6B7280",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #7C3AED" : "2px solid transparent",
                padding: "0 14px",
                height: "100%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                whiteSpace: "nowrap",
                transition: "color .15s, border-color .15s",
                position: "relative",
                top: 1,
                opacity: isActive ? 1 : 0.7,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#7C3AED";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── PANELS ── */}
      <div className="flex-1 overflow-hidden relative">
        {/* Simulador de Compra — React component */}
        <div
          style={{
            display: activeTab === "compra" ? "block" : "none",
            height: "100%",
            overflow: "auto",
          }}
        >
          <CalculatorPage />
        </div>

        {/* Amortização — React component */}
        <div
          style={{
            display: activeTab === "amortizacao" ? "block" : "none",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <SimuladorPortabilidadePage />
        </div>

        {/* Portabilidade / Proposta — iframe (estado compartilhado, bridge funciona) */}
        <iframe
          src="/ferramentas-portabilidade.html"
          title="Portabilidade e Criador de Proposta"
          style={{
            display: activeTab === "portabilidade" ? "block" : "none",
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="same-origin"
        />

        {/* Renda Fixa — React component */}
        <div
          style={{
            display: activeTab === "renda-fixa" ? "block" : "none",
            height: "100%",
            overflow: "auto",
          }}
        >
          <CalculadoraRendaFixaPage />
        </div>

        {/* Contracheque — iframe */}
        <iframe
          src="/simulador-contracheque.html"
          title="Cálculo de Contracheque"
          style={{
            display: activeTab === "contracheque" ? "block" : "none",
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="same-origin"
        />
      </div>
    </div>
  );
}
