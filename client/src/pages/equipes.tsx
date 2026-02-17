import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Users, Edit, BarChart3, Trash2, UserPlus, Loader2 } from "lucide-react";

interface CommercialTeam {
  id: number;
  nome_equipe: string;
  descricao: string | null;
  coordenador_id: number | null;
  coordenador_nome: string | null;
  ativa: boolean;
  meta_mensal: string | null;
  total_membros: string;
}

interface TeamMember {
  id: number;
  team_id: number;
  employee_id: number;
  funcionario_nome: string;
  funcionario_cpf: string;
  funcionario_cargo: string | null;
  funcao_equipe: string;
  tipo_remuneracao: string;
  percentual_comissao: string | null;
  valor_fixo_adicional: string | null;
  percentual_meta: string | null;
  observacoes: string | null;
}

interface Employee {
  id: number;
  nome_completo: string;
  cpf: string;
  cargo: string | null;
  departamento: string | null;
}

const funcaoLabels: Record<string, string> = {
  coordenador: "Coordenador",
  subcoordenador: "Subcoordenador",
  assistente: "Assistente do Coordenador",
  vendedor: "Vendedor",
  operacional: "Operacional",
};

const remuneracaoLabels: Record<string, string> = {
  salario_fixo: "Salário Fixo",
  salario_variavel: "Salário + Variável",
  premiacao_meta: "Premiação por Meta",
};

