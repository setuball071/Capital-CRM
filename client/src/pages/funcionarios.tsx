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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, 
  User, Users, Briefcase, CreditCard, FileText, Clock, Heart, ClipboardList
} from "lucide-react";

const employeeFormSchema = z.object({
  // Dados Pessoais
  nomeCompleto: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos").max(11),
  rg: z.string().optional(),
  rgEstado: z.string().optional(),
  rgEmissao: z.string().optional(),
  dataNascimento: z.string().optional(),
  nacionalidade: z.string().optional(),
  naturalidade: z.string().optional(),
  naturalidadeEstado: z.string().optional(),
  raca: z.string().optional(),
  grauInstrucao: z.string().optional(),
  emailCorporativo: z.string().email("Email inválido").optional().or(z.literal("")),
  emailPessoal: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  enderecoCompleto: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  
  // Dados Familiares
  nomePai: z.string().optional(),
  nomeMae: z.string().optional(),
  nomeConjuge: z.string().optional(),
  estadoCivil: z.string().optional(),
  quantidadeFilhos: z.number().min(0).optional(),
  
  // Documentos (CTPS, Título, PIS)
  ctpsNumero: z.string().optional(),
  ctpsSerie: z.string().optional(),
  ctpsEstado: z.string().optional(),
  tituloEleitor: z.string().optional(),
  tituloZona: z.string().optional(),
  tituloSecao: z.string().optional(),
  pis: z.string().optional(),
  
  // Exame Admissional
  clinicaExame: z.string().optional(),
  codigoCnes: z.string().optional(),
  medicoExame: z.string().optional(),
  crmMedico: z.string().optional(),
  dataExame: z.string().optional(),
  dataVencimentoExame: z.string().optional(),
  
  // Dados Profissionais
  cargo: z.string().optional(),
  departamento: z.string().optional(),
  tipoContrato: z.string().optional(),
  dataAdmissao: z.string().optional(),
  dataDemissao: z.string().optional(),
  status: z.string().optional(),
  salarioBase: z.string().optional(),
  adicionalSalarial: z.string().optional(),
  
  // Horários de Trabalho
  horarioEntrada1: z.string().optional(),
  horarioSaida1: z.string().optional(),
  horarioEntrada2: z.string().optional(),
  horarioSaida2: z.string().optional(),
  horarioSabadoEntrada: z.string().optional(),
  horarioSabadoSaida: z.string().optional(),
  
  // Benefícios e Descanso
  valeTransporte: z.boolean().optional(),
  valeRefeicao: z.boolean().optional(),
  descansoSabado: z.boolean().optional(),
  descansoDomingo: z.boolean().optional(),
  
  // Experiência e Contrato
  periodoExperiencia: z.string().optional(),
  renovacaoExperiencia: z.string().optional(),
  cidadeAssinatura: z.string().optional(),
  dataAssinatura: z.string().optional(),
  
  // Dados Bancários
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipoConta: z.string().optional(),
  pix: z.string().optional(),
  
  // Observações
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

const GRAUS_INSTRUCAO = [
  "Fundamental Incompleto", "Fundamental Completo", "Médio Incompleto", "Médio Completo",
  "Superior Incompleto", "Superior Completo", "Pós-Graduação", "Mestrado", "Doutorado"
];

const NACIONALIDADES = ["Brasileiro(a)", "Estrangeiro(a)"];

const RACAS = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não declarada"];

const PERIODOS_EXPERIENCIA = ["30 dias", "45 dias", "60 dias", "90 dias"];

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
  
  const { data, isLoading } = useQuery<{
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

  const defaultFormValues: EmployeeFormData = {
    nomeCompleto: "",
    cpf: "",
    rg: "",
    rgEstado: "",
    rgEmissao: "",
    dataNascimento: "",
    nacionalidade: "",
    naturalidade: "",
    naturalidadeEstado: "",
    raca: "",
    grauInstrucao: "",
    emailCorporativo: "",
    emailPessoal: "",
    telefone: "",
    celular: "",
    enderecoCompleto: "",
    bairro: "",
    cep: "",
    cidade: "",
    estado: "",
    nomePai: "",
    nomeMae: "",
    nomeConjuge: "",
    estadoCivil: "",
    quantidadeFilhos: 0,
    ctpsNumero: "",
    ctpsSerie: "",
    ctpsEstado: "",
    tituloEleitor: "",
    tituloZona: "",
    tituloSecao: "",
    pis: "",
    clinicaExame: "",
    codigoCnes: "",
    medicoExame: "",
    crmMedico: "",
    dataExame: "",
    dataVencimentoExame: "",
    cargo: "",
    departamento: "",
    tipoContrato: "",
    dataAdmissao: "",
    dataDemissao: "",
    status: "ativo",
    salarioBase: "",
    adicionalSalarial: "",
    horarioEntrada1: "",
    horarioSaida1: "",
    horarioEntrada2: "",
    horarioSaida2: "",
    horarioSabadoEntrada: "",
    horarioSabadoSaida: "",
    valeTransporte: false,
    valeRefeicao: false,
    descansoSabado: false,
    descansoDomingo: false,
    periodoExperiencia: "",
    renovacaoExperiencia: "",
    cidadeAssinatura: "",
    dataAssinatura: "",
    banco: "",
    agencia: "",
    conta: "",
    tipoConta: "",
    pix: "",
    observacoes: "",
  };

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaultFormValues,
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
    form.reset(defaultFormValues);
    setWizardStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (employee: any) => {
    setEditingEmployee(employee);
    form.reset({
      nomeCompleto: employee.nome_completo || "",
      cpf: employee.cpf || "",
      rg: employee.rg || "",
      rgEstado: employee.rg_estado || "",
      rgEmissao: employee.rg_emissao || "",
      dataNascimento: employee.data_nascimento || "",
      nacionalidade: employee.nacionalidade || "",
      naturalidade: employee.naturalidade || "",
      naturalidadeEstado: employee.naturalidade_estado || "",
      raca: employee.raca || "",
      grauInstrucao: employee.grau_instrucao || "",
      emailCorporativo: employee.email_corporativo || "",
      emailPessoal: employee.email_pessoal || "",
      telefone: employee.telefone || "",
      celular: employee.celular || "",
      enderecoCompleto: employee.endereco_completo || "",
      bairro: employee.bairro || "",
      cep: employee.cep || "",
      cidade: employee.cidade || "",
      estado: employee.estado || "",
      nomePai: employee.nome_pai || "",
      nomeMae: employee.nome_mae || "",
      nomeConjuge: employee.nome_conjuge || "",
      estadoCivil: employee.estado_civil || "",
      quantidadeFilhos: employee.quantidade_filhos || 0,
      ctpsNumero: employee.ctps_numero || "",
      ctpsSerie: employee.ctps_serie || "",
      ctpsEstado: employee.ctps_estado || "",
      tituloEleitor: employee.titulo_eleitor || "",
      tituloZona: employee.titulo_zona || "",
      tituloSecao: employee.titulo_secao || "",
      pis: employee.pis || "",
      clinicaExame: employee.clinica_exame || "",
      codigoCnes: employee.codigo_cnes || "",
      medicoExame: employee.medico_exame || "",
      crmMedico: employee.crm_medico || "",
      dataExame: employee.data_exame || "",
      dataVencimentoExame: employee.data_vencimento_exame || "",
      cargo: employee.cargo || "",
      departamento: employee.departamento || "",
      tipoContrato: employee.tipo_contrato || "",
      dataAdmissao: employee.data_admissao || "",
      dataDemissao: employee.data_demissao || "",
      status: employee.status || "ativo",
      salarioBase: employee.salario_base || "",
      adicionalSalarial: employee.adicional_salarial || "",
      horarioEntrada1: employee.horario_entrada_1 || "",
      horarioSaida1: employee.horario_saida_1 || "",
      horarioEntrada2: employee.horario_entrada_2 || "",
      horarioSaida2: employee.horario_saida_2 || "",
      horarioSabadoEntrada: employee.horario_sabado_entrada || "",
      horarioSabadoSaida: employee.horario_sabado_saida || "",
      valeTransporte: employee.vale_transporte || false,
      valeRefeicao: employee.vale_refeicao || false,
      descansoSabado: employee.descanso_sabado || false,
      descansoDomingo: employee.descanso_domingo || false,
      periodoExperiencia: employee.periodo_experiencia || "",
      renovacaoExperiencia: employee.renovacao_experiencia || "",
      cidadeAssinatura: employee.cidade_assinatura || "",
      dataAssinatura: employee.data_assinatura || "",
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
    form.reset(defaultFormValues);
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
        form.setValue("enderecoCompleto", data.logradouro);
        form.setValue("bairro", data.bairro);
        form.setValue("cidade", data.localidade);
        form.setValue("estado", data.uf);
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const WIZARD_STEPS = [
    { number: 1, title: "Pessoais", icon: User },
    { number: 2, title: "Família", icon: Users },
    { number: 3, title: "Documentos", icon: FileText },
    { number: 4, title: "Exame", icon: Heart },
    { number: 5, title: "Profissional", icon: Briefcase },
    { number: 6, title: "Horários", icon: Clock },
    { number: 7, title: "Bancário", icon: CreditCard },
    { number: 8, title: "Contrato", icon: ClipboardList },
  ];

  const TOTAL_STEPS = WIZARD_STEPS.length;

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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-modal-title">
              {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do funcionário em cada etapa ({wizardStep}/{TOTAL_STEPS})
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1 mb-4 border-b pb-4">
            {WIZARD_STEPS.map((step) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setWizardStep(step.number)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  wizardStep === step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover-elevate"
                }`}
                data-testid={`button-step-${step.number}`}
              >
                <step.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Step 1: Dados Pessoais */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-5 h-5" /> Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="nomeCompleto"
                      render={({ field }) => (
                        <FormItem className="md:col-span-3">
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
                            <Input {...field} maxLength={11} placeholder="Apenas números" data-testid="input-cpf" />
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
                      name="rgEstado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF RG</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-rg-estado">
                                <SelectValue placeholder="UF" />
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
                    <FormField
                      control={form.control}
                      name="rgEmissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Emissão RG</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-rg-emissao" />
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
                      name="nacionalidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nacionalidade</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-nacionalidade">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NACIONALIDADES.map(n => (
                                <SelectItem key={n} value={n}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="naturalidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Naturalidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade natal" data-testid="input-naturalidade" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="naturalidadeEstado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF Naturalidade</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-naturalidade-estado">
                                <SelectValue placeholder="UF" />
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
                    <FormField
                      control={form.control}
                      name="raca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Raça/Cor</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-raca">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RACAS.map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="grauInstrucao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grau de Instrução</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-grau-instrucao">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GRAUS_INSTRUCAO.map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-endereco" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-bairro" />
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
                                <SelectValue placeholder="UF" />
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

              {/* Step 2: Dados Familiares */}
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
                      name="nomeConjuge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Cônjuge</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-nome-conjuge" />
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

              {/* Step 3: Documentos (CTPS, Título, PIS) */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Documentos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3 text-sm font-medium text-muted-foreground">CTPS - Carteira de Trabalho</div>
                    <FormField
                      control={form.control}
                      name="ctpsNumero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número CTPS</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-ctps-numero" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ctpsSerie"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Série CTPS</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-ctps-serie" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ctpsEstado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF CTPS</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-ctps-estado">
                                <SelectValue placeholder="UF" />
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
                    <div className="md:col-span-3 text-sm font-medium text-muted-foreground mt-4">Título de Eleitor</div>
                    <FormField
                      control={form.control}
                      name="tituloEleitor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do Título</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-titulo-eleitor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tituloZona"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-titulo-zona" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tituloSecao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seção</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-titulo-secao" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-3 text-sm font-medium text-muted-foreground mt-4">PIS/PASEP</div>
                    <FormField
                      control={form.control}
                      name="pis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número PIS/PASEP</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-pis" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Exame Admissional */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Heart className="w-5 h-5" /> Exame Admissional
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clinicaExame"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clínica</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-clinica-exame" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="codigoCnes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código CNES</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-codigo-cnes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="medicoExame"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Médico Responsável</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-medico-exame" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="crmMedico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CRM do Médico</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-crm-medico" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataExame"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data do Exame</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-data-exame" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataVencimentoExame"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Vencimento Exame</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-data-vencimento-exame" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Dados Profissionais */}
              {wizardStep === 5 && (
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
                          <FormLabel>Departamento</FormLabel>
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
                          <FormLabel>Cargo/Função</FormLabel>
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
                          <FormLabel>Tipo de Contrato</FormLabel>
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
                          <FormLabel>Data de Admissão</FormLabel>
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
                          <FormLabel>Salário Base (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-salario" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="adicionalSalarial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adicional (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-adicional" />
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

              {/* Step 6: Horários de Trabalho e Benefícios */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5" /> Horários de Trabalho e Benefícios
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-4 text-sm font-medium text-muted-foreground">Jornada Dias Úteis</div>
                    <FormField
                      control={form.control}
                      name="horarioEntrada1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entrada Manhã</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-entrada-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="horarioSaida1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saída Almoço</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-saida-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="horarioEntrada2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retorno Almoço</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-entrada-2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="horarioSaida2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saída Tarde</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-saida-2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-4 text-sm font-medium text-muted-foreground mt-4">Jornada Sábado</div>
                    <FormField
                      control={form.control}
                      name="horarioSabadoEntrada"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entrada Sábado</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-sabado-entrada" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="horarioSabadoSaida"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saída Sábado</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-horario-sabado-saida" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-4 text-sm font-medium text-muted-foreground mt-4">Benefícios e Descanso</div>
                    <FormField
                      control={form.control}
                      name="valeTransporte"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-vale-transporte"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Vale Transporte</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="valeRefeicao"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-vale-refeicao"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Vale Refeição</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="descansoSabado"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-descanso-sabado"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Descanso Sábado</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="descansoDomingo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-descanso-domingo"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Descanso Domingo</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 7: Dados Bancários */}
              {wizardStep === 7 && (
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
                          <FormLabel>Banco</FormLabel>
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
                          <FormLabel>Agência</FormLabel>
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
                          <FormLabel>Conta</FormLabel>
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
                          <FormLabel>Tipo de Conta</FormLabel>
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

              {/* Step 8: Contrato e Observações */}
              {wizardStep === 8 && (
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" /> Contrato e Observações
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="periodoExperiencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Período de Experiência</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-periodo-experiencia">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PERIODOS_EXPERIENCIA.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="renovacaoExperiencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Renovação Experiência</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-renovacao-experiencia">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PERIODOS_EXPERIENCIA.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cidadeAssinatura"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade da Assinatura</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-cidade-assinatura" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataAssinatura"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Assinatura</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-data-assinatura" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="observacoes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
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
                  {wizardStep < TOTAL_STEPS ? (
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
