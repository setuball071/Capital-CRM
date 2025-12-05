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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Database, FileSpreadsheet, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function BasesClientes() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [convenio, setConvenio] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [nomeBase, setNomeBase] = useState("");

  const { data: bases = [], isLoading, refetch } = useQuery<BaseImportada[]>({
    queryKey: ["/api/bases"],
    refetchInterval: 5000,
  });

  const importMutation = useMutation({
    mutationFn: async (data: { arquivo: string; convenio: string; competencia: string; nome_base?: string }) => {
      return await apiRequest("POST", "/api/bases/importar", data);
    },
    onSuccess: () => {
      toast({
        title: "Importação iniciada",
        description: "O arquivo está sendo processado em segundo plano.",
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

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      importMutation.mutate({
        arquivo: base64,
        convenio,
        competencia,
        nome_base: nomeBase || undefined,
      });
    };
    reader.readAsDataURL(file);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Base de Clientes</h1>
          <p className="text-muted-foreground">
            Importe e gerencie bases de clientes (SIAPE, INSS, estaduais)
          </p>
        </div>
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
