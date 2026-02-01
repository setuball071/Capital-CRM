import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight, 
  User, Users, Briefcase, CreditCard, FileText, X
} from "lucide-react";

const employeeFormSchema = z.object({
  nomeCompleto: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(11),
  rg: z.string().optional(),
  dataNascimento: z.string().optional(),
  emailCorporativo: z.string().email("Email inválido").optional().or(z.literal("")),
  emailPessoal: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  enderecoCompleto: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  nomePai: z.string().optional(),
  nomeMae: z.string().optional(),
  estadoCivil: z.string().optional(),
  quantidadeFilhos: z.number().min(0).optional(),
  cargo: z.string().optional(),
  departamento: z.string().optional(),
  tipoContrato: z.string().optional(),
  dataAdmissao: z.string().optional(),
  dataDemissao: z.string().optional(),
  status: z.string().optional(),
  salarioBase: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipoConta: z.string().optional(),
  pix: z.string().optional(),
  observacoes: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const DEPARTAMENTOS = [
  "Comercial", "Operacional", "Financeiro", "RH", "TI", "Marketing", "Serviços Gerais", "Diretoria"
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "ferias", label: "Férias" },
  { value: "afastado", label: "Afastado" },
  { value: "demitido", label: "Demitido" },
];

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const BANCOS = [
  "Banco do Brasil", "Caixa Econômica", "Bradesco", "Itaú", "Santander", 
  "Nubank", "Inter", "C6 Bank", "BTG", "Safra", "Original", "PagBank", "Outro"
];

function formatCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "ativo": return "default";
    case "ferias": return "secondary";
    case "afastado": return "outline";
    case "demitido": return "destructive";
    default: return "secondary";
  }
}

