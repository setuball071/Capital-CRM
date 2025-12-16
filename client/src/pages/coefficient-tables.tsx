import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Papa from "papaparse";
import { Loader2, Plus, Pencil, Trash2, Calculator, Download, Upload, X, Search, Ban } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agreement, CoefficientTable, InsertCoefficientTable } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const headers = ["convênio", "tipo_operacao", "banco", "prazo", "nome_tabela", "coeficiente", "margem_seguranca", "tipo_margem"];
  const exampleRows = [
    ["Gov SP", "credit_card", "Banco do Brasil", "60", "Tabela BB 60 meses", "0.0216", "10", "percentual"],
    ["Gov SP", "benefit_card", "Caixa Econômica Federal", "72", "Tabela CEF 72 meses", "0.0198", "8", "percentual"],
    ["Gov SP", "consignado", "PH Tech", "48", "Tabela PH Tech Especial", "0.0235", "1", "fixo"],
  ];

  const csvContent = [headers, ...exampleRows]
    .map(row => row.join(";"))
    .join("\r\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "modelo_tabelas_coeficientes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const OPERATION_TYPES = [
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "benefit_card", label: "Cartão Benefício" },
  { value: "consignado", label: "Consignado" },
] as const;

const MARGIN_TYPES = [
  { value: "percentual", label: "Percentual da parcela" },
  { value: "fixo", label: "Valor fixo em R$" },
] as const;

const coefficientFormSchema = z.object({
  agreementId: z.number().positive({ message: "Convênio é obrigatório" }),
  operationType: z.enum(["credit_card", "benefit_card", "consignado"], { message: "Tipo de operação é obrigatório" }),
  bank: z.string().min(1, { message: "Banco é obrigatório" }),
  termMonths: z.number().int().min(12, { message: "Prazo mínimo é 12 meses" }).max(140, { message: "Prazo máximo é 140 meses" }),
  tableName: z.string().min(1, { message: "Nome da tabela é obrigatório" }),
  coefficient: z.string()
    .transform((val) => val.replace(',', '.'))
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Coeficiente deve ser um número positivo",
    }),
  safetyMargin: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Margem de segurança deve ser um número não-negativo" }
  ),
  marginType: z.enum(["percentual", "fixo"]).default("percentual"),
  isActive: z.boolean().default(true),
});

type CoefficientFormData = z.infer<typeof coefficientFormSchema>;

