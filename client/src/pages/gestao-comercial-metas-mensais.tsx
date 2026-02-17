import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Target, Users, TrendingUp, TrendingDown, Save, Lock, ChevronLeft, ChevronRight, CreditCard, DollarSign } from "lucide-react";

interface Team {
  id: number;
  nome_equipe: string;
  coordenador_nome: string | null;
}

interface MetaEquipe {
  id: number;
  equipe_id: number;
  mes_referencia: string;
  meta_geral: string;
  meta_cartao: string;
}

interface MetaIndividual {
  id?: number;
  usuario_id: number;
  equipe_id: number;
  mes_referencia: string;
  meta_geral: string;
  meta_cartao: string;
  usuario_nome: string;
  usuario_email: string;
}

interface TeamMember {
  member_id: number;
  funcao_equipe: string;
  employee_id: number;
  nome: string;
  user_id: number | null;
  user_name: string | null;
  email: string | null;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthDisplay(mesRef: string): string {
  const [year, month] = mesRef.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function navigateMonth(mesRef: string, direction: number): string {
  const [year, month] = mesRef.split('-').map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function MetasMensaisPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth());
  const [equipeId, setEquipeId] = useState<string>("");
  const [metaGeralEquipe, setMetaGeralEquipe] = useState("");
  const [metaCartaoEquipe, setMetaCartaoEquipe] = useState("");
  const [metasIndividuaisLocal, setMetasIndividuaisLocal] = useState<Record<number, { metaGeral: string; metaCartao: string }>>({});

  const isAdmin = user?.role === "master" || user?.isMaster;
  const isCoord = user?.role === "coordenacao";
  const isVendedor = user?.role === "vendedor";
  const canEdit = isAdmin || isCoord;

  const currentMonth = getCurrentMonth();
  const isMonthLocked = mesReferencia < currentMonth;

  const { data: equipes = [], isLoading: loadingEquipes } = useQuery<Team[]>({
    queryKey: ["/api/metas/equipes"],
  });

  useEffect(() => {
    if (equipes.length > 0 && !equipeId) {
      setEquipeId(String(equipes[0].id));
    }
  }, [equipes]);

  const { data: metaEquipe, isLoading: loadingMetaEquipe } = useQuery<MetaEquipe | null>({
    queryKey: ["/api/metas/equipe", equipeId, mesReferencia],
    queryFn: async () => {
      if (!equipeId) return null;
      const res = await fetch(`/api/metas/equipe/${equipeId}/${mesReferencia}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar meta");
      return res.json();
    },
    enabled: !!equipeId,
  });

  const { data: metasIndividuais = [], isLoading: loadingIndividuais } = useQuery<MetaIndividual[]>({
    queryKey: ["/api/metas/individuais", equipeId, mesReferencia],
    queryFn: async () => {
      if (!equipeId) return [];
      const res = await fetch(`/api/metas/individuais/${equipeId}/${mesReferencia}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar metas individuais");
      return res.json();
    },
    enabled: !!equipeId,
  });

  const { data: membros = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/metas/membros", equipeId],
    queryFn: async () => {
      if (!equipeId) return [];
      const res = await fetch(`/api/metas/membros/${equipeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar membros");
      return res.json();
    },
    enabled: !!equipeId && canEdit,
  });

  useEffect(() => {
    if (metaEquipe) {
      setMetaGeralEquipe(metaEquipe.meta_geral || "0");
      setMetaCartaoEquipe(metaEquipe.meta_cartao || "0");
    } else {
      setMetaGeralEquipe("0");
      setMetaCartaoEquipe("0");
    }
  }, [metaEquipe]);

  useEffect(() => {
    const localMetas: Record<number, { metaGeral: string; metaCartao: string }> = {};
    metasIndividuais.forEach((mi) => {
      localMetas[mi.usuario_id] = { metaGeral: mi.meta_geral || "0", metaCartao: mi.meta_cartao || "0" };
    });
    setMetasIndividuaisLocal(localMetas);
  }, [metasIndividuais]);

  const saveMetaEquipeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/metas/equipe", {
        equipeId: parseInt(equipeId),
        mesReferencia,
        metaGeral: parseFloat(metaGeralEquipe) || 0,
        metaCartao: parseFloat(metaCartaoEquipe) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas/equipe", equipeId, mesReferencia] });
      toast({ title: "Meta da equipe salva com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar meta da equipe", description: error.message, variant: "destructive" });
    },
  });

  const saveMetasIndividuaisMutation = useMutation({
    mutationFn: async () => {
      const membrosComUser = membros.filter(m => m.user_id);
      const metas = membrosComUser.map(m => ({
        usuarioId: m.user_id!,
        metaGeral: parseFloat(metasIndividuaisLocal[m.user_id!]?.metaGeral || "0"),
        metaCartao: parseFloat(metasIndividuaisLocal[m.user_id!]?.metaCartao || "0"),
      }));
      return apiRequest("PUT", "/api/metas/individuais/batch", {
        metas,
        equipeId: parseInt(equipeId),
        mesReferencia,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas/individuais", equipeId, mesReferencia] });
      toast({ title: "Metas individuais salvas com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar metas individuais", description: error.message, variant: "destructive" });
    },
  });

  const somaIndividualGeral = useMemo(() => {
    return Object.values(metasIndividuaisLocal).reduce((sum, m) => sum + (parseFloat(m.metaGeral) || 0), 0);
  }, [metasIndividuaisLocal]);

  const somaIndividualCartao = useMemo(() => {
    return Object.values(metasIndividuaisLocal).reduce((sum, m) => sum + (parseFloat(m.metaCartao) || 0), 0);
  }, [metasIndividuaisLocal]);

  const diferencaGeral = (parseFloat(metaGeralEquipe) || 0) - somaIndividualGeral;
  const diferencaCartao = (parseFloat(metaCartaoEquipe) || 0) - somaIndividualCartao;

  const selectedTeam = equipes.find(e => String(e.id) === equipeId);

  const membrosDisplay = canEdit
    ? membros.filter(m => m.user_id)
    : metasIndividuais.map(mi => ({
        user_id: mi.usuario_id,
        nome: mi.usuario_nome,
        user_name: mi.usuario_nome,
        email: mi.usuario_email,
        funcao_equipe: "",
        member_id: 0,
        employee_id: 0,
      }));

  const handleIndividualChange = (userId: number, field: 'metaGeral' | 'metaCartao', value: string) => {
    setMetasIndividuaisLocal(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId] || { metaGeral: "0", metaCartao: "0" },
        [field]: value,
      },
    }));
  };

  if (loadingEquipes) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-metas">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (equipes.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold" data-testid="text-metas-title">Metas Mensais</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isVendedor
                ? "Você não está vinculado a nenhuma equipe. Fale com seu coordenador."
                : "Nenhuma equipe encontrada. Crie equipes em Gestão Comercial > Equipes."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-metas-title">Metas Mensais</h1>
        {isMonthLocked && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Lock className="w-4 h-4" />
            <span>Mês bloqueado para edição</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMesReferencia(navigateMonth(mesReferencia, -1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium min-w-[160px] text-center" data-testid="text-month-display">
            {formatMonthDisplay(mesReferencia)}
          </span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMesReferencia(navigateMonth(mesReferencia, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {!isVendedor && equipes.length > 1 && (
          <Select value={equipeId} onValueChange={setEquipeId}>
            <SelectTrigger className="w-[250px]" data-testid="select-equipe">
              <SelectValue placeholder="Selecione a equipe" />
            </SelectTrigger>
            <SelectContent>
              {equipes.map(eq => (
                <SelectItem key={eq.id} value={String(eq.id)} data-testid={`option-equipe-${eq.id}`}>
                  {eq.nome_equipe}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isVendedor && selectedTeam && (
          <span className="text-muted-foreground text-sm">Equipe: {selectedTeam.nome_equipe}</span>
        )}
      </div>

      {!isVendedor && (
        <Card data-testid="card-meta-equipe">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5" />
              Meta da Equipe — {selectedTeam?.nome_equipe || ""}
            </CardTitle>
            {canEdit && !isMonthLocked && (
              <Button
                size="sm"
                onClick={() => saveMetaEquipeMutation.mutate()}
                disabled={saveMetaEquipeMutation.isPending}
                data-testid="button-save-meta-equipe"
              >
                <Save className="w-4 h-4 mr-1" />
                Salvar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Meta Geral (R$)
                </label>
                {canEdit && !isMonthLocked ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={metaGeralEquipe}
                    onChange={e => setMetaGeralEquipe(e.target.value)}
                    data-testid="input-meta-geral-equipe"
                  />
                ) : (
                  <p className="text-lg font-semibold" data-testid="text-meta-geral-equipe">
                    {formatCurrency(parseFloat(metaGeralEquipe) || 0)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  Meta Cartão (R$)
                </label>
                {canEdit && !isMonthLocked ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={metaCartaoEquipe}
                    onChange={e => setMetaCartaoEquipe(e.target.value)}
                    data-testid="input-meta-cartao-equipe"
                  />
                ) : (
                  <p className="text-lg font-semibold" data-testid="text-meta-cartao-equipe">
                    {formatCurrency(parseFloat(metaCartaoEquipe) || 0)}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Soma Individuais (Geral)</p>
                <p className="text-lg font-semibold" data-testid="text-soma-individual-geral">
                  {formatCurrency(somaIndividualGeral)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Soma Individuais (Cartão)</p>
                <p className="text-lg font-semibold" data-testid="text-soma-individual-cartao">
                  {formatCurrency(somaIndividualCartao)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Diferença</p>
                <div className="flex flex-wrap gap-3">
                  <span className={`text-lg font-semibold flex items-center gap-1 ${diferencaGeral >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-diferenca-geral">
                    {diferencaGeral >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(Math.abs(diferencaGeral))}
                  </span>
                  <span className={`text-lg font-semibold flex items-center gap-1 ${diferencaCartao >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-diferenca-cartao">
                    {diferencaCartao >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(Math.abs(diferencaCartao))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-metas-individuais">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isVendedor ? "Minha Meta" : "Metas Individuais"}
          </CardTitle>
          {canEdit && !isMonthLocked && membrosDisplay.length > 0 && (
            <Button
              size="sm"
              onClick={() => saveMetasIndividuaisMutation.mutate()}
              disabled={saveMetasIndividuaisMutation.isPending}
              data-testid="button-save-metas-individuais"
            >
              <Save className="w-4 h-4 mr-1" />
              Salvar Metas
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(loadingIndividuais || loadingMetaEquipe) ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : membrosDisplay.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {isVendedor
                ? "Nenhuma meta definida para você neste mês."
                : "Nenhum membro com acesso ao sistema nesta equipe. Vincule usuários aos funcionários em Equipes."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-metas-individuais">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Vendedor</th>
                    <th className="py-2 pr-4 font-medium text-right">Meta Geral (R$)</th>
                    <th className="py-2 pr-4 font-medium text-right">Meta Cartão (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {membrosDisplay.map((membro) => {
                    const userId = membro.user_id;
                    if (!userId) return null;
                    const localMeta = metasIndividuaisLocal[userId] || { metaGeral: "0", metaCartao: "0" };
                    return (
                      <tr key={userId} className="border-b last:border-b-0" data-testid={`row-meta-${userId}`}>
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium">{membro.user_name || membro.nome}</p>
                            {membro.email && (
                              <p className="text-xs text-muted-foreground">{membro.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {canEdit && !isMonthLocked ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-36 ml-auto text-right"
                              value={localMeta.metaGeral}
                              onChange={e => handleIndividualChange(userId, 'metaGeral', e.target.value)}
                              data-testid={`input-meta-geral-${userId}`}
                            />
                          ) : (
                            <span data-testid={`text-meta-geral-${userId}`}>
                              {formatCurrency(parseFloat(localMeta.metaGeral) || 0)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {canEdit && !isMonthLocked ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-36 ml-auto text-right"
                              value={localMeta.metaCartao}
                              onChange={e => handleIndividualChange(userId, 'metaCartao', e.target.value)}
                              data-testid={`input-meta-cartao-${userId}`}
                            />
                          ) : (
                            <span data-testid={`text-meta-cartao-${userId}`}>
                              {formatCurrency(parseFloat(localMeta.metaCartao) || 0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}