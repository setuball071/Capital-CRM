import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Plus,
  Globe,
  Users,
  Building2,
  Trash2,
  Edit,
  Link,
  UserPlus,
  MoreVertical,
  Copy,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Rocket,
} from "lucide-react";
import type { User } from "@shared/schema";
import { SUBSCRIPTION_PLANS, PLAN_LABELS, PLAN_PRICES } from "@shared/schema";

interface Tenant {
  id: number;
  key: string;
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeJson?: Record<string, unknown>;
  isActive: boolean;
  interno?: boolean;
  status?: string;
  ultimoAcesso?: string | null;
  createdAt: string;
}

interface SaasConfig {
  wildcardBaseDomain: string | null;
  railwayConfigured: boolean;
  asaasConfigured: boolean;
}

interface ProvisionResult {
  tenantId: number;
  adminUserId: number;
  senhaTemporaria: string;
  dominio: string | null;
  cnameAlvo: string | null;
  emailEnviado: boolean;
  warnings: string[];
}

interface TenantFicha {
  tenant: Tenant & Record<string, unknown>;
  dominios: { domain: string; is_primary: boolean }[];
  assinatura: {
    plan: string;
    status: string;
    current_period_end: string | null;
    gateway_subscription_id: string | null;
  } | null;
  adicionais: { id: number; produto: string; created_at: string }[];
  modulos: { key: string; nome: string; ativo: boolean }[];
  metricas: {
    usuarios: number;
    usuarios_ativos: number;
    propostas: number;
    total_pago: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  inativo: "Inativo",
  cancelado: "Cancelado",
  excluido: "Excluído",
};

function tenantStatus(t: Tenant): string {
  return t.status || (t.isActive ? "ativo" : "inativo");
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  if (status === "ativo") {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">{label}</Badge>;
  }
  if (status === "suspenso") {
    return (
      <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
        {label}
      </Badge>
    );
  }
  if (status === "excluido") {
    return <Badge variant="destructive">{label}</Badge>;
  }
  return <Badge variant="secondary">{label}</Badge>;
}

function formatDateTimeBR(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatDateBR(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function formatPlanPrice(cents: number | null): string {
  if (cents === null) return "Sob consulta";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const WIZARD_INITIAL = {
  nome: "",
  key: "",
  adminNome: "",
  adminEmail: "",
  dominioTipo: "subdominio" as "subdominio" | "proprio" | "nenhum",
  dominioProprio: "",
  plano: "basico",
  statusAssinatura: "trial" as "trial" | "active" | "nenhuma",
  trialDays: "7",
};

interface TenantDomain {
  id: number;
  tenantId: number;
  domain: string;
  isPrimary: boolean;
  createdAt: string;
}

interface TenantUser {
  id: number;
  userId: number;
  roleInTenant: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function AdminTenantsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<TenantDomain | null>(null);
  const [userAccessToDelete, setUserAccessToDelete] = useState<TenantUser | null>(null);

  const [formData, setFormData] = useState({
    key: "",
    name: "",
    logoUrl: "",
    faviconUrl: "",
    themeJson: "",
  });

  const [newDomain, setNewDomain] = useState({ domain: "", isPrimary: false });
  const [domainError, setDomainError] = useState("");
  const [newUserAccess, setNewUserAccess] = useState({ userId: "", roleInTenant: "vendedor" });

  // ===== Painel SaaS (Fase 5) =====
  const [statusFilter, setStatusFilter] = useState("todos");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState({ ...WIZARD_INITIAL });
  const [keyEdited, setKeyEdited] = useState(false);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [provisionedInfo, setProvisionedInfo] = useState<{ nome: string; adminEmail: string } | null>(null);
  const [fichaTenantId, setFichaTenantId] = useState<number | null>(null);
  const [modulosDraft, setModulosDraft] = useState<Record<string, boolean>>({});
  const [tenantToSoftDelete, setTenantToSoftDelete] = useState<Tenant | null>(null);
  const [tenantToHardDelete, setTenantToHardDelete] = useState<Tenant | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState("");
  const [isDownloadingDump, setIsDownloadingDump] = useState(false);

  const validateDomain = (value: string): string => {
    if (value.includes("http://") || value.includes("https://")) {
      return "Digite apenas o domínio, ex: goldcarddigital.com.br (sem http ou https)";
    }
    if (value.includes("/")) {
      return "Digite apenas o domínio, sem caminho ou barra";
    }
    return "";
  };

  const handleDomainChange = (value: string) => {
    setDomainError(validateDomain(value));
    setNewDomain({ ...newDomain, domain: value });
  };

  // REFACTORED: Use isMaster flag instead of role check
  const isMaster = currentUser?.isMaster === true;

  const { data: tenants = [], isLoading: isLoadingTenants } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: isMaster,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isMaster,
  });

  const { data: tenantDomains = [], isLoading: isLoadingDomains } = useQuery<TenantDomain[]>({
    queryKey: ["/api/admin/tenants", selectedTenant?.id, "domains"],
    enabled: !!selectedTenant,
  });

  const { data: tenantUsers = [], isLoading: isLoadingUsers } = useQuery<TenantUser[]>({
    queryKey: ["/api/admin/tenants", selectedTenant?.id, "users"],
    enabled: !!selectedTenant,
  });

  const { data: saasConfig } = useQuery<SaasConfig>({
    queryKey: ["/api/admin/saas-config"],
    enabled: isMaster,
  });

  const { data: ficha, isLoading: isLoadingFicha } = useQuery<TenantFicha>({
    queryKey: ["/api/admin/tenants", fichaTenantId, "ficha"],
    enabled: fichaTenantId !== null,
  });

  useEffect(() => {
    if (ficha?.modulos) {
      setModulosDraft(Object.fromEntries(ficha.modulos.map((m) => [m.key, m.ativo])));
    }
  }, [ficha]);

  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: Record<string, unknown> = {
        key: data.key,
        name: data.name,
        logoUrl: data.logoUrl || null,
        faviconUrl: data.faviconUrl || null,
      };
      if (data.themeJson) {
        try {
          payload.themeJson = JSON.parse(data.themeJson);
        } catch {
          throw new Error("JSON do tema inválido");
        }
      }
      return apiRequest("POST", "/api/admin/tenants", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Tenant criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar tenant", description: error.message, variant: "destructive" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: { id: number } & typeof formData & { isActive?: boolean; interno?: boolean }) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        logoUrl: data.logoUrl || null,
        faviconUrl: data.faviconUrl || null,
        isActive: data.isActive,
        interno: data.interno,
      };
      if (data.themeJson) {
        try {
          payload.themeJson = JSON.parse(data.themeJson);
        } catch {
          throw new Error("JSON do tema inválido");
        }
      }
      return apiRequest("PUT", `/api/admin/tenants/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setIsEditDialogOpen(false);
      setSelectedTenant(null);
      resetForm();
      toast({ title: "Tenant atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar tenant", description: error.message, variant: "destructive" });
    },
  });

  const addDomainMutation = useMutation({
    mutationFn: async (data: { tenantId: number; domain: string; isPrimary: boolean }) => {
      return apiRequest("POST", `/api/admin/tenants/${data.tenantId}/domains`, {
        domain: data.domain,
        isPrimary: data.isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant?.id, "domains"] });
      setIsAddDomainOpen(false);
      setNewDomain({ domain: "", isPrimary: false });
      toast({ title: "Domínio adicionado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar domínio", description: error.message, variant: "destructive" });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: number) => {
      return apiRequest("DELETE", `/api/admin/tenants/domains/${domainId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant?.id, "domains"] });
      setDomainToDelete(null);
      toast({ title: "Domínio removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover domínio", description: error.message, variant: "destructive" });
    },
  });

  const addUserAccessMutation = useMutation({
    mutationFn: async (data: { tenantId: number; userId: number; roleInTenant: string }) => {
      return apiRequest("POST", `/api/admin/tenants/${data.tenantId}/users`, {
        userId: data.userId,
        roleInTenant: data.roleInTenant,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant?.id, "users"] });
      setIsAddUserOpen(false);
      setNewUserAccess({ userId: "", roleInTenant: "vendedor" });
      toast({ title: "Acesso concedido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao conceder acesso", description: error.message, variant: "destructive" });
    },
  });

  const removeUserAccessMutation = useMutation({
    mutationFn: async (userTenantId: number) => {
      return apiRequest("DELETE", `/api/admin/tenants/users/${userTenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", selectedTenant?.id, "users"] });
      setUserAccessToDelete(null);
      toast({ title: "Acesso removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover acesso", description: error.message, variant: "destructive" });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        nome: wizard.nome,
        key: wizard.key,
        adminNome: wizard.adminNome,
        adminEmail: wizard.adminEmail,
        plano: wizard.plano,
        statusAssinatura: wizard.statusAssinatura,
        dominioTipo: wizard.dominioTipo,
      };
      if (wizard.statusAssinatura === "trial") {
        body.trialDays = parseInt(wizard.trialDays, 10) || 7;
      }
      if (wizard.dominioTipo === "proprio") {
        body.dominioProprio = wizard.dominioProprio;
      }
      const res = await apiRequest("POST", "/api/admin/tenants/provisionar", body);
      return (await res.json()) as ProvisionResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setProvisionedInfo({ nome: wizard.nome, adminEmail: wizard.adminEmail });
      setIsWizardOpen(false);
      setWizard({ ...WIZARD_INITIAL });
      setWizardStep(1);
      setKeyEdited(false);
      setProvisionResult(result);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao provisionar ambiente", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/admin/tenants/${data.id}/status`, { status: data.status });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setTenantToSoftDelete(null);
      toast({ title: `Status alterado para "${STATUS_LABELS[vars.status] || vars.status}"` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao alterar status", description: error.message, variant: "destructive" });
    },
  });

  const saveModulosMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/admin/tenants/${fichaTenantId}/modulos`, { modulos: modulosDraft });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", fichaTenantId, "ficha"] });
      toast({ title: "Módulos salvos com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar módulos", description: error.message, variant: "destructive" });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (data: { id: number; confirmKey: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/tenants/${data.id}/hard-delete`, {
        confirmKey: data.confirmKey,
      });
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
    onSuccess: (data: { message?: string } | null) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setTenantToHardDelete(null);
      setHardDeleteConfirm("");
      toast({ title: data?.message || "Ambiente apagado definitivamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao apagar ambiente", description: error.message, variant: "destructive" });
    },
  });

  const downloadDump = async (tenant: Tenant) => {
    setIsDownloadingDump(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/export-dump`, { credentials: "include" });
      if (!res.ok) throw new Error(`Falha ao exportar (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${tenant.key}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup baixado" });
    } catch (error) {
      toast({
        title: "Erro ao baixar backup",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsDownloadingDump(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: `Não foi possível copiar`, variant: "destructive" });
    }
  };

  const openWizard = () => {
    setWizard({
      ...WIZARD_INITIAL,
      dominioTipo: saasConfig?.wildcardBaseDomain ? "subdominio" : "nenhum",
    });
    setWizardStep(1);
    setKeyEdited(false);
    setIsWizardOpen(true);
  };

  const wizardStep1Valid =
    wizard.nome.trim() !== "" &&
    wizard.key.trim() !== "" &&
    wizard.adminNome.trim() !== "" &&
    wizard.adminEmail.trim() !== "";
  const wizardStep2Valid =
    wizard.dominioTipo !== "proprio" || wizard.dominioProprio.trim() !== "";

  const filteredTenants = tenants.filter((t) => {
    const st = tenantStatus(t);
    if (statusFilter === "todos") return st !== "excluido";
    return st === statusFilter;
  });

  const resetForm = () => {
    setFormData({ key: "", name: "", logoUrl: "", faviconUrl: "", themeJson: "" });
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      key: tenant.key,
      name: tenant.name,
      logoUrl: tenant.logoUrl || "",
      faviconUrl: tenant.faviconUrl || "",
      themeJson: tenant.themeJson ? JSON.stringify(tenant.themeJson, null, 2) : "",
    });
    setIsEditDialogOpen(true);
  };

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Apenas administradores master podem acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Ambientes (Tenants)</h1>
          <p className="text-muted-foreground">
            Configure os ambientes white-label do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-tenant">
            <Plus className="mr-2 h-4 w-4" />
            Criar ambiente (avançado)
          </Button>
          <Button onClick={openWizard} data-testid="button-new-client-tenant">
            <Rocket className="mr-2 h-4 w-4" />
            Novo Ambiente Cliente
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="suspenso">Suspensos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
            <SelectItem value="excluido">Excluídos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoadingTenants ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTenants.map((tenant) => {
            const st = tenantStatus(tenant);
            return (
            <Card
              key={tenant.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedTenant(tenant)}
              data-testid={`card-tenant-${tenant.id}`}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <CardTitle className="text-lg truncate">{tenant.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <StatusBadge status={st} />
                  {tenant.interno === true && <Badge variant="outline">Interno</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-tenant-actions-${tenant.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={() => setFichaTenantId(tenant.id)}
                        data-testid={`menu-ficha-${tenant.id}`}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ficha do ambiente
                      </DropdownMenuItem>
                      {st !== "excluido" && (
                        <>
                          {st === "ativo" ? (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: tenant.id, status: "suspenso" })}
                              data-testid={`menu-suspender-${tenant.id}`}
                            >
                              Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => statusMutation.mutate({ id: tenant.id, status: "ativo" })}
                              data-testid={`menu-reativar-${tenant.id}`}
                            >
                              Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setTenantToSoftDelete(tenant)}
                            data-testid={`menu-excluir-${tenant.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir (soft)
                          </DropdownMenuItem>
                        </>
                      )}
                      {st === "excluido" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: tenant.id, status: "ativo" })}
                            data-testid={`menu-restaurar-${tenant.id}`}
                          >
                            Restaurar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setHardDeleteConfirm("");
                              setTenantToHardDelete(tenant);
                            }}
                            data-testid={`menu-hard-delete-${tenant.id}`}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Excluir DEFINITIVAMENTE
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded">{tenant.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Último acesso: {formatDateTimeBR(tenant.ultimoAcesso)}</span>
                  </div>
                  {tenant.logoUrl && (
                    <div className="flex items-center gap-2">
                      <img
                        src={tenant.logoUrl}
                        alt="Logo"
                        className="h-6 max-w-24 object-contain"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {selectedTenant && !isEditDialogOpen && (
        <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl">{selectedTenant.name}</DialogTitle>
                  <DialogDescription>
                    Gerencie domínios e acessos para este ambiente
                  </DialogDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedTenant)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            </DialogHeader>

            <Tabs defaultValue="domains" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="domains" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Domínios
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usuários
                </TabsTrigger>
              </TabsList>

              <TabsContent value="domains" className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setIsAddDomainOpen(true)} data-testid="button-add-domain">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Domínio
                  </Button>
                </div>

                {isLoadingDomains ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : tenantDomains.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum domínio configurado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantDomains.map((domain) => (
                        <TableRow key={domain.id} data-testid={`row-domain-${domain.id}`}>
                          <TableCell className="font-mono">{domain.domain}</TableCell>
                          <TableCell>
                            {domain.isPrimary && <Badge>Principal</Badge>}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setDomainToDelete(domain)}
                              data-testid={`button-delete-domain-${domain.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user-access">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Conceder Acesso
                  </Button>
                </div>

                {isLoadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : tenantUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum usuário com acesso</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Papel no Sistema</TableHead>
                        <TableHead>Papel no Tenant</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantUsers.map((userAccess) => (
                        <TableRow key={userAccess.id} data-testid={`row-user-access-${userAccess.id}`}>
                          <TableCell className="font-medium">{userAccess.userName}</TableCell>
                          <TableCell>{userAccess.userEmail}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{userAccess.userRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{userAccess.roleInTenant}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setUserAccessToDelete(userAccess)}
                              data-testid={`button-remove-user-${userAccess.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Ambiente</DialogTitle>
            <DialogDescription>
              Configure um novo ambiente white-label
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTenantMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="key">Chave (única)</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                  placeholder="goldcard"
                  required
                  data-testid="input-tenant-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Gold Card Digital"
                  required
                  data-testid="input-tenant-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL do Logo</Label>
              <Input
                id="logoUrl"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://exemplo.com/logo.png"
                data-testid="input-tenant-logo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faviconUrl">URL do Favicon</Label>
              <Input
                id="faviconUrl"
                value={formData.faviconUrl}
                onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                placeholder="https://exemplo.com/favicon.ico"
                data-testid="input-tenant-favicon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="themeJson">Tema (JSON)</Label>
              <Textarea
                id="themeJson"
                value={formData.themeJson}
                onChange={(e) => setFormData({ ...formData, themeJson: e.target.value })}
                placeholder='{"primaryColor": "#1a365d", "accentColor": "#ecc94b"}'
                rows={4}
                data-testid="input-tenant-theme"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTenantMutation.isPending} data-testid="button-submit-tenant">
                {createTenantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ambiente</DialogTitle>
            <DialogDescription>
              Atualize as configurações do ambiente
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedTenant) {
                updateTenantMutation.mutate({
                  id: selectedTenant.id,
                  ...formData,
                  isActive: selectedTenant.isActive,
                  interno: selectedTenant.interno === true,
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-edit-tenant-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-logoUrl">URL do Logo</Label>
              <Input
                id="edit-logoUrl"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                data-testid="input-edit-tenant-logo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-faviconUrl">URL do Favicon</Label>
              <Input
                id="edit-faviconUrl"
                value={formData.faviconUrl}
                onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                data-testid="input-edit-tenant-favicon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-themeJson">Tema (JSON)</Label>
              <Textarea
                id="edit-themeJson"
                value={formData.themeJson}
                onChange={(e) => setFormData({ ...formData, themeJson: e.target.value })}
                rows={4}
                data-testid="input-edit-tenant-theme"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-isActive"
                  checked={selectedTenant?.isActive || false}
                  onCheckedChange={(checked) => 
                    setSelectedTenant(selectedTenant ? { ...selectedTenant, isActive: checked } : null)
                  }
                  data-testid="switch-tenant-active"
                />
                <Label htmlFor="edit-isActive">Ambiente Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-interno"
                  checked={selectedTenant?.interno === true}
                  onCheckedChange={(checked) =>
                    setSelectedTenant(selectedTenant ? { ...selectedTenant, interno: checked } : null)
                  }
                  data-testid="switch-tenant-interno"
                />
                <Label htmlFor="edit-interno">Ambiente interno (não paga)</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateTenantMutation.isPending} data-testid="button-update-tenant">
                {updateTenantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDomainOpen} onOpenChange={(open) => {
        setIsAddDomainOpen(open);
        if (!open) {
          setDomainError("");
          setNewDomain({ domain: "", isPrimary: false });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Domínio</DialogTitle>
            <DialogDescription>
              Configure um domínio para este ambiente
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const error = validateDomain(newDomain.domain);
              if (error) {
                setDomainError(error);
                return;
              }
              if (selectedTenant) {
                addDomainMutation.mutate({
                  tenantId: selectedTenant.id,
                  domain: newDomain.domain,
                  isPrimary: newDomain.isPrimary,
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="domain">Domínio</Label>
              <Input
                id="domain"
                value={newDomain.domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                placeholder="goldcarddigital.com.br"
                required
                data-testid="input-new-domain"
                className={domainError ? "border-destructive" : ""}
              />
              {domainError ? (
                <p className="text-xs text-destructive">{domainError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Digite apenas o domínio, ex: goldcarddigital.com.br
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isPrimary"
                checked={newDomain.isPrimary}
                onCheckedChange={(checked) => setNewDomain({ ...newDomain, isPrimary: checked })}
              />
              <Label htmlFor="isPrimary">Domínio principal</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDomainOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addDomainMutation.isPending} data-testid="button-submit-domain">
                {addDomainMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Acesso</DialogTitle>
            <DialogDescription>
              Conceda acesso a um usuário para este ambiente
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedTenant && newUserAccess.userId) {
                addUserAccessMutation.mutate({
                  tenantId: selectedTenant.id,
                  userId: parseInt(newUserAccess.userId),
                  roleInTenant: newUserAccess.roleInTenant,
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="userId">Usuário</Label>
              <Select
                value={newUserAccess.userId}
                onValueChange={(value) => setNewUserAccess({ ...newUserAccess, userId: value })}
              >
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u) => !tenantUsers.some((tu) => tu.userId === u.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleInTenant">Papel no Ambiente</Label>
              <Select
                value={newUserAccess.roleInTenant}
                onValueChange={(value) => setNewUserAccess({ ...newUserAccess, roleInTenant: value })}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="coordenacao">Coordenação</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addUserAccessMutation.isPending} data-testid="button-submit-user-access">
                {addUserAccessMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conceder Acesso
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!domainToDelete} onOpenChange={() => setDomainToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Domínio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o domínio "{domainToDelete?.domain}"? 
              Usuários não poderão mais acessar o sistema por este domínio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => domainToDelete && deleteDomainMutation.mutate(domainToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userAccessToDelete} onOpenChange={() => setUserAccessToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso de "{userAccessToDelete?.userName}" a este ambiente?
              O usuário não poderá mais acessar o sistema por este domínio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userAccessToDelete && removeUserAccessMutation.mutate(userAccessToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Wizard: Novo Ambiente (cliente) ===== */}
      <Dialog
        open={isWizardOpen}
        onOpenChange={(open) => {
          setIsWizardOpen(open);
          if (!open) {
            setWizard({ ...WIZARD_INITIAL });
            setWizardStep(1);
            setKeyEdited(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Ambiente Cliente</DialogTitle>
            <DialogDescription>
              Passo {wizardStep} de 4 —{" "}
              {wizardStep === 1
                ? "Dados"
                : wizardStep === 2
                ? "Domínio"
                : wizardStep === 3
                ? "Plano"
                : "Confirmar"}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wiz-nome">Nome da empresa</Label>
                <Input
                  id="wiz-nome"
                  value={wizard.nome}
                  onChange={(e) => {
                    const nome = e.target.value;
                    setWizard((w) => ({
                      ...w,
                      nome,
                      key: keyEdited ? w.key : slugify(nome),
                    }));
                  }}
                  placeholder="Gold Card Digital"
                  data-testid="input-wizard-nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wiz-key">Chave (slug)</Label>
                <Input
                  id="wiz-key"
                  value={wizard.key}
                  onChange={(e) => {
                    setKeyEdited(true);
                    setWizard((w) => ({
                      ...w,
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                    }));
                  }}
                  placeholder="goldcard"
                  data-testid="input-wizard-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wiz-admin-nome">Nome do administrador</Label>
                <Input
                  id="wiz-admin-nome"
                  value={wizard.adminNome}
                  onChange={(e) => setWizard((w) => ({ ...w, adminNome: e.target.value }))}
                  placeholder="João da Silva"
                  data-testid="input-wizard-admin-nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wiz-admin-email">E-mail do administrador</Label>
                <Input
                  id="wiz-admin-email"
                  type="email"
                  value={wizard.adminEmail}
                  onChange={(e) => setWizard((w) => ({ ...w, adminEmail: e.target.value }))}
                  placeholder="joao@empresa.com.br"
                  data-testid="input-wizard-admin-email"
                />
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <RadioGroup
                value={wizard.dominioTipo}
                onValueChange={(value) =>
                  setWizard((w) => ({ ...w, dominioTipo: value as typeof w.dominioTipo }))
                }
                className="space-y-3"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="subdominio"
                    id="wiz-dom-sub"
                    disabled={!saasConfig?.wildcardBaseDomain}
                    data-testid="radio-dominio-subdominio"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="wiz-dom-sub" className={!saasConfig?.wildcardBaseDomain ? "opacity-50" : ""}>
                      Subdomínio automático
                    </Label>
                    {saasConfig?.wildcardBaseDomain ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        {wizard.key || "<key>"}.{saasConfig.wildcardBaseDomain}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Domínio wildcard não configurado (WILDCARD_BASE_DOMAIN) — opção indisponível.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="proprio" id="wiz-dom-proprio" data-testid="radio-dominio-proprio" />
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="wiz-dom-proprio">Domínio próprio</Label>
                    {wizard.dominioTipo === "proprio" && (
                      <div className="space-y-2">
                        <Input
                          value={wizard.dominioProprio}
                          onChange={(e) => setWizard((w) => ({ ...w, dominioProprio: e.target.value }))}
                          placeholder="crm.empresadocliente.com.br"
                          data-testid="input-wizard-dominio-proprio"
                        />
                        <p className="text-xs text-muted-foreground">
                          O cliente precisará apontar um CNAME do domínio para o servidor. O alvo será
                          informado ao final do provisionamento.
                        </p>
                        {saasConfig && !saasConfig.railwayConfigured && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Railway não configurado — será necessário registrar o domínio manualmente no
                            painel do Railway.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="nenhum" id="wiz-dom-nenhum" data-testid="radio-dominio-nenhum" />
                  <Label htmlFor="wiz-dom-nenhum">Sem domínio agora</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={wizard.plano}
                  onValueChange={(value) => setWizard((w) => ({ ...w, plano: value }))}
                >
                  <SelectTrigger data-testid="select-wizard-plano">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {PLAN_LABELS[plan]} — {formatPlanPrice(PLAN_PRICES[plan])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assinatura</Label>
                <RadioGroup
                  value={wizard.statusAssinatura}
                  onValueChange={(value) =>
                    setWizard((w) => ({ ...w, statusAssinatura: value as typeof w.statusAssinatura }))
                  }
                  className="space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="trial" id="wiz-ass-trial" data-testid="radio-assinatura-trial" />
                    <div className="space-y-1">
                      <Label htmlFor="wiz-ass-trial">Trial</Label>
                      {wizard.statusAssinatura === "trial" && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            value={wizard.trialDays}
                            onChange={(e) => setWizard((w) => ({ ...w, trialDays: e.target.value }))}
                            data-testid="input-wizard-trial-days"
                          />
                          <span className="text-sm text-muted-foreground">dias</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="active" id="wiz-ass-active" data-testid="radio-assinatura-active" />
                    <div className="space-y-1">
                      <Label htmlFor="wiz-ass-active">Ativa (cobra via Asaas)</Label>
                      {wizard.statusAssinatura === "active" && saasConfig && !saasConfig.asaasConfigured && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Asaas não configurado — a cobrança não será criada automaticamente.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="nenhuma" id="wiz-ass-nenhuma" data-testid="radio-assinatura-nenhuma" />
                    <Label htmlFor="wiz-ass-nenhuma">Sem assinatura</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{wizard.nome}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Chave</span>
                  <span className="font-mono">{wizard.key}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Administrador</span>
                  <span>{wizard.adminNome} ({wizard.adminEmail})</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Domínio</span>
                  <span>
                    {wizard.dominioTipo === "subdominio"
                      ? `${wizard.key}.${saasConfig?.wildcardBaseDomain || ""}`
                      : wizard.dominioTipo === "proprio"
                      ? wizard.dominioProprio
                      : "Nenhum"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Plano</span>
                  <span>
                    {PLAN_LABELS[wizard.plano as keyof typeof PLAN_LABELS] || wizard.plano} —{" "}
                    {formatPlanPrice(PLAN_PRICES[wizard.plano as keyof typeof PLAN_PRICES] ?? null)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Assinatura</span>
                  <span>
                    {wizard.statusAssinatura === "trial"
                      ? `Trial (${wizard.trialDays || 7} dias)`
                      : wizard.statusAssinatura === "active"
                      ? "Ativa (Asaas)"
                      : "Sem assinatura"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => (wizardStep === 1 ? setIsWizardOpen(false) : setWizardStep(wizardStep - 1))}
              data-testid="button-wizard-back"
            >
              {wizardStep === 1 ? "Cancelar" : "Voltar"}
            </Button>
            {wizardStep < 4 ? (
              <Button
                type="button"
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={(wizardStep === 1 && !wizardStep1Valid) || (wizardStep === 2 && !wizardStep2Valid)}
                data-testid="button-wizard-next"
              >
                Avançar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => provisionMutation.mutate()}
                disabled={provisionMutation.isPending}
                data-testid="button-wizard-provisionar"
              >
                {provisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Provisionar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Resultado do provisionamento ===== */}
      <Dialog
        open={!!provisionResult}
        onOpenChange={(open) => {
          if (!open) {
            setProvisionResult(null);
            setProvisionedInfo(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Ambiente provisionado
            </DialogTitle>
            <DialogDescription>
              {provisionedInfo?.nome || "Ambiente"} criado com sucesso. Guarde as credenciais abaixo.
            </DialogDescription>
          </DialogHeader>
          {provisionResult && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Login</p>
                    <p className="font-mono" data-testid="text-provision-login">
                      {provisionedInfo?.adminEmail || "-"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyText(provisionedInfo?.adminEmail || "", "Login")}
                    data-testid="button-copy-login"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Senha temporária</p>
                    <p className="font-mono" data-testid="text-provision-senha">
                      {provisionResult.senhaTemporaria}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyText(provisionResult.senhaTemporaria, "Senha")}
                    data-testid="button-copy-senha"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {provisionResult.dominio && (
                <div className="rounded-md border p-4 space-y-2">
                  <p className="text-muted-foreground text-xs">Domínio</p>
                  <p className="font-mono">{provisionResult.dominio}</p>
                  {provisionResult.cnameAlvo && (
                    <p className="text-xs text-muted-foreground">
                      Aponte o CNAME do domínio para:{" "}
                      <span className="font-mono text-foreground">{provisionResult.cnameAlvo}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                {provisionResult.emailEnviado ? (
                  <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> E-mail com as credenciais enviado.
                  </p>
                ) : (
                  <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> E-mail não enviado — repasse as credenciais
                    manualmente.
                  </p>
                )}
              </div>

              {provisionResult.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1">
                  {provisionResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setProvisionResult(null);
                setProvisionedInfo(null);
              }}
              data-testid="button-close-provision-result"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Ficha do ambiente ===== */}
      <Sheet open={fichaTenantId !== null} onOpenChange={(open) => { if (!open) setFichaTenantId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {isLoadingFicha || !ficha ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {ficha.tenant.name}
                  <StatusBadge status={tenantStatus(ficha.tenant)} />
                  {ficha.tenant.interno === true && <Badge variant="outline">Interno</Badge>}
                </SheetTitle>
                <SheetDescription className="space-y-1">
                  <span className="font-mono">{ficha.tenant.key}</span>
                  <br />
                  Criado em {formatDateBR(ficha.tenant.createdAt)} · Último acesso:{" "}
                  {formatDateTimeBR(ficha.tenant.ultimoAcesso)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Usuários (ativos/total)</p>
                      <p className="text-xl font-bold" data-testid="text-ficha-usuarios">
                        {ficha.metricas.usuarios_ativos}/{ficha.metricas.usuarios}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Propostas</p>
                      <p className="text-xl font-bold" data-testid="text-ficha-propostas">
                        {ficha.metricas.propostas}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-2">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total pago</p>
                      <p className="text-xl font-bold" data-testid="text-ficha-total-pago">
                        {Number(ficha.metricas.total_pago || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Domínios
                  </h3>
                  {ficha.dominios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum domínio configurado</p>
                  ) : (
                    <div className="space-y-1">
                      {ficha.dominios.map((d) => (
                        <div key={d.domain} className="flex items-center gap-2 text-sm">
                          <span className="font-mono">{d.domain}</span>
                          {d.is_primary && <Badge variant="secondary">Principal</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Assinatura</h3>
                  {ficha.assinatura ? (
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {PLAN_LABELS[ficha.assinatura.plan as keyof typeof PLAN_LABELS] ||
                            ficha.assinatura.plan}
                        </span>
                        <Badge variant="secondary">{ficha.assinatura.status}</Badge>
                        {ficha.assinatura.gateway_subscription_id && <Badge>Asaas</Badge>}
                      </div>
                      <p className="text-muted-foreground">
                        Vencimento: {formatDateBR(ficha.assinatura.current_period_end)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem assinatura</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Adicionais</h3>
                  {ficha.adicionais.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum adicional</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {ficha.adicionais.map((a) => (
                        <Badge key={a.id} variant="outline">
                          {a.produto}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Módulos</h3>
                  <div className="space-y-2">
                    {ficha.modulos.map((m) => (
                      <div key={m.key} className="flex items-center justify-between gap-2">
                        <Label htmlFor={`modulo-${m.key}`} className="text-sm font-normal">
                          {m.nome}
                        </Label>
                        <Switch
                          id={`modulo-${m.key}`}
                          checked={modulosDraft[m.key] ?? m.ativo}
                          onCheckedChange={(checked) =>
                            setModulosDraft((prev) => ({ ...prev, [m.key]: checked }))
                          }
                          data-testid={`switch-modulo-${m.key}`}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveModulosMutation.mutate()}
                    disabled={saveModulosMutation.isPending}
                    data-testid="button-salvar-modulos"
                  >
                    {saveModulosMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar módulos
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== Soft delete ===== */}
      <AlertDialog open={!!tenantToSoftDelete} onOpenChange={(open) => { if (!open) setTenantToSoftDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ambiente</AlertDialogTitle>
            <AlertDialogDescription>
              O ambiente "{tenantToSoftDelete?.name}" será marcado como excluído e ficará inacessível para os
              usuários. Os dados são preservados e o ambiente pode ser restaurado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                tenantToSoftDelete && statusMutation.mutate({ id: tenantToSoftDelete.id, status: "excluido" })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-soft-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Hard delete (dupla confirmação) ===== */}
      <AlertDialog
        open={!!tenantToHardDelete}
        onOpenChange={(open) => {
          if (!open) {
            setTenantToHardDelete(null);
            setHardDeleteConfirm("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir DEFINITIVAMENTE
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga PARA SEMPRE todos os dados do ambiente "{tenantToHardDelete?.name}". Não há
              como desfazer. Baixe um backup antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => tenantToHardDelete && downloadDump(tenantToHardDelete)}
              disabled={isDownloadingDump}
              data-testid="button-download-backup"
            >
              {isDownloadingDump ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar backup (JSON)
            </Button>
            <div className="space-y-2">
              <Label htmlFor="hard-delete-confirm">
                Digite a chave <span className="font-mono font-bold">{tenantToHardDelete?.key}</span> para
                confirmar:
              </Label>
              <Input
                id="hard-delete-confirm"
                value={hardDeleteConfirm}
                onChange={(e) => setHardDeleteConfirm(e.target.value)}
                placeholder={tenantToHardDelete?.key}
                data-testid="input-hard-delete-confirm"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={
                hardDeleteConfirm !== tenantToHardDelete?.key || hardDeleteMutation.isPending
              }
              onClick={() =>
                tenantToHardDelete &&
                hardDeleteMutation.mutate({ id: tenantToHardDelete.id, confirmKey: hardDeleteConfirm })
              }
              data-testid="button-confirm-hard-delete"
            >
              {hardDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apagar para sempre
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
