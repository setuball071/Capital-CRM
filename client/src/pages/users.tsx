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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, UserPlus, CheckCircle, XCircle } from "lucide-react";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"vendedor" | "coordenacao" | "master">("vendedor");
  const [managerId, setManagerId] = useState<string>("");

  const isMaster = currentUser?.role === "master";
  const isCoordinator = currentUser?.role === "coordenacao";

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch coordenadores (only for master when creating vendedor)
  const { data: coordenadores = [] } = useQuery<User[]>({
    queryKey: ["/api/users/coordenadores"],
    enabled: isMaster,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string; managerId?: number }) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário criado com sucesso!",
      });
      handleCloseDialog();
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
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário atualizado com sucesso!",
      });
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

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("vendedor");
    setManagerId("");
  };

  const handleOpenCreateDialog = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole(isCoordinator ? "vendedor" : "vendedor");
    setManagerId("");
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role as "vendedor" | "coordenacao" | "master");
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
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const toggleUserStatus = async (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    });
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      master: "Administrador",
      coordenacao: "Coordenador",
      vendedor: "Vendedor",
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "master") return "default";
    if (role === "coordenacao") return "secondary";
    return "outline";
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
            {isMaster
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Criar Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Atualize as informações do usuário"
                  : isCoordinator
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
              {!isCoordinator && (
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger id="role" data-testid="select-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="coordenacao">Coordenador</SelectItem>
                      <SelectItem value="master">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isMaster && role === "vendedor" && (
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
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                {isMaster && <TableHead>Coordenador</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
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
                    {isMaster && (
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
                      {isMaster && user.id !== currentUser?.id && (
                        <Button
                          variant={user.isActive ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          data-testid={`button-toggle-user-${user.id}`}
                        >
                          {user.isActive ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isMaster ? 6 : 5} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
