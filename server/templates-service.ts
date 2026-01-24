import ExcelJS from "exceljs";

// Colunas que DEVEM ser formatadas como TEXTO para não virar notação científica
const TEXT_COLUMNS = ["cpf", "matricula", "upag", "numero_contrato", "n_contrato", "prazo", "prazo_remanescente", "m_instituidor", "ids", "instituidor", "arq_upag", "cep", "telefone_1", "telefone_2", "telefone_3", "telefone_4", "telefone_5"];

// Colunas do template Folha Servidor - ordem EXATA conforme especificação do usuário
// NÃO reordenar, NÃO renomear, NÃO traduzir, NÃO remover espaços ou acentos
export const FOLHA_SERVIDOR_HEADERS = [
  "Orgão",
  "Matricula",
  "Base Calc",
  "Bruta 5%",
  "Utilz 5%",
  "Saldo 5%",
  "Beneficio Bruta 5%",
  "Beneficio Utilizado 5%",
  "Beneficio Saldo 5%",
  "Bruta 35%",
  "Utilz 35%",
  "Saldo 35%",
  "Bruta 70%",
  "Utilz 70%",
  "Saldo 70%",
  "Créditos",
  "Débitos",
  "Líquido",
  "Salário Bruto",
  "Descontos Brutos",
  "Salário Líquido",
  "ARQ. UPAG",
  "EXC QTD",
  "EXC Soma",
  "RJUR",
  "Sit Func",
  "CPF",
  "Margem",
];

// Mapeamento de header → campo interno (para parser)
export const FOLHA_SERVIDOR_COLUMN_MAP: Record<string, string> = {
  "Orgão": "orgao",
  "Matricula": "matricula",
  "Base Calc": "base_calc",
  "Bruta 5%": "margem_5_bruta",
  "Utilz 5%": "margem_5_utilizada",
  "Saldo 5%": "margem_5_saldo",
  "Beneficio Bruta 5%": "margem_beneficio_5_bruta",
  "Beneficio Utilizado 5%": "margem_beneficio_5_utilizada",
  "Beneficio Saldo 5%": "margem_beneficio_5_saldo",
  "Bruta 35%": "margem_35_bruta",
  "Utilz 35%": "margem_35_utilizada",
  "Saldo 35%": "margem_35_saldo",
  "Bruta 70%": "margem_70_bruta",
  "Utilz 70%": "margem_70_utilizada",
  "Saldo 70%": "margem_70_saldo",
  "Créditos": "creditos",
  "Débitos": "debitos",
  "Líquido": "liquido",
  "Salário Bruto": "salario_bruto",
  "Descontos Brutos": "descontos_brutos",
  "Salário Líquido": "salario_liquido",
  "ARQ. UPAG": "arq_upag",
  "EXC QTD": "exc_qtd",
  "EXC Soma": "exc_soma",
  "RJUR": "rjur",
  "Sit Func": "sit_func",
  "CPF": "cpf",
  "Margem": "margem",
};

// Colunas do template Folha Pensionista - ordem EXATA conforme especificação
// Diferença do Servidor: inclui coluna "Instituidor" na posição 2
export const FOLHA_PENSIONISTA_HEADERS = [
  "Orgão",
  "Instituidor",
  "Matricula",
  "Base Calc",
  "Bruta 5%",
  "Utilz 5%",
  "Saldo 5%",
  "Beneficio Bruta 5%",
  "Beneficio Utilizado 5%",
  "Beneficio Saldo 5%",
  "Bruta 35%",
  "Utilz 35%",
  "Saldo 35%",
  "Bruta 70%",
  "Utilz 70%",
  "Saldo 70%",
  "Créditos",
  "Débitos",
  "Líquido",
  "Salário Bruto",
  "Descontos Brutos",
  "Salário Líquido",
  "ARQ. UPAG",
  "EXC QTD",
  "EXC Soma",
  "RJUR",
  "Sit Func",
  "CPF",
  "Margem",
];

// Mapeamento de header → campo interno (Pensionista - inclui instituidor)
export const FOLHA_PENSIONISTA_COLUMN_MAP: Record<string, string> = {
  ...FOLHA_SERVIDOR_COLUMN_MAP,
  "Instituidor": "instituidor",
};