export default function CoefficientTablesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeactivateDialogOpen, setIsBulkDeactivateDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<CoefficientTable | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperationType, setSelectedOperationType] = useState<string>("all");

  const createForm = useForm<CoefficientFormData>({
    resolver: zodResolver(coefficientFormSchema),
    defaultValues: {
      agreementId: 0,
      operationType: "credit_card",
      bank: "",
      termMonths: 12,
      tableName: "",
      coefficient: "",
      safetyMargin: "0",
      marginType: "percentual",
      isActive: true,
    },
  });

  const editForm = useForm<CoefficientFormData>({
    resolver: zodResolver(coefficientFormSchema),
    defaultValues: {
      agreementId: 0,
      operationType: "credit_card",
      bank: "",
      termMonths: 12,
      tableName: "",
      coefficient: "",
      safetyMargin: "0",
      marginType: "percentual",
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
        operationType: data.operationType,
        bank: data.bank,
        termMonths: data.termMonths,
        tableName: data.tableName,
        coefficient: data.coefficient,
        safetyMargin: data.safetyMargin,
        marginType: data.marginType,
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
        operationType: data.operationType,
        bank: data.bank,
        termMonths: data.termMonths,
        tableName: data.tableName,
        coefficient: data.coefficient,
        safetyMargin: data.safetyMargin,
        marginType: data.marginType,
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return await apiRequest("POST", "/api/coefficient-tables/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      toast({
        title: "Tabelas excluídas com sucesso",
        description: `${data.count} tabelas foram removidas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir tabelas",
        description: error.message || "Ocorreu um erro ao excluir as tabelas.",
        variant: "destructive",
      });
    },
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return await apiRequest("POST", "/api/coefficient-tables/bulk-deactivate", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsBulkDeactivateDialogOpen(false);
      setSelectedIds([]);
      toast({
        title: "Tabelas desativadas com sucesso",
        description: `${data.count} tabelas foram desativadas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desativar tabelas",
        description: error.message || "Ocorreu um erro ao desativar as tabelas.",
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
      operationType: table.operationType as "credit_card" | "benefit_card" | "consignado",
      bank: table.bank,
      termMonths: table.termMonths,
      tableName: table.tableName,
      coefficient: table.coefficient,
      safetyMargin: table.safetyMargin || "0",
      marginType: (table.marginType as "percentual" | "fixo") || "percentual",
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

  const handleBulkDelete = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds);
  };

  const handleBulkDeactivate = () => {
    setIsBulkDeactivateDialogOpen(true);
  };

  const confirmBulkDeactivate = () => {
    bulkDeactivateMutation.mutate(selectedIds);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTables.map(t => t.id));
    }
  };

  const toggleSelectTable = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const getAgreementName = (agreementId: number) => {
    const agreement = agreements?.find((a) => a.id === agreementId);
    return agreement?.name || `Convênio #${agreementId}`;
  };

  const getOperationTypeName = (operationType: string) => {
    const type = OPERATION_TYPES.find(t => t.value === operationType);
    return type?.label || operationType;
  };

  const filteredTables = tables?.filter(table => {
    // Filter by operation type from selected tab
    if (selectedOperationType !== "all" && table.operationType !== selectedOperationType) {
      return false;
    }
    
    // Filter by search term
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const agreementName = getAgreementName(table.agreementId).toLowerCase();
    const operationTypeName = getOperationTypeName(table.operationType).toLowerCase();
    
    return (
      agreementName.includes(search) ||
      table.bank.toLowerCase().includes(search) ||
      table.tableName.toLowerCase().includes(search) ||
      table.termMonths.toString().includes(search) ||
      table.coefficient.toLowerCase().includes(search) ||
      operationTypeName.includes(search)
    );
  }) || [];

  // Group filtered tables by agreement -> bank
  const groupedTables = filteredTables.reduce((acc, table) => {
    const agreementId = table.agreementId;
    const agreementName = getAgreementName(agreementId);
    
    if (!acc[agreementName]) {
      acc[agreementName] = {};
    }
    
    if (!acc[agreementName][table.bank]) {
      acc[agreementName][table.bank] = [];
    }
    
    acc[agreementName][table.bank].push(table);
    return acc;
  }, {} as Record<string, Record<string, CoefficientTable[]>>);

  const isAllSelected = filteredTables.length > 0 && selectedIds.length === filteredTables.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < filteredTables.length;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: (results) => {
        const errors: string[] = [];
        const data: InsertCoefficientTable[] = [];

        results.data.forEach((row: any, index: number) => {
          const agreementName = row.convênio || row.convenio;
          const operationType = row.tipo_operacao;
          const bank = row.banco;
          const termMonths = parseInt(row.prazo);
          const tableName = row.nome_tabela;
          const coefficient = (row.coeficiente || "").toString().replace(',', '.');
          const safetyMargin = (row.margem_seguranca || "0").toString().replace(',', '.');
          const marginTypeRaw = (row.tipo_margem || "percentual").toString().toLowerCase().trim();
          const marginType = marginTypeRaw === "fixo" ? "fixo" : "percentual";

          const agreement = agreements?.find(a => a.name === agreementName);

          if (!agreement) {
            errors.push(`Linha ${index + 2}: Convênio "${agreementName}" não encontrado`);
            return;
          }

          if (!operationType || !["credit_card", "benefit_card", "consignado"].includes(operationType)) {
            errors.push(`Linha ${index + 2}: Tipo de operação inválido (deve ser credit_card, benefit_card ou consignado)`);
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

          const safetyMarginNum = parseFloat(safetyMargin);
          if (isNaN(safetyMarginNum) || safetyMarginNum < 0) {
            errors.push(`Linha ${index + 2}: Margem de segurança inválida (deve ser um número não-negativo)`);
            return;
          }

          if (marginType === "percentual" && safetyMarginNum > 100) {
            errors.push(`Linha ${index + 2}: Margem percentual inválida (deve estar entre 0 e 100)`);
            return;
          }

          data.push({
            agreementId: agreement.id,
            operationType: operationType as "credit_card" | "benefit_card" | "consignado",
            bank,
            termMonths,
            tableName,
            coefficient,
            safetyMargin,
            marginType: marginType as "percentual" | "fixo",
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
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 mr-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
                <span className="text-sm font-medium text-primary">
                  {selectedIds.length} selecionada{selectedIds.length > 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  data-testid="button-bulk-deactivate"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Desativar Selecionadas
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Selecionadas
                </Button>
              </div>
            )}
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
            {/* Search/Filter Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por convênio, banco, prazo, tipo de operação ou nome da tabela..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-tables"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7"
                    onClick={() => setSearchTerm("")}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {searchTerm && (
                <p className="text-sm text-muted-foreground mt-2">
                  Mostrando {filteredTables.length} de {tables?.length || 0} tabelas
                </p>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs value={selectedOperationType} onValueChange={setSelectedOperationType} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all" data-testid="tab-all">
                    Todos ({tables?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="credit_card" data-testid="tab-credit-card">
                    Cartão de Crédito ({(tables?.filter(t => t.operationType === "credit_card") ?? []).length})
                  </TabsTrigger>
                  <TabsTrigger value="benefit_card" data-testid="tab-benefit-card">
                    Cartão Benefício ({(tables?.filter(t => t.operationType === "benefit_card") ?? []).length})
                  </TabsTrigger>
                  <TabsTrigger value="consignado" data-testid="tab-consignado">
                    Consignado ({(tables?.filter(t => t.operationType === "consignado") ?? []).length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={selectedOperationType} className="mt-0">
                  {filteredTables.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {searchTerm ? (
                        <>
                          Nenhuma tabela encontrada com o filtro "{searchTerm}".
                          <br />
                          <Button
                            variant="ghost"
                            onClick={() => setSearchTerm("")}
                            className="mt-2"
                            data-testid="button-clear-filter-empty"
                          >
                            Limpar filtro
                          </Button>
                        </>
                      ) : (
                        "Nenhuma tabela encontrada. Crie uma nova tabela para começar."
                      )}
                    </div>
                  ) : Object.keys(groupedTables).length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                      {Object.entries(groupedTables).map(([agreementName, banks]) => {
                        const agreementTablesCount = Object.values(banks).flat().length;
                        return (
                          <AccordionItem key={agreementName} value={agreementName}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={Object.values(banks).flat().every(t => selectedIds.includes(t.id))}
                                onCheckedChange={(checked) => {
                                  const allTablesInAgreement = Object.values(banks).flat();
                                  if (checked) {
                                    const newIds = [...selectedIds, ...allTablesInAgreement.map(t => t.id)];
                                    setSelectedIds(Array.from(new Set(newIds)));
                                  } else {
                                    setSelectedIds(prev => prev.filter(id => !allTablesInAgreement.map(t => t.id).includes(id)));
                                  }
                                }}
                                aria-label={`Selecionar todas de ${agreementName}`}
                                data-testid={`checkbox-select-all-${agreementName}`}
                              />
                              <AccordionTrigger className="hover:no-underline flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{agreementName}</span>
                                  <Badge variant="outline">{agreementTablesCount} tabelas</Badge>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent>
                              <Accordion type="multiple" className="w-full pl-4">
                                {Object.entries(banks).map(([bankName, tablesInBank]) => (
                                  <AccordionItem key={`${agreementName}-${bankName}`} value={bankName}>
                                    <AccordionTrigger className="hover:no-underline">
                                      <div className="flex items-center gap-2">
                                        <span>{bankName}</span>
                                        <Badge variant="secondary">{tablesInBank.length} tabelas</Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-12">
                                                <Checkbox
                                                  checked={tablesInBank.every(t => selectedIds.includes(t.id))}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      const newIds = [...selectedIds, ...tablesInBank.map(t => t.id)];
                                                      setSelectedIds(Array.from(new Set(newIds)));
                                                    } else {
                                                      setSelectedIds(prev => prev.filter(id => !tablesInBank.map(t => t.id).includes(id)));
                                                    }
                                                  }}
                                                  aria-label={`Selecionar todas de ${bankName}`}
                                                />
                                              </TableHead>
                                              <TableHead>Prazo</TableHead>
                                              <TableHead>Nome da Tabela</TableHead>
                                              <TableHead>Tipo</TableHead>
                                              <TableHead>Coeficiente</TableHead>
                                              <TableHead>Status</TableHead>
                                              <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {tablesInBank.sort((a, b) => a.termMonths - b.termMonths).map((table) => (
                                              <TableRow key={table.id} data-testid={`row-table-${table.id}`}>
                                                <TableCell>
                                                  <Checkbox
                                                    checked={selectedIds.includes(table.id)}
                                                    onCheckedChange={() => toggleSelectTable(table.id)}
                                                    aria-label={`Selecionar ${table.tableName}`}
                                                    data-testid={`checkbox-select-${table.id}`}
                                                  />
                                                </TableCell>
                                                <TableCell data-testid={`text-term-${table.id}`}>
                                                  {table.termMonths} meses
                                                </TableCell>
                                                <TableCell data-testid={`text-name-${table.id}`}>
                                                  {table.tableName}
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">{getOperationTypeName(table.operationType)}</Badge>
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
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : null}
                </TabsContent>
              </Tabs>
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
                  name="operationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Operação</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-operation-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPERATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="marginType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo da Margem de Segurança</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-margin-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MARGIN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="safetyMargin"
                  render={({ field }) => {
                    const marginType = createForm.watch("marginType");
                    return (
                      <FormItem>
                        <FormLabel>
                          Margem de Segurança {marginType === "fixo" ? "(R$)" : "(%)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={marginType === "percentual" ? "100" : undefined}
                            placeholder="0.00"
                            data-testid="input-safety-margin"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {marginType === "fixo" 
                            ? "Valor fixo em reais a descontar" 
                            : "Percentual de desconto (0 a 100%)"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

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
                  name="operationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Operação</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-operation-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPERATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="marginType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo da Margem de Segurança</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-margin-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MARGIN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="safetyMargin"
                  render={({ field }) => {
                    const marginType = editForm.watch("marginType");
                    return (
                      <FormItem>
                        <FormLabel>
                          Margem de Segurança {marginType === "fixo" ? "(R$)" : "(%)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={marginType === "percentual" ? "100" : undefined}
                            placeholder="0.00"
                            data-testid="input-edit-safety-margin"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {marginType === "fixo" 
                            ? "Valor fixo em reais a descontar" 
                            : "Percentual de desconto (0 a 100%)"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.length} tabela{selectedIds.length > 1 ? 's' : ''}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita e todas as tabelas selecionadas serão permanentemente removidas do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-bulk-delete-confirm"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                `Excluir ${selectedIds.length} Tabela${selectedIds.length > 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Deactivate Confirmation Dialog */}
      <AlertDialog open={isBulkDeactivateDialogOpen} onOpenChange={setIsBulkDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desativação em Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar <strong>{selectedIds.length} tabela{selectedIds.length > 1 ? 's' : ''}</strong>?
              <br />
              <br />
              As tabelas desativadas não serão exibidas nas simulações, mas poderão ser reativadas posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-deactivate-cancel">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDeactivate}
              disabled={bulkDeactivateMutation.isPending}
              data-testid="button-bulk-deactivate-confirm"
            >
              {bulkDeactivateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desativando...
                </>
              ) : (
                `Desativar ${selectedIds.length} Tabela${selectedIds.length > 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
