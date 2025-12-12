import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, UserPlus, CheckCircle, XCircle, Trash2, Search, Copy, Check } from "lucide-react";
import { type User, USER_ROLES, ROLE_LABELS, type UserRole, type UserPermission } from "@shared/schema";
import { Separator } from "@/components/ui/separator";

const MODULE_TRANSLATIONS: Record<string, string> = {
  modulo_simulador: "Simulador GoldCard",
  modulo_roteiros: "Roteiro Bancário",
  modulo_base_clientes: "Base de Clientes",
  modulo_compra_lista: "Compra de Lista",
  modulo_crm_vendas_campanhas: "CRM Campanhas",
  modulo_crm_vendas_atendimento: "CRM Atendimento",
  modulo_academia: "Academia",
  modulo_config_usuarios: "Config. Usuários",
  modulo_config_precos: "Config. Preços",
};

type PermissionState = { module: string; canView: boolean; canEdit: boolean };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Credentials dialog state (shown after creating user)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [managerId, setManagerId] = useState<string>("");
  const [permissions, setPermissions] = useState<PermissionState[]>([]);

  const currentUserRole = currentUser?.role as UserRole;
  const isMaster = currentUserRole === "master";
  const isAtendimento = currentUserRole === "atendimento";
  const isCoordenacao = currentUserRole === "coordenacao";
  
  // Roles that can manage users (for display and permissions)
  const canManageAllUsers = isMaster || isAtendimento;

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch coordenadores (for master and atendimento when creating vendedor)
  const { data: coordenadores = [] } = useQuery<User[]>({
    queryKey: ["/api/users/coordenadores"],
    enabled: canManageAllUsers,
  });

  // Fetch available modules for permissions
  const { data: modules = [] } = useQuery<string[]>({
    queryKey: ["/api/permissions/modules"],
    enabled: isMaster,
  });

  // Fetch user permissions when editing
  const { data: userPermissions, isLoading: isLoadingPermissions } = useQuery<UserPermission[]>({
    queryKey: ["/api/users", editingUser?.id, "permissions"],
    enabled: !!editingUser && editingUser.role !== "master" && isMaster,
  });

  // Initialize permissions when user permissions are loaded or modules change
  useEffect(() => {
    if (editingUser && modules.length > 0) {
      const existingPermissions = userPermissions || [];
      const permissionMap = new Map(existingPermissions.map(p => [p.module, { canView: p.canView, canEdit: p.canEdit }]));
      
      const initialPermissions: PermissionState[] = modules.map(module => ({
        module,
        canView: permissionMap.get(module)?.canView ?? false,
        canEdit: permissionMap.get(module)?.canEdit ?? false,
      }));
      
      setPermissions(initialPermissions);
    }
  }, [editingUser, modules, userPermissions]);

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string; managerId?: number }) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/coordenadores"] });
      // Save credentials for copying before closing dialog
      setCreatedCredentials({
        name: variables.name,
        email: variables.email,
        password: variables.password,
      });
      handleCloseDialog();
      setShowCredentialsDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Não foi possível criar o usuário",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data, showCredentials }: { id: number; data: any; showCredentials?: { name: string; email: string; password: string } }) => {
      const result = await apiRequest("PUT", `/api/users/${id}`, data);
      return { result, showCredentials };
    },
    onSuccess: ({ showCredentials }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/coordenadores"] });
      
      if (showCredentials) {
        // If password was changed, show credentials dialog
        setCreatedCredentials(showCredentials);
        setShowCredentialsDialog(true);
        toast({
          title: "Usuário atualizado com sucesso!",
          description: "Copie as novas credenciais para compartilhar",
        });
      } else {
        toast({
          title: "Usuário atualizado com sucesso!",
        });
      }
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Não foi possível atualizar o usuário",
        variant: "destructive",
      });
    },
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: PermissionState[] }) => {
      return apiRequest("PUT", `/api/users/${userId}/permissions`, permissions);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", variables.userId, "permissions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar permissões",
        description: error.message || "Não foi possível salvar as permissões",
        variant: "destructive",
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest("PUT", `/api/users/${id}`, { isActive });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: variables.isActive ? "Usuário ativado!" : "Usuário desativado!",
        description: variables.isActive 
          ? "O usuário foi ativado e pode fazer login novamente." 
          : "O usuário foi desativado e não poderá mais fazer login.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Não foi possível alterar o status do usuário",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/users/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário excluído com sucesso!",
      });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message || "Não foi possível excluir o usuário",
        variant: "destructive",
      });
      setUserToDelete(null);
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("vendedor");
    setManagerId("");
    setPermissions([]);
  };

  const handleOpenCreateDialog = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("vendedor");
    setManagerId("");
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role as UserRole);
    setManagerId(user.managerId?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || (!editingUser && !password)) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      name,
      email,
      role,
    };

    if (password) {
      data.password = password;
    }

    if (role === "vendedor" && managerId && managerId !== "none") {
      data.managerId = parseInt(managerId);
    }

    if (editingUser) {
      // Pass credentials info if password was changed
      const showCredentials = password ? { name, email, password } : undefined;
      updateUserMutation.mutate({ id: editingUser.id, data, showCredentials }, {
        onSuccess: () => {
          // Save permissions after user is updated (only for non-master users)
          if (isMaster && editingUser.role !== "master" && permissions.length > 0) {
            savePermissionsMutation.mutate({ userId: editingUser.id, permissions });
          }
        },
      });
    } else {
      createUserMutation.mutate(data);
    }
  };

  // Helper to update permission state
  const updatePermission = (module: string, field: 'canView' | 'canEdit', value: boolean) => {
    setPermissions(prev => prev.map(p => {
      if (p.module !== module) return p;
      if (field === 'canEdit' && value) {
        // If enabling edit, also enable view
        return { ...p, canEdit: true, canView: true };
      }
      if (field === 'canView' && !value) {
        // If disabling view, also disable edit
        return { ...p, canView: false, canEdit: false };
      }
      return { ...p, [field]: value };
    }));
  };

  const toggleUserStatus = (user: User) => {
    toggleActiveMutation.mutate({
      id: user.id,
      isActive: !user.isActive,
    });
  };

  const canDeleteUser = (user: User): boolean => {
    if (!currentUser || user.id === currentUser.id) {
      return false; // Cannot delete yourself
    }
    
    const targetRole = user.role as UserRole;
    
    if (isMaster) {
      return true; // Master can delete anyone except themselves
    }
    
    if (isAtendimento) {
      // Atendimento can delete anyone except master
      return targetRole !== "master";
    }
    
    if (isCoordenacao) {
      // Coordenacao can ONLY delete vendedores from their own team
      return targetRole === "vendedor" && user.managerId === currentUser.id;
    }
    
    return false; // Operacional and vendedores cannot delete anyone
  };

  const getRoleLabel = (role: string) => {
    return ROLE_LABELS[role as UserRole] || role;
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copiado!",
        description: `${field} copiado para a área de transferência`,
      });
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const copyAllCredentials = () => {
    if (!createdCredentials) return;
    const text = `Login: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`;
    copyToClipboard(text, "Credenciais");
  };

  // Filter users based on search term
  const filteredUsers = users.filter((user) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      getRoleLabel(user.role).toLowerCase().includes(search)
    );
  });

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "master") return "default";
    if (role === "coordenacao" || role === "atendimento") return "secondary";
    return "outline";
  };
  
  // Get available roles based on current user's role
  const getAvailableRoles = (): UserRole[] => {
    if (isMaster) {
      // Master can create any role
      return [...USER_ROLES];
    }
    if (isAtendimento) {
      // Atendimento can create any role except master
      return USER_ROLES.filter(r => r !== "master");
    }
    if (isCoordenacao) {
      // Coordenacao can only create vendedor
      return ["vendedor"];
    }
    return [];
  };

  if (isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground mt-1">
            {canManageAllUsers
              ? "Gerencie todos os usuários do sistema"
              : "Gerencie sua equipe de vendedores"}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreateDialog} data-testid="button-create-user">
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Criar Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Atualize as informações do usuário"
                  : isCoordenacao
                  ? "Crie um novo vendedor para sua equipe"
                  : "Preencha os dados do novo usuário"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  data-testid="input-user-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  data-testid="input-user-email"
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? "Nova Senha (opcional)" : "Senha"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                  data-testid="input-user-password"
                />
              </div>
              {getAvailableRoles().length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={role} onValueChange={(v: UserRole) => setRole(v)}>
                    <SelectTrigger id="role" data-testid="select-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles().map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {canManageAllUsers && role === "vendedor" && (
                <div className="space-y-2">
                  <Label htmlFor="manager">Coordenador (opcional)</Label>
                  <Select value={managerId || "none"} onValueChange={setManagerId}>
                    <SelectTrigger id="manager" data-testid="select-user-manager">
                      <SelectValue placeholder="Selecione um coordenador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {coordenadores.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id.toString()}>
                          {coord.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isMaster && editingUser && editingUser.role !== "master" && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Permissões de Acesso</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure quais módulos este usuário pode acessar e editar.
                    </p>
                    {isLoadingPermissions ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50%]">Módulo</TableHead>
                              <TableHead className="text-center">Visualizar</TableHead>
                              <TableHead className="text-center">Editar</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {permissions.map((perm) => (
                              <TableRow key={perm.module} data-testid={`permission-row-${perm.module}`}>
                                <TableCell className="font-medium">
                                  {MODULE_TRANSLATIONS[perm.module] || perm.module}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canView}
                                    onCheckedChange={(checked) => updatePermission(perm.module, 'canView', !!checked)}
                                    data-testid={`checkbox-view-${perm.module}`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={perm.canEdit}
                                    onCheckedChange={(checked) => updatePermission(perm.module, 'canEdit', !!checked)}
                                    data-testid={`checkbox-edit-${perm.module}`}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel-user"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  data-testid="button-submit-user"
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : editingUser ? (
                    "Salvar Alterações"
                  ) : (
                    "Criar Usuário"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                {filteredUsers.length === users.length 
                  ? `${users.length} usuário${users.length !== 1 ? "s" : ""} cadastrado${users.length !== 1 ? "s" : ""}`
                  : `${filteredUsers.length} de ${users.length} usuário${users.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email ou função..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                {canManageAllUsers && <TableHead>Coordenador</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const manager = coordenadores.find((c) => c.id === user.managerId);
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium" data-testid={`user-name-${user.id}`}>
                      {user.name}
                    </TableCell>
                    <TableCell data-testid={`user-email-${user.id}`}>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`user-role-${user.id}`}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    {canManageAllUsers && (
                      <TableCell data-testid={`user-manager-${user.id}`}>
                        {manager ? manager.name : "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      {user.isActive ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Ativo
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Inativo
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        Editar
                      </Button>
                      {canManageAllUsers && user.id !== currentUser?.id && (
                        <Button
                          variant={user.isActive ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          data-testid={`button-toggle-user-${user.id}`}
                        >
                          {user.isActive ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                      {canDeleteUser(user) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setUserToDelete(user)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManageAllUsers ? 6 : 5} className="text-center text-muted-foreground py-8">
                    {searchTerm.trim() ? "Nenhum usuário encontrado para esta pesquisa" : "Nenhum usuário cadastrado"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?
              Esta ação não pode ser desfeita e todos os dados associados a este usuário serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Usuário"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credentials Dialog - shown after creating user */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Usuário Criado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie as credenciais abaixo para compartilhar com <strong>{createdCredentials?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Login (Email)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={createdCredentials?.email || ""} 
                  readOnly 
                  className="font-mono"
                  data-testid="input-credential-email"
                />
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(createdCredentials?.email || "", "Email")}
                  data-testid="button-copy-email"
                >
                  {copiedField === "Email" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Senha</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={createdCredentials?.password || ""} 
                  readOnly 
                  className="font-mono"
                  data-testid="input-credential-password"
                />
                <Button 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(createdCredentials?.password || "", "Senha")}
                  data-testid="button-copy-password"
                >
                  {copiedField === "Senha" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={copyAllCredentials}
              className="w-full"
              data-testid="button-copy-all-credentials"
            >
              {copiedField === "Credenciais" ? (
                <><Check className="mr-2 h-4 w-4" /> Copiado!</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Copiar Login e Senha</>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowCredentialsDialog(false)}
              data-testid="button-close-credentials"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
