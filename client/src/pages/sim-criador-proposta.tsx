import { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import { useProposta } from "@/contexts/proposta-context";
import { useTenant } from "@/components/tenant-theme-provider";
import { useAuth } from "@/lib/auth";

// ── helpers ────────────────────────────────────────────────────────────
const fmtR = (v: number) =>
  "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function maskDoc(v: string): string {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length <= 3) return "***";
  return d.slice(0, -3).replace(/./g, "*") + d.slice(-3).replace(/./, "*");
}

function gerarNum(): string {
  return "CG-" + Date.now().toString().slice(-6);
}

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// ── tipos ──────────────────────────────────────────────────────────────
interface ContratoRow {
  id: number;
  banco: string;
  parcela: string;
  prazo: string;
}

interface NovaRow {
  id: number;
  parcela: string;
  prazo: string;
  troco: string;
}

interface PropostaData {
  num: string;
  data: string;
  validade: string;
  nome: string;
  cpf: string;
  matricula: string;
  convenio: string;
  contratos: ContratoRow[];
  novas: NovaRow[];
  corNome: string;
  corCargo: string;
  corWa: string;
  obs: string;
}

let _idSeq = 0;
const nextId = () => ++_idSeq;

// ── componente principal ────────────────────────────────────────────────
export default function SimCriadorProposta() {
  const propCtx = useProposta();
  const { tenant, logoUrl } = useTenant();
  const { user } = useAuth();
  const [logoBase64, setLogoBase64] = useState<string>("");
  // Armazena dimensões reais da logo para calcular aspect ratio corretamente no PDF
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);

  // Pré-carrega logo como base64 para usar no PDF
  useEffect(() => {
    if (!logoUrl) { setLogoBase64(""); setLogoDims(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Guarda dimensões reais ANTES de qualquer uso
      setLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL("image/png"));
      }
    };
    img.onerror = () => { setLogoBase64(""); setLogoDims(null); };
    img.src = logoUrl;
  }, [logoUrl]);

  // ── estado do formulário ──
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [convenio, setConvenio] = useState("");

  const [contratos, setContratos] = useState<ContratoRow[]>([
    { id: nextId(), banco: "", parcela: "", prazo: "" },
  ]);
  const [novas, setNovas] = useState<NovaRow[]>([
    { id: nextId(), parcela: "", prazo: "", troco: "" },
  ]);

  const [corNome, setCorNome] = useState<string>(
    () => localStorage.getItem("pdf_consultor_nome") ?? user?.name ?? ""
  );
  const [corCargo, setCorCargo] = useState<string>(
    () => localStorage.getItem("pdf_consultor_titulo") ?? "Consultor de Crédito"
  );
  const [corWa, setCorWa] = useState<string>(
    () => localStorage.getItem("pdf_consultor_tel") ?? ""
  );
  const [obs, setObs] = useState("");

  const [proposta, setProposta] = useState<PropostaData | null>(null);

  // ── pre-fill via bridge ──
  useEffect(() => {
    if (!propCtx?.fill) return;
    const { contratos: ct, novas: nv } = propCtx.fill;
    setContratos(
      ct.map((c) => ({
        id: nextId(),
        banco: c.banco,
        parcela: c.parcela.toFixed(2),
        prazo: String(c.prazo),
      }))
    );
    setNovas(
      nv.map((n) => ({
        id: nextId(),
        parcela: n.parcela.toFixed(2),
        prazo: String(n.prazo),
        troco: n.troco > 0 ? n.troco.toFixed(2) : "",
      }))
    );
    propCtx.clearFill();
  }, [propCtx?.fill]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── contratos helpers ──
  const addContrato = () =>
    setContratos((p) => [...p, { id: nextId(), banco: "", parcela: "", prazo: "" }]);
  const remContrato = (id: number) =>
    setContratos((p) => (p.length > 1 ? p.filter((c) => c.id !== id) : p));
  const updateContrato = (id: number, field: keyof ContratoRow, value: string) =>
    setContratos((p) => p.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const addNova = () =>
    setNovas((p) => [...p, { id: nextId(), parcela: "", prazo: "", troco: "" }]);
  const remNova = (id: number) =>
    setNovas((p) => (p.length > 1 ? p.filter((n) => n.id !== id) : p));
  const updateNova = (id: number, field: keyof NovaRow, value: string) =>
    setNovas((p) => p.map((n) => (n.id === id ? { ...n, [field]: value } : n)));

  // ── totais ──
  const totalContratos = contratos.reduce((s, c) => s + (parseFloat(c.parcela) || 0), 0);
  const totalNovasParcelas = novas.reduce((s, n) => s + (parseFloat(n.parcela) || 0), 0);
  const totalTroco = novas.reduce((s, n) => s + (parseFloat(n.troco) || 0), 0);

  // ── gerar proposta ──
  const gerar = useCallback(() => {
    if (!nome.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }
    const hoje = new Date();
    const valid = new Date(hoje);
    valid.setDate(valid.getDate() + 1);
    setProposta({
      num: gerarNum(),
      data: hoje.toLocaleDateString("pt-BR"),
      validade: valid.toLocaleDateString("pt-BR"),
      nome: nome.trim(),
      cpf,
      matricula,
      convenio,
      contratos: [...contratos],
      novas: [...novas],
      corNome: corNome || "Corretor",
      corCargo: corCargo || "Consultor de Crédito",
      corWa,
      obs,
    });
  }, [nome, cpf, matricula, convenio, contratos, novas, corNome, corCargo, corWa, obs]);

  const limpar = () => {
    setNome(""); setCpf(""); setMatricula(""); setConvenio(""); setObs("");
    setContratos([{ id: nextId(), banco: "", parcela: "", prazo: "" }]);
    setNovas([{ id: nextId(), parcela: "", prazo: "", troco: "" }]);
    setProposta(null);
  };

  // ── PDF export (jsPDF) ──
  const exportPDF = useCallback(() => {
    if (!proposta) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, ml = 16, mr = 16;
    const cw = W - ml - mr;
    let y = 0;

    // barra de cor no topo — única faixa roxa (cor primária Capital Go)
    doc.setFillColor(108, 43, 217); doc.rect(0, 0, W, 4, "F");
    y = 14;

    // Logo ou nome da empresa — usa dimensões pré-carregadas (logoDims) para aspect ratio correto
    const tenantName = tenant?.name ?? "Capital Go";
    if (logoBase64 && logoDims && logoDims.w > 0 && logoDims.h > 0) {
      const ratio = logoDims.w / logoDims.h;
      const logoH = 10; // altura fixa 10mm
      const logoW = Math.min(logoH * ratio, 52); // largura proporcional, máx 52mm
      doc.addImage(logoBase64, "PNG", ml, y - 8, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.setTextColor(108, 43, 217); doc.text(tenantName, ml, y);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text("Crédito Consignado", ml, y + 5);
    doc.text("Proposta nº " + proposta.num, W - mr, y, { align: "right" });
    doc.text(proposta.data, W - mr, y + 5, { align: "right" });
    y += 12;

    // cabeçalho cliente
    doc.setDrawColor(230, 230, 230); doc.line(ml, y, W - mr, y); y += 1;
    doc.setFillColor(250, 249, 255); doc.rect(ml, y, cw, 16, "F"); y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text(proposta.nome, ml + 3, y + 5);
    const subParts: string[] = [];
    if (proposta.cpf) subParts.push("CPF: " + maskDoc(proposta.cpf));
    if (proposta.matricula) subParts.push("Matrícula: " + maskDoc(proposta.matricula));
    if (proposta.convenio) subParts.push("Convênio: " + proposta.convenio);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(subParts.join(" · "), ml + 3, y + 10);
    y += 18;

    // helpers de tabela
    const thRow = (cols: string[], colW: number[], yy: number, bg: [number, number, number]) => {
      doc.setFillColor(...bg); doc.rect(ml, yy, cw, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(110, 110, 110);
      let cx = ml + 3;
      cols.forEach((h, i) => { doc.text(h, cx, yy + 5); cx += colW[i]; });
      return yy + 7;
    };

    const tdRow = (
      cells: string[], colW: number[], yy: number, even: boolean,
      styles?: Array<"normal" | "bold" | "purple" | "blue" | "muted">
    ) => {
      if (even) { doc.setFillColor(252, 252, 252); doc.rect(ml, yy, cw, 7, "F"); }
      let cx = ml + 3;
      cells.forEach((c, i) => {
        const s = styles?.[i] ?? "normal";
        doc.setFont("helvetica", s === "bold" || s === "purple" ? "bold" : "normal");
        doc.setFontSize(8);
        if (s === "purple") doc.setTextColor(108, 43, 217);
        else if (s === "blue") doc.setTextColor(30, 136, 229);
        else if (s === "muted") doc.setTextColor(120, 120, 120);
        else doc.setTextColor(40, 40, 40);
        doc.text(String(c || "—"), cx, yy + 5);
        cx += colW[i];
      });
      doc.setDrawColor(238, 238, 238); doc.line(ml, yy + 7, W - mr, yy + 7);
      return yy + 7;
    };

    const totalRow = (label: string, val: string, valStyle: "purple" | "normal", yy: number) => {
      doc.setFillColor(242, 242, 242); doc.rect(ml, yy, cw, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(100, 100, 100); doc.text(label, ml + 3, yy + 5);
      if (valStyle === "purple") doc.setTextColor(108, 43, 217);
      else doc.setTextColor(30, 30, 30);
      doc.text(val, W - mr - 3, yy + 5, { align: "right" });
      return yy + 9;
    };

    // CONTRATOS ATUAIS
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
    doc.text("CONTRATOS ATUAIS", ml, y); y += 4;
    const colAt = [cw * 0.40, cw * 0.32, cw * 0.28];
    y = thRow(["Banco", "Parcela", "Prazo restante"], colAt, y, [245, 245, 245]);
    let tAt = 0;
    proposta.contratos.forEach((c, i) => {
      const parc = parseFloat(c.parcela) || 0;
      tAt += parc;
      y = tdRow(
        [c.banco || "—", parc ? fmtR(parc) : "—", c.prazo ? c.prazo + " meses" : "—"],
        colAt, y, i % 2 === 0, ["normal", "bold", "muted"]
      );
    });
    y = totalRow("Total mensal atual", tAt ? fmtR(tAt) : "—", "normal", y);
    y += 5;

    // NOVA PROPOSTA
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 70, 180);
    doc.text("NOVA PROPOSTA · " + tenantName.toUpperCase(), ml, y); y += 4;
    const colNv = [cw * 0.36, cw * 0.28, cw * 0.36];
    y = thRow(["Parcela", "Prazo", "Troco / Liberado"], colNv, y, [243, 238, 255]);
    let tNv = 0, tTroco = 0;
    proposta.novas.forEach((n, i) => {
      const parc = parseFloat(n.parcela) || 0;
      const troco = parseFloat(n.troco) || 0;
      tNv += parc; tTroco += troco;
      y = tdRow(
        [parc ? fmtR(parc) : "—", n.prazo ? n.prazo + " meses" : "—", troco > 0 ? fmtR(troco) : "—"],
        colNv, y, i % 2 === 0, ["purple", "muted", "blue"]
      );
    });
    y = totalRow("Total mensal novo", tNv ? fmtR(tNv) : "—", "purple", y);
    if (tTroco > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(30, 136, 229);
      doc.text("Troco total disponível: " + fmtR(tTroco), W - mr - 3, y, { align: "right" });
      y += 6;
    }
    y += 3;

    // RESULTADO — só adiciona itens com valor positivo (vantagens reais)
    const resItems: [string, string, "green" | "blue"][] = [];
    if (tAt && tNv && tAt - tNv > 0) resItems.push(["Economia mensal", fmtR(tAt - tNv), "green"]);
    if (tTroco > 0) resItems.push(["Troco total disponível", fmtR(tTroco), "blue"]);
    const prazosAt = proposta.contratos.filter(c => parseInt(c.prazo)).map(c => parseInt(c.prazo));
    const prazosNv = proposta.novas.filter(n => parseInt(n.prazo)).map(n => parseInt(n.prazo));
    if (prazosAt.length && prazosNv.length && tAt && tNv) {
      const diff = tAt * Math.min(...prazosAt) - tNv * Math.min(...prazosNv);
      if (diff > 0) resItems.push(["Economia total estimada", fmtR(diff), "green"]);
    }
    if (resItems.length > 0) {
      doc.setFillColor(248, 248, 248); doc.roundedRect(ml, y, cw, resItems.length * 8 + 14, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
      doc.text("RESULTADO PARA O CLIENTE", ml + 3, y + 7);
      resItems.forEach((r, i) => {
        const ry = y + 13 + i * 8;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        doc.text(r[0], ml + 5, ry);
        doc.setFont("helvetica", "bold");
        if (r[2] === "blue") doc.setTextColor(30, 136, 229);
        else doc.setTextColor(59, 109, 17);
        doc.text(r[1], W - mr - 3, ry, { align: "right" });
      });
      y += resItems.length * 8 + 18;
    }

    if (proposta.obs) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
      doc.text("Obs: " + proposta.obs, ml, y); y += 6;
    }

    // assinatura
    y += 4; doc.setDrawColor(220, 220, 220); doc.line(ml, y, W - mr, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(proposta.corNome, ml, y + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    const subCor = [proposta.corCargo, proposta.corWa].filter(Boolean).join(" · ");
    doc.text(subCor, ml, y + 8.5);
    if (logoBase64 && logoDims && logoDims.w > 0 && logoDims.h > 0) {
      // logo menor na assinatura — usa dimensões reais carregadas no useEffect
      const ratio2 = logoDims.w / logoDims.h;
      const lH2 = 6; const lW2 = Math.min(lH2 * ratio2, 30);
      doc.addImage(logoBase64, "PNG", W - mr - lW2, y, lW2, lH2);
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(108, 43, 217);
      doc.text(tenantName, W - mr, y + 4, { align: "right" });
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
    doc.text(proposta.data, W - mr, y + 8.5, { align: "right" });
    y += 18;

    // rodapé
    doc.setDrawColor(220, 220, 220); doc.line(ml, y, W - mr, y); y += 5;
    const rodape = [
      "Cálculos de amortização de parcela são diários e sofrem alteração.",
      "Proposta válida até " + proposta.validade + ", sujeita a alteração sem aviso prévio.",
      "A taxa de juros final e a redução do valor da parcela poderão sofrer oscilações a critério das instituições bancárias.",
    ];
    rodape.forEach((l) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(160, 160, 160);
      doc.text("* " + l, ml, y); y += 4;
    });

    const n = (proposta.nome || "proposta").replace(/\s+/g, "_");
    doc.save("proposta_" + n + ".pdf");
  }, [proposta, tenant, logoBase64, logoDims]);

  // ── render ──────────────────────────────────────────────────────────
  const CONVENIOS = [
    "INSS", "Estadual - SC", "Estadual - SP", "Estadual - MG",
    "Estadual - RS", "Municipal", "Federal", "Forças Armadas",
  ];

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="w-full max-w-3xl mx-auto px-4 py-6 pb-16 space-y-5">

        {/* ── Dados do cliente ── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Dados do cliente
          </p>
          <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Nome completo</label>
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={nome} onChange={e => setNome(e.target.value)}
                placeholder="João da Silva"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">CPF</label>
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={cpf}
                onChange={e => setCpf(mascaraCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Matrícula</label>
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={matricula} onChange={e => setMatricula(e.target.value)}
                placeholder="1234567"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Convênio</label>
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={convenio} onChange={e => setConvenio(e.target.value)}
              >
                <option value="">Selecione...</option>
                {CONVENIOS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* ── Contratos atuais ── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Contratos atuais do cliente
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* header */}
            <div className="grid bg-muted/50 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ gridTemplateColumns: "2fr 1.5fr 1fr 36px" }}>
              <span className="px-3 py-2">Banco</span>
              <span className="px-3 py-2">Parcela (R$)</span>
              <span className="px-3 py-2">Prazo</span>
              <span />
            </div>
            {contratos.map((c) => (
              <div key={c.id} className="grid border-b border-border last:border-b-0 items-center"
                style={{ gridTemplateColumns: "2fr 1.5fr 1fr 36px" }}>
                <div className="p-1.5">
                  <input
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={c.banco} onChange={e => updateContrato(c.id, "banco", e.target.value)}
                    placeholder="Ex: BMG"
                  />
                </div>
                <div className="p-1.5">
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={c.parcela} onChange={e => updateContrato(c.id, "parcela", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="p-1.5">
                  <input
                    type="number" min="1"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={c.prazo} onChange={e => updateContrato(c.id, "prazo", e.target.value)}
                    placeholder="84"
                  />
                </div>
                <div className="flex justify-center">
                  {contratos.length > 1 && (
                    <button
                      onClick={() => remContrato(c.id)}
                      className="w-7 h-7 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center text-base leading-none"
                    >×</button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-4 px-3 py-2 bg-muted/30 text-[12px] text-muted-foreground">
              <span>Total Contratos: <strong className="text-foreground">{contratos.length}</strong></span>
              <span>Soma Parcelas: <strong className="text-foreground">{fmtR(totalContratos)}</strong></span>
            </div>
          </div>
          <button
            onClick={addContrato}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary border border-dashed border-primary rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
          >
            <span className="text-base leading-none">+</span> Adicionar Contrato
          </button>
        </section>

        {/* ── Nova proposta ── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Nova proposta
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid bg-muted/50 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ gridTemplateColumns: "1.5fr 1fr 1.5fr 36px" }}>
              <span className="px-3 py-2">Parcela (R$)</span>
              <span className="px-3 py-2">Prazo</span>
              <span className="px-3 py-2">Troco / Liberado (R$)</span>
              <span />
            </div>
            {novas.map((n) => (
              <div key={n.id} className="grid border-b border-border last:border-b-0 items-center"
                style={{ gridTemplateColumns: "1.5fr 1fr 1.5fr 36px" }}>
                <div className="p-1.5">
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={n.parcela} onChange={e => updateNova(n.id, "parcela", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="p-1.5">
                  <input
                    type="number" min="1"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={n.prazo} onChange={e => updateNova(n.id, "prazo", e.target.value)}
                    placeholder="84"
                  />
                </div>
                <div className="p-1.5">
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={n.troco} onChange={e => updateNova(n.id, "troco", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="flex justify-center">
                  {novas.length > 1 && (
                    <button
                      onClick={() => remNova(n.id)}
                      className="w-7 h-7 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center text-base leading-none"
                    >×</button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-4 px-3 py-2 bg-muted/30 text-[12px] text-muted-foreground flex-wrap">
              <span>Total Parcelas: <strong className="text-foreground">{novas.length}</strong></span>
              <span>Soma Parcelas: <strong className="text-primary">{fmtR(totalNovasParcelas)}</strong></span>
              {totalTroco > 0 && (
                <span>Troco Total: <strong className="text-blue-600 dark:text-blue-400">{fmtR(totalTroco)}</strong></span>
              )}
            </div>
          </div>
          <button
            onClick={addNova}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 border border-dashed border-blue-400 rounded-lg px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <span className="text-base leading-none">+</span> Adicionar Parcela
          </button>
        </section>

        {/* ── Corretor ── */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Corretor
          </p>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Nome</label>
                <input
                  className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={corNome} onChange={e => setCorNome(e.target.value)}
                  placeholder="Nome do corretor"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Cargo / Equipe</label>
                <input
                  className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={corCargo} onChange={e => setCorCargo(e.target.value)}
                  placeholder="Consultor de Crédito"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">WhatsApp</label>
                <input
                  className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={corWa} onChange={e => setCorWa(e.target.value)}
                  placeholder="(48) 99999-0000"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Observação (opcional)</label>
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Aprovação sujeita a análise de margem disponível"
              />
            </div>
          </div>
        </section>

        {/* ── Botões ── */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={gerar}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/90 transition-colors shadow-sm"
          >
            Gerar proposta
          </button>
          <button
            onClick={limpar}
            className="h-10 px-6 rounded-lg border border-border bg-background text-foreground font-medium text-[13px] hover:bg-muted/50 transition-colors"
          >
            Limpar tudo
          </button>
        </div>

        {/* ── Proposta visual ── */}
        {proposta && <PropostaVisual proposta={proposta} onExportPDF={exportPDF} onFechar={() => setProposta(null)} />}
      </div>
    </div>
  );
}

// ── subcomponente PropostaVisual ────────────────────────────────────────
function PropostaVisual({
  proposta,
  onExportPDF,
  onFechar,
}: {
  proposta: PropostaData;
  onExportPDF: () => void;
  onFechar: () => void;
}) {
  const totalAt = proposta.contratos.reduce((s, c) => s + (parseFloat(c.parcela) || 0), 0);
  const totalNv = proposta.novas.reduce((s, n) => s + (parseFloat(n.parcela) || 0), 0);
  const totalTroco = proposta.novas.reduce((s, n) => s + (parseFloat(n.troco) || 0), 0);

  const economia = totalAt && totalNv ? totalAt - totalNv : null;

  const prazosAt = proposta.contratos.filter(c => parseInt(c.prazo)).map(c => parseInt(c.prazo));
  const prazosNv = proposta.novas.filter(n => parseInt(n.prazo)).map(n => parseInt(n.prazo));
  const econTotal = prazosAt.length && prazosNv.length && totalAt && totalNv
    ? totalAt * Math.min(...prazosAt) - totalNv * Math.min(...prazosNv)
    : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-md mt-2">
      {/* barra de gradiente */}
      <div className="h-1 bg-gradient-to-r from-violet-600 via-blue-500 to-pink-500" />

      {/* cabeçalho */}
      <div className="flex justify-between items-start px-6 py-4 border-b border-border">
        <div>
          <div className="text-lg font-bold bg-gradient-to-r from-violet-600 via-blue-500 to-pink-500 bg-clip-text text-transparent">
            Capital Go
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Crédito Consignado</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground leading-relaxed">
          Proposta nº <strong className="text-foreground">{proposta.num}</strong><br />
          {proposta.data}
        </div>
      </div>

      {/* cliente */}
      <div className="px-6 py-3 border-b border-border bg-muted/30">
        <div className="font-medium text-[15px] text-foreground">{proposta.nome}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {[
            proposta.cpf && "CPF: " + maskDoc(proposta.cpf),
            proposta.matricula && "Matrícula: " + maskDoc(proposta.matricula),
            proposta.convenio && "Convênio: " + proposta.convenio,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* corpo */}
      <div className="px-6 py-4 space-y-4">
        {/* Contratos atuais */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-2 bg-muted/40 border-b border-border">
            Contratos atuais
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Banco</th>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Parcela</th>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {proposta.contratos.map((c, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 text-foreground">{c.banco || "—"}</td>
                  <td className="px-4 py-2 font-medium text-foreground">{parseFloat(c.parcela) ? fmtR(parseFloat(c.parcela)) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.prazo ? c.prazo + " meses" : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td className="px-4 py-2 text-[12px] text-muted-foreground">Total mensal atual</td>
                <td className="px-4 py-2 font-semibold text-foreground">{totalAt ? fmtR(totalAt) : "—"}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Nova proposta */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400 px-4 py-2 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border-b border-border">
            Nova proposta · Capital Go
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Parcela</th>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Prazo</th>
                <th className="text-left text-[10px] font-semibold uppercase text-muted-foreground px-4 py-2 bg-muted/20 border-b border-border">Troco</th>
              </tr>
            </thead>
            <tbody>
              {proposta.novas.map((n, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 font-semibold text-violet-600 dark:text-violet-400">{parseFloat(n.parcela) ? fmtR(parseFloat(n.parcela)) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{n.prazo ? n.prazo + " meses" : "—"}</td>
                  <td className="px-4 py-2 text-blue-600 dark:text-blue-400 text-[11px]">{parseFloat(n.troco) > 0 ? fmtR(parseFloat(n.troco)) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-violet-50/50 to-blue-50/50 dark:from-violet-900/10 dark:to-blue-900/10">
                <td className="px-4 py-2 font-semibold text-violet-600 dark:text-violet-400 text-[12px]">{totalNv ? fmtR(totalNv) : "—"}</td>
                <td />
                <td className="px-4 py-2 text-blue-600 dark:text-blue-400 text-[11px]">{totalTroco > 0 ? fmtR(totalTroco) : ""}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Resultado — mostra apenas valores positivos (vantagens reais ao cliente) */}
        {((economia !== null && economia > 0) || totalTroco > 0 || (econTotal !== null && econTotal > 0)) && (() => {
          const mostraEconomia = economia !== null && economia > 0;
          const mostraTroco = totalTroco > 0;
          const mostraEconTotal = econTotal !== null && econTotal > 0;
          const qtdCols = [mostraEconomia, mostraTroco, mostraEconTotal].filter(Boolean).length;
          return (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-2 bg-muted/30 border-b border-border">
                Resultado para o cliente
              </div>
              <div className="grid divide-x divide-border" style={{ gridTemplateColumns: `repeat(${qtdCols}, 1fr)` }}>
                {mostraEconomia && (
                  <div className="text-center p-4">
                    <div className="text-[10px] text-muted-foreground mb-1">Economia mensal</div>
                    <div className="text-base font-semibold text-green-600 dark:text-green-400">{fmtR(economia!)}</div>
                    <div className="inline-block text-[9px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full mt-1">Por mês</div>
                  </div>
                )}
                {mostraTroco && (
                  <div className="text-center p-4">
                    <div className="text-[10px] text-muted-foreground mb-1">Troco disponível</div>
                    <div className="text-base font-semibold text-blue-600 dark:text-blue-400">{fmtR(totalTroco)}</div>
                    <div className="inline-block text-[9px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full mt-1">Disponível</div>
                  </div>
                )}
                {mostraEconTotal && (
                  <div className="text-center p-4">
                    <div className="text-[10px] text-muted-foreground mb-1">Economia total est.</div>
                    <div className="text-base font-semibold text-green-600 dark:text-green-400">{fmtR(econTotal!)}</div>
                    <div className="inline-block text-[9px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full mt-1">No período</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Obs */}
        {proposta.obs && (
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <strong className="text-foreground">Obs:</strong> {proposta.obs}
          </div>
        )}
      </div>

      {/* assinatura */}
      <div className="flex items-center gap-3 px-6 py-3 border-t border-border bg-muted/20">
        <div>
          <div className="text-[13px] font-medium text-foreground">{proposta.corNome}</div>
          <div className="text-[11px] text-muted-foreground">
            {[proposta.corCargo, proposta.corWa].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">Capital Go</div>
          <div className="text-[10px] text-muted-foreground">{proposta.data}</div>
        </div>
      </div>

      {/* rodapé */}
      <div className="px-6 py-3 border-t border-border bg-muted/10">
        <ul className="space-y-0.5">
          <li className="text-[9px] text-muted-foreground/70 before:content-['*'] before:mr-1">Cálculos de amortização de parcela são diários e sofrem alteração.</li>
          <li className="text-[9px] text-muted-foreground/70 before:content-['*'] before:mr-1">Proposta válida até {proposta.validade}, sujeita a alteração sem aviso prévio.</li>
          <li className="text-[9px] text-muted-foreground/70 before:content-['*'] before:mr-1">A taxa de juros final poderá sofrer oscilações a critério das instituições bancárias.</li>
        </ul>
      </div>

      {/* botões */}
      <div className="flex gap-3 px-6 py-3 border-t border-border">
        <button
          onClick={onExportPDF}
          className="h-9 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/90 transition-colors"
        >
          Exportar PDF
        </button>
        <button
          onClick={onFechar}
          className="h-9 px-5 rounded-lg border border-border bg-background text-foreground font-medium text-[13px] hover:bg-muted/50 transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
