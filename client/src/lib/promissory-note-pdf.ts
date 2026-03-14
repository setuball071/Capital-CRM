import { valorPorExtenso } from "./valor-extenso";

interface PromissoryNoteData {
  npNumber: string;
  companyRazaoSocial: string;
  companyCnpj: string;
  companyCidade: string;
  companyUf: string;
  devedorNome: string;
  devedorCpf: string;
  devedorEndereco: string;
  valor: string;
  dataVencimento: string;
  localPagamento?: string | null;
  multaPercentual?: string | null;
  jurosPercentual?: string | null;
  bancoOrigem?: string | null;
  dataPagamento?: string | null;
  descricao?: string | null;
  prazoProtesto?: number | null;
  localEmissao: string;
  dataEmissao: string;
  emitidoPorNome?: string | null;
}

function formatCurrency(val: string | number): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}

function formatDateBr(dateStr: string): string {
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export function generatePromissoryNotePDF(data: PromissoryNoteData) {
  const valorNum = parseFloat(data.valor);
  const valorFormatado = formatCurrency(valorNum);
  const valorExtenso = valorPorExtenso(valorNum);
  const multa = data.multaPercentual || "2";
  const juros = data.jurosPercentual || "1";
  const prazoProtesto = data.prazoProtesto || 3;
  const foro = `${data.companyCidade}/${data.companyUf}`;
  const vencimentoFormatado = formatDateBr(data.dataVencimento);
  const localPagamento = data.localPagamento || `${data.companyCidade}/${data.companyUf}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Promissória ${data.npNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm 15mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      line-height: 1.4;
    }
    .page { max-width: 180mm; margin: 0 auto; padding: 5mm 0; }

    .doc-header {
      border: 2px solid #000;
      padding: 0;
      margin-bottom: 0;
    }
    .doc-header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid #000;
    }
    .doc-header-top .doc-title {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    .doc-header-top .doc-np {
      font-size: 12pt;
      font-weight: bold;
    }

    .valor-box {
      border: 2px solid #000;
      border-top: none;
      margin-bottom: 12px;
    }
    .valor-box-main {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .valor-box-main .vb-label {
      width: 60mm;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 10pt;
      border-right: 1px solid #000;
      background: #f5f5f5;
    }
    .valor-box-main .vb-value {
      flex: 1;
      padding: 6px 12px;
      font-size: 14pt;
      font-weight: bold;
      text-align: right;
    }
    .valor-extenso {
      padding: 6px 12px;
      font-size: 10pt;
      font-style: italic;
      border-bottom: 1px solid #000;
    }
    .valor-vencimento {
      display: flex;
    }
    .valor-vencimento .vv-item {
      flex: 1;
      padding: 6px 12px;
      font-size: 10pt;
    }
    .valor-vencimento .vv-item:first-child {
      border-right: 1px solid #000;
    }
    .vv-label { font-weight: bold; }

    .details-grid {
      border: 1px solid #000;
      margin-bottom: 12px;
    }
    .detail-row {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .dl {
      width: 50mm;
      padding: 4px 10px;
      font-weight: bold;
      font-size: 10pt;
      background: #f9f9f9;
      border-right: 1px solid #ccc;
    }
    .detail-row .dv {
      flex: 1;
      padding: 4px 10px;
      font-size: 10pt;
    }
    .detail-section-header {
      background: #e8e8e8;
      padding: 4px 10px;
      font-weight: bold;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #000;
    }

    .legal-section {
      margin-bottom: 12px;
    }
    .legal-section h3 {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #999;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    .legal-text {
      text-align: justify;
      margin-bottom: 8px;
      font-size: 10.5pt;
      text-indent: 2em;
    }
    .legal-text strong { font-weight: bold; }

    .emission-line {
      text-align: right;
      font-size: 10.5pt;
      margin-top: 20px;
      margin-bottom: 40px;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 30mm;
      margin-top: 50px;
    }
    .sig-block {
      flex: 1;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 40px;
    }
    .sig-role { font-size: 10pt; font-weight: bold; }
    .sig-name { font-size: 9pt; }
    .sig-doc { font-size: 9pt; color: #333; }

    .footer {
      text-align: center;
      margin-top: 25px;
      font-size: 8pt;
      color: #888;
      border-top: 1px solid #ddd;
      padding-top: 6px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-top">
        <span class="doc-title">Nota Promissória</span>
        <span class="doc-np">N.º ${escapeHtml(data.npNumber)}</span>
      </div>
    </div>

    <div class="valor-box">
      <div class="valor-box-main">
        <div class="vb-label">VALOR</div>
        <div class="vb-value">${escapeHtml(valorFormatado)}</div>
      </div>
      <div class="valor-extenso">
        ${escapeHtml(valorExtenso)}
      </div>
      <div class="valor-vencimento">
        <div class="vv-item">
          <span class="vv-label">Vencimento:</span> ${escapeHtml(vencimentoFormatado)}
        </div>
        <div class="vv-item">
          <span class="vv-label">Local de Pagamento:</span> ${escapeHtml(localPagamento)}
        </div>
      </div>
    </div>

    <div class="details-grid">
      <div class="detail-section-header">Credor / Emitente</div>
      <div class="detail-row">
        <div class="dl">Razão Social</div>
        <div class="dv">${escapeHtml(data.companyRazaoSocial)}</div>
      </div>
      <div class="detail-row">
        <div class="dl">CNPJ</div>
        <div class="dv">${escapeHtml(data.companyCnpj)}</div>
      </div>
      <div class="detail-section-header">Devedor(a) / Emitente</div>
      <div class="detail-row">
        <div class="dl">Nome</div>
        <div class="dv">${escapeHtml(data.devedorNome)}</div>
      </div>
      <div class="detail-row">
        <div class="dl">CPF</div>
        <div class="dv">${escapeHtml(formatCpf(data.devedorCpf))}</div>
      </div>
      <div class="detail-row">
        <div class="dl">Endereço</div>
        <div class="dv">${escapeHtml(data.devedorEndereco)}</div>
      </div>
      ${data.bancoOrigem ? `
      <div class="detail-section-header">Dados da Operação</div>
      <div class="detail-row">
        <div class="dl">Banco de Origem</div>
        <div class="dv">${escapeHtml(data.bancoOrigem)}</div>
      </div>
      ${data.dataPagamento ? `<div class="detail-row">
        <div class="dl">Data Pagamento</div>
        <div class="dv">${escapeHtml(formatDateBr(data.dataPagamento))}</div>
      </div>` : ""}` : ""}
    </div>

    <div class="legal-section">
      <h3>Termos e Condições</h3>
      ${data.descricao ? `
      <p class="legal-text">${escapeHtml(data.descricao)}</p>
      ` : `
      <p class="legal-text">
        No vencimento desta Nota Promissória, o(a) devedor(a) <strong>${escapeHtml(data.devedorNome)}</strong>,
        inscrito(a) no CPF sob o n.º <strong>${escapeHtml(formatCpf(data.devedorCpf))}</strong>,
        residente e domiciliado(a) em <strong>${escapeHtml(data.devedorEndereco)}</strong>,
        pagará por esta única via de NOTA PROMISSÓRIA a <strong>${escapeHtml(data.companyRazaoSocial)}</strong>,
        inscrita no CNPJ sob o n.º <strong>${escapeHtml(data.companyCnpj)}</strong>,
        ou à sua ordem, a quantia de <strong>${escapeHtml(valorFormatado)}</strong>
        (${escapeHtml(valorExtenso)}), pagável em <strong>${escapeHtml(localPagamento)}</strong>.
      </p>
      <p class="legal-text">
        Em caso de inadimplência, incidirá multa de <strong>${escapeHtml(multa)}%</strong>
        (${escapeHtml(multa)} por cento) sobre o valor total, acrescido de juros moratórios de
        <strong>${escapeHtml(juros)}%</strong> (${escapeHtml(juros)} por cento) ao mês,
        calculados pro rata die a partir da data do vencimento até a data do efetivo pagamento.
      </p>
      <p class="legal-text">
        O devedor poderá antecipar o pagamento total ou parcial desta nota promissória,
        mediante comunicação prévia ao credor com antecedência mínima de 5 (cinco) dias úteis.
      </p>
      <p class="legal-text">
        Esta nota promissória será protestada no prazo de <strong>${prazoProtesto}</strong>
        (${escapeHtml(prazoProtestoPorExtenso(prazoProtesto))}) dia(s)
        após o vencimento, caso não seja paga até a data de vencimento, conforme legislação vigente.
      </p>
      <p class="legal-text">
        Fica eleito o foro da comarca de <strong>${escapeHtml(foro)}</strong> para dirimir
        quaisquer questões oriundas desta Nota Promissória, com renúncia expressa a qualquer outro,
        por mais privilegiado que seja.
      </p>
      `}
    </div>

    <div class="emission-line">
      ${escapeHtml(data.localEmissao)}, ${escapeHtml(formatDateBr(data.dataEmissao))}
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-role">Emitente / Credor</div>
          <div class="sig-name">${escapeHtml(data.companyRazaoSocial)}</div>
          <div class="sig-doc">CNPJ: ${escapeHtml(data.companyCnpj)}</div>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-role">Devedor(a)</div>
          <div class="sig-name">${escapeHtml(data.devedorNome)}</div>
          <div class="sig-doc">CPF: ${escapeHtml(formatCpf(data.devedorCpf))}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Documento gerado eletronicamente em ${escapeHtml(formatDateBr(data.dataEmissao))}
      ${data.emitidoPorNome ? ` por ${escapeHtml(data.emitidoPorNome)}` : ""}
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function prazoProtestoPorExtenso(prazo: number): string {
  const map: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
    6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    15: "quinze", 20: "vinte", 30: "trinta",
  };
  return map[prazo] || String(prazo);
}
