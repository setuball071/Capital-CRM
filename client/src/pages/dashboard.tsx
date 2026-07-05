import { useQuery } from "@tanstack/react-query";
import { Target, Clock, TrendingUp, TrendingDown, CalendarDays, Trophy, Users, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

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

// ── Tokens de marca (Capital Go) ──────────────────────────────────────────────
const CG = {
  purple: "#6C2BD9", blue: "#1E88E5", pink: "#E91E63", green: "#00C853", greenText: "#0A7A3B",
  warning: "#F9A825", black: "#121212", gray800: "#333333", gray500: "#6B7280", gray400: "#9CA3AF",
  gray200: "#E5E7EB", gray100: "#F3F4F6", gray50: "#F9FAFB", border: "#E5E7EB", muted: "#6B7280",
  purpleSoft: "#F2EBFC",
};
const GRAD_CTA = "linear-gradient(90deg,#6C2BD9 0%,#1E88E5 100%)";
const GRAD_GO = "linear-gradient(90deg,#A855F7 0%,#E91E63 100%)";
const SHADOW = "0 1px 2px rgba(16,24,40,.06)";
const FONT = "'Inter', system-ui, sans-serif";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = { fontVariantNumeric: "tabular-nums" as const };

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

function MetaCard({ e, periodo }: { e: GestorDashboardData["equipe"]; periodo: string }) {
  const pctMeta = e.meta > 0 ? Math.round((e.efetivado / e.meta) * 100) : 0;
  const faltam = Math.max(0, e.meta - e.efetivado);
  const somaProd = e.novo + e.portabilidade + e.cartao;
  const share = (v: number) => (somaProd > 0 ? Math.round((v / somaProd) * 100) : 0);
  const produtos = [
    { nome: "Contrato novo", valor: e.novo, cor: CG.purple },
    { nome: "Portabilidade", valor: e.portabilidade, cor: CG.blue },
    { nome: "Cartão", valor: e.cartao, cor: CG.pink },
  ];
  const up = e.deltaPercentual >= 0;

  return (
    <div style={{ background: "#fff", border: `1px solid ${CG.border}`, borderRadius: 16, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={20} color={CG.purple} />
            <span style={{ fontSize: 17, fontWeight: 700, color: CG.black }}>Meta da equipe</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 999, background: CG.gray100, color: CG.gray800, fontSize: 13, fontWeight: 600 }}>
            <CalendarDays size={16} color={CG.muted} />{periodo}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 32, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: CG.muted }}>EFETIVADO NO MÊS</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: CG.black, letterSpacing: "-0.02em", ...num }}>{fmtCent(e.efetivado)}</span>
              {e.deltaPercentual !== 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 14, fontWeight: 700, color: up ? CG.green : CG.pink }}>
                  {up ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {Math.abs(e.deltaPercentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
            <span style={{ fontSize: 14, color: CG.muted }}>Meta do mês: <b style={{ color: CG.gray800, ...num }}>{fmtCent(e.meta)}</b></span>
          </div>
          <div style={{ width: 1, height: 64, background: CG.border }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: CG.warning }}>
              <Clock size={16} />EM ANDAMENTO
            </span>
            <span style={{ fontSize: 38, fontWeight: 700, color: CG.warning, letterSpacing: "-0.02em", ...num }}>{fmtCent(e.emAndamento)}</span>
            <span style={{ fontSize: 14, color: CG.muted }}>{e.propostasEmAberto} propostas em aberto, aguardando efetivação</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: CG.gray800 }}><b style={{ color: CG.purple, fontSize: 16 }}>{pctMeta}%</b> da meta atingida</span>
            <span style={{ fontSize: 14, color: CG.muted }}>faltam <b style={{ color: CG.gray800, ...num }}>{fmtCent(faltam)}</b></span>
          </div>
          <div style={{ position: "relative", height: 16, borderRadius: 999, background: CG.gray200, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${Math.min(pctMeta, 100)}%`, borderRadius: 999, background: GRAD_CTA }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {produtos.map((p) => (
            <div key={p.nome} style={{ border: `1px solid ${CG.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: CG.gray800 }}>{p.nome}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.cor }}>{share(p.valor)}%</span>
              </div>
              <span style={{ fontSize: 21, fontWeight: 700, color: CG.black, ...num }}>{fmtInt(p.valor)}</span>
              <div style={{ height: 6, borderRadius: 999, background: CG.gray100 }}>
                <div style={{ width: `${share(p.valor)}%`, height: "100%", borderRadius: 999, background: p.cor }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function medalStyle(pos: number): { bg: string; color: string } | null {
  if (pos === 1) return { bg: "#F4C64A", color: "#6B4E00" };
  if (pos === 2) return { bg: "#CBD1D8", color: "#3B4252" };
  if (pos === 3) return { bg: "#E6B486", color: "#6B3B14" };
  return null;
}

function RankingRow({ v }: { v: VendedorRanking }) {
  const top3 = v.posicao <= 3;
  const medal = medalStyle(v.posicao);
  const pct = v.percentual || 0;
  const rowBg = v.posicao === 1 ? "linear-gradient(100deg, #FEF8E7 0%, #fff 40%)" : "#fff";
  const barFill = top3 ? CG.green : CG.purple;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 30px", borderBottom: `1px solid ${CG.border}`, background: rowBg }}>
      <span style={{ width: 34, display: "flex", justifyContent: "center" }}>
        {medal ? (
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: medal.bg, color: medal.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{v.posicao}</span>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 15, color: CG.gray400 }}>{v.posicao}</span>
        )}
      </span>
      <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: GRAD_GO, color: "#fff", fontWeight: 600, fontSize: 15, flexShrink: 0 }}>
        {getInitials(v.nome)}
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 15.5, fontWeight: top3 ? 700 : 600, color: CG.black }}>{v.nome}</div>
        <div style={{ fontSize: 12, color: CG.muted }}>Novo {fmtInt(v.novo)} · Port. {fmtInt(v.portabilidade)} · Cartão {fmtInt(v.cartao)}</div>
      </div>
      <div style={{ width: 210, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ height: 8, borderRadius: 999, background: CG.gray100 }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 999, background: barFill }} />
        </div>
        <span style={{ fontSize: 12, color: CG.muted }}>
          <b style={{ color: top3 ? CG.greenText : CG.gray800 }}>{pct}%</b> de {fmtInt(v.meta)}
        </span>
      </div>
      <span style={{ width: 128, textAlign: "right", fontSize: 14, color: CG.warning, fontWeight: 600, ...num }}>{fmtInt(v.emAndamento)}</span>
      <span style={{ width: 140, textAlign: "right", fontWeight: 700, fontSize: 18, color: top3 ? CG.black : CG.gray800, ...num }}>{fmtInt(v.efetivado)}</span>
      <span style={{ width: 46, textAlign: "right", fontSize: 14, fontWeight: 600, color: CG.gray800 }}>{v.contratos}</span>
    </div>
  );
}

