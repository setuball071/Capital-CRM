import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Database, FileSpreadsheet, CheckCircle, XCircle, Clock, HelpCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface BaseImportada {
  id: number;
  nome: string;
  baseTag: string;
  convenio: string;
  competencia: string;
  totalLinhas: number;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

const MODELO_COLUNAS = {
  identificacao: [
    { nome: "cpf", descricao: "CPF do cliente" },
    { nome: "matricula", descricao: "Matrícula no órgão/convênio" },
    { nome: "convenio", descricao: "Ex: SIAPE, GOV_SP, INSS" },
    { nome: "orgao", descricao: "Nome do órgão/secretaria" },
    { nome: "uf", descricao: "Estado do vínculo" },
    { nome: "municipio", descricao: "Município (se existir)" },
    { nome: "situacao_funcional", descricao: "ATIVO, APOSENTADO, PENSIONISTA" },
    { nome: "data_nascimento", descricao: "Data de nascimento (opcional)" },
  ],
  contatos: [
    { nome: "telefone_1", descricao: "Telefone principal" },
    { nome: "telefone_2", descricao: "Telefone alternativo" },
    { nome: "telefone_3", descricao: "Telefone alternativo 2" },
    { nome: "email", descricao: "E-mail do cliente" },
  ],
  dadosBancarios: [
    { nome: "banco_salario", descricao: "Código/nome do banco onde recebe salário" },
    { nome: "agencia_salario", descricao: "Agência do banco" },
    { nome: "conta_salario", descricao: "Número da conta" },
  ],
  folhaMargens: [
    { nome: "competencia_folha", descricao: "Mês da folha (ex: 2025-10)" },
    { nome: "margem_70_bruta", descricao: "Margem 70% bruta" },
    { nome: "margem_70_utilizada", descricao: "Margem 70% utilizada" },
    { nome: "margem_70_saldo", descricao: "Margem 70% disponível" },
    { nome: "margem_35_bruta", descricao: "Margem 35% bruta" },
    { nome: "margem_35_utilizada", descricao: "Margem 35% utilizada" },
    { nome: "margem_35_saldo", descricao: "Margem 35% disponível" },
    { nome: "margem_cartao_credito_bruta", descricao: "Margem cartão crédito bruta" },
    { nome: "margem_cartao_credito_utilizada", descricao: "Margem cartão crédito utilizada" },
    { nome: "margem_cartao_credito_saldo", descricao: "Margem cartão crédito disponível" },
    { nome: "margem_cartao_beneficio_bruta", descricao: "Margem cartão benefício bruta" },
    { nome: "margem_cartao_beneficio_utilizada", descricao: "Margem cartão benefício utilizada" },
    { nome: "margem_cartao_beneficio_saldo", descricao: "Margem cartão benefício disponível" },
  ],
  contratos: [
    { nome: "banco_emprestimo", descricao: "Banco do contrato (BMG, PAN, etc.)" },
    { nome: "tipo_produto", descricao: "consignado, cartao_credito, cartao_beneficio" },
    { nome: "valor_parcela", descricao: "Valor da parcela mensal" },
    { nome: "prazo_remanescente", descricao: "Parcelas restantes" },
    { nome: "saldo_devedor", descricao: "Saldo devedor (opcional)" },
    { nome: "numero_contrato", descricao: "Número do contrato (opcional)" },
    { nome: "situacao_contrato", descricao: "ATIVO, QUITADO, SUSPENSO (opcional)" },
  ],
};

export default function BasesClientes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isModeloOpen, setIsModeloOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [convenio, setConvenio] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [nomeBase, setNomeBase] = useState("");

  const handleDownloadModelo = () => {
    const headers = [
      ...MODELO_COLUNAS.identificacao.map((c) => c.nome),
      ...MODELO_COLUNAS.contatos.map((c) => c.nome),
      ...MODELO_COLUNAS.dadosBancarios.map((c) => c.nome),
      ...MODELO_COLUNAS.folhaMargens.map((c) => c.nome),
      ...MODELO_COLUNAS.contratos.map((c) => c.nome),
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    
    ws["!cols"] = headers.map(() => ({ wch: 25 }));

    XLSX.writeFile(wb, "modelo_importacao_base.xlsx");
    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como base para sua planilha de importação.",
    });
  };

  const { data: bases = [], isLoading, refetch } = useQuery<BaseImportada[]>({
    queryKey: ["/api/bases"],
    refetchInterval: 5000,
  });

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/bases/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao importar");
      }
      return response.json();
    },
    onSuccess: (data: { message: string; totalLinhas: number; baseTag: string }) => {
      toast({
        title: "Importação concluída",
        description: `${data.totalLinhas} registros importados com sucesso para a base ${data.baseTag}.`,
      });
      setIsDialogOpen(false);
      setFile(null);
      setConvenio("");
      setCompetencia("");
      setNomeBase("");
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao importar a base.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file || !convenio || !competencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("convenio", convenio);
    formData.append("competencia", competencia);
    if (nomeBase) {
      formData.append("nome_base", nomeBase);
    }
    
    importMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluida":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluída
          </Badge>
        );
      case "processando":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Base de Clientes</h1>
          <p className="text-muted-foreground">
            Importe e gerencie bases de clientes (SIAPE, INSS, estaduais)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isModeloOpen} onOpenChange={setIsModeloOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-modelo">
                <HelpCircle className="w-4 h-4 mr-2" />
                Ver modelo de planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Modelo de Planilha para Importação</DialogTitle>
                <DialogDescription>
                  Sua planilha precisa conter uma linha de cabeçalho com os nomes exatos das colunas abaixo.
                  Nem todas são obrigatórias, mas quanto mais campos você preencher, mais completa será a consulta.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Identificação (obrigatórios)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.identificacao.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Contatos (opcionais)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.contatos.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Dados Bancários do Salário</h3>
                    <p className="text-xs text-muted-foreground mb-2">Onde o cliente recebe o salário (diferente do banco do empréstimo)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.dadosBancarios.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Folha / Margens</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.folhaMargens.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-2">Contratos / Descontos em Folha</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {MODELO_COLUNAS.contratos.map((col) => (
                        <div key={col.nome} className="flex items-start gap-2 text-sm">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{col.nome}</code>
                          <span className="text-muted-foreground text-xs">{col.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button onClick={handleDownloadModelo} data-testid="button-download-modelo">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar modelo Excel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-import-base">
                <Upload className="w-4 h-4 mr-2" />
                Importar Base
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Importar Base de Clientes</DialogTitle>
              <DialogDescription>
                Faça upload de um arquivo Excel (.xlsx) ou CSV (.csv) com os dados da base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="convenio">Convênio *</Label>
                <Input
                  id="convenio"
                  placeholder="Ex: SIAPE, INSS, GOV SP"
                  value={convenio}
                  onChange={(e) => setConvenio(e.target.value)}
                  data-testid="input-convenio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competencia">Competência *</Label>
                <Input
                  id="competencia"
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  data-testid="input-competencia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Base (opcional)</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Base SIAPE Novembro 2025"
                  value={nomeBase}
                  onChange={(e) => setNomeBase(e.target.value)}
                  data-testid="input-nome-base"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                data-testid="button-submit-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bases Importadas
          </CardTitle>
          <CardDescription>
            Lista de todas as bases de clientes importadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : bases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma base importada ainda.</p>
              <p className="text-sm">Clique em "Importar Base" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bases.map((base) => (
                  <TableRow key={base.id} data-testid={`row-base-${base.id}`}>
                    <TableCell className="font-medium">{base.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{base.convenio}</Badge>
                    </TableCell>
                    <TableCell>
                      {base.competencia
                        ? format(new Date(base.competencia), "MMM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>{base.totalLinhas?.toLocaleString("pt-BR") || 0}</TableCell>
                    <TableCell>{getStatusBadge(base.status)}</TableCell>
                    <TableCell>
                      {format(new Date(base.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
