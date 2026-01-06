import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, Phone, MessageSquare, Mail, User, Building, CreditCard, Search,
  Landmark, Briefcase, Copy, Calendar, MapPin, Database, Calculator, Star
} from "lucide-react";

interface HigienizacaoTelefone {
  telefone: string;
  tipo: string;
  principal: boolean | null;
}

interface ConsultaData {
  clienteBase: any | null;
  folhaAtual: any | null;
  contratos: any[];
  higienizacao?: {
    telefones: HigienizacaoTelefone[];
    emails: string[];
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
    };
  };
  vinculo?: {
    id: number;
    pessoaId: number;
    cpf: string;
    matricula: string;
    orgao: string | null;
    upag: string | null;
    sitFunc: string | null;
    rjur: string | null;
    natureza: string | null;
  } | null;
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function CopyableField({ 
  value, 
  displayValue, 
  testId, 
  className = "",
  toast 
}: { 
  value: string | null | undefined; 
  displayValue: string; 
  testId: string;
  className?: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const handleCopy = async () => {
    if (!value || value === "-") return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const canCopy = value && value !== "-" && displayValue !== "-";

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{displayValue}</span>
      {canCopy && (
        <button
          onClick={handleCopy}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          data-testid={testId}
          type="button"
        >
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </span>
  );
}

export default function VendasConsulta() {
  const { toast } = useToast();
  const [termoBusca, setTermoBusca] = useState("");
  const [consultaData, setConsultaData] = useState<ConsultaData | null>(null);
  const [contratosSelecionados, setContratosSelecionados] = useState<Set<number>>(new Set());
  const [taxasContratos, setTaxasContratos] = useState<Record<number, string>>({});

  const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    
    const str = String(value).trim();
    
    if (/^-?\d+\.?\d*$/.test(str)) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    
    const cleaned = str
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calcularSaldoDevedorPrice = (valorParcela: number | null, taxaPercent: number, parcelasRestantes: number | null): number | null => {
    if (!valorParcela || !parcelasRestantes || taxaPercent <= 0) return null;
    const i = taxaPercent / 100;
    const n = parcelasRestantes;
    const pmt = valorParcela;
    const pv = pmt * (1 - Math.pow(1 + i, -n)) / i;
    return pv;
  };

  const { data: nomenclaturas } = useQuery<{ id: number; categoria: string; codigo: string; nome: string; ativo: boolean }[]>({
    queryKey: ["/api/nomenclaturas-cached"],
    staleTime: 1000 * 60 * 5,
  });

  const mapNomenclatura = (categoria: "ORGAO" | "TIPO_CONTRATO" | "UPAG" | "UF" | "SIT_FUNC" | "RJUR", codigo: string | null | undefined): string => {
    if (!codigo) return "-";
    if (!nomenclaturas) return codigo;
    const found = nomenclaturas.find(n => n.categoria === categoria && n.codigo === codigo && n.ativo);
    return found ? found.nome : codigo;
  };

  useEffect(() => {
    setContratosSelecionados(new Set());
    setTaxasContratos({});
  }, [consultaData?.clienteBase?.cpf]);

  const buscarMutation = useMutation({
    mutationFn: async (termo: string) => {
      const termoNormalizado = termo.replace(/\D/g, "");
      if (!termoNormalizado) {
        throw new Error("CPF ou Matrícula inválido");
      }
      const res = await apiRequest("POST", "/api/vendas/consulta/buscar", { termo: termoNormalizado });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Cliente não encontrado");
      }
      const data = await res.json();
      
      const transformFolha = (folha: any) => {
        if (!folha) return null;
        return {
          ...folha,
          margem_bruta_5: folha.margemBruta5 ?? folha.margem_bruta_5,
          margem_saldo_5: folha.margemSaldo5 ?? folha.margem_saldo_5,
          margem_utilizada_5: folha.margemUtilizada5 ?? folha.margem_utilizada_5,
          margem_bruta_35: folha.margemBruta35 ?? folha.margem_bruta_35,
          margem_saldo_35: folha.margemSaldo35 ?? folha.margem_saldo_35,
          margem_utilizada_35: folha.margemUtilizada35 ?? folha.margem_utilizada_35,
          margem_bruta_70: folha.margemBruta70 ?? folha.margem_bruta_70,
          margem_saldo_70: folha.margemSaldo70 ?? folha.margem_saldo_70,
          margem_utilizada_70: folha.margemUtilizada70 ?? folha.margem_utilizada_70,
          margem_beneficio_bruta_5: folha.margemBeneficioBruta5 ?? folha.margem_beneficio_bruta_5,
          margem_beneficio_saldo_5: folha.margemBeneficioSaldo5 ?? folha.margem_beneficio_saldo_5,
          margem_beneficio_utilizada_5: folha.margemBeneficioUtilizada5 ?? folha.margem_beneficio_utilizada_5,
          margem_cartao_credito_saldo: folha.margemCartaoCreditoSaldo ?? folha.margem_cartao_credito_saldo,
          margem_cartao_beneficio_saldo: folha.margemCartaoBeneficioSaldo ?? folha.margem_cartao_beneficio_saldo,
        };
      };
      
      const transformContrato = (contrato: any) => {
        if (!contrato) return null;
        return {
          ...contrato,
          valor_parcela: contrato.valorParcela ?? contrato.valor_parcela,
          parcelas_restantes: contrato.parcelasRestantes ?? contrato.parcelas_restantes,
          saldo_devedor: contrato.saldoDevedor ?? contrato.saldo_devedor,
          tipo_contrato: contrato.tipoContrato ?? contrato.tipo_contrato,
          numero_contrato: contrato.numeroContrato ?? contrato.numero_contrato ?? contrato.contrato,
        };
      };
      
      return {
        ...data,
        folhaAtual: transformFolha(data.folhaAtual),
        contratos: (data.contratos || []).map(transformContrato),
      };
    },
    onSuccess: (data) => {
      setConsultaData(data);
      setContratosSelecionados(new Set());
      setTaxasContratos({});
      toast({ title: "Cliente encontrado", description: data.clienteBase?.nome || "Dados carregados" });
    },
    onError: (error: any) => {
      setConsultaData(null);
      toast({ 
        title: "Cliente não localizado", 
        description: error.message || "Verifique os dados informados ou atualize a Base de Clientes.",
        variant: "destructive" 
      });
    },
  });

  const handleBuscar = () => {
    if (!termoBusca.trim()) {
      toast({ title: "Atenção", description: "Digite CPF ou Matrícula", variant: "destructive" });
      return;
    }
    buscarMutation.mutate(termoBusca.trim());
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (!consultaData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Consulta de Cliente</h1>
          <p className="text-muted-foreground">Busque dados completos de clientes por CPF ou Matrícula</p>
        </div>

        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Buscar Cliente</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Digite o CPF ou Matrícula do cliente para consultar dados completos, contratos e margens disponíveis.
            </p>
            <div className="w-full max-w-md space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite CPF ou Matrícula..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  data-testid="input-termo-busca"
                  className="flex-1"
                />
                <Button 
                  onClick={handleBuscar} 
                  disabled={buscarMutation.isPending}
                  data-testid="button-buscar"
                >
                  {buscarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Consultar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-shrink-0 border-b bg-card p-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" data-testid="text-cliente-nome">
                  {consultaData.clienteBase?.nome || "-"}
                </h1>
                <Badge variant="secondary" data-testid="badge-modo">Consulta</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <CopyableField
                  value={consultaData.clienteBase?.cpf}
                  displayValue={formatCPF(consultaData.clienteBase?.cpf)}
                  testId="button-copy-cpf-header"
                  className="font-mono"
                  toast={toast}
                />
                <span className="text-muted-foreground">Matrícula:</span>
                <CopyableField
                  value={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula}
                  displayValue={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula || "-"}
                  testId="button-copy-matricula-header"
                  className="font-mono"
                  toast={toast}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setConsultaData(null)}
                data-testid="button-nova-busca"
              >
                <Search className="h-4 w-4 mr-2" />
                Nova Busca
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-4">
        <div className="container mx-auto p-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">CPF</p>
                      <p className="font-mono" data-testid="text-cpf">
                        <CopyableField
                          value={consultaData.clienteBase?.cpf}
                          displayValue={formatCPF(consultaData.clienteBase?.cpf)}
                          testId="button-copy-cpf"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Matrícula</p>
                      <p className="font-mono" data-testid="text-matricula">
                        <CopyableField
                          value={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula}
                          displayValue={consultaData.vinculo?.matricula || consultaData.clienteBase?.matricula || "-"}
                          testId="button-copy-matricula"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-nome">
                        {consultaData.clienteBase?.nome || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Nascimento / Idade
                      </p>
                      <div className="flex items-center gap-2 flex-wrap" data-testid="text-data-nascimento">
                        {(() => {
                          const dataNasc = consultaData.clienteBase?.data_nascimento || consultaData.clienteBase?.dataNascimento;
                          if (!dataNasc) return <span>-</span>;
                          const dataFormatada = new Date(dataNasc).toLocaleDateString("pt-BR");
                          const hoje = new Date();
                          const nascimento = new Date(dataNasc);
                          let idade = hoje.getFullYear() - nascimento.getFullYear();
                          const mesAtual = hoje.getMonth();
                          const mesNasc = nascimento.getMonth();
                          if (mesAtual < mesNasc || (mesAtual === mesNasc && hoje.getDate() < nascimento.getDate())) {
                            idade--;
                          }
                          return (
                            <>
                              <span>{dataFormatada}</span>
                              <Badge variant="secondary">{idade} anos</Badge>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Situação Funcional</p>
                      <Badge variant="secondary" data-testid="text-sit-func">
                        {mapNomenclatura("SIT_FUNC", consultaData.vinculo?.sitFunc || consultaData.clienteBase?.sit_func || consultaData.clienteBase?.sitFunc)}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Regime Jurídico (REJUR)</p>
                      <p data-testid="text-rjur">
                        {mapNomenclatura("RJUR", consultaData.vinculo?.rjur || consultaData.clienteBase?.rjur || consultaData.clienteBase?.regime_juridico)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Natureza</p>
                      <p data-testid="text-natureza">
                        {consultaData.vinculo?.natureza || consultaData.clienteBase?.natureza || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">UPAG</p>
                      <p data-testid="text-upag">
                        {mapNomenclatura("UPAG", consultaData.vinculo?.upag || consultaData.clienteBase?.upag || consultaData.clienteBase?.undpagadoracod)}
                      </p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Building className="w-4 h-4" />
                        Órgão
                      </p>
                      <p data-testid="text-orgao">
                        {mapNomenclatura("ORGAO", consultaData.vinculo?.orgao || consultaData.clienteBase?.orgao || consultaData.clienteBase?.orgaocod)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        Última Base
                      </p>
                      <Badge variant="secondary" data-testid="text-ultima-base">
                        {consultaData.clienteBase?.base_tag || consultaData.folhaAtual?.competencia || "-"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Dados Bancários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Banco</p>
                      <p data-testid="text-banco">
                        <CopyableField
                          value={consultaData.clienteBase?.banco_codigo || consultaData.clienteBase?.bancoCodigo}
                          displayValue={consultaData.clienteBase?.banco_nome || consultaData.clienteBase?.bancoNome || consultaData.clienteBase?.banco_codigo || consultaData.clienteBase?.bancoCodigo || "-"}
                          testId="button-copy-banco"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Agência</p>
                      <p data-testid="text-agencia">
                        <CopyableField
                          value={consultaData.clienteBase?.agencia}
                          displayValue={consultaData.clienteBase?.agencia || "-"}
                          testId="button-copy-agencia"
                          toast={toast}
                        />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Conta</p>
                      <p data-testid="text-conta">
                        <CopyableField
                          value={consultaData.clienteBase?.conta}
                          displayValue={consultaData.clienteBase?.conta || "-"}
                          testId="button-copy-conta"
                          toast={toast}
                        />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Situação de Folha
                  </CardTitle>
                  <CardDescription>
                    {consultaData.folhaAtual?.competencia
                      ? `Competência: ${consultaData.folhaAtual.competencia}`
                      : "Dados de folha não disponíveis"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {consultaData.folhaAtual ? (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-muted/50" data-testid="card-margem-70">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Margem 70%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_70)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_70)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(consultaData.folhaAtual.margem_saldo_70 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(consultaData.folhaAtual.margem_saldo_70)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/50" data-testid="card-margem-35">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Margem 35%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_35)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_35)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(consultaData.folhaAtual.margem_saldo_35 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(consultaData.folhaAtual.margem_saldo_35)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/50" data-testid="card-margem-5">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Margem 5%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_bruta_5)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_utilizada_5)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(consultaData.folhaAtual.margem_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(consultaData.folhaAtual.margem_saldo_5)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/50" data-testid="card-margem-beneficio-5">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium mb-2">Benefício 5%</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruta:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_bruta_5)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Utilizada:</span>
                              <span>{formatCurrency(consultaData.folhaAtual.margem_beneficio_utilizada_5)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Saldo:</span>
                              <span className={(consultaData.folhaAtual.margem_beneficio_saldo_5 ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                                {formatCurrency(consultaData.folhaAtual.margem_beneficio_saldo_5)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-muted-foreground">Total Créditos</p>
                          <p className="font-medium text-green-600">{formatCurrency(consultaData.folhaAtual.creditos ?? consultaData.folhaAtual.salario_bruto)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Total Débitos</p>
                          <p className="font-medium text-red-600">{formatCurrency(consultaData.folhaAtual.debitos ?? consultaData.folhaAtual.descontos_brutos)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Valor Líquido</p>
                          <p className="font-medium">{formatCurrency(consultaData.folhaAtual.liquido ?? consultaData.folhaAtual.salario_liquido)}</p>
                        </div>
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de folha disponível para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Contratos
                  </CardTitle>
                  <CardDescription>
                    {consultaData.contratos && consultaData.contratos.length > 0
                      ? `${consultaData.contratos.length} contrato(s) encontrado(s)`
                      : "Nenhum contrato registrado"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {consultaData.contratos && consultaData.contratos.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={contratosSelecionados.size === consultaData.contratos.length && consultaData.contratos.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setContratosSelecionados(new Set(consultaData.contratos.map((_, idx) => idx)));
                                  } else {
                                    setContratosSelecionados(new Set());
                                  }
                                }}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Origem do Desconto</TableHead>
                            <TableHead>Nº Contrato</TableHead>
                            <TableHead className="text-right">Valor Parcela</TableHead>
                            <TableHead className="text-center w-20">Taxa (%)</TableHead>
                            <TableHead className="text-right">Saldo Devedor</TableHead>
                            <TableHead className="text-right">Parc. Rest.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consultaData.contratos.map((contrato, idx) => {
                            const taxaStr = taxasContratos[idx];
                            const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                            const valorParcela = contrato.valor_parcela || contrato.valorParcela;
                            const parcelasRestantes = contrato.parcelas_restantes || contrato.parcelasRestantes;
                            const saldoCalculado = taxa > 0 
                              ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes)
                              : null;
                            const saldoExibir = saldoCalculado !== null ? saldoCalculado : (contrato.saldo_devedor || contrato.saldoDevedor);
                            const isCalculado = saldoCalculado !== null;
                            return (
                              <TableRow key={idx} data-testid={`row-contrato-${idx}`} className={contratosSelecionados.has(idx) ? "bg-muted/50" : ""}>
                                <TableCell>
                                  <Checkbox
                                    checked={contratosSelecionados.has(idx)}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(contratosSelecionados);
                                      if (checked) {
                                        newSet.add(idx);
                                      } else {
                                        newSet.delete(idx);
                                      }
                                      setContratosSelecionados(newSet);
                                    }}
                                    data-testid={`checkbox-contrato-${idx}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {mapNomenclatura("TIPO_CONTRATO", contrato.tipo_contrato || contrato.tipoContrato)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  <CopyableField
                                    value={contrato.banco || contrato.BANCO_DO_EMPRESTIMO}
                                    displayValue={contrato.banco || contrato.BANCO_DO_EMPRESTIMO || "-"}
                                    testId={`button-copy-banco-contrato-${idx}`}
                                    toast={toast}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  <CopyableField
                                    value={contrato.numero_contrato || contrato.numeroContrato}
                                    displayValue={contrato.numero_contrato || contrato.numeroContrato || "-"}
                                    testId={`button-copy-contrato-${idx}`}
                                    toast={toast}
                                  />
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(valorParcela)}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="w-16 h-8 text-sm text-center"
                                    value={taxasContratos[idx] || ""}
                                    onChange={(e) => setTaxasContratos(prev => ({
                                      ...prev,
                                      [idx]: e.target.value
                                    }))}
                                    data-testid={`input-taxa-${idx}`}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {formatCurrency(saldoExibir)}
                                    {isCalculado && (
                                      <Badge variant="outline" className="text-xs ml-1 text-blue-600 border-blue-300">
                                        calc
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{parcelasRestantes || "-"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>

                      {contratosSelecionados.size > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Resumo dos {contratosSelecionados.size} contrato(s) selecionado(s)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {(() => {
                              let somaParcelas = 0;
                              let somaSaldo = 0;
                              let totalParcelasRestantes = 0;
                              let contratosComParcelas = 0;
                              contratosSelecionados.forEach((idx) => {
                                const contrato = consultaData.contratos[idx];
                                if (!contrato) return;
                                const valorParcela = parseCurrency(contrato.valor_parcela || contrato.valorParcela);
                                const parcelasRestantes = parseInt(String(contrato.parcelas_restantes || contrato.parcelasRestantes || 0)) || 0;
                                const taxaStr = taxasContratos[idx];
                                const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                                const saldoCalculado = taxa > 0 
                                  ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes)
                                  : null;
                                const saldoContrato = saldoCalculado !== null ? saldoCalculado : parseCurrency(contrato.saldo_devedor || contrato.saldoDevedor);
                                somaParcelas += valorParcela;
                                somaSaldo += saldoContrato;
                                if (parcelasRestantes > 0) {
                                  totalParcelasRestantes += parcelasRestantes;
                                  contratosComParcelas++;
                                }
                              });
                              const prazoMedio = contratosComParcelas > 0 ? Math.round(totalParcelasRestantes / contratosComParcelas) : 0;
                              return (
                                <>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Parcelas</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaParcelas)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Soma Saldo Devedor</p>
                                    <p className="font-bold text-lg">{formatCurrency(somaSaldo)}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg text-center">
                                    <p className="text-muted-foreground text-xs">Prazo Médio</p>
                                    <p className="font-bold text-lg">{prazoMedio} meses</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum contrato registrado para este cliente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Painel de Contato</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue="telefones" className="w-full">
                    <TabsList className="w-full rounded-none border-b">
                      <TabsTrigger value="telefones" className="flex-1" data-testid="tab-telefones">
                        <Phone className="h-3 w-3 mr-1" />
                        Telefones
                      </TabsTrigger>
                      <TabsTrigger value="emails" className="flex-1" data-testid="tab-emails">
                        <Mail className="h-3 w-3 mr-1" />
                        Emails
                      </TabsTrigger>
                      <TabsTrigger value="endereco" className="flex-1" data-testid="tab-endereco">
                        <MapPin className="h-3 w-3 mr-1" />
                        Endereço
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="telefones" className="p-4 space-y-2">
                      {consultaData.higienizacao?.telefones && consultaData.higienizacao.telefones.length > 0 ? (
                        <>
                          <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                          {consultaData.higienizacao.telefones.map((tel, idx) => (
                            <div 
                              key={`hig-tel-${idx}`} 
                              className="flex items-center gap-2 p-2 border rounded text-sm bg-green-50 dark:bg-green-950/30"
                              data-testid={`higienizacao-tel-${idx}`}
                            >
                              {tel.principal && <Star className="h-3 w-3 text-yellow-500 fill-current shrink-0" />}
                              <span className="font-medium flex-1 truncate">{formatPhone(tel.telefone)}</span>
                              <Badge variant="outline" className="text-xs shrink-0">{tel.tipo}</Badge>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCopyPhone(tel.telefone)}
                                data-testid={`button-copy-hig-tel-${idx}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Sem telefones cadastrados
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="emails" className="p-4 space-y-2">
                      {consultaData.higienizacao?.emails && consultaData.higienizacao.emails.length > 0 ? (
                        <>
                          <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                          {consultaData.higienizacao.emails.map((email, idx) => (
                            <div 
                              key={`email-${idx}`} 
                              className="flex items-center gap-2 p-2 border rounded text-sm bg-blue-50 dark:bg-blue-950/30"
                              data-testid={`email-item-${idx}`}
                            >
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium flex-1 truncate">{email}</span>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCopyPhone(email)}
                                data-testid={`button-copy-email-${idx}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Sem emails cadastrados
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="endereco" className="p-4 space-y-2">
                      {consultaData.higienizacao?.endereco ? (
                        <div className="space-y-3 text-sm p-3 border rounded bg-green-50 dark:bg-green-950/30">
                          <p className="text-xs text-muted-foreground font-medium">Base Importada</p>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Logradouro</p>
                            <p>{consultaData.higienizacao.endereco.logradouro || "-"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Número</p>
                              <p>{consultaData.higienizacao.endereco.numero || "-"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Complemento</p>
                              <p>{consultaData.higienizacao.endereco.complemento || "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Bairro</p>
                            <p>{consultaData.higienizacao.endereco.bairro || "-"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Cidade</p>
                              <p>{consultaData.higienizacao.endereco.cidade || "-"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">UF</p>
                              <p>{consultaData.higienizacao.endereco.uf || "-"}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">CEP</p>
                            <p>{consultaData.higienizacao.endereco.cep || "-"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Sem endereço cadastrado
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
