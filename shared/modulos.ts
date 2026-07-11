// Catálogo de módulos vendáveis do SaaS (chaves estáveis — usadas em planos,
// plano_modulos e tenant_modulos). Constante no código por decisão de projeto:
// adicionar módulo novo é mudança de produto, não de dados.
export const MODULOS_CATALOGO = [
  { key: "crm", nome: "CRM de Vendas" },
  { key: "simuladores", nome: "Simuladores" },
  { key: "criador_propostas", nome: "Criador de Propostas" },
  { key: "consulta_individual", nome: "Consulta Individual" },
  { key: "discador", nome: "Discador" },
  { key: "gestao_comercial", nome: "Gestão Comercial" },
  { key: "financeiro", nome: "Financeiro" },
  { key: "relatorios", nome: "Relatórios" },
  { key: "ia_jarvis", nome: "IA Jarvis" },
  { key: "compra_leads", nome: "Compra de Leads / API" },
] as const;

export type ModuloKey = (typeof MODULOS_CATALOGO)[number]["key"];

export const MODULO_KEYS: ModuloKey[] = MODULOS_CATALOGO.map((m) => m.key);
