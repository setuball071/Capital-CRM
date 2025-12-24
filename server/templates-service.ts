import ExcelJS from "exceljs";

// Colunas que DEVEM ser formatadas como TEXTO para não virar notação científica
const TEXT_COLUMNS = ["cpf", "matricula", "upag", "numero_contrato", "n_contrato", "prazo", "prazo_remanescente", "m_instituidor", "cpf_instituidor", "matricula_instituidor", "cep", "telefone_1", "telefone_2", "telefone_3", "telefone_4", "telefone_5"];

export const TEMPLATE_COLUMNS = {
  folha: [
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "MATRICULA", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "ORGAO", key: "orgaodesc", width: 25, required: false, example: "SECRETARIA DE EDUCACAO", isText: false },
    { header: "UPAG", key: "upag", width: 15, required: false, example: "00123", isText: true },
    { header: "UF", key: "uf", width: 5, required: false, example: "SP", isText: false },
    { header: "MUNICIPIO", key: "municipio", width: 20, required: false, example: "SAO PAULO", isText: false },
    { header: "SITUACAO_FUNCIONAL", key: "sit_func", width: 20, required: false, example: "ATIVO", isText: false },
    { header: "SALARIO_BRUTO", key: "salario_bruto", width: 15, required: false, example: 5000.00, isText: false },
    { header: "DESCONTOS_BRUTOS", key: "descontos_brutos", width: 15, required: false, example: 1000.00, isText: false },
    { header: "SALARIO_LIQUIDO", key: "salario_liquido", width: 15, required: false, example: 4000.00, isText: false },
    // Margem 5% (Bruta 5%, Utiliz 5%, Saldo 5%)
    { header: "MARGEM_5_BRUTA", key: "margem_5_bruta", width: 15, required: false, example: 250.00, isText: false },
    { header: "MARGEM_5_UTILIZADA", key: "margem_5_utilizada", width: 18, required: false, example: 50.00, isText: false },
    { header: "MARGEM_5_SALDO", key: "margem_5_saldo", width: 15, required: false, example: 200.00, isText: false },
    // Margem Benefício 5% (Beneficio Bruta 5%, Beneficio Utilizado 5%, Beneficio Saldo 5%)
    { header: "MARGEM_BENEFICIO_5_BRUTA", key: "margem_beneficio_5_bruta", width: 22, required: false, example: 250.00, isText: false },
    { header: "MARGEM_BENEFICIO_5_UTILIZADA", key: "margem_beneficio_5_utilizada", width: 25, required: false, example: 50.00, isText: false },
    { header: "MARGEM_BENEFICIO_5_SALDO", key: "margem_beneficio_5_saldo", width: 22, required: false, example: 200.00, isText: false },
    // Margem 35% (Bruta 35%, Utiliz 35%, Saldo 35%)
    { header: "MARGEM_35_BRUTA", key: "margem_35_bruta", width: 15, required: false, example: 1750.00, isText: false },
    { header: "MARGEM_35_UTILIZADA", key: "margem_35_utilizada", width: 18, required: false, example: 500.00, isText: false },
    { header: "MARGEM_35_SALDO", key: "margem_35_saldo", width: 15, required: false, example: 1250.00, isText: false },
    // Margem 70% (Bruta 70%, Utiliz 70%, Saldo 70%)
    { header: "MARGEM_70_BRUTA", key: "margem_70_bruta", width: 15, required: false, example: 3500.00, isText: false },
    { header: "MARGEM_70_UTILIZADA", key: "margem_70_utilizada", width: 18, required: false, example: 1000.00, isText: false },
    { header: "MARGEM_70_SALDO", key: "margem_70_saldo", width: 15, required: false, example: 2500.00, isText: false },
    { header: "MARGEM_CARTAO_CREDITO_SALDO", key: "margem_cartao_credito_saldo", width: 25, required: false, example: 200.00, isText: false },
    { header: "MARGEM_CARTAO_BENEFICIO_SALDO", key: "margem_cartao_beneficio_saldo", width: 28, required: false, example: 200.00, isText: false },
  ],
  d8_servidor: [
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "MATRICULA", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "NOME", key: "nome", width: 30, required: false, example: "JOAO DA SILVA SANTOS", isText: false },
    { header: "BANCO", key: "banco", width: 20, required: false, example: "BANCO DO BRASIL", isText: false },
    { header: "NUMERO_CONTRATO", key: "numero_contrato", width: 25, required: false, example: "00123456789012345", isText: true },
    { header: "TIPO_CONTRATO", key: "tipo_contrato", width: 15, required: false, example: "CONSIGNADO", isText: false },
    { header: "PMT", key: "pmt", width: 15, required: false, example: 328.50, isText: false },
    { header: "PMT_FMT", key: "pmt_fmt", width: 18, required: false, example: "000000328,50", isText: true },
    { header: "SALDO_DEVEDOR", key: "saldo_devedor", width: 15, required: false, example: 15000.00, isText: false },
    { header: "PRAZO", key: "prazo", width: 10, required: false, example: "084", isText: true },
    { header: "PRAZO_REMANESCENTE", key: "prazo_remanescente", width: 18, required: false, example: "030", isText: true },
    { header: "SITUACAO_CONTRATO", key: "situacao_contrato", width: 18, required: false, example: "ATIVO", isText: false },
    { header: "DATA_INICIO", key: "data_inicio", width: 12, required: false, example: "01/01/2024", isText: false },
    { header: "DATA_FIM", key: "data_fim", width: 12, required: false, example: "01/01/2027", isText: false },
  ],
  d8_pensionista: [
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "MATRICULA", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "NOME", key: "nome", width: 30, required: false, example: "MARIA DA SILVA SANTOS", isText: false },
    { header: "BANCO", key: "banco", width: 20, required: false, example: "CAIXA ECONOMICA", isText: false },
    { header: "NUMERO_CONTRATO", key: "numero_contrato", width: 25, required: false, example: "00987654321012345", isText: true },
    { header: "TIPO_CONTRATO", key: "tipo_contrato", width: 15, required: false, example: "CONSIGNADO", isText: false },
    { header: "PMT", key: "pmt", width: 15, required: false, example: 300.00, isText: false },
    { header: "PMT_FMT", key: "pmt_fmt", width: 18, required: false, example: "000000300,00", isText: true },
    { header: "SALDO_DEVEDOR", key: "saldo_devedor", width: 15, required: false, example: 9000.00, isText: false },
    { header: "PRAZO", key: "prazo", width: 10, required: false, example: "072", isText: true },
    { header: "PRAZO_REMANESCENTE", key: "prazo_remanescente", width: 18, required: false, example: "024", isText: true },
    { header: "SITUACAO_CONTRATO", key: "situacao_contrato", width: 18, required: false, example: "ATIVO", isText: false },
    { header: "M_INSTITUIDOR", key: "m_instituidor", width: 15, required: false, example: "0654321", isText: true },
    { header: "CPF_INSTITUIDOR", key: "cpf_instituidor", width: 15, required: false, example: "00098765432", isText: true },
    { header: "MATRICULA_INSTITUIDOR", key: "matricula_instituidor", width: 20, required: false, example: "0654321", isText: true },
  ],
  contatos: [
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "TELEFONE_1", key: "telefone_1", width: 15, required: false, example: "11999998888", isText: true },
    { header: "TELEFONE_2", key: "telefone_2", width: 15, required: false, example: "11988887777", isText: true },
    { header: "TELEFONE_3", key: "telefone_3", width: 15, required: false, example: "1133334444", isText: true },
    { header: "TELEFONE_4", key: "telefone_4", width: 15, required: false, example: "", isText: true },
    { header: "TELEFONE_5", key: "telefone_5", width: 15, required: false, example: "", isText: true },
    { header: "EMAIL", key: "email", width: 30, required: false, example: "cliente@email.com", isText: false },
    { header: "EMAIL_2", key: "email_2", width: 30, required: false, example: "", isText: false },
    { header: "ENDERECO", key: "endereco", width: 40, required: false, example: "RUA EXEMPLO, 123 - APTO 45", isText: false },
    { header: "CIDADE", key: "cidade", width: 20, required: false, example: "SAO PAULO", isText: false },
    { header: "UF", key: "uf", width: 5, required: false, example: "SP", isText: false },
    { header: "CEP", key: "cep", width: 12, required: false, example: "01234567", isText: true },
  ],
};

