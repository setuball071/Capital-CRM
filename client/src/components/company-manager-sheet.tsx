import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Pencil, Power, Building2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BRAZILIAN_STATES, type Company } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const companyFormSchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  uf: z.string().min(2, "UF é obrigatória"),
  endereco: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface CompanyManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyManagerSheet({ open, onOpenChange }: CompanyManagerSheetProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);

  const createForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { razaoSocial: "", cnpj: "", cidade: "", uf: "", endereco: "" },
  });

  const editForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { razaoSocial: "", cnpj: "", cidade: "", uf: "", endereco: "" },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsCreateOpen(false);
      setIsEditOpen(false);
      setIsDeactivateOpen(false);
      setSelected(null);
      createForm.reset();
      editForm.reset();
    }
    onOpenChange(nextOpen);
  };

  const { data: companiesList, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      return await apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateOpen(false);
      createForm.reset();
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      if (!selected) throw new Error("Nenhuma empresa selecionada");
      return await apiRequest("PUT", `/api/companies/${selected.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditOpen(false);
      setSelected(null);
      editForm.reset();
      toast({ title: "Empresa atualizada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsDeactivateOpen(false);
      setSelected(null);
      toast({ title: "Empresa desativada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao desativar empresa", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (company: Company) => {
    setSelected(company);
    editForm.reset({
      razaoSocial: company.razaoSocial,
      cnpj: company.cnpj,
      cidade: company.cidade,
      uf: company.uf,
      endereco: company.endereco || "",
    });
    setIsEditOpen(true);
  };

  const handleDeactivate = (company: Company) => {
    setSelected(company);
    setIsDeactivateOpen(true);
  };

  const renderForm = (
    form: ReturnType<typeof useForm<CompanyFormData>>,
    onSubmit: (data: CompanyFormData) => void,
    isPending: boolean,
    submitLabel: string,
    onCancel: () => void,
  ) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="razaoSocial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razão Social</FormLabel>
              <FormControl>
                <Input placeholder="Nome da empresa" data-testid="input-razao-social" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cnpj"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CNPJ</FormLabel>
              <FormControl>
                <Input
                  placeholder="00.000.000/0001-00"
                  data-testid="input-cnpj"
                  value={field.value}
                  onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Cidade" data-testid="input-cidade" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="uf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-uf">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="endereco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endereço (opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Endereço completo" data-testid="input-endereco" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas Emissoras
            </SheetTitle>
            <SheetDescription>Gerencie as empresas emissoras de Nota Promissória</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button onClick={() => setIsCreateOpen(true)} className="w-full" data-testid="button-create-company">
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : companiesList && companiesList.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesList.map((company) => (
                    <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-razao-social-${company.id}`}>
                            {company.razaoSocial}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-cnpj-${company.id}`}>
                            {company.cnpj} — {company.cidade}/{company.uf}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`status-company-${company.id}`}>
                        <Badge variant={company.isActive ? "default" : "secondary"}>
                          {company.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {company.isActive && (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} data-testid={`button-edit-company-${company.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeactivate(company)} data-testid={`button-deactivate-company-${company.id}`}>
                              <Power className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma empresa cadastrada</p>
                <p className="text-xs mt-1">Clique em "Nova Empresa" para adicionar</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa Emissora</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa para emissão de Nota Promissória</DialogDescription>
          </DialogHeader>
          {renderForm(createForm, (data) => createMutation.mutate(data), createMutation.isPending, "Criar Empresa", () => setIsCreateOpen(false))}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize as informações da empresa</DialogDescription>
          </DialogHeader>
          {renderForm(editForm, (data) => updateMutation.mutate(data), updateMutation.isPending, "Salvar Alterações", () => setIsEditOpen(false))}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar a empresa <strong>{selected?.razaoSocial}</strong>?
              Ela não aparecerá mais na lista de empresas disponíveis para emissão de notas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-deactivate-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selected && deactivateMutation.mutate(selected.id)}
              disabled={deactivateMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-deactivate-confirm"
            >
              {deactivateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