function ColHead() {
  const base = { fontSize: 11.5, fontWeight: 700 as const, letterSpacing: "0.05em", color: CG.muted };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 30px", borderBottom: `1px solid ${CG.border}` }}>
      <span style={{ width: 34, textAlign: "center", ...base }}>#</span>
      <span style={{ width: 44 }} />
      <span style={{ flex: 1, minWidth: 160, ...base }}>CORRETOR</span>
      <span style={{ width: 210, ...base }}>% DA META</span>
      <span style={{ width: 128, textAlign: "right", ...base }}>EM ABERTO</span>
      <span style={{ width: 140, textAlign: "right", ...base }}>EFETIVADO</span>
      <span style={{ width: 46, textAlign: "right", ...base }}>CTTS</span>
    </div>
  );
}

function GestorDashboard() {
  const { data, isLoading, error } = useQuery<GestorDashboardData>({
    queryKey: ["/api/dashboard-gestor"],
    retry: 3,
    retryDelay: 1000,
  });

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><Loader2 className="h-8 w-8 animate-spin" color={CG.purple} /></div>;
  }
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 64, fontFamily: FONT }}>
        <div style={{ color: CG.pink, fontWeight: 600 }}>Erro ao carregar dashboard</div>
        <div style={{ fontSize: 14, color: CG.muted, marginTop: 4 }}>{error instanceof Error ? error.message : "Erro desconhecido"}</div>
      </div>
    );
  }
  if (!data) return null;

  const periodo = periodoLabel(data.mesAno);
  const legenda = data.statusEmAndamento?.length
    ? `conta propostas em ${data.statusEmAndamento.join(", ")}, ainda não efetivadas.`
    : "conta propostas em andamento, ainda não efetivadas.";

  return (
    <div style={{ padding: 24, background: CG.gray100, minHeight: "100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24, fontFamily: FONT, color: CG.black }}>
        <MetaCard e={data.equipe} periodo={periodo} />

        <div style={{ background: "#fff", border: `1px solid ${CG.border}`, borderRadius: 16, boxShadow: SHADOW, overflow: "hidden" }}>
          <div style={{ padding: "22px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${CG.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Trophy size={24} color={CG.purple} />
              <span style={{ fontSize: 19, fontWeight: 700, color: CG.black }}>Ranking dos corretores</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999, background: CG.purpleSoft, color: CG.purple, fontSize: 13, fontWeight: 600 }}>
              <Users size={16} />{data.ranking.length} corretores
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: CG.muted, padding: "12px 30px", background: CG.gray50, borderBottom: `1px solid ${CG.border}` }}>
            <Info size={16} />
            <span><b style={{ color: CG.gray800 }}>Em aberto</b> {legenda}</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 900 }}>
              <ColHead />
              {data.ranking.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: CG.muted, fontSize: 14 }}>Nenhum contrato efetivado neste período.</div>
              ) : (
                data.ranking.map((v) => <RankingRow key={v.userId} v={v} />)
              )}
            </div>
          </div>
        </div>
      </div>
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
