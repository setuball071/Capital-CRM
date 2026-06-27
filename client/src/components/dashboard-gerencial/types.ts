export type Gran = "dia" | "semana" | "mes";

export interface DashFiltros {
  inicio: string;
  fim: string;
  gran: Gran;
  banco: string[];
  produto: string[];
  convenio: string[];
  corretor: number[];
  parceiro: number[];
}

export interface KpiBloco {
  pagoValor: number;
  pagoQtd: number;
  ticketMedio: number;
  cadastradoValor: number;
  cadastradoQtd: number;
  conversao: number; // 0..1
}

export interface SeriePonto {
  periodo: string;
  pagoValor: number;
  pagoQtd: number;
  cadastradoValor: number;
  cadastradoQtd: number;
}

export interface QuebraItem {
  chave: string;
  valor: number;
  qtd: number;
}

export interface OficialBloco {
  geral: number; // produção sem cartão (= Meta Geral da equipe)
  novo: number;
  portabilidade: number;
  cartao: number;
  total: number;
  qtd: number;
}

export interface VisaoGeralResp {
  filtrosAplicados: { inicio: string; fim: string; gran: Gran };
  kpis: KpiBloco;
  comparativo: KpiBloco;
  serie: SeriePonto[];
  quebras: { produto: QuebraItem[]; banco: QuebraItem[]; convenio: QuebraItem[] };
  oficial: OficialBloco;
}

export interface DrillItem {
  id: number;
  cliente: string;
  cpf: string;
  corretor: string | null;
  banco: string | null;
  produto: string | null;
  convenio: string | null;
  valor: number;
  status: string;
  criadoEm: string;
  pagoEm: string | null;
}

export interface DashOpcoes {
  bancos: string[];
  convenios: string[];
  produtos: string[];
  corretores: { id: number; nome: string }[];
  parceiros: { id: number; nome: string }[];
}

export type DrillMetrica = "pago" | "cadastro";
export type DrillDim = "produto" | "banco" | "convenio";

export interface PerfDimItem {
  chave: string;
  cadQtd: number;
  cadValor: number;
  pagoQtd: number;
  pagoValor: number;
  conversao: number; // 0..1 (pagoQtd / cadQtd)
  ticket: number; // pago: valor/qtd
}

export interface PerfTotais {
  cadQtd: number;
  cadValor: number;
  pagoQtd: number;
  pagoValor: number;
  conversao: number;
  ticket: number;
}

export interface PerformanceResp {
  totais: PerfTotais;
  oficial: { total: number; geral: number; qtd: number };
  conversaoOficial: number; // produção oficial total ÷ cadastrado (valor)
  produto: PerfDimItem[];
  banco: PerfDimItem[];
  convenio: PerfDimItem[];
  porCliente: {
    clientes: number;
    mediaContratos: number;
    pctUmProduto: number;
    pctMultiProduto: number;
  };
}
