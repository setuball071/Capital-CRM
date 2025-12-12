import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, Phone, MessageSquare, Mail, User, Building, MapPin, CreditCard, Save, SkipForward, Calendar } from "lucide-react";
import { LEAD_STATUS, TIPOS_CONTATO, type SalesLeadAssignment, type SalesLead, type SalesLeadEvent } from "@shared/schema";

interface AtendimentoData {
  assignment: SalesLeadAssignment;
  lead: SalesLead;
  clienteBase: any | null;
  folhaAtual: any | null;
  contratos: any[];
  eventos: SalesLeadEvent[];
  campanha: { id: number; nome: string } | null;
}

export default function VendasAtendimento() {
  const { toast } = useToast();
  const [atendimentoAtual, setAtendimentoAtual] = useState<AtendimentoData | null>(null);
  const [formData, setFormData] = useState({
    tipo: "ligacao",
    resultado: "",
    observacao: "",
    status: "em_atendimento",
  });

  const { data: resumo, isLoading: loadingResumo } = useQuery<{
    leadsPendentes: number;
    leadsNovos: number;
    emAtendimento: number;
    vendidos: number;
    concluidos: number;
  }>({
    queryKey: ["/api/vendas/atendimento/resumo"],
  });

  const { data: campanhasDisponiveis } = useQuery<{ id: number; nome: string; leadsPendentes: number }[]>({
    queryKey: ["/api/vendas/atendimento/campanhas-disponiveis"],
  });

  const proximoMutation = useMutation({
    mutationFn: async (campaignId?: number) => {
      const res = await apiRequest("POST", "/api/vendas/atendimento/proximo", { campaignId });
      return res.json() as Promise<AtendimentoData>;
    },
    onSuccess: (data) => {
      setAtendimentoAtual(data);
      setFormData({ tipo: "ligacao", resultado: "", observacao: "", status: "em_atendimento" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
    },
    onError: (error: any) => {
      if (error?.message?.includes("404") || error?.cause?.status === 404) {
        toast({ title: "Não há mais leads na fila", description: "Todos os leads foram atendidos!" });
      } else {
        toast({ title: "Erro ao buscar próximo lead", variant: "destructive" });
      }
    },
  });

  const registrarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!atendimentoAtual) throw new Error("Nenhum atendimento ativo");
      return apiRequest("POST", `/api/vendas/atendimento/${atendimentoAtual.assignment.id}/registrar`, data);
    },
    onSuccess: () => {
      toast({ title: "Atendimento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
    },
    onError: () => {
      toast({ title: "Erro ao registrar atendimento", variant: "destructive" });
    },
  });

  const handleSalvar = () => {
    registrarMutation.mutate(formData);
  };

  const handleSalvarEProximo = async () => {
    await registrarMutation.mutateAsync(formData);
    proximoMutation.mutate();
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatCPF = (cpf: string | null | undefined) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  if (loadingResumo) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-vendas-atendimento">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM de Vendas</h1>
          <p className="text-muted-foreground">Atenda seus leads e registre cada contato</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-leads-pendentes">{resumo?.leadsPendentes || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{resumo?.leadsNovos || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{resumo?.emAtendimento || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{resumo?.vendidos || 0}</p>
          </CardContent>
        </Card>
      </div>

      {!atendimentoAtual ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Play className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Iniciar Atendimento</h2>
            <p className="text-muted-foreground mb-6">
              Clique no botão abaixo para começar a atender o próximo lead da sua fila
            </p>
            <Button
              size="lg"
              onClick={() => proximoMutation.mutate()}
              disabled={proximoMutation.isPending || (resumo?.leadsPendentes || 0) === 0}
              data-testid="button-iniciar-atendimento"
            >
              {proximoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Play className="h-4 w-4 mr-2" />
              Iniciar / Próximo Cliente
            </Button>
            {(resumo?.leadsPendentes || 0) === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                Você não tem leads pendentes na fila.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {atendimentoAtual.lead.nome}
                    </CardTitle>
                    <CardDescription>
                      {atendimentoAtual.campanha?.nome && (
                        <Badge variant="outline" className="mr-2">{atendimentoAtual.campanha.nome}</Badge>
                      )}
                      CPF: {formatCPF(atendimentoAtual.lead.cpf)}
                    </CardDescription>
                  </div>
                  <Badge>{LEAD_STATUS[atendimentoAtual.assignment.status as keyof typeof LEAD_STATUS] || atendimentoAtual.assignment.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone 1</p>
                      <p className="font-medium" data-testid="text-telefone-1">{formatPhone(atendimentoAtual.lead.telefone1)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone 2</p>
                      <p className="font-medium">{formatPhone(atendimentoAtual.lead.telefone2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">E-mail</p>
                      <p className="font-medium">{atendimentoAtual.lead.email || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Cidade/UF</p>
                      <p className="font-medium">
                        {atendimentoAtual.lead.cidade || "-"} / {atendimentoAtual.lead.uf || "-"}
                      </p>
                    </div>
                  </div>
                </div>
                {atendimentoAtual.lead.observacoes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="text-sm">{atendimentoAtual.lead.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {atendimentoAtual.clienteBase && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Margens Disponíveis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Margem 70%</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(atendimentoAtual.folhaAtual?.margem_saldo_70)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Margem 35%</p>
                        <p className="text-xl font-bold text-blue-600">
                          {formatCurrency(atendimentoAtual.folhaAtual?.margem_saldo_35)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Cartão Crédito</p>
                        <p className="text-xl font-bold text-purple-600">
                          {formatCurrency(atendimentoAtual.folhaAtual?.margemCartaoCreditoSaldo)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Cartão Benefício</p>
                        <p className="text-xl font-bold text-orange-600">
                          {formatCurrency(atendimentoAtual.folhaAtual?.margemCartaoBeneficioSaldo)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {atendimentoAtual.contratos && atendimentoAtual.contratos.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Contratos Ativos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Banco</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Parcela</TableHead>
                            <TableHead className="text-right">Saldo Devedor</TableHead>
                            <TableHead className="text-right">Parcelas Rest.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {atendimentoAtual.contratos.map((contrato, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{contrato.banco || "-"}</TableCell>
                              <TableCell>{contrato.tipoContrato || "-"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(contrato.valorParcela)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(contrato.saldoDevedor)}</TableCell>
                              <TableCell className="text-right">{contrato.parcelasRestantes || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {atendimentoAtual.eventos && atendimentoAtual.eventos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Contatos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {atendimentoAtual.eventos.map((evento, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="p-2 bg-muted rounded">
                          {evento.tipo === "ligacao" && <Phone className="h-4 w-4" />}
                          {evento.tipo === "whatsapp" && <MessageSquare className="h-4 w-4" />}
                          {evento.tipo === "email" && <Mail className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{TIPOS_CONTATO[evento.tipo as keyof typeof TIPOS_CONTATO] || evento.tipo}</span>
                            {evento.resultado && <Badge variant="outline">{evento.resultado}</Badge>}
                          </div>
                          {evento.observacao && <p className="text-sm text-muted-foreground mt-1">{evento.observacao}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(evento.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registrar Atendimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tipo de Contato</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                  >
                    <SelectTrigger data-testid="select-tipo-contato">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS_CONTATO).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status do Lead</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEAD_STATUS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Resultado</Label>
                  <Input
                    value={formData.resultado}
                    onChange={(e) => setFormData({ ...formData, resultado: e.target.value })}
                    placeholder="Ex: Cliente interessado, aguardando proposta"
                    data-testid="input-resultado"
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    placeholder="Detalhes do atendimento..."
                    rows={4}
                    data-testid="textarea-observacao"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSalvar}
                    disabled={registrarMutation.isPending}
                    data-testid="button-salvar"
                  >
                    {registrarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={handleSalvarEProximo}
                    disabled={registrarMutation.isPending || proximoMutation.isPending}
                    data-testid="button-salvar-proximo"
                  >
                    {(registrarMutation.isPending || proximoMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    <SkipForward className="h-4 w-4 mr-2" />
                    Salvar e Próximo
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => proximoMutation.mutate()}
                    disabled={proximoMutation.isPending}
                    data-testid="button-proximo"
                  >
                    {proximoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Próximo Cliente
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
