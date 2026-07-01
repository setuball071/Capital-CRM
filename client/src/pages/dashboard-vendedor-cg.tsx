import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { Target, Clock, TrendingUp, TrendingDown, CalendarDays, Trophy, Gauge, Zap, Info, Loader2 } from "lucide-react";

// ── Tokens Capital Go ─────────────────────────────────────────────────────────
const CG = {
  purple: "#6C2BD9", purpleDark: "#4B1FA6", blue: "#1E88E5", pink: "#E91E63", green: "#00C853",
  warning: "#F9A825", black: "#121212", gray800: "#333333", gray400: "#9CA3AF", gray200: "#E5E7EB",
  gray100: "#F3F4F6", border: "#E5E7EB", muted: "#6B7280", purpleSoft: "#F2EBFC", lilas: "#C9B8F0",
};
const GRAD_CTA = "linear-gradient(90deg,#6C2BD9 0%,#1E88E5 100%)";
const GRAD_GO = "linear-gradient(90deg,#A855F7 0%,#E91E63 100%)";
const SHADOW = "0 1px 2px rgba(16,24,40,.06)";
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

function ChartTooltip({ active, payload, label, mesNome }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DiaRitmo;
  return (
    <div style={{ background: "#fff", border: `1px solid ${CG.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: FONT, boxShadow: SHADOW }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: CG.black, marginBottom: 4 }}>{label} de {mesNome}</div>
      <div style={{ fontSize: 11.5, color: CG.purple }}>Produzido: {fmtInt(d.valor)}</div>
      <div style={{ fontSize: 11.5, color: CG.gray400 }}>Meta do dia: {fmtInt(d.metaDoDia)}</div>
      <div style={{ fontSize: 11.5, color: CG.pink }}>Excedente: {d.excedente > 0 ? fmtInt(d.excedente) : "—"}</div>
    </div>
  );
}

function VendedorDashboard() {
  const { data, isLoading, error } = useQuery<VendData>({
    queryKey: ["/api/dashboard-vendedor"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><Loader2 className="h-8 w-8 animate-spin" color={CG.purple} /></div>;
  }
  if (error || !data) {
    return (
      <div style={{ textAlign: "center", padding: 64, fontFamily: FONT }}>
        <div style={{ color: CG.pink, fontWeight: 600 }}>Erro ao carregar o painel</div>
        <div style={{ fontSize: 14, color: CG.muted, marginTop: 4 }}>Tente recarregar a página</div>
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

  const produtos = [
    { nome: "Contrato novo", valor: data.totalNovo, cor: CG.purple },
    { nome: "Portabilidade", valor: data.totalPortabilidade, cor: CG.blue },
    { nome: "Cartão", valor: data.totalCartao, cor: CG.pink },
  ];

  const legenda = data.statusEmAndamento?.length
    ? `conta propostas com status: ${data.statusEmAndamento.join(", ")}.`
    : "conta propostas ainda não efetivadas.";

  return (
    <div style={{ background: "#E9EAEE", minHeight: "100%", fontFamily: FONT, color: CG.black }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: GRAD_GO, color: "#fff", fontWeight: 700, fontSize: 21 }}>{getInitials(data.vendedorNome)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: CG.black, textTransform: "uppercase", lineHeight: 1 }}>{data.vendedorNome}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.14em", color: CG.muted, textTransform: "uppercase" }}>Corretor · {mesNome} {yy}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {data.posicaoRankingGeral > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 16px", borderRadius: 999, background: "#FEF6E0", color: "#9a6a00", fontSize: 14, fontWeight: 700 }}>
                <Trophy size={18} />{data.posicaoRankingGeral}º no ranking
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 16px", borderRadius: 999, background: "#fff", border: `1px solid ${CG.border}`, color: CG.gray800, fontSize: 14, fontWeight: 600 }}>
              <CalendarDays size={18} color={CG.muted} />{mesNome} {yy}
            </span>
          </div>
        </div>

        {/* MINHA META */}
        <div style={{ background: "#fff", border: `1px solid ${CG.border}`, borderRadius: 16, boxShadow: SHADOW, overflow: "hidden" }}>
          <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Target size={20} color={CG.purple} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: CG.purple }}>MINHA META · {mesNome.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 13, color: CG.muted }}>Fechamento em <b style={{ color: CG.gray800 }}>{data.diasUteisRestantes} dias úteis</b></span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 32, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: CG.muted }}>EFETIVADO NO MÊS</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: CG.black, letterSpacing: "-0.02em", ...num }}>{fmtCent(efetivado)}</span>
                  {data.deltaPercentual !== 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 14, fontWeight: 700, color: up ? CG.green : CG.pink }}>
                      {up ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      {Math.abs(data.deltaPercentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 14, color: CG.muted }}>Meta do mês: <b style={{ color: CG.gray800, ...num }}>{fmtCent(meta)}</b></span>
              </div>
              <div style={{ width: 1, height: 64, background: CG.border }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: CG.warning }}>
                  <Clock size={16} />EM ANDAMENTO
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 38, fontWeight: 700, color: CG.warning, letterSpacing: "-0.02em", ...num }}>{fmtCent(data.emAndamento)}</span>
                  <span style={{ fontSize: 14, color: CG.muted, fontWeight: 600 }}>{data.emAndamentoContratos} propostas</span>
                </div>
                <span style={{ fontSize: 14, color: CG.muted }}>em aberto, aguardando efetivação</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: CG.gray800 }}><b style={{ color: CG.purple, fontSize: 16 }}>{pctMeta}%</b> da meta atingida</span>
                <span style={{ fontSize: 14, color: CG.muted }}>faltam <b style={{ color: CG.gray800, ...num }}>{fmtCent(falta)}</b></span>
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

            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: CG.muted, borderTop: `1px solid ${CG.border}`, paddingTop: 16 }}>
              <Info size={16} />
              <span><b style={{ color: CG.gray800 }}>Em andamento</b> {legenda}</span>
            </div>
          </div>
        </div>

        {/* RITMO DE DESEMPENHO */}
        <div style={{ background: "#fff", border: `1px solid ${CG.border}`, borderRadius: 16, boxShadow: SHADOW, padding: "26px 30px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Gauge size={24} color={CG.purple} />
                <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em", color: CG.black, textTransform: "uppercase" }}>Ritmo de desempenho</span>
              </div>
              <span style={{ fontSize: 13.5, color: CG.muted, paddingLeft: 34 }}>Produção diária × meta do dia recalculada para bater a meta do mês.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 14px", border: `1px solid ${CG.border}`, borderRadius: 999 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: CG.gray800 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CG.purple }} />Produzido</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: CG.gray800 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: CG.lilas }} />Meta do dia</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: CG.gray800 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CG.pink }} />Excedente</span>
            </div>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.contratosPorDia} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#EDEDF2" vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={(props: any) => {
                  const isHoje = props.payload?.value === hojeDia;
                  return <text x={props.x} y={props.y + 12} textAnchor="middle" fontSize={11} fontWeight={isHoje ? 700 : 400} fill={isHoje ? CG.purple : CG.gray400} fontFamily="Inter, sans-serif">{props.payload?.value}</text>;
                }} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip mesNome={mesNome} />} cursor={{ fill: "#F6F2FE" }} />
                {hoje && <ReferenceLine x={hojeDia} stroke="#E3D9FB" strokeWidth={22} />}
                <Bar dataKey="preenchimento" stackId="a" fill={CG.purple} radius={[0, 0, 0, 0]} barSize={22} isAnimationActive={false}>
                  {data.contratosPorDia.map((_, i) => <Cell key={i} fill={CG.purple} />)}
                </Bar>
                <Bar dataKey="excedente" stackId="a" fill={CG.pink} radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false} />
                <Line dataKey="metaDoDia" stroke={CG.lilas} strokeWidth={2.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: `1px solid ${CG.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: CG.muted, textTransform: "uppercase" }}>Quanto falta pra meta</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: CG.black, ...num }}>{fmtCent(falta)}</span>
              <span style={{ fontSize: 12.5, color: CG.muted }}>em {data.diasUteisRestantes} dias úteis restantes</span>
            </div>
            <div style={{ border: `1px solid ${CG.purple}`, background: CG.purpleSoft, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: CG.purple, textTransform: "uppercase" }}><Zap size={17} />Meta de hoje</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: CG.purple, ...num }}>{fmtCent(metaHoje)}</span>
              <span style={{ fontSize: 12.5, color: CG.purpleDark }}>produzido hoje: {fmtInt(produzidoHoje)} · faltam {fmtInt(faltaHoje)}</span>
            </div>
          </div>
        </div>
      </div>
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
