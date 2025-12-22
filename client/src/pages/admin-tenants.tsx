import { useState } from "react";
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
  UserPlus 
} from "lucide-react";
import type { User } from "@shared/schema";

interface Tenant {
  id: number;
  key: string;
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeJson?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

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

  const isMaster = currentUser?.role === "master";

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
    mutationFn: async (data: { id: number } & typeof formData & { isActive?: boolean }) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        logoUrl: data.logoUrl || null,
        faviconUrl: data.faviconUrl || null,
        isActive: data.isActive,
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
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-tenant">
          <Plus className="mr-2 h-4 w-4" />
          Novo Ambiente
        </Button>
      </div>

      {isLoadingTenants ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
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
                <Badge variant={tenant.isActive ? "default" : "secondary"}>
                  {tenant.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded">{tenant.key}</span>
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
          ))}
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
    </div>
  );
}
