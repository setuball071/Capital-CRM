import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Plus, UserPlus, CheckCircle, XCircle, Trash2, Search, Copy, Check, ChevronDown, Clock, Camera, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfigurarAcessoModal } from "@/components/ConfigurarAcessoModal";
import { 
  type User, USER_ROLES, ROLE_LABELS, type UserRole, type UserPermission, type Tenant,
  MODULE_LIST, MODULE_SUB_ITEMS, MODULE_LABELS, getSubItemPermissionKey, parsePermissionKey,
  type ModuleName,
} from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Building2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Module translations - kept for compatibility, now using MODULE_LABELS from schema
const MODULE_TRANSLATIONS: Record<string, string> = MODULE_LABELS;

type PermissionState = { module: string; canView: boolean; canEdit: boolean; canDelegate: boolean };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // Credentials dialog state (shown after creating user)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Access configuration modal state
  const [acessoModalUser, setAcessoModalUser] = useState<User | null>(null);
  const [showAcessoModal, setShowAcessoModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("vendedor");
  const [managerId, setManagerId] = useState<string>("");
  const [permissions, setPermissions] = useState<PermissionState[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<number[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
  });

  // Fetch current user's own permissions (for delegation)
  const { data: myPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: ["/api/permissions/my"],
    enabled: !isMaster, // Only non-master users need this
  });

  // Fetch all tenants (ambientes) for master/atendimento users
  const { data: allTenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: canManageAllUsers,
  });

  // Fetch user's tenants when editing
  const { data: userTenantsList = [] } = useQuery<{ id: number; userId: number; roleInTenant: string }[]>({
    queryKey: ["/api/admin/tenants/user", editingUser?.id],
    enabled: !!editingUser && canManageAllUsers,
    queryFn: async () => {
      // Get all user-tenant associations for this user
      const promises = allTenants.map(async (tenant) => {
        const res = await fetch(`/api/admin/tenants/${tenant.id}/users`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.filter((ut: any) => ut.userId === editingUser?.id).map((ut: any) => ({ ...ut, tenantId: tenant.id }));
      });
      const results = await Promise.all(promises);
      return results.flat();
    },
  });

  // Check if current user has Config. Usuários with canEdit
  const hasConfigUsuariosPermission = isMaster || myPermissions.some(
    p => p.module === "modulo_config_usuarios" && p.canEdit
  );

  // Get modules that current user can delegate (for non-master users) - memoized to prevent infinite loops
  const delegatableModules = useMemo(() => {
    if (isMaster) return modules;
    return myPermissions.filter(p => p.canDelegate).map(p => p.module);
  }, [isMaster, modules, myPermissions]);

  // Fetch user permissions when editing
  const { data: userPermissions, isLoading: isLoadingPermissions } = useQuery<UserPermission[]>({
    queryKey: ["/api/users", editingUser?.id, "permissions"],
    enabled: !!editingUser && editingUser.role !== "master" && hasConfigUsuariosPermission,
  });

  // Initialize permissions when user permissions are loaded or modules change
  // NEW: Now expands to sub-item level permissions
  useEffect(() => {
    if (editingUser && modules.length > 0) {
      const existingPermissions = userPermissions || [];
      const permissionMap = new Map(existingPermissions.map(p => [p.module, { canView: p.canView, canEdit: p.canEdit, canDelegate: p.canDelegate }]));
      
      // For non-master users, only show delegatable modules
      const modulesToShow = isMaster ? modules : delegatableModules;
      
      // Build permissions for all sub-items of each module
      const initialPermissions: PermissionState[] = [];
      
      for (const module of modulesToShow) {
        const subItems = MODULE_SUB_ITEMS[module as ModuleName];
        if (subItems) {
          for (const subItem of subItems) {
            const subItemKey = getSubItemPermissionKey(module as ModuleName, subItem.key);
            // Check for specific sub-item permission first, then fall back to module-level permission
            const existingSubItem = permissionMap.get(subItemKey);
            const existingModule = permissionMap.get(module);
            
            initialPermissions.push({
              module: subItemKey,
              canView: existingSubItem?.canView ?? existingModule?.canView ?? false,
              canEdit: existingSubItem?.canEdit ?? existingModule?.canEdit ?? false,
              canDelegate: existingSubItem?.canDelegate ?? existingModule?.canDelegate ?? false,
            });
          }
        }
      }
      
      setPermissions(initialPermissions);
    }
  }, [editingUser, modules, userPermissions, isMaster, delegatableModules]);

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

  // Save user tenants mutation
  const saveUserTenantsMutation = useMutation({
    mutationFn: async ({ userId, tenantIds }: { userId: number; tenantIds: number[] }) => {
      // First, get current tenant associations
      const currentAssociations: { tenantId: number; userTenantId: number }[] = [];
      for (const tenant of allTenants) {
        const res = await fetch(`/api/admin/tenants/${tenant.id}/users`);
        if (res.ok) {
          const data = await res.json();
          const userAssoc = data.find((ut: any) => ut.userId === userId);
          if (userAssoc) {
            currentAssociations.push({ tenantId: tenant.id, userTenantId: userAssoc.id });
          }
        }
      }

      // Remove associations that are no longer selected
      for (const assoc of currentAssociations) {
        if (!tenantIds.includes(assoc.tenantId)) {
          await apiRequest("DELETE", `/api/admin/tenants/users/${assoc.userTenantId}`, undefined);
        }
      }

      // Add new associations
      const currentTenantIds = currentAssociations.map(a => a.tenantId);
      for (const tenantId of tenantIds) {
        if (!currentTenantIds.includes(tenantId)) {
          await apiRequest("POST", `/api/admin/tenants/${tenantId}/users`, { userId });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants/user"] });
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest("DELETE", "/api/users/bulk", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUserIds(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: data.message || "Usuários excluídos com sucesso",
        description: data.errors?.length > 0 ? `Erros: ${data.errors.join(", ")}` : undefined,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir usuários",
        description: error.message || "Não foi possível excluir os usuários",
        variant: "destructive",
      });
      setShowBulkDeleteDialog(false);
    },
  });

  const toggleSelectUser = (userId: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const canDeleteUser = (user: User): boolean => {
    if (!currentUser || user.id === currentUser.id) {
      return false;
    }
    const targetRole = user.role as UserRole;
    if (isMaster) return true;
    if (isAtendimento) return targetRole !== "master";
    if (isCoordenacao) return targetRole === "vendedor" && user.managerId === currentUser.id;
    return false;
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("vendedor");
    setManagerId("");
    setPermissions([]);
    setSelectedTenantIds([]);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingUser || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erro", description: "Arquivo muito grande. Máximo 2MB.", variant: "destructive" });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/users/${editingUser.id}/avatar`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Erro ao enviar foto"); }
      const data = await res.json();
      setEditingUser({ ...editingUser, avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Foto atualizada com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    if (!editingUser) return;
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}/avatar`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao remover foto");
      setEditingUser({ ...editingUser, avatarUrl: null });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("vendedor");
    setManagerId("");
    setSelectedTenantIds([]);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role as UserRole);
    setManagerId(user.managerId?.toString() || "");
    setSelectedTenantIds([]);
    setIsDialogOpen(true);
  };

  // Load user tenants when editing
  useEffect(() => {
    if (editingUser && userTenantsList.length > 0) {
      const tenantIds = userTenantsList.map((ut: any) => ut.tenantId);
      setSelectedTenantIds(tenantIds);
    }
  }, [editingUser, userTenantsList]);

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

    // Validate login format: 4 digits for new users, allow legacy emails
    const is4Digit = /^\d{4}$/.test(email);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!editingUser && !is4Digit && !isEmail) {
      toast({
        title: "Erro",
        description: "Login deve ser um código de 4 dígitos numéricos",
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
          // Save permissions after user is updated (for users with Config. Usuários permission)
          if (hasConfigUsuariosPermission && editingUser.role !== "master" && permissions.length > 0) {
            savePermissionsMutation.mutate({ userId: editingUser.id, permissions });
          }
          // Save user tenants
          if (canManageAllUsers && allTenants.length > 0) {
            saveUserTenantsMutation.mutate({ userId: editingUser.id, tenantIds: selectedTenantIds });
          }
        },
      });
    } else {
      createUserMutation.mutate(data, {
        onSuccess: async (response) => {
          // Save tenants for newly created user
          if (canManageAllUsers && selectedTenantIds.length > 0) {
            const newUser = await response.json();
            if (newUser?.id) {
              saveUserTenantsMutation.mutate({ userId: newUser.id, tenantIds: selectedTenantIds });
            }
          }
        },
      });
    }
  };

  // Helper to update permission state
  const updatePermission = (module: string, field: 'canView' | 'canEdit' | 'canDelegate', value: boolean) => {
    setPermissions(prev => {
      const exists = prev.some(p => p.module === module);
      if (!exists) {
        const newPerm: any = { module, canView: false, canEdit: false, canDelegate: false, [field]: value };
        if (field === 'canEdit' && value) {
          newPerm.canView = true;
        }
        return [...prev, newPerm];
      }
      return prev.map(p => {
        if (p.module !== module) return p;
        if (field === 'canEdit' && value) {
          return { ...p, canEdit: true, canView: true };
        }
        if (field === 'canView' && !value) {
          return { ...p, canView: false, canEdit: false };
        }
        return { ...p, [field]: value };
      });
    });
  };

  // Check if user has Config. Usuários permission with canEdit
  const hasConfigUsuariosEdit = permissions.find(p => p.module === 'modulo_config_usuarios')?.canEdit ?? false;

  const toggleUserStatus = (user: User) => {
    toggleActiveMutation.mutate({
      id: user.id,
      isActive: !user.isActive,
    });
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

  const deletableFilteredUsers = useMemo(() => {
    return filteredUsers.filter(u => canDeleteUser(u));
  }, [filteredUsers, currentUser]);

  const toggleSelectAll = () => {
    if (selectedUserIds.size === deletableFilteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(deletableFilteredUsers.map(u => u.id)));
    }
  };

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
              {editingUser && canManageAllUsers && (
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="w-16 h-16">
                      {editingUser.avatarUrl && <AvatarImage src={editingUser.avatarUrl} alt={editingUser.name} className="object-cover" />}
                      <AvatarFallback className="text-lg font-bold">
                        {editingUser.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" style={{ visibility: isUploadingAvatar ? "hidden" : "visible" }}>
                      <Camera className="w-5 h-5 text-white" />
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} data-testid="input-avatar-upload" />
                    </label>
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Foto do usuário</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG ou WebP (máx 2MB)</span>
                    {editingUser.avatarUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={handleAvatarDelete} disabled={isUploadingAvatar} className="justify-start px-0 text-destructive" data-testid="button-remove-avatar">
                        <X className="w-3 h-3 mr-1" /> Remover foto
                      </Button>
                    )}
                  </div>
                </div>
              )}
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
                <Label htmlFor="email">Login</Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={editingUser ? "" : "1234"}
                  data-testid="input-user-email"
                  disabled={!!editingUser}
                />
                {!editingUser && (
                  <p className="text-xs text-muted-foreground">
                    Digite um código de 4 dígitos numéricos (ou email para compatibilidade)
                  </p>
                )}
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

              {canManageAllUsers && allTenants.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-semibold">Ambientes</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecione os ambientes que este usuário terá acesso.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-md p-3">
                    {allTenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tenant-${tenant.id}`}
                          checked={selectedTenantIds.includes(tenant.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTenantIds(prev => [...prev, tenant.id]);
                            } else {
                              setSelectedTenantIds(prev => prev.filter(id => id !== tenant.id));
                            }
                          }}
                          data-testid={`checkbox-tenant-${tenant.id}`}
                        />
                        <Label
                          htmlFor={`tenant-${tenant.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {tenant.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedTenantIds.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Nenhum ambiente selecionado. O usuário não terá acesso a nenhum ambiente.
                    </p>
                  )}
                </div>
              )}

              {hasConfigUsuariosPermission && editingUser && editingUser.role !== "master" && (isMaster ? modules.length > 0 : delegatableModules.length > 0) && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Permissões de Acesso</Label>
                    <p className="text-sm text-muted-foreground">
                      {isMaster 
                        ? "Configure quais sub-itens de cada módulo este usuário pode acessar e editar."
                        : `Você pode delegar acesso aos seguintes módulos: ${delegatableModules.map(m => MODULE_TRANSLATIONS[m] || m).join(", ")}.`}
                    </p>
                    {isLoadingPermissions ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="border rounded-md">
                        <Accordion type="multiple" className="w-full">
                          {(isMaster ? modules : delegatableModules).map((module) => {
                            const subItems = MODULE_SUB_ITEMS[module as ModuleName] || [];
                            const modulePermissions = permissions.filter(p => p.module.startsWith(module + "."));
                            const hasAnyView = modulePermissions.some(p => p.canView);
                            const hasAnyEdit = modulePermissions.some(p => p.canEdit);
                            
                            return (
                              <AccordionItem key={module} value={module} data-testid={`permission-accordion-${module}`}>
                                <AccordionTrigger className="px-4 hover:no-underline">
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium">{MODULE_LABELS[module as ModuleName]}</span>
                                    <div className="flex items-center gap-2">
                                      {hasAnyView && (
                                        <Badge variant="outline" className="text-xs">
                                          {modulePermissions.filter(p => p.canView).length}/{subItems.length} visíveis
                                        </Badge>
                                      )}
                                      {hasAnyEdit && (
                                        <Badge variant="secondary" className="text-xs">
                                          {modulePermissions.filter(p => p.canEdit).length} editáveis
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                  <div className="space-y-2">
                                    {subItems.map((subItem: { key: string; label: string }) => {
                                      const subItemKey = getSubItemPermissionKey(module as ModuleName, subItem.key);
                                      const perm = permissions.find(p => p.module === subItemKey) || { module: subItemKey, canView: false, canEdit: false, canDelegate: false };
                                      
                                      return (
                                        <div key={subItemKey} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50" data-testid={`permission-row-${subItemKey}`}>
                                          <span className="text-sm">{subItem.label}</span>
                                          <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`view-${subItemKey}`}
                                                checked={perm.canView}
                                                onCheckedChange={(checked) => updatePermission(subItemKey, 'canView', !!checked)}
                                                data-testid={`checkbox-view-${subItemKey}`}
                                              />
                                              <Label htmlFor={`view-${subItemKey}`} className="text-xs text-muted-foreground cursor-pointer">
                                                Visualizar
                                              </Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`edit-${subItemKey}`}
                                                checked={perm.canEdit}
                                                onCheckedChange={(checked) => updatePermission(subItemKey, 'canEdit', !!checked)}
                                                data-testid={`checkbox-edit-${subItemKey}`}
                                              />
                                              <Label htmlFor={`edit-${subItemKey}`} className="text-xs text-muted-foreground cursor-pointer">
                                                Editar
                                              </Label>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
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
                placeholder="Pesquisar por nome, login ou função..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {selectedUserIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-md bg-muted/50 border">
              <span className="text-sm font-medium">
                {selectedUserIds.size} usuário{selectedUserIds.size !== 1 ? "s" : ""} selecionado{selectedUserIds.size !== 1 ? "s" : ""}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Selecionados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserIds(new Set())}
                data-testid="button-clear-selection"
              >
                Limpar Seleção
              </Button>
            </div>
          )}
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={deletableFilteredUsers.length > 0 && selectedUserIds.size === deletableFilteredUsers.length}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-users"
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Função</TableHead>
                {canManageAllUsers && <TableHead>Coordenador</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right min-w-[260px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const manager = coordenadores.find((c) => c.id === user.managerId);
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="w-10">
                      {canDeleteUser(user) ? (
                        <Checkbox
                          checked={selectedUserIds.has(user.id)}
                          onCheckedChange={() => toggleSelectUser(user.id)}
                          data-testid={`checkbox-select-user-${user.id}`}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`user-name-${user.id}`}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />}
                          <AvatarFallback className="text-[10px] font-bold">
                            {user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {user.name}
                      </div>
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
                    <TableCell className="min-w-[260px]">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          Editar
                        </Button>
                        {canManageAllUsers && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setAcessoModalUser(user);
                              setShowAcessoModal(true);
                            }}
                            data-testid={`button-acesso-user-${user.id}`}
                            title="Configurar horário e IP de acesso"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        )}
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
                            size="icon"
                            onClick={() => setUserToDelete(user)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManageAllUsers ? 7 : 6} className="text-center text-muted-foreground py-8">
                    {searchTerm.trim() ? "Nenhum usuário encontrado para esta pesquisa" : "Nenhum usuário cadastrado"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão em Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedUserIds.size} usuário{selectedUserIds.size !== 1 ? "s" : ""}</strong>?
              Esta ação não pode ser desfeita e todos os dados associados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedUserIds))}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                `Excluir ${selectedUserIds.size} Usuário${selectedUserIds.size !== 1 ? "s" : ""}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <Label className="text-muted-foreground text-sm">Login</Label>
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
                  onClick={() => copyToClipboard(createdCredentials?.email || "", "Login")}
                  data-testid="button-copy-email"
                >
                  {copiedField === "Login" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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

      {/* Modal de configuração de acesso */}
      <ConfigurarAcessoModal
        user={acessoModalUser}
        open={showAcessoModal}
        onClose={() => {
          setShowAcessoModal(false);
          setAcessoModalUser(null);
        }}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        }}
      />
    </div>
  );
}
