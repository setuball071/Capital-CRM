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

function formatDateExtenso(dateStr: string): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const formatted = formatDateBr(dateStr);
  const parts = formatted.split("/");
  if (parts.length === 3) {
    const dia = parseInt(parts[0]);
    const mes = parseInt(parts[1]) - 1;
    const ano = parts[2];
    return `${dia} de ${meses[mes] || parts[1]} de ${ano}`;
  }
  return formatted;
}

export function generatePromissoryNotePDF(data: PromissoryNoteData) {
  const valorNum = parseFloat(data.valor);
  const valorFormatado = formatCurrency(valorNum);
  const valorExtenso = valorPorExtenso(valorNum);
  const multa = data.multaPercentual || "2";
  const juros = data.jurosPercentual || "1";
  const prazoProtesto = data.prazoProtesto || 3;
  const vencimentoFormatado = formatDateBr(data.dataVencimento);
  const localPagamento = data.localPagamento || `${data.companyCidade}/${data.companyUf}`;
  const dataEmissaoExtenso = formatDateExtenso(data.dataEmissao);
  const cpfFormatado = formatCpf(data.devedorCpf);

  let operationParagraph = "";
  if (data.descricao) {
    operationParagraph = `<p class="legal-text">${escapeHtml(data.descricao)}</p>`;
  } else {
    const banco = data.bancoOrigem ? ` junto ao banco <strong>${escapeHtml(data.bancoOrigem)}</strong>` : "";
    const pagDateStr = data.dataPagamento ? `, com pagamento realizado em <strong>${escapeHtml(formatDateBr(data.dataPagamento))}</strong>` : "";
    operationParagraph = `<p class="legal-text">A presente nota promissória é emitida em caráter <strong>pro solvendo</strong>, vinculada à operação de quitação de contrato${banco}${pagDateStr}, no valor de <strong>${escapeHtml(valorFormatado)}</strong>.</p>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Nota Promissória ${escapeHtml(data.npNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 15mm 18mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      line-height: 1.5;
    }
    .page { max-width: 180mm; margin: 0 auto; padding: 5mm 0; }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
      margin-bottom: 0;
    }
    .doc-header .company-name {
      font-size: 13pt;
      font-weight: bold;
    }
    .doc-header .np-title {
      text-align: right;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .valor-box {
      border: 1.5px solid #000;
      border-top: none;
      margin-bottom: 16px;
    }
    .valor-row {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .valor-row:last-child { border-bottom: none; }
    .valor-row .vr-label {
      width: 55mm;
      padding: 5px 10px;
      font-weight: bold;
      font-size: 10pt;
      border-right: 1px solid #000;
      background: #f5f5f5;
    }
    .valor-row .vr-value {
      flex: 1;
      padding: 5px 10px;
      font-size: 10pt;
    }
    .valor-row .vr-value.big {
      font-size: 13pt;
      font-weight: bold;
      text-align: right;
    }
    .valor-row .vr-value.italic {
      font-style: italic;
    }

    .section {
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 10.5pt;
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

    .incisos {
      margin: 8px 0 8px 3em;
      font-size: 10.5pt;
    }
    .inciso {
      margin-bottom: 4px;
      text-align: justify;
    }
    .inciso-num {
      font-weight: bold;
      margin-right: 4px;
    }

    .encargos-list {
      margin: 6px 0 6px 3em;
      font-size: 10.5pt;
      list-style: disc;
    }
    .encargos-list li {
      margin-bottom: 3px;
    }

    .emission-line {
      text-align: right;
      font-size: 10.5pt;
      margin-top: 24px;
      margin-bottom: 50px;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 20mm;
      margin-top: 40px;
    }
    .sig-block {
      flex: 1;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #000;
      padding-top: 6px;
      margin-top: 50px;
    }
    .sig-name { font-size: 10pt; font-weight: bold; }
    .sig-doc { font-size: 9pt; color: #333; margin-top: 2px; }
    .sig-role { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 8pt;
      color: #777;
      border-top: 1px solid #ccc;
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
      <div class="company-name">${escapeHtml(data.companyRazaoSocial)}</div>
      <div class="np-title">NOTA PROMISSÓRIA / Nº ${escapeHtml(data.npNumber)}</div>
    </div>

    <div class="valor-box">
      <div class="valor-row">
        <div class="vr-label">VALOR</div>
        <div class="vr-value big">${escapeHtml(valorFormatado)}</div>
      </div>
      <div class="valor-row">
        <div class="vr-label">VALOR POR EXTENSO</div>
        <div class="vr-value italic">${escapeHtml(valorExtenso)}</div>
      </div>
      <div class="valor-row">
        <div class="vr-label">VENCIMENTO</div>
        <div class="vr-value">${escapeHtml(vencimentoFormatado)}</div>
      </div>
      <div class="valor-row">
        <div class="vr-label">LOCAL DE PAGAMENTO</div>
        <div class="vr-value">${escapeHtml(localPagamento)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">1. Promessa de Pagamento</div>
      <p class="legal-text">Por esta Nota Promissória, eu <strong>${escapeHtml(data.devedorNome)}</strong>, inscrito(a) no CPF nº <strong>${escapeHtml(cpfFormatado)}</strong>, residente e domiciliado(a) em <strong>${escapeHtml(data.devedorEndereco)}</strong>, prometo pagar, de forma incondicional, irrevogável e irretratável, na data de vencimento acima indicada, a <strong>${escapeHtml(data.companyRazaoSocial)}</strong>, pessoa jurídica de direito privado inscrita no CNPJ nº <strong>${escapeHtml(data.companyCnpj)}</strong>, ou à sua ordem, a quantia de <strong>${escapeHtml(valorFormatado)}</strong> (${escapeHtml(valorExtenso)}).</p>
      ${operationParagraph}
    </div>

    <div class="section">
      <div class="section-title">2. Cláusula de Vencimento Antecipado</div>
      <p class="legal-text">A presente Nota Promissória terá seu vencimento automaticamente antecipado, tornando-se imediatamente exigível a totalidade do valor nela consignado, independentemente de aviso, interpelação ou notificação judicial ou extrajudicial, na ocorrência de qualquer das seguintes hipóteses:</p>
      <div class="incisos">
        <div class="inciso"><span class="inciso-num">I –</span> cancelamento da operação de quitação realizada em favor do emitente;</div>
        <div class="inciso"><span class="inciso-num">II –</span> impedimento, bloqueio, estorno ou chargeback do pagamento efetuado pela credora;</div>
        <div class="inciso"><span class="inciso-num">III –</span> fornecimento de informações falsas ou inexatas pelo emitente no momento da contratação;</div>
        <div class="inciso"><span class="inciso-num">IV –</span> prática de fraude ou qualquer ato que inviabilize, prejudique ou reverta a operação realizada;</div>
        <div class="inciso"><span class="inciso-num">V –</span> inadimplemento de qualquer obrigação relacionada à operação que originou este título;</div>
        <div class="inciso"><span class="inciso-num">VI –</span> constatação de que a dívida quitada não era de titularidade do emitente ou não existia nos termos declarados;</div>
        <div class="inciso"><span class="inciso-num">VII –</span> ausência, cancelamento ou impossibilidade de averbação da margem consignável necessária à viabilização da operação, por qualquer motivo imputável ao emitente.</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Cláusula de Protesto</div>
      <p class="legal-text">O presente título será encaminhado a protesto junto ao Cartório de Protesto de Títulos competente decorridos <strong>${prazoProtesto}</strong> dias corridos do vencimento sem que o pagamento integral tenha sido efetuado, nos termos da Lei nº 9.492/1997, independentemente de qualquer notificação prévia ao emitente.</p>
    </div>

    <div class="section">
      <div class="section-title">4. Encargos em Caso de Inadimplemento</div>
      <p class="legal-text" style="text-indent: 0;">Em caso de inadimplemento, incidirão sobre o valor devido os seguintes encargos:</p>
      <ul class="encargos-list">
        <li>Multa moratória de <strong>${escapeHtml(multa)}%</strong> sobre o valor devido;</li>
        <li>Juros de mora de <strong>${escapeHtml(juros)}%</strong> ao mês;</li>
        <li>Correção monetária conforme índice legal aplicável.</li>
      </ul>
    </div>

    <div class="section">
      <div class="section-title">5. Foro</div>
      <p class="legal-text">Fica eleito o foro da Comarca de <strong>${escapeHtml(data.companyCidade)}</strong>, Estado de <strong>${escapeHtml(data.companyUf)}</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas ou controvérsias decorrentes desta Nota Promissória.</p>
    </div>

    <div class="emission-line">
      Emitida em ${escapeHtml(data.companyCidade)} – ${escapeHtml(data.companyUf)}, em ${escapeHtml(dataEmissaoExtenso)}
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-name">${escapeHtml(data.devedorNome)}</div>
          <div class="sig-doc">CPF: ${escapeHtml(cpfFormatado)}</div>
          <div class="sig-role">Emitente / Devedor</div>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-name">${escapeHtml(data.companyRazaoSocial)}</div>
          <div class="sig-doc">CNPJ: ${escapeHtml(data.companyCnpj)}</div>
          <div class="sig-role">Credor / Beneficiário</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Documento gerado eletronicamente | ${escapeHtml(data.npNumber)} | Assinatura eletrônica válida nos termos da MP 2.200-2/2001 e Lei 14.063/2020
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
