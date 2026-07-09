import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { Target, Clock, CheckCircle2, CalendarDays, Trophy, Gauge, Zap, Info, Loader2 } from "lucide-react";

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
    chartGrid: "#EDEDF2",
    chartCursor: "#F6F2FE",
    chartHoje: "#E3D9FB",
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
    chartGrid: "rgba(255,255,255,0.08)",
    chartCursor: "rgba(108,43,217,0.12)",
    chartHoje: "rgba(108,43,217,0.25)",
  },
};
type Palette = typeof PALETTE.light;

const PURPLE = "#6C2BD9";
const BLUE = "#1E88E5";
const GRAY = "#9CA3AF";
const GREEN = "#00C853";
const AMBER = "#F9A825";
const DANGER = "#E53935";
const PINK = "#E91E63";
const LILAS = "#C9B8F0";
const GRAD_CTA = "linear-gradient(90deg,#6C2BD9 0%,#1E88E5 100%)";
const GRAD_GO = "linear-gradient(90deg,#A855F7 0%,#E91E63 100%)";
const FONT = "'Inter', system-ui, sans-serif";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const num = { fontVariantNumeric: "tabular-nums" as const };

interface DiaRitmo { dia: string; valor: number; metaDoDia: number; preenchimento: number; excedente: number; }
interface VendData {
  vendedorNome: string;
  mesAno: string;
  posicaoRankingGeral: number;
  diasUteisRestantes: number;
  totalValor: number;
  deltaPercentual: number;
  emAndamento: number;
  emAndamentoContratos: number;
  metaMensal: number;
  metaCartao: number;
  metaUnificada: number;
  totalNovo: number;
  totalPortabilidade: number;
  totalCartao: number;
  saldoDevedor: number;
  metaDiariaAjustada: number;
  statusEmAndamento: string[];
  contratosPorDia: DiaRitmo[];
}

const fmtCent = (v: number) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
function getInitials(name: string) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function ChartTooltip({ active, payload, label, mesNome, t }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DiaRitmo;
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: FONT }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textStrong, marginBottom: 4 }}>{label} de {mesNome}</div>
      <div style={{ fontSize: 11.5, color: PURPLE }}>Produzido: {fmtInt(d.valor)}</div>
      <div style={{ fontSize: 11.5, color: t.textMuted }}>Meta do dia: {fmtInt(d.metaDoDia)}</div>
      <div style={{ fontSize: 11.5, color: PINK }}>Excedente: {d.excedente > 0 ? fmtInt(d.excedente) : "—"}</div>
    </div>
  );
}

function VendedorDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const t: Palette = PALETTE[theme === "dark" ? "dark" : "light"];
  const { data, isLoading, error } = useQuery<VendData>({
    queryKey: ["/api/dashboard-vendedor"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><Loader2 className="h-8 w-8 animate-spin" color={PURPLE} /></div>;
  }
  if (error || !data) {
    return (
      <div style={{ textAlign: "center", padding: 64, fontFamily: FONT }}>
        <div style={{ color: DANGER, fontWeight: 600 }}>Erro ao carregar o painel</div>
        <div style={{ fontSize: 14, color: t.textMuted, marginTop: 4 }}>Tente recarregar a página</div>
      </div>
    );
  }

  const [mm, yy] = (data.mesAno || "").split("/");
  const mesNome = MESES[parseInt(mm, 10) - 1] || "";
  const efetivado = data.totalValor || 0;
  const meta = data.metaUnificada || (data.metaMensal || 0) + (data.metaCartao || 0);
  const pctMeta = meta > 0 ? Math.round((efetivado / meta) * 100) : 0;
  const falta = Math.max(0, data.saldoDevedor ?? meta - efetivado);
  const somaProd = data.totalNovo + data.totalPortabilidade + data.totalCartao;
  const share = (v: number) => (somaProd > 0 ? Math.round((v / somaProd) * 100) : 0);
  const up = (data.deltaPercentual || 0) >= 0;

  const hojeDia = String(new Date().getDate()).padStart(2, "0");
  const hoje = (data.contratosPorDia || []).find((d) => d.dia === hojeDia);
  const produzidoHoje = hoje?.valor || 0;
  const metaHoje = data.metaDiariaAjustada || 0;
  const faltaHoje = Math.max(0, metaHoje - produzidoHoje);

  // Cores dos produtos conforme o design: roxo / azul / CINZA
  const produtos = [
    { nome: "Contrato novo", valor: data.totalNovo, cor: PURPLE },
    { nome: "Portabilidade", valor: data.totalPortabilidade, cor: BLUE },
    { nome: "Cartão", valor: data.totalCartao, cor: GRAY },
  ];

  const legenda = data.statusEmAndamento?.length
    ? `Em andamento conta propostas com status: ${data.statusEmAndamento.join(", ")}, ainda não efetivadas.`
    : "Em andamento conta propostas ainda não efetivadas.";

  const kpiLabel = { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: t.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 } as const;
  const kpiValue = { fontSize: 30, fontWeight: 700, color: t.textStrong } as const;
  const kpiHelper = { fontSize: 13, color: t.textMuted, marginTop: 4 } as const;
  const progressLabel = { fontSize: 13, fontWeight: 600, color: t.textBody } as const;
  const sectionTitle = { fontSize: 17, fontWeight: 700, color: t.textStrong } as const;

  return (
    <div style={{ padding: "28px 32px 60px", background: t.page, minHeight: "100%", display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT, color: t.textStrong }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

      {/* Identidade */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {(user as any)?.avatarUrl ? (
            <img src={(user as any).avatarUrl} alt={data.vendedorNome} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: GRAD_GO, color: "#fff", fontWeight: 600, fontSize: 16 }}>{getInitials(data.vendedorNome)}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.textStrong }}>{data.vendedorNome}</div>
            <div style={{ fontSize: 12.5, color: t.textMuted }}>Corretor · {mesNome} {yy}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {data.posicaoRankingGeral > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, background: "#FEF6E0", color: "#9a6a00", fontSize: 13.5, fontWeight: 700 }}>
              <Trophy size={16} />{data.posicaoRankingGeral}º no ranking
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, border: `1px solid ${t.borderStrong}`, fontSize: 13.5, fontWeight: 600, color: t.textBody }}>
            <CalendarDays size={16} />{mesNome} {yy}
          </span>
        </div>
      </div>

      {/* Minha meta */}
      <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={22} color={PURPLE} />
            <span style={sectionTitle}>Minha meta</span>
          </div>
          <span style={{ fontSize: 13, color: t.textMuted }}>Fechamento em <b style={{ color: t.textBody }}>{data.diasUteisRestantes} dias úteis</b></span>
        </div>

        <div style={{ display: "flex", gap: 48, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={kpiLabel}><CheckCircle2 size={14} /> EFETIVADO NO MÊS</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ ...kpiValue, fontSize: 38, letterSpacing: "-0.02em", ...num }}>{fmtCent(efetivado)}</div>
              {data.deltaPercentual !== 0 && (
                <div style={{ fontSize: 14, fontWeight: 700, color: up ? GREEN : DANGER }}>
                  {up ? "↗" : "↘"} {Math.abs(data.deltaPercentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </div>
              )}
            </div>
            <div style={kpiHelper}>Meta do mês: {fmtCent(meta)}</div>
          </div>
          <div>
            <div style={kpiLabel}><Clock size={14} /> EM ANDAMENTO</div>
            <div style={{ ...kpiValue, fontSize: 26, color: AMBER, ...num }}>{fmtCent(data.emAndamento)}</div>
            <div style={kpiHelper}>{data.emAndamentoContratos} propostas em aberto, aguardando efetivação</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={progressLabel}>{pctMeta}% da meta atingida</span>
            <span style={progressLabel}>faltam {fmtCent(falta)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: t.trackBg, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pctMeta, 100)}%`, borderRadius: 999, background: GRAD_CTA }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
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

        <div style={{ fontSize: 12.5, color: t.textMuted, background: t.subtleBg, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 6 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{legenda}</span>
        </div>
      </section>

      {/* Ritmo de desempenho */}
      <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Gauge size={22} color={PURPLE} />
              <span style={sectionTitle}>Ritmo de desempenho</span>
            </div>
            <span style={{ fontSize: 13, color: t.textMuted, paddingLeft: 32 }}>Produção diária × meta do dia recalculada para bater a meta do mês.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 14px", border: `1px solid ${t.border}`, borderRadius: 999 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: t.textBody }}><span style={{ width: 10, height: 10, borderRadius: 3, background: PURPLE }} />Produzido</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: t.textBody }}><span style={{ width: 14, height: 3, borderRadius: 2, background: LILAS }} />Meta do dia</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: t.textBody }}><span style={{ width: 10, height: 10, borderRadius: 3, background: PINK }} />Excedente</span>
          </div>
        </div>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.contratosPorDia} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={t.chartGrid} vertical={false} />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={(props: any) => {
                const isHoje = props.payload?.value === hojeDia;
                return <text x={props.x} y={props.y + 12} textAnchor="middle" fontSize={11} fontWeight={isHoje ? 700 : 400} fill={isHoje ? PURPLE : t.textMuted} fontFamily="Inter, sans-serif">{props.payload?.value}</text>;
              }} />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip content={<ChartTooltip mesNome={mesNome} t={t} />} cursor={{ fill: t.chartCursor }} />
              {hoje && <ReferenceLine x={hojeDia} stroke={t.chartHoje} strokeWidth={22} />}
              <Bar dataKey="preenchimento" stackId="a" fill={PURPLE} radius={[0, 0, 0, 0]} barSize={22} isAnimationActive={false}>
                {data.contratosPorDia.map((_, i) => <Cell key={i} fill={PURPLE} />)}
              </Bar>
              <Bar dataKey="excedente" stackId="a" fill={PINK} radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false} />
              <Line dataKey="metaDoDia" stroke={LILAS} strokeWidth={2.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ background: t.subtleBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: t.textMuted, textTransform: "uppercase" }}>Quanto falta pra meta</span>
            <span style={{ fontSize: 30, fontWeight: 700, color: t.textStrong, ...num }}>{fmtCent(falta)}</span>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>em {data.diasUteisRestantes} dias úteis restantes</span>
          </div>
          <div style={{ background: t.badgeBrandBg, border: `1px solid ${PURPLE}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: t.badgeBrandText, textTransform: "uppercase" }}><Zap size={15} />Meta de hoje</span>
            <span style={{ fontSize: 30, fontWeight: 700, color: t.badgeBrandText, ...num }}>{fmtCent(metaHoje)}</span>
            <span style={{ fontSize: 12.5, color: t.badgeBrandText }}>produzido hoje: {fmtInt(produzidoHoje)} · faltam {fmtInt(faltaHoje)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DashboardVendedorPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  if (isAuthLoading || !user) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  return <VendedorDashboard />;
}
