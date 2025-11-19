import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Papa from "papaparse";
import { Loader2, Plus, Pencil, Trash2, Calculator, Download, Upload } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agreement, CoefficientTable, InsertCoefficientTable } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AVAILABLE_BANKS = [
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Bradesco",
  "Itaú",
  "Santander",
  "Banrisul",
  "BMG",
  "Pan",
  "Safra",
  "C6 Bank",
  "Nubank",
  "Inter",
  "Original",
  "Sicoob",
  "Sicredi",
  "Mercantil do Brasil",
  "Daycoval",
  "BV",
  "Votorantim",
  "Pine",
] as const;

function downloadTemplateCSV() {
  const headers = ["convênio", "banco", "prazo", "nome_tabela", "coeficiente"];
  const exampleRows = [
    ["Gov SP", "Banco do Brasil", "60", "Tabela BB 60 meses", "0.0216"],
    ["Gov SP", "Caixa Econômica Federal", "72", "Tabela CEF 72 meses", "0.0198"],
    ["Gov SP", "PH Tech", "48", "Tabela PH Tech Especial", "0.0235"],
  ];

  const csvContent = [headers, ...exampleRows]
    .map(row => row.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "modelo_tabelas_coeficientes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const coefficientFormSchema = z.object({
  agreementId: z.number().positive({ message: "Convênio é obrigatório" }),
  bank: z.string().min(1, { message: "Banco é obrigatório" }),
  termMonths: z.number().int().min(12, { message: "Prazo mínimo é 12 meses" }).max(140, { message: "Prazo máximo é 140 meses" }),
  tableName: z.string().min(1, { message: "Nome da tabela é obrigatório" }),
  coefficient: z.string()
    .transform((val) => val.replace(',', '.'))
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Coeficiente deve ser um número positivo",
    }),
  isActive: z.boolean().default(true),
});

type CoefficientFormData = z.infer<typeof coefficientFormSchema>;

