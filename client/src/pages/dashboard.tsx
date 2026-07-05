import { useQuery } from "@tanstack/react-query";
import { Target, Clock, CheckCircle2, CalendarDays, Trophy, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";

interface VendedorRanking {
  userId: number;
  nome: string;
  efetivado: number;
  emAndamento: number;
  emAndamentoContratos: number;
  novo: number;
  portabilidade: number;
  cartao: number;
  contratos: number;
  meta: number;
  percentual: number;
  posicao: number;
}

interface GestorDashboardData {
  equipe: {
    meta: number;
    efetivado: number;
    emAndamento: number;
    novo: number;
    portabilidade: number;
    cartao: number;
    percentual: number;
    deltaPercentual: number;
    propostasEmAberto: number;
  };
  ranking: VendedorRanking[];
  statusEmAndamento: string[];
  mesAno: string;
}

// ── Paletas EXATAS do arquivo de design (PALETTE do Dashboard.dc.html) ────────
const PALETTE = {
  light: {
    page: "#F3F4F6",
    cardBg: "#FFFFFF",
    border: "#E5E7EB",
    borderStrong: "#D1D5DB",
    textStrong: "#121212",
    textBody: "#333333",
    textMuted: "#6B7280",
    subtleBg: "#F9FAFB",
    trackBg: "#E5E7EB",
    badgeBrandBg: "#F2EBFC",
    badgeBrandText: "#6C2BD9",
  },
  dark: {
    page: "#121016",
    cardBg: "#1E1B29",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.16)",
    textStrong: "#FFFFFF",
    textBody: "#D6D3E0",
    textMuted: "#9C97AE",
    subtleBg: "rgba(255,255,255,0.04)",
    trackBg: "rgba(255,255,255,0.10)",
    badgeBrandBg: "rgba(108,43,217,0.28)",
    badgeBrandText: "#C79CF7",
  },
};
type Palette = typeof PALETTE.light;
const PURPLE = "#6C2BD9";
const BLUE = "#1E88E5";
const GRAY = "#9CA3AF";
const GREEN = "#00C853";
const AMBER = "#F9A825";
const DANGER = "#E53935";
const GRAD_CTA = "linear-gradient(90deg,#6C2BD9 0%,#1E88E5 100%)";
const GRAD_GO = "linear-gradient(90deg,#A855F7 0%,#E91E63 100%)";
const FONT = "'Inter', system-ui, sans-serif";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = { fontVariantNumeric: "tabular-nums" as const };
const GRID_COLS = "32px 2fr 1.4fr 1fr 1fr 60px";

function fmtCent(v: number): string {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(v: number): string {
  return "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function periodoLabel(mesAno: string): string {
  const [mm, yy] = (mesAno || "").split("/");
  const idx = parseInt(mm, 10) - 1;
  return `${MESES[idx] || ""} ${yy || ""}`.trim();
}

// ── Meta da equipe ────────────────────────────────────────────────────────────
function MetaCard({ e, periodo, t }: { e: GestorDashboardData["equipe"]; periodo: string; t: Palette }) {
  const pctMeta = e.meta > 0 ? Math.round((e.efetivado / e.meta) * 100) : 0;
  const faltam = Math.max(0, e.meta - e.efetivado);
  const somaProd = e.novo + e.portabilidade + e.cartao;
  const share = (v: number) => (somaProd > 0 ? Math.round((v / somaProd) * 100) : 0);
  const produtos = [
    { nome: "Contrato novo", valor: e.novo, cor: PURPLE },
    { nome: "Portabilidade", valor: e.portabilidade, cor: BLUE },
    { nome: "Cartão", valor: e.cartao, cor: GRAY },
  ];
  const up = e.deltaPercentual >= 0;

  const kpiLabel = { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: t.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 } as const;
  const kpiValue = { fontSize: 30, fontWeight: 700, color: t.textStrong } as const;
  const kpiHelper = { fontSize: 13, color: t.textMuted, marginTop: 4 } as const;
  const progressLabel = { fontSize: 13, fontWeight: 600, color: t.textBody } as const;

  return (
    <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Target size={22} color={PURPLE} />
          <span style={{ fontSize: 17, fontWeight: 700, color: t.textStrong }}>Meta da equipe</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, border: `1px solid ${t.borderStrong}`, fontSize: 13.5, fontWeight: 600, color: t.textBody }}>
          <CalendarDays size={16} />{periodo}
        </span>
      </div>

      <div style={{ display: "flex", gap: 48, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={kpiLabel}><CheckCircle2 size={14} /> EFETIVADO NO MÊS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ ...kpiValue, ...num }}>{fmtCent(e.efetivado)}</div>
            {e.deltaPercentual !== 0 && (
              <div style={{ fontSize: 14, fontWeight: 700, color: up ? GREEN : DANGER }}>
                {up ? "↗" : "↘"} {Math.abs(e.deltaPercentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </div>
            )}
          </div>
          <div style={kpiHelper}>Meta do mês: {fmtCent(e.meta)}</div>
        </div>
        <div>
          <div style={kpiLabel}><Clock size={14} /> EM ANDAMENTO</div>
          <div style={{ ...kpiValue, color: AMBER, ...num }}>{fmtCent(e.emAndamento)}</div>
          <div style={kpiHelper}>{e.propostasEmAberto} propostas em aberto, aguardando efetivação</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={progressLabel}>{pctMeta}% da meta atingida</span>
          <span style={progressLabel}>faltam {fmtCent(faltam)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: t.trackBg, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(pctMeta, 100)}%`, borderRadius: 999, background: GRAD_CTA }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {produtos.map((p) => (
          <div key={p.nome} style={{ background: t.subtleBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: t.textBody }}>{p.nome}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: p.cor }}>{share(p.valor)}%</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.textStrong, marginBottom: 10, ...num }}>{fmtInt(p.valor)}</div>
            <div style={{ height: 6, borderRadius: 999, background: t.trackBg, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${share(p.valor)}%`, borderRadius: 999, background: p.cor }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Ranking dos corretores ────────────────────────────────────────────────────
function RankingRow({ v, t }: { v: VendedorRanking; t: Palette }) {
  const pct = v.percentual || 0;
  const isFirst = v.posicao === 1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center", gap: 16, padding: "14px 4px", borderTop: `1px solid ${t.border}` }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, background: isFirst ? "#FEF6E0" : t.subtleBg, color: isFirst ? "#9a6a00" : t.textMuted }}>{v.posicao}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: GRAD_GO, color: "#fff", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{getInitials(v.nome)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.textStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.nome}</div>
          <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Novo {fmtInt(v.novo)} · Port. {fmtInt(v.portabilidade)} · Cartão {fmtInt(v.cartao)}</div>
        </div>
      </div>
      <div>
        <div style={{ height: 5, borderRadius: 999, background: t.trackBg, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 999, background: pct > 0 ? GREEN : t.trackBg }} />
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{pct}% de {fmtInt(v.meta)}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: AMBER, textAlign: "right", ...num }}>{fmtInt(v.emAndamento)}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.textStrong, textAlign: "right", ...num }}>{fmtInt(v.efetivado)}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: t.textBody, textAlign: "right" }}>{v.contratos}</div>
    </div>
  );
}