export type TemplateType = "folha" | "d8_servidor" | "d8_pensionista" | "contatos";

export async function generateExcelTemplate(templateType: TemplateType): Promise<Buffer> {
  const columns = TEMPLATE_COLUMNS[templateType];
  if (!columns) {
    throw new Error(`Template type ${templateType} not found`);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ConsigOne Simulador";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Dados");
  const instructionsSheet = workbook.addWorksheet("Instrucoes");

  // Configure data sheet columns
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colDef.required ? "FF4472C4" : "FF8FAADC" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add example row with proper formatting
  const exampleData: Record<string, string | number> = {};
  columns.forEach(col => {
    exampleData[col.key] = col.example;
  });
  const exampleRow = worksheet.addRow(exampleData);

  // Style example row and set TEXT format for critical columns
  exampleRow.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
    cell.font = {
      italic: true,
      color: { argb: "FF92400E" },
    };
    
    // Set TEXT format for columns that must preserve leading zeros
    if (colDef.isText) {
      cell.numFmt = "@"; // Text format
    }
  });

  // Set column formats for the entire column (for user data)
  columns.forEach((col, index) => {
    if (col.isText) {
      const column = worksheet.getColumn(index + 1);
      column.numFmt = "@"; // Text format for entire column
    }
  });

  // Add instructions sheet
  instructionsSheet.columns = [
    { header: "Campo", key: "field", width: 30 },
    { header: "Obrigatorio", key: "required", width: 15 },
    { header: "Formato", key: "format", width: 15 },
    { header: "Descricao", key: "description", width: 50 },
    { header: "Exemplo", key: "example", width: 25 },
  ];

  // Style instructions header
  const instrHeaderRow = instructionsSheet.getRow(1);
  instrHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Add field descriptions
  const descriptions: Record<string, string> = {
    cpf: "CPF do cliente (11 digitos, com zeros a esquerda)",
    matricula: "Matricula do servidor/pensionista (preserva zeros)",
    nome: "Nome completo do cliente",
    orgaodesc: "Descricao do orgao",
    upag: "Unidade pagadora (preserva zeros)",
    uf: "Estado (sigla)",
    municipio: "Cidade do cliente",
    sit_func: "Situacao funcional (ATIVO, APOSENTADO, PENSIONISTA)",
    salario_bruto: "Salario bruto em reais (numero com 2 decimais)",
    descontos_brutos: "Total de descontos em reais",
    salario_liquido: "Salario liquido em reais",
    margem_30_bruta: "Margem 30% bruta",
    margem_30_utilizada: "Margem 30% ja utilizada",
    margem_30_saldo: "Margem 30% disponivel",
    margem_35_bruta: "Margem 35% bruta",
    margem_35_utilizada: "Margem 35% ja utilizada",
    margem_35_saldo: "Margem 35% disponivel",
    margem_70_bruta: "Margem 70% bruta (saque aniversario)",
    margem_70_utilizada: "Margem 70% ja utilizada",
    margem_70_saldo: "Margem 70% disponivel",
    margem_cartao_credito_saldo: "Margem disponivel para cartao de credito",
    margem_cartao_beneficio_saldo: "Margem disponivel para cartao beneficio",
    banco: "Nome do banco do emprestimo",
    numero_contrato: "Numero do contrato (TEXTO - preserva todos os digitos)",
    tipo_contrato: "Tipo do contrato (CONSIGNADO, CARTAO, etc)",
    pmt: "Valor da parcela (NUMERO com 2 casas decimais)",
    pmt_fmt: "Parcela formatada (TEXTO ex: 000000328,50) - se preenchido, tem prioridade sobre PMT",
    saldo_devedor: "Saldo devedor total em reais",
    prazo: "Prazo total do contrato (3 digitos, ex: 084)",
    prazo_remanescente: "Parcelas restantes (3 digitos, ex: 030)",
    situacao_contrato: "Status do contrato (ATIVO, ENCERRADO)",
    data_inicio: "Data de inicio do contrato (DD/MM/AAAA)",
    data_fim: "Data prevista de fim do contrato (DD/MM/AAAA)",
    m_instituidor: "Matricula do instituidor (para pensionistas, TEXTO)",
    cpf_instituidor: "CPF do instituidor (para pensionistas, 11 digitos)",
    matricula_instituidor: "Matricula do instituidor (para pensionistas)",
    telefone_1: "Telefone principal (DDD + numero, sem formatacao)",
    telefone_2: "Telefone secundario",
    telefone_3: "Telefone adicional",
    telefone_4: "Telefone adicional",
    telefone_5: "Telefone adicional",
    email: "Email principal do cliente",
    email_2: "Email secundario",
    endereco: "Endereco completo",
    cidade: "Cidade",
    cep: "CEP (8 digitos, sem hifen)",
  };

  columns.forEach(col => {
    instructionsSheet.addRow({
      field: col.header,
      required: col.required ? "SIM" : "NAO",
      format: col.isText ? "TEXTO" : "NUMERO/TEXTO",
      description: descriptions[col.key] || col.header,
      example: String(col.example),
    });
  });

  // Add general instructions at the bottom
  instructionsSheet.addRow({});
  const boldStyle: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF1F2937" } };
  
  const instrRow1 = instructionsSheet.addRow({ field: "=== INSTRUCOES GERAIS ===" });
  instrRow1.getCell(1).font = boldStyle;
  
  instructionsSheet.addRow({ field: "1. Campos em AZUL ESCURO sao OBRIGATORIOS" });
  instructionsSheet.addRow({ field: "2. Campos em AZUL CLARO sao opcionais" });
  instructionsSheet.addRow({ field: "3. A linha 2 da aba 'Dados' contem um EXEMPLO - delete antes de importar" });
  instructionsSheet.addRow({ field: "4. Colunas marcadas como TEXTO preservam zeros a esquerda automaticamente" });
  instructionsSheet.addRow({ field: "5. CPF deve ter EXATAMENTE 11 digitos (com zeros a esquerda se necessario)" });
  instructionsSheet.addRow({ field: "6. Valores monetarios (PMT, SALDO) devem usar ponto como separador decimal (ex: 1500.50)" });
  
  instructionsSheet.addRow({});
  
  if (templateType === "folha") {
    const folhaRow = instructionsSheet.addRow({ field: ">>> ORDEM DE IMPORTACAO: Importe a FOLHA PRIMEIRO <<<" });
    folhaRow.getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    instructionsSheet.addRow({ field: "A folha cria o vinculo CPF+MATRICULA que sera usado por D8 e Contatos" });
  } else if (templateType.startsWith("d8")) {
    const d8Row = instructionsSheet.addRow({ field: ">>> ORDEM: Importe D8 DEPOIS da Folha <<<" });
    d8Row.getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    instructionsSheet.addRow({ field: "O par CPF+MATRICULA deve existir (importado via Folha)" });
    instructionsSheet.addRow({ field: "PMT_FMT (texto) tem prioridade sobre PMT (numero) se ambos estiverem preenchidos" });
    if (templateType === "d8_pensionista") {
      instructionsSheet.addRow({ field: "M_INSTITUIDOR: matricula do servidor original (para pensoes)" });
    }
  } else if (templateType === "contatos") {
    const contatosRow = instructionsSheet.addRow({ field: ">>> ORDEM: Importe Contatos POR ULTIMO <<<" });
    contatosRow.getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    instructionsSheet.addRow({ field: "O CPF deve existir na base (importado via Folha ou D8)" });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function getTemplateFileName(templateType: TemplateType): string {
  const names: Record<TemplateType, string> = {
    folha: "modelo_folha.xlsx",
    d8_servidor: "modelo_d8_servidor.xlsx",
    d8_pensionista: "modelo_d8_pensionista.xlsx",
    contatos: "modelo_contatos.xlsx",
  };
  return names[templateType];
}