export const TEMPLATE_COLUMNS = {
  folha: [
    // Ordem EXATA conforme especificação - com acentos e % incluídos
    { header: "Orgão", key: "orgao", width: 25, required: false, example: "SECRETARIA DE EDUCACAO", isText: false },
    { header: "Matricula", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "Base Calc", key: "base_calc", width: 15, required: false, example: "5000,00", isText: false },
    { header: "Bruta 5%", key: "margem_5_bruta", width: 12, required: false, example: "250,00", isText: false },
    { header: "Utilz 5%", key: "margem_5_utilizada", width: 12, required: false, example: "50,00", isText: false },
    { header: "Saldo 5%", key: "margem_5_saldo", width: 12, required: false, example: "200,00", isText: false },
    { header: "Beneficio Bruta 5%", key: "margem_beneficio_5_bruta", width: 18, required: false, example: "250,00", isText: false },
    { header: "Beneficio Utilizado 5%", key: "margem_beneficio_5_utilizada", width: 20, required: false, example: "50,00", isText: false },
    { header: "Beneficio Saldo 5%", key: "margem_beneficio_5_saldo", width: 18, required: false, example: "200,00", isText: false },
    { header: "Bruta 35%", key: "margem_35_bruta", width: 12, required: false, example: "1.750,00", isText: false },
    { header: "Utilz 35%", key: "margem_35_utilizada", width: 12, required: false, example: "500,00", isText: false },
    { header: "Saldo 35%", key: "margem_35_saldo", width: 12, required: false, example: "1.250,00", isText: false },
    { header: "Bruta 70%", key: "margem_70_bruta", width: 12, required: false, example: "3.500,00", isText: false },
    { header: "Utilz 70%", key: "margem_70_utilizada", width: 12, required: false, example: "1.000,00", isText: false },
    { header: "Saldo 70%", key: "margem_70_saldo", width: 12, required: false, example: "2.500,00", isText: false },
    { header: "Créditos", key: "creditos", width: 12, required: false, example: "5.000,00", isText: false },
    { header: "Débitos", key: "debitos", width: 12, required: false, example: "1.000,00", isText: false },
    { header: "Líquido", key: "liquido", width: 12, required: false, example: "4.000,00", isText: false },
    { header: "Salário Bruto", key: "salario_bruto", width: 15, required: false, example: "5.000,00", isText: false },
    { header: "Descontos Brutos", key: "descontos_brutos", width: 16, required: false, example: "1.000,00", isText: false },
    { header: "Salário Líquido", key: "salario_liquido", width: 15, required: false, example: "4.000,00", isText: false },
    { header: "ARQ. UPAG", key: "arq_upag", width: 15, required: false, example: "00123", isText: true },
    { header: "EXC QTD", key: "exc_qtd", width: 10, required: false, example: "0", isText: false },
    { header: "EXC Soma", key: "exc_soma", width: 12, required: false, example: "0,00", isText: false },
    { header: "RJUR", key: "rjur", width: 10, required: false, example: "CLT", isText: false },
    { header: "Sit Func", key: "sit_func", width: 15, required: false, example: "ATIVO", isText: false },
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "Margem", key: "margem", width: 12, required: false, example: "200,00", isText: false },
  ],
  folha_pensionista: [
    // Ordem EXATA conforme especificação - inclui Instituidor na posição 2
    { header: "Orgão", key: "orgao", width: 25, required: false, example: "SECRETARIA DE EDUCACAO", isText: false },
    { header: "Instituidor", key: "instituidor", width: 15, required: false, example: "0654321", isText: true },
    { header: "Matricula", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "Base Calc", key: "base_calc", width: 15, required: false, example: "3500,00", isText: false },
    { header: "Bruta 5%", key: "margem_5_bruta", width: 12, required: false, example: "175,00", isText: false },
    { header: "Utilz 5%", key: "margem_5_utilizada", width: 12, required: false, example: "50,00", isText: false },
    { header: "Saldo 5%", key: "margem_5_saldo", width: 12, required: false, example: "125,00", isText: false },
    { header: "Beneficio Bruta 5%", key: "margem_beneficio_5_bruta", width: 18, required: false, example: "175,00", isText: false },
    { header: "Beneficio Utilizado 5%", key: "margem_beneficio_5_utilizada", width: 20, required: false, example: "25,00", isText: false },
    { header: "Beneficio Saldo 5%", key: "margem_beneficio_5_saldo", width: 18, required: false, example: "150,00", isText: false },
    { header: "Bruta 35%", key: "margem_35_bruta", width: 12, required: false, example: "1.225,00", isText: false },
    { header: "Utilz 35%", key: "margem_35_utilizada", width: 12, required: false, example: "400,00", isText: false },
    { header: "Saldo 35%", key: "margem_35_saldo", width: 12, required: false, example: "825,00", isText: false },
    { header: "Bruta 70%", key: "margem_70_bruta", width: 12, required: false, example: "2.450,00", isText: false },
    { header: "Utilz 70%", key: "margem_70_utilizada", width: 12, required: false, example: "700,00", isText: false },
    { header: "Saldo 70%", key: "margem_70_saldo", width: 12, required: false, example: "1.750,00", isText: false },
    { header: "Créditos", key: "creditos", width: 12, required: false, example: "3.500,00", isText: false },
    { header: "Débitos", key: "debitos", width: 12, required: false, example: "700,00", isText: false },
    { header: "Líquido", key: "liquido", width: 12, required: false, example: "2.800,00", isText: false },
    { header: "Salário Bruto", key: "salario_bruto", width: 15, required: false, example: "3.500,00", isText: false },
    { header: "Descontos Brutos", key: "descontos_brutos", width: 16, required: false, example: "700,00", isText: false },
    { header: "Salário Líquido", key: "salario_liquido", width: 15, required: false, example: "2.800,00", isText: false },
    { header: "ARQ. UPAG", key: "arq_upag", width: 15, required: false, example: "00456", isText: true },
    { header: "EXC QTD", key: "exc_qtd", width: 10, required: false, example: "0", isText: false },
    { header: "EXC Soma", key: "exc_soma", width: 12, required: false, example: "0,00", isText: false },
    { header: "RJUR", key: "rjur", width: 10, required: false, example: "CLT", isText: false },
    { header: "Sit Func", key: "sit_func", width: 15, required: false, example: "PENSIONISTA", isText: false },
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00098765432", isText: true },
    { header: "Margem", key: "margem", width: 12, required: false, example: "125,00", isText: false },
  ],
  d8_servidor: [
    { header: "BANCO", key: "banco", width: 20, required: true, example: "BANCO DO BRASIL", isText: false },
    { header: "ORGAO", key: "orgao", width: 25, required: true, example: "20114", isText: false },
    { header: "MATRICULA", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "UF", key: "uf", width: 5, required: true, example: "DF", isText: false },
    { header: "NOME", key: "nome", width: 30, required: true, example: "JOAO DA SILVA SANTOS", isText: false },
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "TIPO_CONTRATO", key: "tipo_contrato", width: 15, required: true, example: "CONSIGNADO", isText: false },
    { header: "PMT", key: "pmt", width: 15, required: true, example: 328.50, isText: false },
    { header: "PRAZO_REMANESCENTE", key: "prazo_remanescente", width: 18, required: true, example: "030", isText: true },
    { header: "SITUACAO_CONTRATO", key: "situacao_contrato", width: 18, required: true, example: "ATIVO", isText: false },
    { header: "NUMERO_CONTRATO", key: "numero_contrato", width: 25, required: true, example: "00123456789012345", isText: true },
  ],
  d8_pensionista: [
    { header: "ORGAO", key: "orgao", width: 25, required: true, example: "20114", isText: false },
    { header: "M_INSTITUIDOR", key: "m_instituidor", width: 15, required: false, example: "0654321", isText: true },
    { header: "MATRICULA", key: "matricula", width: 15, required: true, example: "0012345", isText: true },
    { header: "UF", key: "uf", width: 5, required: true, example: "DF", isText: false },
    { header: "NOME", key: "nome", width: 30, required: true, example: "MARIA DA SILVA SANTOS", isText: false },
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "TIPO_CONTRATO", key: "tipo_contrato", width: 15, required: true, example: "CONSIGNADO", isText: false },
    { header: "PMT", key: "pmt", width: 15, required: true, example: 300.00, isText: false },
    { header: "PRAZO_REMANESCENTE", key: "prazo_remanescente", width: 18, required: true, example: "024", isText: true },
    { header: "NUMERO_CONTRATO", key: "numero_contrato", width: 25, required: true, example: "00987654321012345", isText: true },
    { header: "BANCO", key: "banco", width: 20, required: true, example: "CAIXA ECONOMICA", isText: false },
  ],
  contatos: [
    { header: "CPF", key: "cpf", width: 15, required: true, example: "00012345678", isText: true },
    { header: "DATA_NASCIMENTO", key: "data_nascimento", width: 15, required: false, example: "15/03/1985", isText: false },
    { header: "BANCO", key: "banco_nome", width: 25, required: false, example: "BANCO DO BRASIL", isText: false },
    { header: "AGENCIA", key: "agencia", width: 12, required: false, example: "1234", isText: true },
    { header: "CONTA", key: "conta", width: 15, required: false, example: "12345-6", isText: true },
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

export type TemplateType = "folha" | "folha_pensionista" | "d8_servidor" | "d8_pensionista" | "contatos";

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
    upag: "Unidade pagadora (preserva zeros) - sinonimos: UPAG, ARQ. UPAG, ARQ_UPAG",
    arq_upag: "Unidade pagadora (sinonimo de UPAG)",
    uf: "Estado (sigla)",
    municipio: "Cidade do cliente",
    sit_func: "Situacao funcional (ATIVO, APOSENTADO, PENSIONISTA)",
    creditos: "Creditos/Salario bruto em reais (sinonimo: salario_bruto)",
    debitos: "Debitos/Descontos em reais (sinonimo: descontos_brutos)",
    liquido: "Liquido em reais (sinonimo: salario_liquido)",
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
  
  if (templateType === "folha" || templateType === "folha_pensionista") {
    const folhaRow = instructionsSheet.addRow({ field: ">>> ORDEM DE IMPORTACAO: Importe a FOLHA PRIMEIRO <<<" });
    folhaRow.getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    instructionsSheet.addRow({ field: "A folha cria o vinculo CPF+MATRICULA que sera usado por D8 e Contatos" });
    if (templateType === "folha_pensionista") {
      instructionsSheet.addRow({ field: ">>> FOLHA PENSIONISTA: Inclui coluna INSTITUIDOR <<<" });
      instructionsSheet.addRow({ field: "INSTITUIDOR: matricula do servidor original (fonte do beneficio)" });
    }
  } else if (templateType.startsWith("d8")) {
    const d8Row = instructionsSheet.addRow({ field: ">>> ORDEM: Importe D8 DEPOIS da Folha <<<" });
    d8Row.getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    instructionsSheet.addRow({ field: "O par CPF+MATRICULA deve existir (importado via Folha)" });
    if (templateType === "d8_pensionista") {
      instructionsSheet.addRow({ field: ">>> D8 PENSIONISTA: 14 colunas na ordem especifica <<<" });
      instructionsSheet.addRow({ field: "ORGAO, M_INSTITUIDOR, MATRICULA, UF, NOME, CPF, TIPO_CONTRATO, PMT, PRAZO_REMANESCENTE, IDS, OBS, REGIME_JURIDICO, NUMERO_CONTRATO, BANCO" });
      instructionsSheet.addRow({ field: "M_INSTITUIDOR: matricula do servidor original (para pensoes)" });
      instructionsSheet.addRow({ field: "IDS: identificador adicional (opcional)" });
      instructionsSheet.addRow({ field: "OBS: observacoes (opcional)" });
      instructionsSheet.addRow({ field: "REGIME_JURIDICO: regime juridico do pensionista (opcional)" });
    } else {
      instructionsSheet.addRow({ field: ">>> D8 SERVIDOR: 11 colunas obrigatorias <<<" });
      instructionsSheet.addRow({ field: "BANCO, ORGAO, MATRICULA, UF, NOME, CPF, TIPO_CONTRATO, PMT, PRAZO_REMANESCENTE, SITUACAO_CONTRATO, NUMERO_CONTRATO" });
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
    folha: "modelo_folha_servidor.xlsx",
    folha_pensionista: "modelo_folha_pensionista.xlsx",
    d8_servidor: "modelo_d8_servidor.xlsx",
    d8_pensionista: "modelo_d8_pensionista.xlsx",
    contatos: "modelo_dados_complementares.xlsx",
  };
  return names[templateType];
}