export default function EquipesPage() {
  const { toast } = useToast();
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<CommercialTeam | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<CommercialTeam | null>(null);

  const [newTeamForm, setNewTeamForm] = useState({
    nomeEquipe: "",
    descricao: "",
    coordenadorId: "",
    metaMensal: "",
    ativa: true,
  });

  const [newMemberForm, setNewMemberForm] = useState({
    employeeId: "",
    funcaoEquipe: "",
    tipoRemuneracao: "",
    percentualComissao: "",
    valorFixoAdicional: "",
    percentualMeta: "",
    observacoes: "",
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<CommercialTeam[]>({
    queryKey: ["/api/commercial-teams"],
  });

  const { data: coordenadores = [] } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ["/api/users/coordenadores"],
  });

  const { data: availableEmployees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees/available-for-team"],
    enabled: showMembersModal,
  });

  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/commercial-teams", selectedTeam?.id, "members"],
    enabled: !!selectedTeam,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: typeof newTeamForm) => {
      return apiRequest("POST", "/api/commercial-teams", {
        nomeEquipe: data.nomeEquipe,
        descricao: data.descricao || null,
        coordenadorId: data.coordenadorId ? parseInt(data.coordenadorId) : null,
        metaMensal: data.metaMensal || null,
        ativa: data.ativa,
      });
    },
    onSuccess: () => {
      toast({ title: "Equipe criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams"] });
      setShowNewTeamModal(false);
      setNewTeamForm({ nomeEquipe: "", descricao: "", coordenadorId: "", metaMensal: "", ativa: true });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar equipe", description: error.message, variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async (data: { id: number; form: typeof newTeamForm }) => {
      return apiRequest("PUT", `/api/commercial-teams/${data.id}`, {
        nomeEquipe: data.form.nomeEquipe,
        descricao: data.form.descricao || null,
        coordenadorId: data.form.coordenadorId ? parseInt(data.form.coordenadorId) : null,
        metaMensal: data.form.metaMensal || null,
        ativa: data.form.ativa,
      });
    },
    onSuccess: () => {
      toast({ title: "Equipe atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams"] });
      setShowEditModal(false);
      setEditingTeam(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar equipe", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/commercial-teams/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Equipe removida com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover equipe", description: error.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { teamId: number; form: typeof newMemberForm }) => {
      return apiRequest("POST", `/api/commercial-teams/${data.teamId}/members`, {
        employeeId: parseInt(data.form.employeeId),
        funcaoEquipe: data.form.funcaoEquipe,
        tipoRemuneracao: data.form.tipoRemuneracao,
        percentualComissao: data.form.percentualComissao || null,
        valorFixoAdicional: data.form.valorFixoAdicional || null,
        percentualMeta: data.form.percentualMeta || null,
        observacoes: data.form.observacoes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Membro adicionado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams", selectedTeam?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available-for-team"] });
      setNewMemberForm({
        employeeId: "",
        funcaoEquipe: "",
        tipoRemuneracao: "",
        percentualComissao: "",
        valorFixoAdicional: "",
        percentualMeta: "",
        observacoes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adicionar membro", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (data: { teamId: number; memberId: number }) => {
      return apiRequest("DELETE", `/api/commercial-teams/${data.teamId}/members/${data.memberId}`);
    },
    onSuccess: () => {
      toast({ title: "Membro removido com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams", selectedTeam?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available-for-team"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover membro", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
  };

  const handleOpenMembers = (team: CommercialTeam) => {
    setSelectedTeam(team);
    setShowMembersModal(true);
  };

  const handleEditTeam = (team: CommercialTeam) => {
    setEditingTeam(team);
    setNewTeamForm({
      nomeEquipe: team.nome_equipe,
      descricao: team.descricao || "",
      coordenadorId: team.coordenador_id?.toString() || "",
      metaMensal: team.meta_mensal || "",
      ativa: team.ativa,
    });
    setShowEditModal(true);
  };

  const handleCreateTeam = () => {
    if (!newTeamForm.nomeEquipe.trim()) {
      toast({ title: "Nome da equipe é obrigatório", variant: "destructive" });
      return;
    }
    if (!newTeamForm.coordenadorId) {
      toast({ title: "Coordenador é obrigatório", variant: "destructive" });
      return;
    }
    createTeamMutation.mutate(newTeamForm);
  };

  const handleUpdateTeam = () => {
    if (!editingTeam) return;
    if (!newTeamForm.nomeEquipe.trim()) {
      toast({ title: "Nome da equipe é obrigatório", variant: "destructive" });
      return;
    }
    if (!newTeamForm.coordenadorId) {
      toast({ title: "Coordenador é obrigatório", variant: "destructive" });
      return;
    }
    updateTeamMutation.mutate({ id: editingTeam.id, form: newTeamForm });
  };

  const handleAddMember = () => {
    if (!selectedTeam || !newMemberForm.employeeId || !newMemberForm.funcaoEquipe || !newMemberForm.tipoRemuneracao) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (newMemberForm.tipoRemuneracao === "salario_variavel" && !newMemberForm.percentualComissao) {
      toast({ title: "Percentual de comissão é obrigatório para remuneração variável", variant: "destructive" });
      return;
    }
    if (newMemberForm.tipoRemuneracao === "premiacao_meta" && !newMemberForm.percentualMeta) {
      toast({ title: "Percentual de bônus é obrigatório para premiação por meta", variant: "destructive" });
      return;
    }
    addMemberMutation.mutate({ teamId: selectedTeam.id, form: newMemberForm });
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Equipes Comerciais</h1>
        <Button onClick={() => setShowNewTeamModal(true)} data-testid="button-new-team">
          <Plus className="h-4 w-4 mr-2" />
          Nova Equipe
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma equipe comercial cadastrada</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowNewTeamModal(true)} data-testid="button-create-first-team">
              Criar primeira equipe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} data-testid={`card-team-${team.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{team.nome_equipe}</CardTitle>
                  <Badge variant={team.ativa ? "default" : "secondary"} data-testid={`badge-status-${team.id}`}>
                    {team.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coordenador:</span>
                    <span data-testid={`text-coordenador-${team.id}`}>{team.coordenador_nome || "Não definido"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta Mensal:</span>
                    <span data-testid={`text-meta-${team.id}`}>{formatCurrency(team.meta_mensal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membros:</span>
                    <span data-testid={`text-membros-${team.id}`}>{team.total_membros}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditTeam(team)} data-testid={`button-edit-${team.id}`}>
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenMembers(team)} data-testid={`button-members-${team.id}`}>
                    <Users className="h-4 w-4 mr-1" />
                    Membros
                  </Button>
                  <Button variant="outline" size="sm" data-testid={`button-results-${team.id}`}>
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Resultados
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNewTeamModal} onOpenChange={setShowNewTeamModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
            <DialogDescription>Crie uma nova equipe comercial</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nomeEquipe">Nome da Equipe *</Label>
              <Input
                id="nomeEquipe"
                value={newTeamForm.nomeEquipe}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, nomeEquipe: e.target.value })}
                placeholder="Ex: Equipe Alpha"
                data-testid="input-team-name"
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={newTeamForm.descricao}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, descricao: e.target.value })}
                placeholder="Descrição da equipe..."
                data-testid="input-team-description"
              />
            </div>
            <div>
              <Label htmlFor="coordenador">Coordenador *</Label>
              <Select
                value={newTeamForm.coordenadorId}
                onValueChange={(value) => setNewTeamForm({ ...newTeamForm, coordenadorId: value })}
              >
                <SelectTrigger data-testid="select-coordenador">
                  <SelectValue placeholder="Selecione o coordenador" />
                </SelectTrigger>
                <SelectContent>
                  {coordenadores.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id.toString()}>
                      {coord.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="metaMensal">Meta Mensal (R$)</Label>
              <Input
                id="metaMensal"
                type="number"
                step="0.01"
                value={newTeamForm.metaMensal}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, metaMensal: e.target.value })}
                placeholder="0,00"
                data-testid="input-team-meta"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativa"
                checked={newTeamForm.ativa}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, ativa: e.target.checked })}
                className="h-4 w-4"
                data-testid="checkbox-team-active"
              />
              <Label htmlFor="ativa">Equipe Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTeamModal(false)} data-testid="button-cancel-team">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={createTeamMutation.isPending}
              data-testid="button-create-team"
            >
              {createTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Equipe</DialogTitle>
            <DialogDescription>Edite as informações da equipe</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editNomeEquipe">Nome da Equipe *</Label>
              <Input
                id="editNomeEquipe"
                value={newTeamForm.nomeEquipe}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, nomeEquipe: e.target.value })}
                data-testid="input-edit-team-name"
              />
            </div>
            <div>
              <Label htmlFor="editDescricao">Descrição</Label>
              <Textarea
                id="editDescricao"
                value={newTeamForm.descricao}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, descricao: e.target.value })}
                data-testid="input-edit-team-description"
              />
            </div>
            <div>
              <Label htmlFor="editCoordenador">Coordenador *</Label>
              <Select
                value={newTeamForm.coordenadorId}
                onValueChange={(value) => setNewTeamForm({ ...newTeamForm, coordenadorId: value })}
              >
                <SelectTrigger data-testid="select-edit-coordenador">
                  <SelectValue placeholder="Selecione o coordenador" />
                </SelectTrigger>
                <SelectContent>
                  {coordenadores.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id.toString()}>
                      {coord.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editMetaMensal">Meta Mensal (R$)</Label>
              <Input
                id="editMetaMensal"
                type="number"
                step="0.01"
                value={newTeamForm.metaMensal}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, metaMensal: e.target.value })}
                data-testid="input-edit-team-meta"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editAtiva"
                checked={newTeamForm.ativa}
                onChange={(e) => setNewTeamForm({ ...newTeamForm, ativa: e.target.checked })}
                className="h-4 w-4"
                data-testid="checkbox-edit-team-active"
              />
              <Label htmlFor="editAtiva">Equipe Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                if (editingTeam && confirm("Tem certeza que deseja excluir esta equipe?")) {
                  deleteTeamMutation.mutate(editingTeam.id);
                  setShowEditModal(false);
                }
              }}
              data-testid="button-delete-team"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
            <Button variant="outline" onClick={() => setShowEditModal(false)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={updateTeamMutation.isPending}
              data-testid="button-save-team"
            >
              {updateTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Membros da Equipe {selectedTeam?.nome_equipe}</DialogTitle>
            <DialogDescription>Gerencie os membros desta equipe comercial</DialogDescription>
          </DialogHeader>

          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {teamMembers.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Remuneração</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{member.funcionario_nome}</p>
                              <p className="text-xs text-muted-foreground">{member.funcionario_cpf}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{funcaoLabels[member.funcao_equipe] || member.funcao_equipe}</Badge>
                          </TableCell>
                          <TableCell>{remuneracaoLabels[member.tipo_remuneracao] || member.tipo_remuneracao}</TableCell>
                          <TableCell>
                            {member.tipo_remuneracao === "salario_variavel" && member.percentual_comissao && (
                              <span className="text-sm">Comissão: {member.percentual_comissao}%</span>
                            )}
                            {member.tipo_remuneracao === "premiacao_meta" && member.percentual_meta && (
                              <span className="text-sm">Bônus: {member.percentual_meta}%</span>
                            )}
                            {member.tipo_remuneracao === "salario_fixo" && (
                              <span className="text-sm text-muted-foreground">Apenas salário base</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => selectedTeam && removeMemberMutation.mutate({ teamId: selectedTeam.id, memberId: member.id })}
                              data-testid={`button-remove-member-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {teamMembers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum membro na equipe</p>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Adicionar Novo Membro
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Funcionário *</Label>
                    <Select
                      value={newMemberForm.employeeId}
                      onValueChange={(value) => setNewMemberForm({ ...newMemberForm, employeeId: value })}
                    >
                      <SelectTrigger data-testid="select-member-employee">
                        <SelectValue placeholder="Selecione um funcionário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.nome_completo} - {emp.cpf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Função na Equipe *</Label>
                    <Select
                      value={newMemberForm.funcaoEquipe}
                      onValueChange={(value) => setNewMemberForm({ ...newMemberForm, funcaoEquipe: value })}
                    >
                      <SelectTrigger data-testid="select-member-funcao">
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordenador">Coordenador</SelectItem>
                        <SelectItem value="subcoordenador">Subcoordenador</SelectItem>
                        <SelectItem value="assistente">Assistente do Coordenador</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Remuneração *</Label>
                    <Select
                      value={newMemberForm.tipoRemuneracao}
                      onValueChange={(value) => setNewMemberForm({ ...newMemberForm, tipoRemuneracao: value })}
                    >
                      <SelectTrigger data-testid="select-member-remuneracao">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salario_fixo">Salário Fixo (apenas salário base)</SelectItem>
                        <SelectItem value="salario_variavel">Salário + Variável (salário + comissão)</SelectItem>
                        <SelectItem value="premiacao_meta">Premiação por Meta (salário + bônus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newMemberForm.tipoRemuneracao === "salario_variavel" && (
                    <>
                      <div>
                        <Label>% Comissão sobre vendas *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newMemberForm.percentualComissao}
                          onChange={(e) => setNewMemberForm({ ...newMemberForm, percentualComissao: e.target.value })}
                          placeholder="Ex: 5.00"
                          data-testid="input-member-comissao"
                        />
                      </div>
                      <div>
                        <Label>Valor Fixo Adicional</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newMemberForm.valorFixoAdicional}
                          onChange={(e) => setNewMemberForm({ ...newMemberForm, valorFixoAdicional: e.target.value })}
                          placeholder="Ex: 500.00"
                          data-testid="input-member-fixo-adicional"
                        />
                      </div>
                    </>
                  )}
                  {newMemberForm.tipoRemuneracao === "premiacao_meta" && (
                    <div>
                      <Label>% Bônus ao atingir meta *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newMemberForm.percentualMeta}
                        onChange={(e) => setNewMemberForm({ ...newMemberForm, percentualMeta: e.target.value })}
                        placeholder="Ex: 10.00"
                        data-testid="input-member-bonus"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={newMemberForm.observacoes}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, observacoes: e.target.value })}
                      placeholder="Observações sobre o membro..."
                      data-testid="input-member-observacoes"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowMembersModal(false)} data-testid="button-close-members">
                    Fechar
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    disabled={addMemberMutation.isPending}
                    data-testid="button-add-member"
                  >
                    {addMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar Membro
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
