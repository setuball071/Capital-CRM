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

export interface PerfilDimItem {
  chave: string;
  valor: number;
  clientes: number;
}

export interface PerfilResp {
  total: { valor: number; clientes: number };
  convenio: PerfilDimItem[];
  uf: PerfilDimItem[];
  faixaEtaria: PerfilDimItem[];
  orgao: PerfilDimItem[];
  sitFunc: PerfilDimItem[];
  bancoRecebimento: PerfilDimItem[];
}

export interface PerfDimItem {
  chave: string;
  cadQtd: number;
  cadValor: number;
  prodQtd: number;
  prodValor: number;
  conversao: number; // 0..1 (prodQtd / cadQtd)
  ticket: number; // produção: valor/qtd
}

export interface PerfTotais {
  cadQtd: number;
  cadValor: number;
  prodQtd: number;
  prodValor: number;
  conversao: number; // prodValor / cadValor
  ticket: number;
}

export interface PerformanceResp {
  totais: PerfTotais;
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

export interface PortFunilItem {
  key: string;
  label: string;
  color: string;
  qtd: number;
  valor: number;
}

export interface PortBancoItem {
  chave: string;
  qtd: number;
  valor: number;
  efetividade?: number;
}

export interface PortOrigemItem {
  chave: string;
  qtd: number;
  valor: number;
  valorPago: number;
  valorCancelado: number;
  valorAndamento: number;
}

export interface PortabilidadesResp {
  producao: { valor: number; qtd: number }; // oficial (financeiro, inclui importados)
  bancoProducao: PortBancoItem[];
  kpis: {
    total: number;
    valor: number;
    pagas: number;
    valorPagas: number;
    canceladas: number;
    emAndamento: number;
    efetividade: number;
    saldoInformado: number;
    saldoPago: number;
    diasAtePago: number | null;
    diasCipSaldo: number | null;
  };
  funil: PortFunilItem[];
  bancoDestino: PortBancoItem[];
  bancoOrigem: PortOrigemItem[];
}
