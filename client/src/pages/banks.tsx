import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Landmark, Percent } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Bank, InsertBank } from "@shared/schema";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

const bankFormSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  ajusteSaldoPercentual: z.string().default("0"),
  isActive: z.boolean().default(true),
});

type BankFormData = z.infer<typeof bankFormSchema>;

export default function BanksPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  const createForm = useForm<BankFormData>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      name: "",
      ajusteSaldoPercentual: "0",
      isActive: true,
    },
  });

  const editForm = useForm<BankFormData>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      name: "",
      ajusteSaldoPercentual: "0",
      isActive: true,
    },
  });

  const { data: banks, isLoading } = useQuery<Bank[]>({
    queryKey: ["/api/banks/all"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: BankFormData) => {
      const payload: InsertBank = {
        name: data.name,
        ajusteSaldoPercentual: data.ajusteSaldoPercentual,
        isActive: data.isActive,
      };
      return await apiRequest("POST", "/api/banks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Banco criado com sucesso",
        description: "O banco foi adicionado ao sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar banco",
        description: error.message || "Ocorreu um erro ao criar o banco.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: BankFormData) => {
      if (!selectedBank) throw new Error("Nenhum banco selecionado");
      const payload: Partial<InsertBank> = {
        name: data.name,
        ajusteSaldoPercentual: data.ajusteSaldoPercentual,
        isActive: data.isActive,
      };
      return await apiRequest("PUT", `/api/banks/${selectedBank.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsEditDialogOpen(false);
      setSelectedBank(null);
      editForm.reset();
      toast({
        title: "Banco atualizado com sucesso",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar banco",
        description: error.message || "Ocorreu um erro ao atualizar o banco.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/banks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsDeleteDialogOpen(false);
      setSelectedBank(null);
      toast({
        title: "Banco excluído com sucesso",
        description: "O banco foi removido do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir banco",
        description: error.message || "Ocorreu um erro ao excluir o banco.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: BankFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (bank: Bank) => {
    setSelectedBank(bank);
    editForm.reset({
      name: bank.name,
      ajusteSaldoPercentual: bank.ajusteSaldoPercentual || "0",
      isActive: bank.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: BankFormData) => {
    updateMutation.mutate(data);
  };

  const handleDelete = (bank: Bank) => {
    setSelectedBank(bank);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedBank) {
      deleteMutation.mutate(selectedBank.id);
    }
  };

  const formatAdjustment = (value: string | null | undefined) => {
    const num = parseFloat(value || "0");
    if (num === 0) return "0%";
    if (num > 0) return `+${num.toFixed(2)}%`;
    return `${num.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Bancos
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure os bancos e seus ajustes de saldo
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-bank"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Banco
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Bancos</CardTitle>
            <CardDescription>
              Bancos cadastrados e seus percentuais de ajuste de saldo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : banks && banks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ajuste de Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((bank) => (
                    <TableRow key={bank.id} data-testid={`row-bank-${bank.id}`}>
                      <TableCell className="font-medium">{bank.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          <span className={
                            parseFloat(bank.ajusteSaldoPercentual || "0") > 0 
                              ? "text-destructive" 
                              : parseFloat(bank.ajusteSaldoPercentual || "0") < 0 
                                ? "text-chart-2" 
                                : ""
                          }>
                            {formatAdjustment(bank.ajusteSaldoPercentual)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bank.isActive ? "default" : "secondary"}>
                          {bank.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(bank)}
                            data-testid={`button-edit-bank-${bank.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(bank)}
                            data-testid={`button-delete-bank-${bank.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum banco cadastrado</p>
                <p className="text-sm mt-1">
                  Clique em "Novo Banco" para adicionar um banco
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Banco</DialogTitle>
            <DialogDescription>
              Adicione um novo banco ao sistema com configuração de ajuste de saldo.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Banco</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Banco do Brasil" 
                        {...field} 
                        data-testid="input-bank-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="ajusteSaldoPercentual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ajuste de Saldo (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        data-testid="input-bank-adjustment"
                      />
                    </FormControl>
                    <FormDescription>
                      Percentual de ajuste aplicado ao saldo devedor. 
                      Use valores positivos para aumentar ou negativos para diminuir.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Ativo</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-bank-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create-bank"
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Banco</DialogTitle>
            <DialogDescription>
              Altere as informações do banco selecionado.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Banco</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Banco do Brasil" 
                        {...field} 
                        data-testid="input-edit-bank-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="ajusteSaldoPercentual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ajuste de Saldo (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        data-testid="input-edit-bank-adjustment"
                      />
                    </FormControl>
                    <FormDescription>
                      Percentual de ajuste aplicado ao saldo devedor. 
                      Use valores positivos para aumentar ou negativos para diminuir.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Ativo</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-bank-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit-bank"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o banco "{selectedBank?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bank"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