export default function CoefficientTablesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<CoefficientTable | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const createForm = useForm<CoefficientFormData>({
    resolver: zodResolver(coefficientFormSchema),
    defaultValues: {
      agreementId: 0,
      bank: "",
      termMonths: 12,
      tableName: "",
      coefficient: "",
      isActive: true,
    },
  });

  const editForm = useForm<CoefficientFormData>({
    resolver: zodResolver(coefficientFormSchema),
    defaultValues: {
      agreementId: 0,
      bank: "",
      termMonths: 12,
      tableName: "",
      coefficient: "",
      isActive: true,
    },
  });

  const { data: tables, isLoading } = useQuery<CoefficientTable[]>({
    queryKey: ["/api/coefficient-tables"],
  });

  const { data: agreements } = useQuery<Agreement[]>({
    queryKey: ["/api/agreements/active"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CoefficientFormData) => {
      const payload: InsertCoefficientTable = {
        agreementId: data.agreementId,
        bank: data.bank,
        termMonths: data.termMonths,
        tableName: data.tableName,
        coefficient: data.coefficient,
        isActive: data.isActive,
      };
      return await apiRequest("POST", "/api/coefficient-tables", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Tabela criada com sucesso",
        description: "A tabela de coeficiente foi adicionada ao sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tabela",
        description: error.message || "Ocorreu um erro ao criar a tabela.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CoefficientFormData) => {
      if (!selectedTable) throw new Error("Nenhuma tabela selecionada");
      const payload: Partial<InsertCoefficientTable> = {
        agreementId: data.agreementId,
        bank: data.bank,
        termMonths: data.termMonths,
        tableName: data.tableName,
        coefficient: data.coefficient,
        isActive: data.isActive,
      };
      return await apiRequest("PATCH", `/api/coefficient-tables/${selectedTable.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsEditDialogOpen(false);
      setSelectedTable(null);
      editForm.reset();
      toast({
        title: "Tabela atualizada com sucesso",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar tabela",
        description: error.message || "Ocorreu um erro ao atualizar a tabela.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/coefficient-tables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsDeleteDialogOpen(false);
      setSelectedTable(null);
      toast({
        title: "Tabela excluída com sucesso",
        description: "A tabela de coeficiente foi removida.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir tabela",
        description: error.message || "Ocorreu um erro ao excluir a tabela.",
        variant: "destructive",
      });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (tables: InsertCoefficientTable[]) => {
      return await apiRequest("POST", "/api/coefficient-tables/bulk-import", { tables });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsImportDialogOpen(false);
      setImportData([]);
      setImportErrors([]);
      toast({
        title: "Importação concluída com sucesso",
        description: `${data.count} tabelas foram importadas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar tabelas",
        description: error.message || "Ocorreu um erro ao importar as tabelas.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: CoefficientFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (table: CoefficientTable) => {
    setSelectedTable(table);
    editForm.reset({
      agreementId: table.agreementId,
      bank: table.bank,
      termMonths: table.termMonths,
      tableName: table.tableName,
      coefficient: table.coefficient,
      isActive: table.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: CoefficientFormData) => {
    updateMutation.mutate(data);
  };

  const handleDelete = (table: CoefficientTable) => {
    setSelectedTable(table);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedTable) {
      deleteMutation.mutate(selectedTable.id);
    }
  };

  const getAgreementName = (agreementId: number) => {
    const agreement = agreements?.find((a) => a.id === agreementId);
    return agreement?.name || `Convênio #${agreementId}`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const data: InsertCoefficientTable[] = [];

        results.data.forEach((row: any, index: number) => {
          const agreementName = row.convênio || row.convenio;
          const bank = row.banco;
          const termMonths = parseInt(row.prazo);
          const tableName = row.nome_tabela;
          const coefficient = (row.coeficiente || "").toString().replace(',', '.');

          const agreement = agreements?.find(a => a.name === agreementName);

          if (!agreement) {
            errors.push(`Linha ${index + 2}: Convênio "${agreementName}" não encontrado`);
            return;
          }

          if (!bank || !tableName || !coefficient) {
            errors.push(`Linha ${index + 2}: Campos obrigatórios faltando`);
            return;
          }

          if (isNaN(termMonths) || termMonths < 12 || termMonths > 140) {
            errors.push(`Linha ${index + 2}: Prazo inválido (deve estar entre 12 e 140)`);
            return;
          }

          if (isNaN(parseFloat(coefficient)) || parseFloat(coefficient) <= 0) {
            errors.push(`Linha ${index + 2}: Coeficiente inválido`);
            return;
          }

          data.push({
            agreementId: agreement.id,
            bank,
            termMonths,
            tableName,
            coefficient,
            isActive: true,
          });
        });

        setImportData(data);
        setImportErrors(errors);
      },
      error: (error) => {
        toast({
          title: "Erro ao ler arquivo",
          description: error.message,
          variant: "destructive",
        });
      },
    });

    event.target.value = "";
  };

  const handleConfirmImport = () => {
    if (importData.length > 0) {
      bulkImportMutation.mutate(importData);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Tabelas de Coeficientes
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as tabelas de coeficientes por convênio, banco e prazo
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplateCSV}
              data-testid="button-download-template"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
              data-testid="button-import-spreadsheet"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid="button-create-table"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tabela
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Tabelas de Coeficientes</CardTitle>
            <CardDescription>
              Tabelas disponíveis no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Convênio</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Nome da Tabela</TableHead>
                      <TableHead>Coeficiente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables && tables.length > 0 ? (
                      tables.map((table) => (
                        <TableRow key={table.id} data-testid={`row-table-${table.id}`}>
                          <TableCell className="font-medium" data-testid={`text-agreement-${table.id}`}>
                            {getAgreementName(table.agreementId)}
                          </TableCell>
                          <TableCell data-testid={`text-bank-${table.id}`}>
                            {table.bank}
                          </TableCell>
                          <TableCell data-testid={`text-term-${table.id}`}>
                            {table.termMonths} meses
                          </TableCell>
                          <TableCell data-testid={`text-name-${table.id}`}>
                            {table.tableName}
                          </TableCell>
                          <TableCell className="font-mono" data-testid={`text-coefficient-${table.id}`}>
                            {table.coefficient}
                          </TableCell>
                          <TableCell data-testid={`status-${table.id}`}>
                            <Badge variant={table.isActive ? "default" : "secondary"}>
                              {table.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(table)}
                                data-testid={`button-edit-${table.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(table)}
                                data-testid={`button-delete-${table.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma tabela encontrada. Crie uma nova tabela para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Nova Tabela de Coeficiente</DialogTitle>
            <DialogDescription>
              Adicione uma nova tabela de coeficiente ao sistema
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="agreementId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Convênio</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-agreement">
                            <SelectValue placeholder="Selecione um convênio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agreements?.map((agreement) => (
                            <SelectItem
                              key={agreement.id}
                              value={agreement.id.toString()}
                            >
                              {agreement.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Banco do Brasil, PH Tech, etc."
                          data-testid="input-bank"
                          list="banks-list"
                          {...field}
                        />
                      </FormControl>
                      <datalist id="banks-list">
                        {AVAILABLE_BANKS.map((bank) => (
                          <option key={bank} value={bank} />
                        ))}
                      </datalist>
                      <FormDescription>Digite o nome do banco ou fintech</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="termMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo (meses)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="12 a 140"
                          min="12"
                          max="140"
                          data-testid="input-term"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Entre 12 e 140 meses</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="tableName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Tabela</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Tabela A"
                          data-testid="input-table-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="coefficient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coeficiente</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Ex: 0,0216 ou 0.0216"
                        data-testid="input-coefficient"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Valor decimal positivo (use vírgula ou ponto)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Tabela"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Tabela de Coeficiente</DialogTitle>
            <DialogDescription>
              Atualize as informações da tabela
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="agreementId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Convênio</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-agreement">
                            <SelectValue placeholder="Selecione um convênio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agreements?.map((agreement) => (
                            <SelectItem
                              key={agreement.id}
                              value={agreement.id.toString()}
                            >
                              {agreement.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="bank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Banco do Brasil, PH Tech, etc."
                          data-testid="input-edit-bank"
                          list="banks-list-edit"
                          {...field}
                        />
                      </FormControl>
                      <datalist id="banks-list-edit">
                        {AVAILABLE_BANKS.map((bank) => (
                          <option key={bank} value={bank} />
                        ))}
                      </datalist>
                      <FormDescription>Digite o nome do banco ou fintech</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="termMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo (meses)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="12 a 140"
                          min="12"
                          max="140"
                          data-testid="input-edit-term"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Entre 12 e 140 meses</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="tableName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Tabela</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Tabela A"
                          data-testid="input-edit-table-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="coefficient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coeficiente</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Ex: 0,0216 ou 0.0216"
                        data-testid="input-edit-coefficient"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Valor decimal positivo (use vírgula ou ponto)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Status</FormLabel>
                      <FormDescription className="text-sm text-muted-foreground">
                        {field.value ? "Tabela ativa" : "Tabela inativa"}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "secondary"}
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                        data-testid="button-toggle-status"
                      >
                        {field.value ? "Ativo" : "Inativo"}
                      </Button>
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-edit-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-edit-submit"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Planilha de Coeficientes</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV com as tabelas de coeficientes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-sm font-medium">Formato do Arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  O arquivo CSV deve conter as colunas: convênio, banco, prazo, nome_tabela, coeficiente
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplateCSV}
                data-testid="button-download-template-dialog"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                data-testid="input-csv-file"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para selecionar arquivo CSV</p>
                <p className="text-xs text-muted-foreground">ou arraste o arquivo aqui</p>
              </label>
            </div>

            {importErrors.length > 0 && (
              <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                <p className="text-sm font-medium text-destructive mb-2">
                  Erros encontrados ({importErrors.length}):
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {importErrors.map((error, index) => (
                    <p key={index} className="text-xs text-destructive">
                      • {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {importData.length > 0 && (
              <div className="border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <p className="text-sm font-medium">
                    Preview da Importação ({importData.length} tabela{importData.length > 1 ? 's' : ''})
                  </p>
                </div>
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Convênio</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Nome da Tabela</TableHead>
                        <TableHead>Coeficiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">
                            {getAgreementName(row.agreementId)}
                          </TableCell>
                          <TableCell className="text-sm">{row.bank}</TableCell>
                          <TableCell className="text-sm">{row.termMonths} meses</TableCell>
                          <TableCell className="text-sm">{row.tableName}</TableCell>
                          <TableCell className="text-sm">{row.coefficient}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importData.length > 10 && (
                    <div className="p-2 text-center text-xs text-muted-foreground border-t">
                      ... e mais {importData.length - 10} tabela{importData.length - 10 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportData([]);
                setImportErrors([]);
              }}
              data-testid="button-import-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importData.length === 0 || importErrors.length > 0 || bulkImportMutation.isPending}
              data-testid="button-import-confirm"
            >
              {bulkImportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${importData.length} Tabela${importData.length > 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tabela <strong>{selectedTable?.tableName}</strong>?
              <br />
              <br />
              Convênio: {selectedTable && getAgreementName(selectedTable.agreementId)}
              <br />
              Banco: {selectedTable?.bank}
              <br />
              Prazo: {selectedTable?.termMonths} meses
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Tabela"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
