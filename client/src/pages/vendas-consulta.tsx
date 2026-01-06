import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, Search, User, Building, CreditCard, Phone, Mail, MapPin, Calculator, 
  Landmark, Briefcase, Copy, Calendar, Database
} from "lucide-react";

interface HigienizacaoTelefone {
  telefone: string;
  tipo: string;
  principal: boolean | null;
}

interface ConsultaData {
  clienteBase: any;
  folhaAtual: any | null;
  contratos: any[];
  higienizacao: {
    telefones: HigienizacaoTelefone[];
    emails: string[];
  };
  vinculo?: any;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "-";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function getMarginColor(bruta: number | null | undefined, saldo: number | null | undefined): string {
  if (bruta === null || bruta === undefined || bruta === 0) return "text-muted-foreground";
  if (saldo === null || saldo === undefined) return "text-muted-foreground";
  const percentUsed = ((bruta - saldo) / bruta) * 100;
  if (percentUsed >= 90) return "text-red-600";
  if (percentUsed >= 70) return "text-yellow-600";
  return "text-green-600";
}

function normalizarTermo(termo: string): string {
  return termo.replace(/\D/g, "");
}

function transformFolhaToSnakeCase(folha: any): any {
  if (!folha) return null;
  return {
    ...folha,
    margem_bruta_5: folha.margemBruta5 ?? folha.margem_bruta_5,
    margem_saldo_5: folha.margemSaldo5 ?? folha.margem_saldo_5,
    margem_bruta_35: folha.margemBruta35 ?? folha.margem_bruta_35,
    margem_saldo_35: folha.margemSaldo35 ?? folha.margem_saldo_35,
    margem_bruta_70: folha.margemBruta70 ?? folha.margem_bruta_70,
    margem_saldo_70: folha.margemSaldo70 ?? folha.margem_saldo_70,
    margem_beneficio_bruta_5: folha.margemBeneficioBruta5 ?? folha.margem_beneficio_bruta_5,
    margem_beneficio_saldo_5: folha.margemBeneficioSaldo5 ?? folha.margem_beneficio_saldo_5,
    margem_cartao_credito_saldo: folha.margemCartaoCreditoSaldo ?? folha.margem_cartao_credito_saldo,
    margem_cartao_beneficio_saldo: folha.margemCartaoBeneficioSaldo ?? folha.margem_cartao_beneficio_saldo,
  };
}

function transformContratoToSnakeCase(contrato: any): any {
  if (!contrato) return null;
  return {
    ...contrato,
    valor_parcela: contrato.valorParcela ?? contrato.valor_parcela,
    parcelas_restantes: contrato.parcelasRestantes ?? contrato.parcelas_restantes,
    saldo_devedor: contrato.saldoDevedor ?? contrato.saldo_devedor,
    tipo_operacao: contrato.tipoOperacao ?? contrato.tipo_operacao,
    numero_contrato: contrato.numeroContrato ?? contrato.numero_contrato ?? contrato.contrato,
    banco_nome: contrato.bancoNome ?? contrato.banco_nome ?? contrato.banco,
  };
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
    const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
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

  const buscarMutation = useMutation({
    mutationFn: async (termo: string) => {
      const termoNormalizado = normalizarTermo(termo);
      if (!termoNormalizado) {
        throw new Error("CPF ou Matrícula inválido");
      }
      const res = await apiRequest("POST", "/api/vendas/consulta/buscar", { termo: termoNormalizado });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Cliente não encontrado");
      }
      const data = await res.json();
      return {
        ...data,
        folhaAtual: transformFolhaToSnakeCase(data.folhaAtual),
        contratos: (data.contratos || []).map(transformContratoToSnakeCase),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const cliente = consultaData?.clienteBase;
  const folha = consultaData?.folhaAtual;
  const contratos = consultaData?.contratos || [];
  const vinculo = consultaData?.vinculo;
  const higienizacao = consultaData?.higienizacao;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Consulta de Cliente
          </CardTitle>
          <CardDescription>
            Digite CPF ou Matrícula para consultar os dados do cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Digite CPF ou Matrícula..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                data-testid="input-termo-busca"
              />
            </div>
            <Button 
              onClick={handleBuscar} 
              disabled={buscarMutation.isPending}
              data-testid="button-buscar"
            >
              {buscarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {consultaData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground text-xs">Nome</Label>
                    <p className="font-medium">{cliente?.nome || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">CPF</Label>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{formatCPF(cliente?.cpf)}</p>
                      {cliente?.cpf && (
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(cliente.cpf)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Nascimento</Label>
                    <p className="font-medium">{formatDate(cliente?.dataNascimento)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Matrícula</Label>
                    <p className="font-medium">{vinculo?.matricula || cliente?.matricula || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2 border-t">
                  <div>
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> Situação Funcional
                    </Label>
                    <p className="font-medium">{vinculo?.sitFunc || cliente?.sitFunc || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Landmark className="h-3 w-3" /> Regime Jurídico
                    </Label>
                    <p className="font-medium">{vinculo?.rjur || cliente?.rjur || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Building className="h-3 w-3" /> Órgão
                    </Label>
                    <p className="font-medium text-xs">{vinculo?.orgao || cliente?.orgao || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">UPAG</Label>
                    <p className="font-medium text-xs">{vinculo?.upag || cliente?.upag || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {folha && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Situação de Folha
                    {folha.competencia && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {folha.competencia}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-muted-foreground text-xs">Créditos</p>
                      <p className="font-bold text-lg text-green-600">{formatCurrency(folha.creditos)}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-muted-foreground text-xs">Débitos</p>
                      <p className="font-bold text-lg text-red-600">{formatCurrency(folha.debitos)}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-muted-foreground text-xs">Líquido</p>
                      <p className="font-bold text-lg">{formatCurrency(folha.liquido)}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium mb-3">Margens Disponíveis</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Margem 5%</p>
                        <p className={`font-bold ${getMarginColor(folha.margem_bruta_5, folha.margem_saldo_5)}`}>
                          {formatCurrency(folha.margem_saldo_5)}
                        </p>
                        <p className="text-xs text-muted-foreground">de {formatCurrency(folha.margem_bruta_5)}</p>
                      </div>
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Benefício 5%</p>
                        <p className={`font-bold ${getMarginColor(folha.margem_beneficio_bruta_5, folha.margem_beneficio_saldo_5)}`}>
                          {formatCurrency(folha.margem_beneficio_saldo_5)}
                        </p>
                        <p className="text-xs text-muted-foreground">de {formatCurrency(folha.margem_beneficio_bruta_5)}</p>
                      </div>
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Margem 35%</p>
                        <p className={`font-bold ${getMarginColor(folha.margem_bruta_35, folha.margem_saldo_35)}`}>
                          {formatCurrency(folha.margem_saldo_35)}
                        </p>
                        <p className="text-xs text-muted-foreground">de {formatCurrency(folha.margem_bruta_35)}</p>
                      </div>
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Margem 70%</p>
                        <p className={`font-bold ${getMarginColor(folha.margem_bruta_70, folha.margem_saldo_70)}`}>
                          {formatCurrency(folha.margem_saldo_70)}
                        </p>
                        <p className="text-xs text-muted-foreground">de {formatCurrency(folha.margem_bruta_70)}</p>
                      </div>
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Cartão Crédito</p>
                        <p className="font-bold text-green-600">{formatCurrency(folha.margem_cartao_credito_saldo)}</p>
                      </div>
                      <div className="p-2 border rounded">
                        <p className="text-xs text-muted-foreground">Cartão Benefício</p>
                        <p className="font-bold text-green-600">{formatCurrency(folha.margem_cartao_beneficio_saldo)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Contratos ({contratos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contratos.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox 
                                checked={contratosSelecionados.size === contratos.length && contratos.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setContratosSelecionados(new Set(contratos.map((_, idx) => idx)));
                                  } else {
                                    setContratosSelecionados(new Set());
                                  }
                                }}
                                data-testid="checkbox-todos-contratos"
                              />
                            </TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Banco</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Parcela</TableHead>
                            <TableHead className="text-center w-20">Taxa %</TableHead>
                            <TableHead className="text-right">Saldo Devedor</TableHead>
                            <TableHead className="text-right">Restantes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contratos.map((contrato, idx) => {
                            const valorParcela = parseCurrency(contrato.valor_parcela || contrato.valorParcela);
                            const parcelasRestantes = parseInt(String(contrato.parcelas_restantes || contrato.parcelasRestantes || 0)) || 0;
                            const taxaStr = taxasContratos[idx];
                            const taxa = taxaStr ? parseFloat(taxaStr) : 0;
                            const saldoCalculado = taxa > 0 ? calcularSaldoDevedorPrice(valorParcela, taxa, parcelasRestantes) : null;
                            const saldoOriginal = parseCurrency(contrato.saldo_devedor || contrato.saldoDevedor);
                            const saldoExibir = saldoCalculado !== null ? saldoCalculado : saldoOriginal;
                            const isCalculado = saldoCalculado !== null;

                            return (
                              <TableRow key={idx} className={contratosSelecionados.has(idx) ? "bg-muted/50" : ""}>
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
                                <TableCell className="font-mono text-xs">
                                  {contrato.contrato || contrato.numeroContrato || "-"}
                                </TableCell>
                                <TableCell>{contrato.banco || contrato.bancoNome || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {contrato.tipo_operacao || contrato.tipoOperacao || contrato.tipo || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(valorParcela)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="1.80"
                                    className="w-16 h-7 text-xs text-center p-1"
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
                              const contrato = contratos[idx];
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contatos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {higienizacao?.telefones && higienizacao.telefones.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefones</Label>
                    <div className="space-y-1 mt-1">
                      {higienizacao.telefones.map((tel, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{tel.telefone}</span>
                          {tel.principal && <Badge variant="secondary" className="text-xs">Principal</Badge>}
                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => copyToClipboard(tel.telefone)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {higienizacao?.emails && higienizacao.emails.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">E-mails</Label>
                    <div className="space-y-1 mt-1">
                      {higienizacao.emails.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{email}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => copyToClipboard(email)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!higienizacao?.telefones || higienizacao.telefones.length === 0) && 
                 (!higienizacao?.emails || higienizacao.emails.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum contato cadastrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {cliente && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cidade/UF</Label>
                      <p>{cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : cliente.uf || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!consultaData && !buscarMutation.isPending && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Busque um cliente</h3>
            <p className="text-muted-foreground">
              Digite o CPF ou Matrícula no campo acima para consultar os dados completos do cliente
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
