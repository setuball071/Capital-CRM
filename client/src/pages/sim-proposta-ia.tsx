import { useState, useEffect } from "react";
import { useTenant } from "@/components/tenant-theme-provider";
import { MatIcon } from "@/components/mat-icon";

interface ImportData {
  cliente?: string;
  contratos?: Array<{ banco?: string; parcela?: number; prazo?: number; acao?: string; portar?: boolean }>;
  novas?: Array<{ parcela?: number; prazo?: number; troco?: number }>;
}

// Traduz a ação bruta do simulador (manter/quitar/amortizar + flag portar) para o rótulo do formulário
function mapAcao(acao?: string, portar?: boolean): string {
  if (acao === "quitar") return "Quitar";
  if (acao === "amortizar") return portar ? "Amortizar e portar" : "Amortizar";
  if (portar) return "Portar";
  return "Manter";
}

interface ContratoAtual {
  id: number;
  banco: string;
  parcela: string;
  prazo: string;
  acao: string;
}

interface ContratoFinal {
  id: number;
  banco: string;
  parcela: string;
  prazo: string;
}

interface PropostaGerada {
  titulo: string;
  subtitulo: string;
  estrategia: string;
  passos: Array<{ titulo: string; descricao: string }>;
  observacao: string;
}

function parseBRL(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function fmtBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let _uid = 1;

const ACOES = ["Portar", "Quitar", "Amortizar", "Amortizar e portar", "Manter"];

export default function SimPropostaIa({
  importData,
  onConsumed,
}: {
  importData?: ImportData | null;
  onConsumed?: () => void;
}) {
  const { logoUrl } = useTenant();

  const [cliente, setCliente] = useState("");
  const [contratosAtuais, setContratosAtuais] = useState<ContratoAtual[]>([
    { id: _uid++, banco: "", parcela: "", prazo: "", acao: "Portar" },
  ]);
  const [contratosFinals, setContratosFinals] = useState<ContratoFinal[]>([
    { id: _uid++, banco: "", parcela: "", prazo: "" },
  ]);
  const [economiaTotal, setEconomiaTotal] = useState("");
  const [margemLivre, setMargemLivre] = useState("");
  const [gerando, setGerando] = useState(false);
  const [proposta, setProposta] = useState<PropostaGerada | null>(null);
  const [erro, setErro] = useState("");
  const [importado, setImportado] = useState(false);

  // Pré-preenche o formulário quando o Simulador de Portabilidade envia uma cotação
  useEffect(() => {
    if (!importData) return;

    if (importData.cliente) setCliente(importData.cliente);

    const atuais = (importData.contratos || []).map((c) => ({
      id: _uid++,
      banco: c.banco || "",
      parcela: c.parcela ? fmtBRL(c.parcela) : "",
      prazo: c.prazo ? `${c.prazo} meses` : "",
      acao: mapAcao(c.acao, c.portar),
    }));
    if (atuais.length) setContratosAtuais(atuais);

    const finais = (importData.novas || []).map((n) => ({
      id: _uid++,
      banco: "",
      parcela: n.parcela ? fmtBRL(n.parcela) : "",
      prazo: n.prazo ? `${n.prazo} meses` : "",
    }));
    if (finais.length) setContratosFinals(finais);

    setImportado(true);
    setProposta(null);
    setErro("");
    onConsumed?.();
  }, [importData]);

  // ── contratos atuais ──
  const addAtual = () =>
    setContratosAtuais((p) => [...p, { id: _uid++, banco: "", parcela: "", prazo: "", acao: "Portar" }]);
  const removeAtual = (id: number) =>
    setContratosAtuais((p) => p.filter((c) => c.id !== id));
  const updateAtual = (id: number, field: keyof ContratoAtual, value: string) =>
    setContratosAtuais((p) => p.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  // ── contratos finais ──
  const addFinal = () =>
    setContratosFinals((p) => [...p, { id: _uid++, banco: "", parcela: "", prazo: "" }]);
  const removeFinal = (id: number) =>
    setContratosFinals((p) => p.filter((c) => c.id !== id));
  const updateFinal = (id: number, field: keyof ContratoFinal, value: string) =>
    setContratosFinals((p) => p.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const totalAtual = contratosAtuais.reduce((s, c) => s + parseBRL(c.parcela), 0);
  const totalFinal = contratosFinals.reduce((s, c) => s + parseBRL(c.parcela), 0);
  const economiaCalc = totalAtual - totalFinal;

  const gerarProposta = async () => {
    if (!cliente.trim()) { setErro("Informe o nome do cliente."); return; }
    if (contratosAtuais.some((c) => !c.banco || !c.parcela)) {
      setErro("Preencha banco e parcela de todos os contratos atuais.");
      return;
    }
    setGerando(true);
    setErro("");
    setProposta(null);
    try {
      const res = await fetch("/api/proposta-ia/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente,
          contratosAtuais,
          contratosFinals,
          economiaTotal: economiaTotal || fmtBRL(economiaCalc),
          margemLivre,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");
      setProposta(data);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  };

  const buildHtml = (): string => {
    if (!proposta) return "";

    const origin = window.location.origin;
    const logoSrc = logoUrl
      ? `${origin}${logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl}`
      : "";
    const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const economia = economiaTotal || fmtBRL(economiaCalc);
    const margem = margemLivre || fmtBRL(economiaCalc);

    const logoTag = logoSrc
      ? `<img src="${logoSrc}" alt="Logo" />`
      : `<span style="font-size:20px;font-weight:800;color:#6C2BD9;letter-spacing:-0.5px;">capital go</span>`;

    const tblAtual = contratosAtuais
      .map(
        (c) => `<tr>
        <td>${c.banco}</td>
        <td>${c.parcela}</td>
        <td>${c.prazo || "—"}</td>
        <td>${c.acao}</td>
      </tr>`
      )
      .join("");

    const tblFinal = contratosFinals
      .map(
        (c) => `<tr>
        <td>${c.banco}</td>
        <td>${c.parcela}</td>
        <td>${c.prazo || "—"}</td>
      </tr>`
      )
      .join("");

    const passos = proposta.passos
      .map(
        (p, i) => `<div class="passo">
        <div class="passo-num">${i + 1}</div>
        <div class="passo-body">
          <div class="passo-titulo">${p.titulo}</div>
          <div class="passo-desc">${p.descricao}</div>
        </div>
      </div>`
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Proposta ${cliente} - Capital Go</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Inter,-apple-system,sans-serif;background:#f5f5f5;color:#111;}
.page{max-width:794px;margin:0 auto;background:#fff;padding:52px 56px;min-height:1123px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}
.header-logo img{height:32px;width:auto;}
.header-right{text-align:right;}
.header-right .label{font-size:11px;font-weight:600;color:#374151;}
.header-right .sub{font-size:10px;color:#9CA3AF;margin-top:2px;}
hr{border:none;border-top:1px solid #E5E7EB;margin-bottom:24px;}
.client-tag{font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;}
h1{font-size:26px;font-weight:700;color:#111;line-height:1.2;margin-bottom:8px;}
.subtitulo{font-size:12.5px;color:#6B7280;line-height:1.6;margin-bottom:28px;}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px;}
.card-main{background:#6C2BD9;border-radius:12px;padding:24px 28px;color:#fff;}
.card-sec{background:#EDE9FE;border-radius:12px;padding:24px 28px;color:#4C1D95;}
.card-label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;opacity:.8;margin-bottom:8px;}
.card-value{font-size:28px;font-weight:800;margin-bottom:4px;letter-spacing:-0.5px;}
.card-desc{font-size:11px;opacity:.75;}
h2{font-size:16px;font-weight:700;color:#111;margin-bottom:12px;}
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;}
thead th{text-transform:uppercase;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:.8px;padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:left;}
tbody td{padding:10px 12px;border-bottom:1px solid #F3F4F6;color:#374151;}
tfoot td{padding:10px 12px;font-weight:700;color:#111;border-top:1px solid #E5E7EB;}
.callout-strategy{background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;}
.callout-label{font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;}
.callout-strategy p{font-size:12px;color:#374151;line-height:1.7;}
.sep-logo{display:flex;align-items:center;gap:10px;margin:4px 0 20px;}
.sep-logo img{height:18px;width:auto;opacity:.65;}
.sep-logo .sep-text{font-size:12px;font-weight:600;color:#6C2BD9;opacity:.65;}
.sep-line{flex:1;border-top:1px solid #E5E7EB;}
.passos{display:flex;flex-direction:column;gap:16px;margin-bottom:28px;}
.passo{display:flex;gap:14px;align-items:flex-start;}
.passo-num{width:28px;height:28px;border-radius:50%;background:#6C2BD9;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.passo-titulo{font-size:13px;font-weight:700;color:#111;margin-bottom:4px;}
.passo-desc{font-size:12px;color:#6B7280;line-height:1.6;}
.comp-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;}
.comp-table th{padding:8px 12px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#6B7280;border-bottom:1px solid #E5E7EB;text-align:left;}
.col-r{text-align:right;}
.col-cg{text-align:right;color:#7C3AED;}
.comp-table td{padding:10px 12px;border-bottom:1px solid #F3F4F6;color:#374151;}
.td-r{text-align:right;}
.td-cg{text-align:right;color:#7C3AED;font-weight:600;}
.callout-obs{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin-bottom:28px;}
.obs-label{font-size:10px;font-weight:700;color:#92400E;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;}
.callout-obs p{font-size:12px;color:#78350F;line-height:1.6;}
.footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E7EB;padding-top:16px;margin-top:8px;}
.footer .fl{font-size:10px;color:#9CA3AF;}
.footer .fl span{color:#6C2BD9;font-weight:600;}
@media print{body{background:#fff;}.page{box-shadow:none;padding:18mm 20mm;}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-logo">${logoTag}</div>
    <div class="header-right">
      <div class="label">Proposta estratégica de reorganização</div>
      <div class="sub">${mes} · Capital Go Soluções Financeiras</div>
    </div>
  </div>
  <hr />

  <div class="client-tag">Proposta para ${cliente.toUpperCase()}</div>
  <h1>${proposta.titulo}</h1>
  <p class="subtitulo">${proposta.subtitulo}</p>

  <div class="cards">
    <div class="card-main">
      <div class="card-label">Economia Mensal</div>
      <div class="card-value">${economia}</div>
      <div class="card-desc">de economia todo mês</div>
    </div>
    <div class="card-sec">
      <div class="card-label">Margem Livre Final</div>
      <div class="card-value">${margem}</div>
      <div class="card-desc">liberada ao final da operação</div>
    </div>
  </div>

  <h2>Cenário atual</h2>
  <table>
    <thead><tr><th>Banco</th><th>Parcela Mensal</th><th>Prazo Restante</th><th>O que faremos</th></tr></thead>
    <tbody>${tblAtual}</tbody>
    <tfoot><tr><td>Total</td><td>${fmtBRL(totalAtual)}</td><td>—</td><td>—</td></tr></tfoot>
  </table>

  <div class="callout-strategy">
    <div class="callout-label">Como funciona a estratégia</div>
    <p>${proposta.estrategia}</p>
  </div>

  <div class="sep-logo">
    ${logoSrc ? `<img src="${logoSrc}" alt="" />` : `<span class="sep-text">capital go</span>`}
    <div class="sep-line"></div>
    <span class="sep-text">Proposta estratégica de reorganização</span>
  </div>

  <h2>Cenário final</h2>
  <table>
    <thead><tr><th>Banco</th><th>Parcela Mensal</th><th>Prazo</th></tr></thead>
    <tbody>${tblFinal}</tbody>
    <tfoot><tr><td>Total</td><td>${fmtBRL(totalFinal)}</td><td>—</td></tr></tfoot>
  </table>

  <h2>Passo a passo da operação</h2>
  <div class="passos">${passos}</div>

  <h2>Comparativo</h2>
  <table class="comp-table">
    <thead><tr><th></th><th class="col-r">Hoje</th><th class="col-cg">Com Capital Go</th></tr></thead>
    <tbody>
      <tr><td>Desconto mensal</td><td class="td-r">${fmtBRL(totalAtual)}</td><td class="td-cg">${fmtBRL(totalFinal)}</td></tr>
      <tr><td>Contratos ativos</td><td class="td-r">${contratosAtuais.length}</td><td class="td-cg">${contratosFinals.length}</td></tr>
      <tr><td>Margem livre</td><td class="td-r">Comprometida</td><td class="td-cg">${margem}</td></tr>
      <tr><td>Taxas</td><td class="td-r">Variadas e altas</td><td class="td-cg">Reduzidas</td></tr>
    </tbody>
  </table>

  <div class="callout-obs">
    <div class="obs-label">Observação</div>
    <p>${proposta.observacao}</p>
  </div>

  <div class="footer">
    <div class="fl"><span>capital go</span> | Correspondente bancário · Florianópolis/SC</div>
    <div class="fl">Dúvidas? Fale com seu consultor.</div>
  </div>
</div>
</body>
</html>`;
  };

  const imprimirPdf = () => {
    const html = buildHtml();
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  // ── estilos inline compartilhados ──
  const inputCss: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    outline: "none",
    width: "100%",
  };

  const thCss: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "hsl(var(--muted-foreground))",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "6px 8px",
    textAlign: "left",
    borderBottom: "1px solid hsl(var(--border))",
    background: "hsl(var(--muted))",
  };

  const tdCss: React.CSSProperties = {
    padding: "4px 6px",
    verticalAlign: "middle",
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* ── Cabeçalho ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Gerador de Proposta com IA</h1>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            Preencha os dados e gere uma proposta personalizada com linguagem profissional.
          </p>
        </div>
        {proposta && (
          <button
            onClick={imprimirPdf}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#6C2BD9", color: "#fff",
              border: "none", borderRadius: 8,
              padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <MatIcon name="print" size={16} />
            Imprimir / Salvar PDF
          </button>
        )}
      </div>

      {/* ── Aviso de importação do simulador ── */}
      {importado && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8,
          padding: "10px 14px", fontSize: 13, color: "#6C2BD9", marginBottom: 20,
        }}>
          <MatIcon name="sync_alt" size={16} />
          Dados importados do Simulador de Portabilidade. Revise os campos, nomeie os bancos do cenário final e gere a proposta.
        </div>
      )}

      {/* ── Campo cliente ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Nome do cliente
        </label>
        <input
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Ex: Daniele Sulamiite Yared Souza"
          style={{ ...inputCss, maxWidth: 420 }}
        />
      </div>

      {/* ── Contratos Atuais ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Contratos atuais</span>
          <button
            onClick={addAtual}
            style={{
              fontSize: 12, background: "none", border: "1px solid hsl(var(--border))",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
              color: "hsl(var(--foreground))", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <MatIcon name="add" size={14} /> Linha
          </button>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thCss, width: "25%" }}>Banco</th>
                <th style={{ ...thCss, width: "18%" }}>Parcela mensal</th>
                <th style={{ ...thCss, width: "15%" }}>Prazo restante</th>
                <th style={{ ...thCss, width: "22%" }}>Ação</th>
                <th style={{ ...thCss, width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {contratosAtuais.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: idx < contratosAtuais.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                  <td style={tdCss}>
                    <input value={c.banco} onChange={(e) => updateAtual(c.id, "banco", e.target.value)} placeholder="Ex: Inter" style={inputCss} />
                  </td>
                  <td style={tdCss}>
                    <input value={c.parcela} onChange={(e) => updateAtual(c.id, "parcela", e.target.value)} placeholder="R$ 0,00" style={inputCss} />
                  </td>
                  <td style={tdCss}>
                    <input value={c.prazo} onChange={(e) => updateAtual(c.id, "prazo", e.target.value)} placeholder="Ex: 94 meses" style={inputCss} />
                  </td>
                  <td style={tdCss}>
                    <select
                      value={c.acao}
                      onChange={(e) => updateAtual(c.id, "acao", e.target.value)}
                      style={{ ...inputCss }}
                    >
                      {ACOES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdCss, textAlign: "center" }}>
                    <button
                      onClick={() => removeAtual(c.id)}
                      disabled={contratosAtuais.length === 1}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", opacity: contratosAtuais.length === 1 ? 0.3 : 1 }}
                    >
                      <MatIcon name="delete" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalAtual > 0 && (
          <div style={{ textAlign: "right", fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>
            Total atual: <strong>{fmtBRL(totalAtual)}</strong>
          </div>
        )}
      </div>

      {/* ── Contratos Finais ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Contratos finais (propostos)</span>
          <button
            onClick={addFinal}
            style={{
              fontSize: 12, background: "none", border: "1px solid hsl(var(--border))",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
              color: "hsl(var(--foreground))", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <MatIcon name="add" size={14} /> Linha
          </button>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thCss, width: "35%" }}>Banco</th>
                <th style={{ ...thCss, width: "25%" }}>Parcela mensal</th>
                <th style={{ ...thCss, width: "25%" }}>Prazo</th>
                <th style={{ ...thCss, width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {contratosFinals.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: idx < contratosFinals.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                  <td style={tdCss}>
                    <input value={c.banco} onChange={(e) => updateFinal(c.id, "banco", e.target.value)} placeholder="Ex: Banco Paraná" style={inputCss} />
                  </td>
                  <td style={tdCss}>
                    <input value={c.parcela} onChange={(e) => updateFinal(c.id, "parcela", e.target.value)} placeholder="R$ 0,00" style={inputCss} />
                  </td>
                  <td style={tdCss}>
                    <input value={c.prazo} onChange={(e) => updateFinal(c.id, "prazo", e.target.value)} placeholder="Ex: 120 meses" style={inputCss} />
                  </td>
                  <td style={{ ...tdCss, textAlign: "center" }}>
                    <button
                      onClick={() => removeFinal(c.id)}
                      disabled={contratosFinals.length === 1}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", opacity: contratosFinals.length === 1 ? 0.3 : 1 }}
                    >
                      <MatIcon name="delete" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalFinal > 0 && (
          <div style={{ textAlign: "right", fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>
            Total final: <strong>{fmtBRL(totalFinal)}</strong>
            {totalAtual > 0 && (
              <span style={{ marginLeft: 12, color: "#16A34A" }}>
                ↓ economia de <strong>{fmtBRL(economiaCalc)}/mês</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Resumo / campos extras ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
            Economia mensal <span style={{ fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>(sobrescreve cálculo automático)</span>
          </label>
          <input
            value={economiaTotal}
            onChange={(e) => setEconomiaTotal(e.target.value)}
            placeholder={totalAtual > 0 ? fmtBRL(economiaCalc) : "R$ 0,00"}
            style={inputCss}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
            Margem livre liberada
          </label>
          <input
            value={margemLivre}
            onChange={(e) => setMargemLivre(e.target.value)}
            placeholder="R$ 0,00"
            style={inputCss}
          />
        </div>
      </div>

      {/* ── Erro ── */}
      {erro && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 16 }}>
          {erro}
        </div>
      )}

      {/* ── Botão gerar ── */}
      <button
        onClick={gerarProposta}
        disabled={gerando}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: gerando ? "#A78BFA" : "#6C2BD9",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "11px 24px", fontSize: 14, fontWeight: 600,
          cursor: gerando ? "not-allowed" : "pointer",
          marginBottom: 32,
          transition: "background .15s",
        }}
      >
        <MatIcon name={gerando ? "autorenew" : "auto_awesome"} size={18} />
        {gerando ? "Gerando proposta…" : "Gerar Proposta com IA"}
      </button>

      {/* ── Preview ── */}
      {proposta && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Pré-visualização</span>
            <button
              onClick={imprimirPdf}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "1px solid #6C2BD9", color: "#6C2BD9",
                borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <MatIcon name="open_in_new" size={14} />
              Abrir para impressão
            </button>
          </div>
          <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", background: "#f5f5f5" }}>
            {/* iframe escalado para caber na tela */}
            <div style={{ position: "relative", width: "100%", paddingBottom: "141.4%", overflow: "hidden" }}>
              <iframe
                srcDoc={buildHtml()}
                title="Preview da proposta"
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: "794px",
                  height: "1123px",
                  border: "none",
                  transformOrigin: "top left",
                  transform: `scale(${1})`,
                }}
                // Reescalado via ResizeObserver abaixo — por ora usa scrollable
                scrolling="no"
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 8, textAlign: "center" }}>
            Use "Abrir para impressão" ou o botão no topo para salvar como PDF via Ctrl+P / Cmd+P → Salvar como PDF.
          </p>
        </div>
      )}
    </div>
  );
}
