// ═══════════════════════════════════════════════════════════════════════════
// VIABILIDADE INTER — números de negócio que ANTES moravam no HTML.
//
// O `isMaster` da tela decidia se DESENHAVA a comissão; o número seguia dentro
// do arquivo que o navegador baixa — bastava Ctrl+U para ler. Agora a tela pede
// por API e o servidor decide o que mandar: comissão só para o master.
//
// Os valores abaixo foram recortados do próprio viabilidade-inter.html, sem
// redigitar nada (25/09/2026). A grade por convênio continua editável pelo
// master em /api/viabilidade-regras — isto aqui é o padrão de fábrica.
// ═══════════════════════════════════════════════════════════════════════════

export interface ConvenioRegra {
  conv: string;
  max: number;
  /** [taxa sem seguro, taxa com seguro, número da tabela de comissionamento] */
  grade: number[][];
}

/** Grade de taxas por convênio — abas "Apoio" e "Tabela de Comissionamento". */
export const REGRAS_PADRAO: ConvenioRegra[] = [
  { conv: 'Aeronáutica', max: 5.0, grade: [[1.85,1.85,1], [1.86,1.86,2], [1.88,1.88,3], [1.89,1.89,4], [1.91,1.91,5], [1.92,1.92,6]] },
  { conv: 'Bombeiros MG', max: 5.0, grade: [[2.25,2.25,1], [2.26,2.26,2], [2.28,2.28,3], [2.29,2.29,4], [2.3,2.3,5], [2.32,2.32,6]] },
  { conv: 'Def. Pública MG', max: 5.0, grade: [[2.25,2.25,1], [2.26,2.26,2], [2.28,2.28,3], [2.29,2.29,4], [2.3,2.3,5], [2.32,2.32,6]] },
  { conv: 'Estado BA', max: 5.0, grade: [[1.91,1.91,1], [1.92,1.92,2], [1.93,1.93,3], [1.94,1.94,4], [1.95,1.95,5], [1.96,1.96,6]] },
  { conv: 'Estado MS', max: 5.0, grade: [[1.88,1.88,1], [1.89,1.89,2], [1.91,1.91,3], [1.92,1.92,4], [1.93,1.93,5], [1.94,1.94,6]] },
  { conv: 'Estado SC', max: 5.0, grade: [[2.0,2.0,1], [2.01,2.01,2], [2.03,2.03,3], [2.04,2.04,4], [2.05,2.05,5], [2.07,2.07,6]] },
  { conv: 'Exército', max: 2.04, grade: [[1.7,1.7,1], [1.71,1.71,2], [1.73,1.73,3], [1.74,1.74,4], [1.76,1.76,5], [1.77,1.77,6]] },
  { conv: 'Grupo I Governos', max: 5.0, grade: [[2.19,2.19,1], [2.21,2.21,2], [2.22,2.22,3], [2.23,2.23,4], [2.24,2.24,5], [2.26,2.26,6]] },
  { conv: 'Grupo II Prefeituras', max: 5.0, grade: [[2.12,2.12,1], [2.14,2.14,2], [2.15,2.15,3], [2.17,2.17,4], [2.19,2.19,5], [2.2,2.2,6]] },
  { conv: 'INSS', max: 1.85, grade: [[1.78,1.78,1], [1.79,1.79,2], [1.81,1.81,3], [1.82,1.82,4], [1.83,1.83,5], [1.85,1.85,6]] },
  { conv: 'IPSEMG', max: 5.0, grade: [[2.25,2.25,1], [2.26,2.26,2], [2.28,2.28,3], [2.29,2.29,4], [2.3,2.3,5], [2.32,2.32,6]] },
  { conv: 'IPSM', max: 5.0, grade: [[2.25,2.25,1], [2.26,2.26,2], [2.28,2.28,3], [2.29,2.29,4], [2.3,2.3,5], [2.32,2.32,6]] },
  { conv: 'Marinha', max: 2.04, grade: [[1.83,1.83,1], [1.85,1.85,2], [1.87,1.87,3], [1.89,1.89,4], [1.91,1.91,5], [1.93,1.93,6]] },
  { conv: 'PMMG', max: 5.0, grade: [[2.17,2.17,1], [2.19,2.19,2], [2.2,2.2,3], [2.21,2.21,4], [2.23,2.23,5], [2.24,2.24,6]] },
  { conv: 'Pref. Contagem', max: 5.0, grade: [[1.97,1.97,1], [1.98,1.98,2], [2.0,2.0,3], [2.01,2.01,4], [2.03,2.03,5], [2.05,2.05,6]] },
  { conv: 'Pref. Goiânia', max: 5.0, grade: [[2.04,2.04,1], [2.06,2.06,2], [2.08,2.08,3], [2.09,2.09,4], [2.11,2.11,5], [2.13,2.13,6]] },
  { conv: 'Pref. SP', max: 5.0, grade: [[1.76,1.76,1], [1.77,1.77,2], [1.79,1.79,3], [1.8,1.8,4], [1.82,1.82,5], [1.83,1.83,6]] },
  { conv: 'SEPLAG MG', max: 5.0, grade: [[2.25,2.25,1], [2.26,2.26,2], [2.28,2.28,3], [2.29,2.29,4], [2.3,2.3,5], [2.32,2.32,6]] },
  { conv: 'SPPrev', max: 5.0, grade: [[1.74,1.74,1], [1.75,1.75,2], [1.77,1.77,3], [1.78,1.78,4], [1.79,1.79,5], [1.81,1.81,6]] },
  { conv: 'Siape', max: 1.8, grade: [[1.63,1.6,1], [1.65,1.62,2], [1.66,1.63,3], [1.67,1.64,4], [1.68,1.65,5], [1.69,1.66,6]] },
  { conv: 'Tribunais Estaduais', max: 5.0, grade: [[1.92,1.92,1], [1.94,1.94,2], [1.95,1.95,3], [1.96,1.96,4], [1.97,1.97,5], [1.99,1.99,6]] },
  { conv: 'Tribunais Federais', max: 5.0, grade: [[2.01,2.01,1], [2.02,2.02,2], [2.03,2.03,3], [2.04,2.04,4], [2.05,2.05,5], [2.07,2.07,6]] }
];

/** Range Refin: 31 tabelas, de 1,50% a 3,00%, de 0,05 em 0,05. Com seguro
 *  prestamista a taxa de cada uma cai 0,03 ponto. */
export const REFIN = { primeira: 1.50, passo: 0.05, quantidade: 31, descontoSeguro: 0.03 };

/** Comissão que fica com a casa em cada tabela de comissionamento (coluna
 *  "fabio" da planilha, 23/09/2026). Sempre sobre o SALDO DEVEDOR portado.
 *  ⚠ Só sai do servidor para o master. */
export const COMISSAO_TABELA: Record<string, number> = { 1: 0.35, 2: 0.65, 3: 1.00, 4: 1.35, 5: 1.70, 6: 2.05 };