function RankingCard({ data, t }: { data: GestorDashboardData; t: Palette }) {
  const legenda = data.statusEmAndamento?.length
    ? `Em aberto conta propostas em ${data.statusEmAndamento.join(", ")}, ainda não efetivadas.`
    : "Em aberto conta propostas em Aguardando envio CIP, Aguardando retorno CIP, Em Andamento, ainda não efetivadas.";
  const headBase = { fontSize: 11.5, fontWeight: 700 as const, letterSpacing: "0.04em", color: t.textMuted };

  return (
    <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Trophy size={22} color={PURPLE} />
          <span style={{ fontSize: 17, fontWeight: 700, color: t.textStrong }}>Ranking dos corretores</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 999, background: t.badgeBrandBg, color: t.badgeBrandText, fontSize: 12.5, fontWeight: 600 }}>{data.ranking.length} corretores</span>
      </div>

      <div style={{ fontSize: 12.5, color: t.textMuted, background: t.subtleBg, borderRadius: 8, padding: "10px 14px", margin: "10px 0 8px", display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{legenda}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: 16, padding: "10px 4px 8px" }}>
            <div style={headBase}>#</div>
            <div style={headBase}>CORRETOR</div>
            <div style={headBase}>% DA META</div>
            <div style={{ ...headBase, textAlign: "right" }}>EM ABERTO</div>
            <div style={{ ...headBase, textAlign: "right" }}>EFETIVADO</div>
            <div style={{ ...headBase, textAlign: "right" }}>CTTS</div>
          </div>
          {data.ranking.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 14, borderTop: `1px solid ${t.border}` }}>Nenhum contrato efetivado neste período.</div>
          ) : (
            data.ranking.map((v) => <RankingRow key={v.userId} v={v} t={t} />)
          )}
        </div>
      </div>
    </section>
  );
}

function GestorDashboard() {
  const { theme } = useTheme();
  const t = PALETTE[theme === "dark" ? "dark" : "light"];
  const { data, isLoading, error } = useQuery<GestorDashboardData>({
    queryKey: ["/api/dashboard-gestor"],
    retry: 3,
    retryDelay: 1000,
  });

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><Loader2 className="h-8 w-8 animate-spin" color={PURPLE} /></div>;
  }
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 64, fontFamily: FONT }}>
        <div style={{ color: DANGER, fontWeight: 600 }}>Erro ao carregar dashboard</div>
        <div style={{ fontSize: 14, color: t.textMuted, marginTop: 4 }}>{error instanceof Error ? error.message : "Erro desconhecido"}</div>
      </div>
    );
  }
  if (!data) return null;

  const periodo = periodoLabel(data.mesAno);

  return (
    <div style={{ padding: "28px 32px 60px", background: t.page, minHeight: "100%", display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT, color: t.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <MetaCard e={data.equipe} periodo={periodo} t={t} />
      <RankingCard data={data} t={t} />
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <GestorDashboard />;
}
