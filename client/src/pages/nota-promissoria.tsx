import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, FileText, Printer, Settings } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Company, PromissoryNote } from "@shared/schema";
import { CompanyManagerSheet } from "@/components/company-manager-sheet";
import { generatePromissoryNotePDF } from "@/lib/promissory-note-pdf";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatBrlInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrlToNumber(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function formatDateBr(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function NotaPromissoriaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [companySheetOpen, setCompanySheetOpen] = useState(false);

  const [companyId, setCompanyId] = useState("");
  const [devedorNome, setDevedorNome] = useState("");
  const [devedorCpf, setDevedorCpf] = useState("");
  const [devedorEndereco, setDevedorEndereco] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [localPagamento, setLocalPagamento] = useState("");
  const [multaPercentual, setMultaPercentual] = useState("2");
  const [jurosPercentual, setJurosPercentual] = useState("1");
  const [bancoOrigem, setBancoOrigem] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazoProtesto, setPrazoProtesto] = useState("5");

  const { data: companiesList, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: notesData, isLoading: notesLoading } = useQuery<{ notes: PromissoryNote[]; total: number }>({
    queryKey: ["/api/promissory-notes"],
  });
  const notesList = notesData?.notes;

  const activeCompanies = (companiesList || []).filter(c => c.isActive);
  const selectedCompany = activeCompanies.find(c => String(c.id) === companyId);

  const handleCompanyChange = (value: string) => {
    setCompanyId(value);
    const company = activeCompanies.find(c => String(c.id) === value);
    if (company) {
      setLocalPagamento(`${company.cidade}/${company.uf}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const valorNum = parseBrlToNumber(valor);
      if (valorNum <= 0) throw new Error("Valor deve ser positivo");
      if (!companyId) throw new Error("Selecione uma empresa");
      if (!devedorNome) throw new Error("Nome do devedor é obrigatório");
      if (!devedorCpf || devedorCpf.replace(/\D/g, "").length < 11) throw new Error("CPF inválido");
      if (!devedorEndereco) throw new Error("Endereço do devedor é obrigatório");
      if (!dataVencimento) throw new Error("Data de vencimento é obrigatória");

      const res = await apiRequest("POST", "/api/promissory-notes", {
        companyId: parseInt(companyId),
        devedorNome,
        devedorCpf: devedorCpf.replace(/\D/g, ""),
        devedorEndereco,
        valor: valorNum.toFixed(2),
        dataVencimento,
        localPagamento: localPagamento || null,
        multaPercentual: multaPercentual || "2",
        jurosPercentual: jurosPercentual || "1",
        bancoOrigem: bancoOrigem || null,
        dataPagamento: dataPagamento || null,
        descricao: descricao || null,
        prazoProtesto: prazoProtesto || "3",
      });
      return await res.json();
    },
    onSuccess: (note: PromissoryNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promissory-notes"] });
      toast({ title: "Nota Promissória gerada", description: `Número: ${note.npNumber}` });
      generatePromissoryNotePDF(note);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao gerar nota", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCompanyId("");
    setDevedorNome("");
    setDevedorCpf("");
    setDevedorEndereco("");
    setValor("");
    setDataVencimento("");
    setLocalPagamento("");
    setMultaPercentual("2");
    setJurosPercentual("1");
    setBancoOrigem("");
    setDataPagamento("");
    setDescricao("");
    setPrazoProtesto("5");
  };

  const handleReprint = (note: PromissoryNote) => {
    generatePromissoryNotePDF(note);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Nota Promissória</h1>
            <p className="text-sm text-muted-foreground">Emita e gerencie notas promissórias</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nova Nota Promissória</CardTitle>
            <CardDescription>Preencha os dados para gerar uma nova nota promissória</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Empresa Emissora</h3>
                  {user?.role === "master" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCompanySheetOpen(true)}
                      data-testid="button-manage-companies"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Empresa <span className="text-destructive">*</span></Label>
                    {companiesLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
                    ) : (
                      <Select value={companyId} onValueChange={handleCompanyChange}>
                        <SelectTrigger data-testid="select-company">
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeCompanies.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={selectedCompany?.cnpj || ""} readOnly className="bg-muted" data-testid="input-company-cnpj" />
                  </div>
                  <div className="space-y-2">
                    <Label>Local de Emissão</Label>
                    <Input
                      value={selectedCompany ? `${selectedCompany.cidade}/${selectedCompany.uf}` : ""}
                      readOnly
                      className="bg-muted"
                      data-testid="input-local-emissao"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Devedor</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo <span className="text-destructive">*</span></Label>
                    <Input
                      value={devedorNome}
                      onChange={(e) => setDevedorNome(e.target.value)}
                      placeholder="Nome do devedor"
                      data-testid="input-devedor-nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF <span className="text-destructive">*</span></Label>
                    <Input
                      value={devedorCpf}
                      onChange={(e) => setDevedorCpf(formatCpfInput(e.target.value))}
                      placeholder="000.000.000-00"
                      data-testid="input-devedor-cpf"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={devedorEndereco}
                    onChange={(e) => setDevedorEndereco(e.target.value)}
                    placeholder="Endereço completo do devedor"
                    data-testid="input-devedor-endereco"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valor e Condições</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$) <span className="text-destructive">*</span></Label>
                    <Input
                      value={valor}
                      onChange={(e) => setValor(formatBrlInput(e.target.value))}
                      placeholder="0,00"
                      data-testid="input-valor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Vencimento <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      data-testid="input-data-vencimento"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Local de Pagamento</Label>
                    <Input
                      value={localPagamento}
                      onChange={(e) => setLocalPagamento(e.target.value)}
                      placeholder="Local de pagamento"
                      data-testid="input-local-pagamento"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Multa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={multaPercentual}
                      onChange={(e) => setMultaPercentual(e.target.value)}
                      data-testid="input-multa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Juros ao mês (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={jurosPercentual}
                      onChange={(e) => setJurosPercentual(e.target.value)}
                      data-testid="input-juros"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detalhes da Operação</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Banco de Origem</Label>
                    <Input
                      value={bancoOrigem}
                      onChange={(e) => setBancoOrigem(e.target.value)}
                      placeholder="Banco"
                      data-testid="input-banco-origem"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Pagamento</Label>
                    <Input
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      data-testid="input-data-pagamento"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de Protesto (dias)</Label>
                    <Select value={prazoProtesto} onValueChange={setPrazoProtesto}>
                      <SelectTrigger data-testid="select-prazo-protesto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 dias</SelectItem>
                        <SelectItem value="5">5 dias</SelectItem>
                        <SelectItem value="10">10 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Texto Legal Personalizado</Label>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Deixe em branco para usar o texto legal padrão, ou insira texto personalizado que substituirá as cláusulas padrão"
                    data-testid="input-descricao"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !companyId || !devedorNome || !devedorCpf || !devedorEndereco || !valor || !dataVencimento}
                  data-testid="button-gerar-nota"
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Nota Promissória
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Notas Promissórias</CardTitle>
            <CardDescription>Notas emitidas anteriormente</CardDescription>
          </CardHeader>
          <CardContent>
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : notesList && notesList.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Devedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notesList.map((note) => (
                    <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                      <TableCell className="font-medium" data-testid={`text-np-number-${note.id}`}>
                        {note.npNumber}
                      </TableCell>
                      <TableCell data-testid={`text-company-${note.id}`}>
                        {note.companyRazaoSocial}
                      </TableCell>
                      <TableCell data-testid={`text-devedor-${note.id}`}>
                        {note.devedorNome}
                      </TableCell>
                      <TableCell data-testid={`text-valor-${note.id}`}>
                        {parseFloat(note.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell data-testid={`text-vencimento-${note.id}`}>
                        {formatDateBr(note.dataVencimento)}
                      </TableCell>
                      <TableCell data-testid={`text-emissao-${note.id}`}>
                        {formatDateBr(note.dataEmissao)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReprint(note)}
                          data-testid={`button-reimprimir-${note.id}`}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Reimprimir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma nota promissória emitida</p>
                <p className="text-sm mt-1">Preencha o formulário acima para emitir sua primeira nota</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.role === "master" && (
        <CompanyManagerSheet open={companySheetOpen} onOpenChange={setCompanySheetOpen} />
      )}
    </div>
  );
}
