import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agreement, InsertAgreement } from "@shared/schema";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const agreementFormSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  description: z.string().optional(),
  safetyMargin: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    },
    { message: "Margem de segurança deve ser entre 0 e 100%" }
  ),
  isActive: z.boolean().default(true),
});

type AgreementFormData = z.infer<typeof agreementFormSchema>;

export default function AgreementsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);

  const createForm = useForm<AgreementFormData>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: {
      name: "",
      description: "",
      safetyMargin: "0",
      isActive: true,
    },
  });

  const editForm = useForm<AgreementFormData>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: {
      name: "",
      description: "",
      safetyMargin: "0",
      isActive: true,
    },
  });

  const { data: agreements, isLoading } = useQuery<Agreement[]>({
    queryKey: ["/api/agreements"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: AgreementFormData) => {
      const payload: InsertAgreement = {
        name: data.name,
        description: data.description || undefined,
        safetyMargin: data.safetyMargin,
        isActive: data.isActive,
      };
      return await apiRequest("POST", "/api/agreements", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Convênio criado com sucesso",
        description: "O convênio foi adicionado ao sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar convênio",
        description: error.message || "Ocorreu um erro ao criar o convênio.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AgreementFormData) => {
      if (!selectedAgreement) throw new Error("Nenhum convênio selecionado");
      const payload: Partial<InsertAgreement> = {
        name: data.name,
        description: data.description || undefined,
        safetyMargin: data.safetyMargin,
        isActive: data.isActive,
      };
      return await apiRequest("PATCH", `/api/agreements/${selectedAgreement.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      setIsEditDialogOpen(false);
      setSelectedAgreement(null);
      editForm.reset();
      toast({
        title: "Convênio atualizado com sucesso",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar convênio",
        description: error.message || "Ocorreu um erro ao atualizar o convênio.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/agreements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coefficient-tables"] });
      setIsDeleteDialogOpen(false);
      setSelectedAgreement(null);
      toast({
        title: "Convênio excluído com sucesso",
        description: "O convênio e suas tabelas de coeficientes foram removidos.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir convênio",
        description: error.message || "Ocorreu um erro ao excluir o convênio.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: AgreementFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    editForm.reset({
      name: agreement.name,
      description: agreement.description || "",
      safetyMargin: agreement.safetyMargin || "0",
      isActive: agreement.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: AgreementFormData) => {
    updateMutation.mutate(data);
  };

  const handleDelete = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedAgreement) {
      deleteMutation.mutate(selectedAgreement.id);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Convênios
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie os convênios do sistema
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-agreement"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Convênio
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Convênios</CardTitle>
            <CardDescription>
              Convênios disponíveis no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements && agreements.length > 0 ? (
                    agreements.map((agreement) => (
                      <TableRow key={agreement.id} data-testid={`row-agreement-${agreement.id}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${agreement.id}`}>
                          {agreement.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-description-${agreement.id}`}>
                          {agreement.description || "-"}
                        </TableCell>
                        <TableCell data-testid={`status-${agreement.id}`}>
                          <Badge variant={agreement.isActive ? "default" : "secondary"}>
                            {agreement.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(agreement)}
                              data-testid={`button-edit-${agreement.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(agreement)}
                              data-testid={`button-delete-${agreement.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum convênio encontrado. Crie um novo convênio para começar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Convênio</DialogTitle>
            <DialogDescription>
              Adicione um novo convênio ao sistema
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do convênio"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrição do convênio"
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="safetyMargin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margem de Segurança (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        data-testid="input-safety-margin"
                        {...field}
                      />
                    </FormControl>
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
                    "Criar Convênio"
                  )}
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
            <DialogTitle>Editar Convênio</DialogTitle>
            <DialogDescription>
              Atualize as informações do convênio
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do convênio"
                        data-testid="input-edit-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrição do convênio"
                        data-testid="input-edit-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="safetyMargin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margem de Segurança (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        data-testid="input-edit-safety-margin"
                        {...field}
                      />
                    </FormControl>
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
                        {field.value ? "Convênio ativo" : "Convênio inativo"}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o convênio <strong>{selectedAgreement?.name}</strong>?
              <br />
              <br />
              <span className="text-destructive font-medium">
                Atenção: Todas as tabelas de coeficientes vinculadas a este convênio também serão excluídas!
              </span>
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
                "Excluir Convênio"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { FormDescription } from "@/components/ui/form";
