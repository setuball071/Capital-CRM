import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Globe, Users, Plus, Trash2, History, Save, RotateCcw, UserPlus, Settings2, GraduationCap, Target, Clock } from "lucide-react";
import type { UserRole, User } from "@shared/schema";

interface Team {
  id: number;
  name: string;
  managerUserId: number;
  managerName?: string;
  memberCount?: number;
  createdAt?: string;
}

interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  roleInTeam: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

interface AiPrompt {
  id: number;
  type: string;
  scope: string;
  teamId: number | null;
  promptText: string;
  version: number;
  isActive: boolean;
  updatedByUserId: number | null;
  updatedAt: string;
}

interface RoleplayNivelPrompt {
  id: number;
  nivel: number;
  nome: string;
  descricao: string | null;
  promptCompleto: string;
  criteriosAprovacao: string[];
  notaMinima: string;
  tempoLimiteMinutos: number | null;
  isActive: boolean;
  podeCustomizar: boolean;
}

export default function ConfigPrompts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [globalPromptText, setGlobalPromptText] = useState("");
  const [teamPromptText, setTeamPromptText] = useState("");
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamManagerId, setNewTeamManagerId] = useState<string>("");
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyScope, setHistoryScope] = useState<"global" | "team">("global");

  const userRole = user?.role as UserRole;
  const isMaster = userRole === "master";
  const isCoordinator = userRole === "coordenacao";

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: isMaster,
  });

  const { data: userTeamData } = useQuery<{ team: Team | null; membership: TeamMember | null }>({
    queryKey: ["/api/user/team"],
    enabled: isCoordinator,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isMaster,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    enabled: !!selectedTeamId && isMaster,
  });

  const { data: globalPrompts = [] } = useQuery<AiPrompt[]>({
    queryKey: ["/api/ai-prompts/roleplay/global"],
    enabled: isMaster,
  });

  const { data: teamPrompts = [] } = useQuery<AiPrompt[]>({
    queryKey: ["/api/ai-prompts/roleplay/team", selectedTeamId],
    enabled: !!selectedTeamId,
  });
  
  const { data: nivelPrompts = [] } = useQuery<RoleplayNivelPrompt[]>({
    queryKey: ["/api/roleplay-niveis/prompts"],
    enabled: isMaster,
  });

  const activeGlobalPrompt = globalPrompts.find(p => p.isActive);
  const activeTeamPrompt = teamPrompts.find(p => p.isActive);

  const saveGlobalPromptMutation = useMutation({
    mutationFn: async (promptText: string) => {
      return apiRequest("POST", "/api/ai-prompts/roleplay/global", { promptText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts/roleplay/global"] });
      toast({ title: "Prompt global salvo com sucesso" });
      setGlobalPromptText("");
    },
    onError: () => {
      toast({ title: "Erro ao salvar prompt", variant: "destructive" });
    },
  });

  const saveTeamPromptMutation = useMutation({
    mutationFn: async ({ teamId, promptText }: { teamId: number; promptText: string }) => {
      return apiRequest("POST", `/api/ai-prompts/roleplay/team/${teamId}`, { promptText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts/roleplay/team", selectedTeamId] });
      toast({ title: "Prompt da equipe salvo com sucesso" });
      setTeamPromptText("");
    },
    onError: () => {
      toast({ title: "Erro ao salvar prompt da equipe", variant: "destructive" });
    },
  });

  const resetTeamPromptMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return apiRequest("DELETE", `/api/ai-prompts/roleplay/team/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts/roleplay/team", selectedTeamId] });
      toast({ title: "Prompt da equipe resetado. Agora usa o prompt global." });
    },
    onError: () => {
      toast({ title: "Erro ao resetar prompt", variant: "destructive" });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ name, managerUserId }: { name: string; managerUserId: number }) => {
      return apiRequest("POST", "/api/teams", { name, managerUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Equipe criada com sucesso" });
      setShowCreateTeamDialog(false);
      setNewTeamName("");
      setNewTeamManagerId("");
    },
    onError: () => {
      toast({ title: "Erro ao criar equipe", variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Equipe excluída" });
      setSelectedTeamId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir equipe", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      return apiRequest("POST", `/api/teams/${teamId}/members`, { userId, roleInTeam: "seller" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Membro adicionado" });
      setShowAddMemberDialog(false);
      setNewMemberUserId("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar membro", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/teams/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Membro removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover membro", variant: "destructive" });
    },
  });

  const coordinators = allUsers.filter(u => u.role === "coordenacao" && u.isActive);
  const vendedoresDisponiveis = allUsers.filter(u => 
    ["vendedor", "coordenacao"].includes(u.role) && 
    u.isActive && 
    !teamMembers.some(m => m.userId === u.id)
  );

  const coordTeam = isCoordinator ? userTeamData?.team : null;
  const effectiveTeamId = isMaster ? selectedTeamId : coordTeam?.id || null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isMaster && !isCoordinator) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Apenas Master e Coordenadores podem configurar prompts de IA.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Configuração de Prompts IA
        </h1>
        <p className="text-muted-foreground">
          Configure os prompts do Roleplay para treinamento de vendedores
        </p>
      </div>

      <Tabs defaultValue={isMaster ? "global" : "team"}>
        <TabsList>
          {isMaster && (
            <TabsTrigger value="global" data-testid="tab-global">
              <Globe className="h-4 w-4 mr-1" />
              Prompt Global
            </TabsTrigger>
          )}
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="h-4 w-4 mr-1" />
            Prompt por Equipe
          </TabsTrigger>
          {isMaster && (
            <TabsTrigger value="teams" data-testid="tab-teams">
              <Users className="h-4 w-4 mr-1" />
              Gerenciar Equipes
            </TabsTrigger>
          )}
          {isMaster && (
            <TabsTrigger value="niveis" data-testid="tab-niveis">
              <GraduationCap className="h-4 w-4 mr-1" />
              Prompts dos Níveis
            </TabsTrigger>
          )}
        </TabsList>

        {isMaster && (
          <TabsContent value="global" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Prompt Global (Padrão)
                </CardTitle>
                <CardDescription>
                  Este prompt é usado por todas as equipes que não possuem prompt específico.
                  Todas as equipes herdam este prompt automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeGlobalPrompt && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">Versão {activeGlobalPrompt.version} - Ativo</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(activeGlobalPrompt.updatedAt)}
                      </span>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {activeGlobalPrompt.promptText}
                    </pre>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Novo Prompt Global</Label>
                  <Textarea
                    value={globalPromptText}
                    onChange={(e) => setGlobalPromptText(e.target.value)}
                    placeholder="Digite o novo prompt para o Roleplay..."
                    rows={8}
                    data-testid="input-global-prompt"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => saveGlobalPromptMutation.mutate(globalPromptText)}
                    disabled={!globalPromptText.trim() || saveGlobalPromptMutation.isPending}
                    data-testid="button-save-global-prompt"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Salvar Nova Versão
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistoryScope("global");
                      setShowHistoryDialog(true);
                    }}
                    data-testid="button-history-global"
                  >
                    <History className="h-4 w-4 mr-1" />
                    Ver Histórico ({globalPrompts.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="team" className="space-y-4">
          {isMaster && (
            <div className="mb-4">
              <Label>Selecione a Equipe</Label>
              <Select
                value={selectedTeamId?.toString() || ""}
                onValueChange={(v) => setSelectedTeamId(parseInt(v))}
              >
                <SelectTrigger className="w-64" data-testid="select-team">
                  <SelectValue placeholder="Escolha uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name} ({team.memberCount || 0} membros)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isCoordinator && coordTeam && (
            <Card className="mb-4 bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">Sua Equipe: {coordTeam.name}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {effectiveTeamId ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Prompt Específico da Equipe
                </CardTitle>
                <CardDescription>
                  {activeTeamPrompt
                    ? "Esta equipe possui um prompt personalizado ativo."
                    : "Esta equipe usa o prompt global (padrão). Você pode criar um prompt específico."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTeamPrompt ? (
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge>Versão {activeTeamPrompt.version} - Personalizado</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(activeTeamPrompt.updatedAt)}
                      </span>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {activeTeamPrompt.promptText}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    Nenhum prompt específico. Usando o prompt global.
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Novo Prompt para esta Equipe</Label>
                  <Textarea
                    value={teamPromptText}
                    onChange={(e) => setTeamPromptText(e.target.value)}
                    placeholder="Digite o prompt personalizado para esta equipe..."
                    rows={8}
                    data-testid="input-team-prompt"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      saveTeamPromptMutation.mutate({
                        teamId: effectiveTeamId,
                        promptText: teamPromptText,
                      })
                    }
                    disabled={!teamPromptText.trim() || saveTeamPromptMutation.isPending}
                    data-testid="button-save-team-prompt"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Salvar Prompt da Equipe
                  </Button>
                  {activeTeamPrompt && (
                    <Button
                      variant="outline"
                      onClick={() => resetTeamPromptMutation.mutate(effectiveTeamId)}
                      disabled={resetTeamPromptMutation.isPending}
                      data-testid="button-reset-team-prompt"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Resetar (Usar Global)
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistoryScope("team");
                      setShowHistoryDialog(true);
                    }}
                    data-testid="button-history-team"
                  >
                    <History className="h-4 w-4 mr-1" />
                    Ver Histórico ({teamPrompts.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {isMaster
                  ? "Selecione uma equipe para configurar o prompt."
                  : "Você não está associado a nenhuma equipe."}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isMaster && (
          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gerenciar Equipes</CardTitle>
                    <CardDescription>
                      Crie equipes e associe vendedores a coordenadores
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateTeamDialog(true)} data-testid="button-create-team">
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Equipe
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Equipe</TableHead>
                      <TableHead>Coordenador</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma equipe cadastrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.managerName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{team.memberCount || 0}</Badge>
                          </TableCell>
                          <TableCell>
                            {teamPrompts.some(p => p.teamId === team.id && p.isActive) ? (
                              <Badge>Personalizado</Badge>
                            ) : (
                              <Badge variant="secondary">Global</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTeamId(team.id);
                                  setShowAddMemberDialog(true);
                                }}
                                data-testid={`button-add-member-${team.id}`}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteTeamMutation.mutate(team.id)}
                                data-testid={`button-delete-team-${team.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedTeamId && (
              <Card>
                <CardHeader>
                  <CardTitle>Membros da Equipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="w-20">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhum membro nesta equipe
                          </TableCell>
                        </TableRow>
                      ) : (
                        teamMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.userName}</TableCell>
                            <TableCell>{member.userEmail}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{member.userRole}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeMemberMutation.mutate(member.userId)}
                                data-testid={`button-remove-member-${member.userId}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
        
        {isMaster && (
          <TabsContent value="niveis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Prompts do Modo Níveis
                </CardTitle>
                <CardDescription>
                  Configure as 5 personas do sistema de progressão estruturada. 
                  Os vendedores devem atingir a nota mínima em cada nível para avançar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nivelPrompts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Carregando prompts de níveis...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {nivelPrompts.map((prompt) => (
                      <div key={prompt.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge variant={prompt.isActive ? "default" : "secondary"}>
                              Nível {prompt.nivel}
                            </Badge>
                            <div>
                              <h3 className="font-semibold">{prompt.nome}</h3>
                              <p className="text-sm text-muted-foreground">{prompt.descricao}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              Nota mínima: {prompt.notaMinima}
                            </span>
                            {prompt.tempoLimiteMinutos && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {prompt.tempoLimiteMinutos} min
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-muted rounded-lg p-3 mb-3">
                          <Label className="text-xs text-muted-foreground mb-1 block">Critérios de Aprovação:</Label>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {prompt.criteriosAprovacao.map((criterio, idx) => (
                              <li key={idx}>{criterio}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-3">
                          <Label className="text-xs text-muted-foreground mb-1 block">Prompt (resumo):</Label>
                          <pre className="text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {prompt.promptCompleto.substring(0, 500)}
                            {prompt.promptCompleto.length > 500 && "..."}
                          </pre>
                        </div>
                        
                        {!prompt.podeCustomizar && (
                          <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                            * Este prompt é fixo e não pode ser editado no momento.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Equipe</Label>
              <Input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Ex: Equipe Alfa"
                data-testid="input-team-name"
              />
            </div>
            <div>
              <Label>Coordenador</Label>
              <Select value={newTeamManagerId} onValueChange={setNewTeamManagerId}>
                <SelectTrigger data-testid="select-team-manager">
                  <SelectValue placeholder="Selecione um coordenador" />
                </SelectTrigger>
                <SelectContent>
                  {coordinators.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id.toString()}>
                      {coord.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTeamDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                createTeamMutation.mutate({
                  name: newTeamName,
                  managerUserId: parseInt(newTeamManagerId),
                })
              }
              disabled={!newTeamName.trim() || !newTeamManagerId || createTeamMutation.isPending}
              data-testid="button-confirm-create-team"
            >
              Criar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendedor</Label>
              <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                <SelectTrigger data-testid="select-new-member">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoresDisponiveis.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                addMemberMutation.mutate({
                  teamId: selectedTeamId!,
                  userId: parseInt(newMemberUserId),
                })
              }
              disabled={!newMemberUserId || addMemberMutation.isPending}
              data-testid="button-confirm-add-member"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico de Prompts ({historyScope === "global" ? "Global" : "Equipe"})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(historyScope === "global" ? globalPrompts : teamPrompts).map((prompt) => (
              <div
                key={prompt.id}
                className={`p-4 rounded-lg border ${prompt.isActive ? "border-primary bg-accent/30" : "bg-muted"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={prompt.isActive ? "default" : "secondary"}>
                      Versão {prompt.version}
                    </Badge>
                    {prompt.isActive && <Badge variant="outline">Ativo</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(prompt.updatedAt)}
                  </span>
                </div>
                <pre className="text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {prompt.promptText}
                </pre>
              </div>
            ))}
            {(historyScope === "global" ? globalPrompts : teamPrompts).length === 0 && (
              <p className="text-center text-muted-foreground">Nenhum histórico disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
