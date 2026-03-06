import { useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";

interface SimState {
  contrato: number;
  taxa: number;
  coef: number;
  comIof: number;
  saldo: number;
  margem: number;
  prazo: number;
  antecipa: number;
  cliente: number;
}

interface AmortCol {
  prazo: number;
  vp: number;
}

interface FluxoLine {
  prazosStr: string;
  amortsCols: AmortCol[];
  amortTotal: number;
  totalMes: number;
  parcela: number;
}

interface CronogramaState {
  fluxo: FluxoLine[];
  s: SimState;
  meses: number;
  side: "left" | "right";
  totalPago: number;
  parcMedia: number;
  taxaImpl: number;
}

interface PrazoCard {
  meses: number;
  parcMedia: number;
  taxaImpl: number;
  fluxo: FluxoLine[];
  totalPago: number;
}

const PRAZOS = [10, 12, 15, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 140];

const fmtR = (v: number) =>
  "R$ " +
  (+v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtN = (v: number, d = 2) => (+v || 0).toFixed(d);

function coefPrice(taxa_am_perc: number, n: number): number {
  const i = taxa_am_perc / 100;
  if (i === 0) return 1 / n;
  const f = Math.pow(1 + i, n);
  return (i * f) / (f - 1);
}

function taxaDeCoef(coef: number, n: number): number {
  let t = Math.max(1e-7, coef - 1 / n);
  for (let k = 0; k < 600; k++) {
    const f = Math.pow(1 + t, n);
    const fn = (t * f) / (f - 1) - coef;
    const df = (f * (1 - Math.pow(1 + t, -n) * (1 + t * n))) / (t * (f - 1));
    const nt = t - fn / (df || 1e-12);
    if (Math.abs(nt - t) < 1e-12) {
      t = nt;
      break;
    }
    t = Math.max(1e-7, nt);
  }
  return t * 100;
}

function gerarFluxo(s: SimState, meses: number): FluxoLine[] {
  const taxa = s.taxa / 100;
  const n = s.prazo;
  const parcela = s.margem;
  const trasDisp = n - meses;
  const extrasBase = Math.floor(trasDisp / meses);
  const extrasRest = trasDisp % meses;
  let frente = 0,
    tras = n - 1;
  const linhas: FluxoLine[] = [];
  for (let mes = 0; mes < meses; mes++) {
    if (frente > tras) break;
    const extras = extrasBase + (mes < extrasRest ? 1 : 0);
    const prazosDoMes: number[] = [];
    const amortsCols: AmortCol[] = [];
    let totalMes = parcela;
    prazosDoMes.push(frente + 1);
    frente++;
    for (let e = 0; e < extras; e++) {
      if (tras < frente - 1) break;
      const k = tras + 1;
      const vp = parcela / Math.pow(1 + taxa, k);
      prazosDoMes.push(k);
      amortsCols.push({ prazo: k, vp });
      totalMes += vp;
      tras--;
    }
    linhas.push({
      prazosStr: prazosDoMes.join(", "),
      amortsCols,
      amortTotal: amortsCols.reduce((a, x) => a + x.vp, 0),
      totalMes,
      parcela,
    });
  }
  return linhas;
}

function buildPrazoCards(s: SimState): PrazoCard[] {
  return PRAZOS.filter((p) => p <= s.prazo).map((meses) => {
    const comIofCard = meses < 24 ? s.contrato * 1.15 : s.comIof;
    const taxaCard = taxaDeCoef(s.margem / comIofCard, s.prazo);
    const sCard = { ...s, taxa: taxaCard, comIof: comIofCard };
    const fluxo = gerarFluxo(sCard, meses);
    const totalPago = fluxo.reduce((a, l) => a + l.totalMes, 0);
    const parcMedia = totalPago / meses;
    const taxaImpl = taxaDeCoef(parcMedia / comIofCard, meses);
    return { meses, parcMedia, taxaImpl, fluxo, totalPago };
  });
}

export default function SimuladorPortabilidadePage() {
  const { user } = useAuth();
  const { logoUrl } = useTenant();
  const [logoBase64, setLogoBase64] = useState<string>("");

  useEffect(() => {
    if (!logoUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL("image/png"));
      }
    };
    img.src = logoUrl;
  }, [logoUrl]);

  const [leftState, setLeftState] = useState<SimState | null>(null);
  const [rightState, setRightState] = useState<SimState | null>(null);
  const [leftCards, setLeftCards] = useState<PrazoCard[]>([]);
  const [rightCards, setRightCards] = useState<PrazoCard[]>([]);
  const [cronograma, setCronograma] = useState<CronogramaState | null>(null);
  const [selectedCard, setSelectedCard] = useState<{ side: string; meses: number } | null>(null);

  const lOrgaoRef = useRef<HTMLSelectElement>(null);
  const lPrazoRef = useRef<HTMLInputElement>(null);
  const lMargemRef = useRef<HTMLInputElement>(null);
  const lCoefRef = useRef<HTMLInputElement>(null);
  const lIofRef = useRef<HTMLInputElement>(null);

  const rOrgaoRef = useRef<HTMLSelectElement>(null);
  const rPrazoRef = useRef<HTMLInputElement>(null);
  const rContratoRef = useRef<HTMLInputElement>(null);
  const rTaxaRef = useRef<HTMLInputElement>(null);

  const tabelaRef = useRef<HTMLDivElement>(null);

  const calcLeft = useCallback(() => {
    const margem = parseFloat(lMargemRef.current?.value || "0") || 0;
    const coef = parseFloat(lCoefRef.current?.value || "0") || 0;
    const prazo = parseInt(lPrazoRef.current?.value || "96") || 96;
    const iofPerc = parseFloat(lIofRef.current?.value || "0") || 0;
    if (!margem || !coef || !prazo) {
      alert("Preencha Margem, Coeficiente e Prazo.");
      return;
    }
    const contrato = margem / coef;
    const comIof = contrato * (1 + iofPerc / 100);
    const coefReal = margem / comIof;
    const taxa = taxaDeCoef(coefReal, prazo);
    const saldo = comIof;
    const s: SimState = { contrato, taxa, coef, comIof, saldo, margem, prazo, antecipa: 0, cliente: 0 };
    setLeftState(s);
    setLeftCards(buildPrazoCards(s));
    if (rContratoRef.current) rContratoRef.current.value = comIof.toFixed(2);
    if (rPrazoRef.current) rPrazoRef.current.value = String(prazo);
  }, []);

  const calcRight = useCallback(() => {
    const contratoIof = parseFloat(rContratoRef.current?.value || "0") || 0;
    const taxa = parseFloat(rTaxaRef.current?.value || "0") || 0;
    const prazo = parseInt(rPrazoRef.current?.value || "96") || 96;
    if (!contratoIof) {
      alert("Calcule primeiro o Contrato Novo.");
      return;
    }
    if (!taxa) {
      alert("Informe a Taxa Final a.m.");
      return;
    }
    const coef = coefPrice(taxa, prazo);
    const parcela = contratoIof * coef;
    const s: SimState = {
      contrato: contratoIof, taxa, coef, comIof: contratoIof,
      saldo: contratoIof, margem: parcela, prazo, antecipa: 0, cliente: 0,
    };
    setRightState(s);
    setRightCards(buildPrazoCards(s));
  }, []);

  const selectPrazo = useCallback(
    (side: "left" | "right", card: PrazoCard) => {
      const s = side === "left" ? leftState : rightState;
      if (!s) return;
      setSelectedCard({ side, meses: card.meses });
      setCronograma({
        fluxo: card.fluxo,
        s,
        meses: card.meses,
        side,
        totalPago: card.totalPago,
        parcMedia: card.parcMedia,
        taxaImpl: card.taxaImpl,
      });
      setTimeout(() => tabelaRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    [leftState, rightState]
  );

  const exportarPDF = useCallback(() => {
    if (!cronograma) return;
    const { fluxo, s, meses, parcMedia, taxaImpl } = cronograma;
    const corretor = {
      nome: user?.name || "Corretor",
      email: user?.email || "",
      tel: "",
    };
    const hoje = new Date().toLocaleDateString("pt-BR");
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" alt="Logo" style="height:44px;width:auto;object-fit:contain;">`
      : `<div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">Proposta</div>`;
    const _html = `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"><title>Proposta de Amortização</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#fff}
    .header{display:flex;align-items:center;justify-content:space-between;padding:24px 40px 20px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header-left{display:flex;align-items:center;gap:14px}
    .header-left img{filter:brightness(0) invert(1)}
    .header-right{text-align:right}
    .header-tag{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);font-weight:600}
    .header-date{font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px}
    .corretor-bar{display:flex;align-items:center;gap:14px;padding:14px 40px;background:linear-gradient(90deg,#6C2BD9,#1E88E5);color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .avatar{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0;border:2px solid rgba(255,255,255,0.35)}
    .corretor-info{flex:1}
    .corretor-nome{font-size:14px;font-weight:700;letter-spacing:-0.2px}
    .corretor-contato{font-size:10px;color:rgba(255,255,255,0.8);margin-top:2px}
    .corpo{padding:20px 40px 0}
    .resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px}
    .resumo-item{padding:14px 16px;background:#f8fafc;border-right:1px solid #e2e8f0}
    .resumo-item:last-child{border-right:none}
    .resumo-item label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:5px;font-weight:600}
    .resumo-item .val{font-size:15px;font-weight:800;color:#1a1a2e}
    .resumo-item:first-child .val{color:#6C2BD9}
    .section-label{font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #6C2BD9;display:inline-block}
    table{width:100%;border-collapse:separate;border-spacing:0;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
    thead th{background:#1a1a2e;color:#fff;padding:10px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tbody td{padding:7px 12px;color:#475569;font-size:11px;border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even) td{background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tbody tr:last-child td{border-bottom:none}
    td.mes{color:#94a3b8;font-weight:600;font-size:10px}
    td.parcela{color:#1a1a2e;font-weight:500}
    td.prazos{color:#94a3b8;font-size:10px}
    td.total{color:#6C2BD9;font-weight:800;font-size:12px}
    .rodape{margin:18px 40px 24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;line-height:1.9;letter-spacing:0.1px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:0}}
  </style>
</head><body>
  <div class="header">
    <div class="header-left">${logoHtml}</div>
    <div class="header-right">
      <div class="header-tag">Proposta de Amortização</div>
      <div class="header-date">${hoje}</div>
    </div>
  </div>
  <div class="corretor-bar">
    <div class="avatar">${corretor.nome.charAt(0).toUpperCase()}</div>
    <div class="corretor-info">
      <div class="corretor-nome">${corretor.nome}</div>
      <div class="corretor-contato">${corretor.email}${corretor.tel ? " &middot; " + corretor.tel : ""}</div>
    </div>
  </div>
  <div class="corpo">
    <div class="resumo">
      <div class="resumo-item"><label>Valor do Contrato</label><div class="val">${fmtR(s.contrato)}</div></div>
      <div class="resumo-item"><label>Prazo Estratégia</label><div class="val">${meses} meses</div></div>
      <div class="resumo-item"><label>Parcela Média</label><div class="val">${fmtR(parcMedia)}</div></div>
      <div class="resumo-item"><label>Taxa Média a.m.</label><div class="val">${fmtN(taxaImpl, 2)}%</div></div>
    </div>
    <div class="section-label">Cronograma de Amortização — ${meses} meses</div>
    <table>
      <thead><tr><th>Mês</th><th>Parcela</th><th>Prazos Pagos</th><th>Amortização Total</th><th style="text-align:right">Total no Mês</th></tr></thead>
      <tbody>${fluxo
        .map(
          (l, i) =>
            `<tr><td class="mes">${String(i + 1).padStart(2, "0")}</td><td class="parcela">${fmtR(l.parcela)}</td><td class="prazos">${l.prazosStr}</td><td>${fmtR(l.amortTotal)}</td><td class="total" style="text-align:right">${fmtR(l.totalMes)}</td></tr>`
        )
        .join("")}</tbody>
    </table>
  </div>
  <div class="rodape">
    * Cálculos de amortização de parcela são diários e sofrem alteração.<br>
    * Proposta válida até ${hoje}, sujeita a alteração sem aviso prévio.<br>
    * A taxa de juros final e a redução do valor da parcela poderão sofrer oscilações a critério das instituições bancárias.
  </div>
  <script>setTimeout(()=>{window.print();},400);<\/script>
</body></html>`;
    const blob = new Blob([_html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  }, [cronograma, user, logoBase64]);

  return (
    <div className="sim-portabilidade-page overflow-auto h-full">
      <style>{`
        .sim-wrap * { box-sizing: border-box; }
        .sim-wrap { font-family: 'Inter', sans-serif; font-size: 14px; color: #121212; }
        .sim-wrap .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .sim-wrap .panel { padding: 24px 28px; background: #FFFFFF; border-right: 1px solid #E5E7EB; }
        .sim-wrap .panel:last-child { border-right: none; }
        .sim-wrap .panel-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6B7280; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
        .sim-wrap .sim-badge { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: .06em; }
        .sim-wrap .badge-left { background: rgba(108,43,217,.1); color: #6C2BD9; border: 1px solid rgba(108,43,217,.25); }
        .sim-wrap .badge-right { background: rgba(30,136,229,.1); color: #1E88E5; border: 1px solid rgba(30,136,229,.25); }
        .sim-wrap .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .sim-wrap .form-row.single { grid-template-columns: 1fr; }
        .sim-wrap .fg { display: flex; flex-direction: column; gap: 5px; }
        .sim-wrap label { font-size: 11px; font-weight: 500; color: #6B7280; }
        .sim-wrap input, .sim-wrap select { background: #F3F4F6; border: 1.5px solid #E5E7EB; border-radius: 8px; color: #121212; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; padding: 9px 12px; width: 100%; outline: none; transition: border-color .15s, box-shadow .15s; }
        .sim-wrap input:focus, .sim-wrap select:focus { border-color: #6C2BD9; box-shadow: 0 0 0 3px rgba(108,43,217,.1); }
        .sim-wrap input[readonly] { opacity: .55; cursor: not-allowed; background: #FAFAFA; border-style: dashed; }
        .sim-wrap .results { background: #F3F4F6; border: 1.5px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sim-wrap .ri label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: .05em; }
        .sim-wrap .ri .v { font-size: 15px; font-weight: 700; color: #6C2BD9; margin-top: 3px; }
        .sim-wrap .panel-right .ri .v { color: #1E88E5; }
        .sim-wrap .ri .v.destaque { font-size: 20px; }
        .sim-wrap .btn-sim { width: 100%; margin-top: 14px; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .04em; transition: opacity .15s, transform .1s, box-shadow .15s; }
        .sim-wrap .btn-sim:hover { opacity: .9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(108,43,217,.12); }
        .sim-wrap .btn-sim-left { background: linear-gradient(90deg, #6C2BD9 0%, #1E88E5 100%); color: #fff; }
        .sim-wrap .btn-sim-right { background: linear-gradient(90deg, #1E88E5 0%, #0d47a1 100%); color: #fff; }
        .sim-wrap .sim-section { border-top: 1px solid #E5E7EB; padding: 24px 28px; background: #F3F4F6; }
        .sim-wrap .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6B7280; margin-bottom: 16px; }
        .sim-wrap .prazos-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sim-wrap .prazos-col-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; }
        .sim-wrap .col-left-label { color: #6C2BD9; }
        .sim-wrap .col-right-label { color: #1E88E5; }
        .sim-wrap .prazos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 10px; }
        .sim-wrap .pc { background: #FFFFFF; border: 1.5px solid #E5E7EB; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all .15s; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
        .sim-wrap .pc:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(108,43,217,.12); border-color: #6C2BD9; }
        .sim-wrap .pc.al { border-color: #6C2BD9; background: rgba(108,43,217,.04); box-shadow: 0 0 0 3px rgba(108,43,217,.12); }
        .sim-wrap .pc.ar { border-color: #1E88E5; background: rgba(30,136,229,.04); box-shadow: 0 0 0 3px rgba(30,136,229,.12); }
        .sim-wrap .pc-meses { font-size: 20px; font-weight: 800; color: #121212; }
        .sim-wrap .pc-meses small { font-size: 11px; font-weight: 400; color: #6B7280; margin-left: 3px; }
        .sim-wrap .pc-parc { font-size: 12px; font-weight: 600; color: #6C2BD9; margin-top: 5px; }
        .sim-wrap .pc.ar .pc-parc { color: #1E88E5; }
        .sim-wrap .pc-taxa { font-size: 10px; color: #6B7280; margin-top: 2px; }
        .sim-wrap .pc-tag { position: absolute; top: 8px; right: 8px; font-size: 9px; font-weight: 700; letter-spacing: .05em; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; display: none; }
        .sim-wrap .pc.al .pc-tag { display: block; background: #6C2BD9; color: #fff; }
        .sim-wrap .pc.ar .pc-tag { display: block; background: #1E88E5; color: #fff; }
        .sim-wrap .table-section { border-top: 1px solid #E5E7EB; padding: 24px 28px; background: #FFFFFF; }
        .sim-wrap .table-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .sim-wrap .table-title { font-size: 15px; font-weight: 700; color: #121212; }
        .sim-wrap .table-meta { font-size: 11px; color: #6B7280; margin-top: 3px; }
        .sim-wrap .btn-pdf { background: linear-gradient(90deg, #6C2BD9 0%, #1E88E5 100%); color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap; transition: opacity .15s, box-shadow .15s; box-shadow: 0 4px 12px rgba(108,43,217,.12); }
        .sim-wrap .btn-pdf:hover { opacity: .88; box-shadow: 0 6px 18px rgba(108,43,217,.25); }
        .sim-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sim-wrap thead th { background: #F3F4F6; color: #6B7280; text-transform: uppercase; font-size: 10px; font-weight: 600; letter-spacing: .07em; padding: 10px 12px; text-align: left; border-bottom: 2px solid #E5E7EB; }
        .sim-wrap tbody tr { border-bottom: 1px solid #E5E7EB; transition: background .1s; }
        .sim-wrap tbody tr:hover { background: #F9F6FF; }
        .sim-wrap td { padding: 8px 12px; color: #333333; }
        .sim-wrap .tm { color: #6B7280; font-weight: 500; }
        .sim-wrap .ta { color: #6C2BD9; font-weight: 700; }
        .sim-wrap .ta2 { color: #121212; font-weight: 500; }
        .sim-wrap .empty-sim { text-align: center; padding: 48px; color: #6B7280; font-size: 13px; }
        @media (max-width: 768px) {
          .sim-wrap .main-grid { grid-template-columns: 1fr; }
          .sim-wrap .prazos-wrap { grid-template-columns: 1fr; }
          .sim-wrap .panel { border-right: none; border-bottom: 1px solid #E5E7EB; }
        }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div className="sim-wrap">
        <div className="main-grid">
          <div className="panel">
            <div className="panel-label">
              <span className="sim-badge badge-left">CHEIA</span>
              Contrato Novo — Tabela de Comissão
            </div>
            <div className="form-row">
              <div className="fg">
                <label>Órgão</label>
                <select ref={lOrgaoRef} data-testid="select-left-orgao">
                  <option>SIAPE</option><option>INSS</option><option>ESTADUAL</option>
                  <option>MUNICIPAL</option><option>MILITAR</option>
                </select>
              </div>
              <div className="fg">
                <label>Prazo (meses)</label>
                <input type="number" ref={lPrazoRef} defaultValue={96} min={1} data-testid="input-left-prazo" />
              </div>
            </div>
            <div className="form-row">
              <div className="fg">
                <label>Margem / Parcela (R$)</label>
                <input type="number" ref={lMargemRef} placeholder="Ex: 500,00" step="0.01" data-testid="input-left-margem" />
              </div>
              <div className="fg">
                <label>Coeficiente</label>
                <input type="number" ref={lCoefRef} placeholder="Ex: 0.022000" step="0.000001" data-testid="input-left-coef" />
              </div>
            </div>
            <div className="form-row single">
              <div className="fg">
                <label>IOF / Encargos (%)</label>
                <input type="number" ref={lIofRef} step="0.01" defaultValue={4.5} min={4.5} data-testid="input-left-iof" />
              </div>
            </div>
            <button className="btn-sim btn-sim-left" onClick={calcLeft} data-testid="button-calc-left">
              Calcular Contrato Novo
            </button>
            <div className="results">
              <div className="ri"><label>Valor do Contrato</label><div className="v destaque" data-testid="text-left-contrato">{leftState ? fmtR(leftState.contrato) : "—"}</div></div>
              <div className="ri"><label>Contrato + IOF</label><div className="v" data-testid="text-left-iof">{leftState ? fmtR(leftState.comIof) : "—"}</div></div>
              <div className="ri"><label>Taxa Implícita a.m.</label><div className="v" data-testid="text-left-taxa">{leftState ? fmtN(leftState.taxa, 4) + "%" : "—"}</div></div>
              <div className="ri"><label>Parcela</label><div className="v" data-testid="text-left-parcela">{leftState ? fmtR(leftState.margem) : "—"}</div></div>
              <div className="ri"><label>Quanto Antecipado</label><div className="v">{leftState ? fmtR(0) : "—"}</div></div>
              <div className="ri"><label>Saldo p/ Portabilidade</label><div className="v">{leftState ? fmtR(leftState.saldo) : "—"}</div></div>
              <div className="ri"><label>Remanescentes</label><div className="v">{leftState ? leftState.prazo + "x" : "—"}</div></div>
            </div>
          </div>

          <div className="panel panel-right">
            <div className="panel-label">
              <span className="sim-badge badge-right">FINAL</span>
              Contrato Final — Após Portabilidade
            </div>
            <div className="form-row">
              <div className="fg">
                <label>Órgão</label>
                <select ref={rOrgaoRef} data-testid="select-right-orgao">
                  <option>SIAPE</option><option>INSS</option><option>ESTADUAL</option>
                  <option>MUNICIPAL</option><option>MILITAR</option>
                </select>
              </div>
              <div className="fg">
                <label>Prazo (meses)</label>
                <input type="number" ref={rPrazoRef} defaultValue={96} min={1} data-testid="input-right-prazo" />
              </div>
            </div>
            <div className="form-row">
              <div className="fg">
                <label>Contrato + IOF (herdado)</label>
                <input type="number" ref={rContratoRef} placeholder="Calculado pelo lado esquerdo" step="0.01" readOnly data-testid="input-right-contrato" />
              </div>
              <div className="fg">
                <label>Taxa Final a.m. (%)</label>
                <input type="number" ref={rTaxaRef} placeholder="Ex: 1.45" step="0.0001" data-testid="input-right-taxa" />
              </div>
            </div>
            <button className="btn-sim btn-sim-right" onClick={calcRight} data-testid="button-calc-right">
              Calcular Contrato Final
            </button>
            <div className="results">
              <div className="ri"><label>Nova Parcela</label><div className="v destaque" data-testid="text-right-parcela">{rightState ? fmtR(rightState.margem) : "—"}</div></div>
              <div className="ri"><label>Contrato + IOF</label><div className="v">{rightState ? fmtR(rightState.comIof) : "—"}</div></div>
              <div className="ri"><label>Coeficiente Final</label><div className="v">{rightState ? fmtN(rightState.coef, 6) : "—"}</div></div>
              <div className="ri"><label>Taxa Final</label><div className="v">{rightState ? fmtN(rightState.taxa, 4) + "%" : "—"}</div></div>
              <div className="ri"><label>Quanto Antecipado</label><div className="v">—</div></div>
              <div className="ri"><label>Saldo p/ Portabilidade</label><div className="v">—</div></div>
              <div className="ri"><label>Remanescentes</label><div className="v">{rightState ? rightState.prazo + "x" : "—"}</div></div>
            </div>
          </div>
        </div>

        <div className="sim-section">
          <div className="section-title">Estratégia de Amortização — escolha um prazo para ver o cronograma</div>
          <div className="prazos-wrap">
            <div>
              <div className="prazos-col-label col-left-label">Tabela Cheia</div>
              <div className="prazos-grid">
                {leftCards.length === 0 ? (
                  <div className="empty-sim" style={{ padding: 16, gridColumn: "1/-1" }}>
                    Calcule o contrato novo primeiro.
                  </div>
                ) : (
                  leftCards.map((card) => (
                    <div
                      key={card.meses}
                      className={`pc${selectedCard?.side === "left" && selectedCard?.meses === card.meses ? " al" : ""}`}
                      onClick={() => selectPrazo("left", card)}
                      data-testid={`card-left-${card.meses}`}
                    >
                      <div className="pc-meses">{card.meses}<small>meses</small></div>
                      <div className="pc-parc">{fmtR(card.parcMedia)}/mês</div>
                      <div className="pc-taxa">{fmtN(card.taxaImpl, 2)}% a.m.</div>
                      <div className="pc-tag">CHEIA</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="prazos-col-label col-right-label">Taxa Final</div>
              <div className="prazos-grid">
                {rightCards.length === 0 ? (
                  <div className="empty-sim" style={{ padding: 16, gridColumn: "1/-1" }}>
                    Calcule o contrato final primeiro.
                  </div>
                ) : (
                  rightCards.map((card) => (
                    <div
                      key={card.meses}
                      className={`pc${selectedCard?.side === "right" && selectedCard?.meses === card.meses ? " ar" : ""}`}
                      onClick={() => selectPrazo("right", card)}
                      data-testid={`card-right-${card.meses}`}
                    >
                      <div className="pc-meses">{card.meses}<small>meses</small></div>
                      <div className="pc-parc">{fmtR(card.parcMedia)}/mês</div>
                      <div className="pc-taxa">{fmtN(card.taxaImpl, 2)}% a.m.</div>
                      <div className="pc-tag">FINAL</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="table-section" ref={tabelaRef}>
          <div className="table-header">
            <div>
              <div className="table-title" data-testid="text-cronograma-titulo">
                {cronograma ? `Cronograma — ${cronograma.meses} meses` : "Cronograma de Amortização"}
              </div>
              {cronograma && (
                <div className="table-meta" data-testid="text-cronograma-meta">
                  Contrato: {fmtR(cronograma.s.contrato)} · Parcela Média: {fmtR(cronograma.parcMedia)} · Taxa Média: {fmtN(cronograma.taxaImpl, 2)}% a.m. · Total Pago: {fmtR(cronograma.totalPago)}
                </div>
              )}
            </div>
            {cronograma && (
              <button className="btn-pdf" onClick={exportarPDF} data-testid="button-exportar-pdf">
                Exportar PDF
              </button>
            )}
          </div>
          <div>
            {!cronograma ? (
              <div className="empty-sim">
                Calcule um contrato e selecione um prazo acima.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Valor Parcela</th>
                    <th>Prazos Amortizados</th>
                    <th>Amortização Aproximada</th>
                    <th>Total Aproximado</th>
                  </tr>
                </thead>
                <tbody>
                  {cronograma.fluxo.map((l, i) => {
                    const prazosAtras = l.amortsCols.map((a) => a.prazo).join(", ");
                    const prazosExib = prazosAtras ? `${i + 1}, ${prazosAtras}` : `${i + 1}`;
                    return (
                      <tr key={i}>
                        <td className="tm">{i + 1}</td>
                        <td className="ta2">{fmtR(l.parcela)}</td>
                        <td className="tm">{prazosExib}</td>
                        <td>{fmtR(l.amortTotal)}</td>
                        <td className="ta">{fmtR(l.totalMes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