export default function FuncionariosPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoContratoFilter, setTipoContratoFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [wizardStep, setWizardStep] = useState(1);
  
  const { data, isLoading, refetch } = useQuery<{
    employees: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/employees", { departamento: departamentoFilter, status: statusFilter, tipoContrato: tipoContratoFilter, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (departamentoFilter !== "todos") params.set("departamento", departamentoFilter);
      if (statusFilter !== "todos") params.set("status", statusFilter);
      if (tipoContratoFilter !== "todos") params.set("tipoContrato", tipoContratoFilter);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "50");
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar funcionários");
      return res.json();
    },
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      nomeCompleto: "",
      cpf: "",
      rg: "",
      dataNascimento: "",
      emailCorporativo: "",
      emailPessoal: "",
      telefone: "",
      celular: "",
      enderecoCompleto: "",
      cep: "",
      cidade: "",
      estado: "",
      nomePai: "",
      nomeMae: "",
      estadoCivil: "",
      quantidadeFilhos: 0,
      cargo: "",
      departamento: "",
      tipoContrato: "",
      dataAdmissao: "",
      status: "ativo",
      salarioBase: "",
      banco: "",
      agencia: "",
      conta: "",
      tipoConta: "",
      pix: "",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      toast({ title: "Funcionário criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      closeModal();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar funcionário", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => apiRequest("PUT", `/api/employees/${editingEmployee.id}`, data),
    onSuccess: () => {
      toast({ title: "Funcionário atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      closeModal();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar funcionário", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      toast({ title: "Funcionário removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover funcionário", description: error.message, variant: "destructive" });
    },
  });

  const openCreateModal = () => {
    setEditingEmployee(null);
    form.reset();
    setWizardStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (employee: any) => {
    setEditingEmployee(employee);
    form.reset({
      nomeCompleto: employee.nome_completo || "",
      cpf: employee.cpf || "",
      rg: employee.rg || "",
      dataNascimento: employee.data_nascimento || "",
      emailCorporativo: employee.email_corporativo || "",
      emailPessoal: employee.email_pessoal || "",
      telefone: employee.telefone || "",
      celular: employee.celular || "",
      enderecoCompleto: employee.endereco_completo || "",
      cep: employee.cep || "",
      cidade: employee.cidade || "",
      estado: employee.estado || "",
      nomePai: employee.nome_pai || "",
      nomeMae: employee.nome_mae || "",
      estadoCivil: employee.estado_civil || "",
      quantidadeFilhos: employee.quantidade_filhos || 0,
      cargo: employee.cargo || "",
      departamento: employee.departamento || "",
      tipoContrato: employee.tipo_contrato || "",
      dataAdmissao: employee.data_admissao || "",
      dataDemissao: employee.data_demissao || "",
      status: employee.status || "ativo",
      salarioBase: employee.salario_base || "",
      banco: employee.banco || "",
      agencia: employee.agencia || "",
      conta: employee.conta || "",
      tipoConta: employee.tipo_conta || "",
      pix: employee.pix || "",
      observacoes: employee.observacoes || "",
    });
    setWizardStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setWizardStep(1);
    form.reset();
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja remover este funcionário?")) {
      deleteMutation.mutate(id);
    }
  };

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        form.setValue("enderecoCompleto", `${data.logradouro}, ${data.bairro}`);
        form.setValue("cidade", data.localidade);
        form.setValue("estado", data.uf);
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const WIZARD_STEPS = [
    { number: 1, title: "Dados Pessoais", icon: User },
    { number: 2, title: "Família", icon: Users },
    { number: 3, title: "Profissional", icon: Briefcase },
    { number: 4, title: "Bancário", icon: CreditCard },
    { number: 5, title: "Documentos", icon: FileText },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Funcionários</h1>
        <Button onClick={openCreateModal} data-testid="button-new-employee">
          <Plus className="w-4 h-4 mr-2" />
          Novo Funcionário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome ou CPF..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={departamentoFilter} onValueChange={setDepartamentoFilter}>
                <SelectTrigger data-testid="select-departamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {DEPARTAMENTOS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Contrato</Label>
              <Select value={tipoContratoFilter} onValueChange={setTipoContratoFilter}>
                <SelectTrigger data-testid="select-tipo-contrato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.employees?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum funcionário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.employees?.map((emp: any) => (
                      <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                        <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                        <TableCell>{formatCpf(emp.cpf)}</TableCell>
                        <TableCell>{emp.cargo || "-"}</TableCell>
                        <TableCell>{emp.departamento || "-"}</TableCell>
                        <TableCell>{emp.tipo_contrato || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(emp.status)}>
                            {STATUS_OPTIONS.find(s => s.value === emp.status)?.label || emp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => openEditModal(emp)}
                              data-testid={`button-edit-${emp.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDelete(emp.id)}
                              data-testid={`button-delete-${emp.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {data.page} de {data.totalPages} ({data.total} registros)
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={page >= data.totalPages}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-modal-title">
              {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do funcionário em cada etapa
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-6 border-b pb-4">
            {WIZARD_STEPS.map((step) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setWizardStep(step.number)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  wizardStep === step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover-elevate"
                }`}
                data-testid={`button-step-${step.number}`}
              >
                <step.icon className="w-4 h-4" />
                <span className="hidden md:inline">{step.title}</span>
              </button>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-5 h-5" /> Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nomeCompleto"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-nome" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              maxLength={11}
                              placeholder="Apenas números"
                              data-testid="input-cpf"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-rg" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataNascimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Nascimento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-data-nascimento" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emailCorporativo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Corporativo</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email-corp" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emailPessoal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Pessoal</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email-pessoal" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-telefone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-celular" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              maxLength={8}
                              placeholder="Apenas números"
                              onBlur={(e) => fetchCep(e.target.value)}
                              data-testid="input-cep"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="enderecoCompleto"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Endereço Completo</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-endereco" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-cidade" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-estado">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ESTADOS.map(uf => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" /> Dados Familiares
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nomePai"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Pai</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-nome-pai" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nomeMae"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Mãe</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-nome-mae" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estadoCivil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Civil</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-estado-civil">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ESTADOS_CIVIS.map(ec => (
                                <SelectItem key={ec} value={ec}>{ec}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantidadeFilhos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade de Filhos</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0} 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-filhos"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Briefcase className="w-5 h-5" /> Dados Profissionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-departamento-form">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DEPARTAMENTOS.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cargo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-cargo" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipoContrato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Contrato *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-contrato-form">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CLT">CLT</SelectItem>
                              <SelectItem value="PJ">PJ</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataAdmissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Admissão *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-data-admissao" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="salarioBase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salário Base</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              data-testid="input-salario"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status-form">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Dados Bancários
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="banco"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banco *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-banco">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BANCOS.map(b => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agência *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-agencia" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="conta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Conta *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-conta" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipoConta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Conta *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-conta">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="corrente">Corrente</SelectItem>
                              <SelectItem value="poupanca">Poupança</SelectItem>
                              <SelectItem value="salario">Salário</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pix"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="CPF, Email, Telefone ou Aleatória" data-testid="input-pix" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Documentos e Observações
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    O upload de documentos estará disponível após salvar o funcionário.
                  </p>
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={4}
                            placeholder="Anotações adicionais sobre o funcionário..."
                            data-testid="textarea-observacoes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <div>
                  {wizardStep > 1 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setWizardStep(s => s - 1)}
                      data-testid="button-prev-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Anterior
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeModal} data-testid="button-cancel">
                    Cancelar
                  </Button>
                  {wizardStep < 5 ? (
                    <Button 
                      type="button" 
                      onClick={() => setWizardStep(s => s + 1)}
                      data-testid="button-next-step"
                    >
                      Próximo
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save"
                    >
                      {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
