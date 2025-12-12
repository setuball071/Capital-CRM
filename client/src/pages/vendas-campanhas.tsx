import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Upload, Users, MoreVertical, Trash2, Pause, Play, Eye, RotateCcw, ArrowRightLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SalesCampaign } from "@shared/schema";

interface Vendedor {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface DistributionItem {
  userId: number;
  quantidade: number;
  selected: boolean;
}

interface DistributionStat {
  userId: number;
  userName: string;
  total: number;
  novo: number;
  emAtendimento: number;
  concluido: number;
}

export default function VendasCampanhas() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDistribuirDialog, setShowDistribuirDialog] = useState(false);
  const [showDistribuidosDialog, setShowDistribuidosDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<SalesCampaign | null>(null);
  const [selectedUserForTransfer, setSelectedUserForTransfer] = useState<DistributionStat | null>(null);
  const [newCampaign, setNewCampaign] = useState({ nome: "", descricao: "", convenio: "", uf: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [transferToUserId, setTransferToUserId] = useState<string>("");
  const [transferQuantidade, setTransferQuantidade] = useState<number>(1);

  const { data: campanhas, isLoading } = useQuery<SalesCampaign[]>({
    queryKey: ["/api/vendas/campanhas"],
  });

  const { data: vendedores } = useQuery<Vendedor[]>({
    queryKey: ["/api/vendas/vendedores"],
  });

  const { data: distributionStats, refetch: refetchDistributionStats } = useQuery<DistributionStat[]>({
    queryKey: ["/api/vendas/campanhas", selectedCampaign?.id, "distribuicao"],
    enabled: !!selectedCampaign && showDistribuidosDialog,
  });

  useEffect(() => {
    if (vendedores && showDistribuirDialog) {
      setDistributions(
        vendedores.map((v) => ({
          userId: v.id,
          quantidade: 0,
          selected: false,
        }))
      );
    }
  }, [vendedores, showDistribuirDialog]);

  const selectedVendedores = useMemo(() => {
    return distributions.filter((d) => d.selected);
  }, [distributions]);

  const totalQuantidade = useMemo(() => {
    return distributions.reduce((acc, d) => acc + (d.selected ? d.quantidade : 0), 0);
  }, [distributions]);

  const leadsDisponiveis = selectedCampaign?.leadsDisponiveis || 0;

  const handleToggleVendedor = (userId: number) => {
    setDistributions((prev) => {
      const updated = prev.map((d) =>
        d.userId === userId ? { ...d, selected: !d.selected } : d
      );
      const selectedCount = updated.filter((d) => d.selected).length;
      if (selectedCount > 0) {
        const equalAmount = Math.floor(leadsDisponiveis / selectedCount);
        return updated.map((d) =>
          d.selected ? { ...d, quantidade: equalAmount } : { ...d, quantidade: 0 }
        );
      }
      return updated;
    });
  };

  const handleQuantidadeChange = (userId: number, quantidade: number) => {
    setDistributions((prev) =>
      prev.map((d) => (d.userId === userId ? { ...d, quantidade: Math.max(0, quantidade) } : d))
    );
  };

  const handleDistribuirEqual = () => {
    const selectedCount = selectedVendedores.length;
    if (selectedCount === 0) return;
    
    const equalAmount = Math.floor(leadsDisponiveis / selectedCount);
    setDistributions((prev) =>
      prev.map((d) => (d.selected ? { ...d, quantidade: equalAmount } : d))
    );
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof newCampaign) => {
      return apiRequest("POST", "/api/vendas/campanhas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: "Campanha criada com sucesso!" });
      setShowCreateDialog(false);
      setNewCampaign({ nome: "", descricao: "", convenio: "", uf: "" });
    },
    onError: () => {
      toast({ title: "Erro ao criar campanha", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SalesCampaign> }) => {
      return apiRequest("PATCH", `/api/vendas/campanhas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: "Campanha atualizada!" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ campaignId, file }: { campaignId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/vendas/campanhas/${campaignId}/importar-leads`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao importar");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: `Importados ${data.importados} leads!` });
      setShowImportDialog(false);
      setImportFile(null);
    },
    onError: () => {
      toast({ title: "Erro ao importar leads", variant: "destructive" });
    },
  });

  const distribuirMultiMutation = useMutation({
    mutationFn: async ({ campaignId, distributions }: { campaignId: number; distributions: { userId: number; quantidade: number }[] }) => {
      const res = await apiRequest("POST", `/api/vendas/campanhas/${campaignId}/distribuir-multi`, { distributions });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: `Distribuídos ${data.totalDistribuido} leads para ${data.distribuicoes?.length || 0} vendedores!` });
      setShowDistribuirDialog(false);
      setDistributions([]);
      setSelectedCampaign(null);
    },
    onError: () => {
      toast({ title: "Erro ao distribuir leads", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/vendas/campanhas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: "Campanha excluída!" });
    },
  });

  const devolverPoolMutation = useMutation({
    mutationFn: async ({ campaignId, userId }: { campaignId: number; userId: number }) => {
      const res = await apiRequest("POST", `/api/vendas/campanhas/${campaignId}/devolver-pool`, { userId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      refetchDistributionStats();
      toast({ title: `Devolvidos ${data.quantidade} leads ao pool!` });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Erro ao devolver leads", variant: "destructive" });
    },
  });

  const transferirMutation = useMutation({
    mutationFn: async ({ campaignId, fromUserId, toUserId, quantidade }: { campaignId: number; fromUserId: number; toUserId: number; quantidade: number }) => {
      const res = await apiRequest("POST", `/api/vendas/campanhas/${campaignId}/transferir`, { fromUserId, toUserId, quantidade });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      refetchDistributionStats();
      toast({ title: `Transferidos ${data.quantidade} leads!` });
      setShowTransferDialog(false);
      setSelectedUserForTransfer(null);
      setTransferToUserId("");
      setTransferQuantidade(1);
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Erro ao transferir leads", variant: "destructive" });
    },
  });

  const handleDistribuirSubmit = () => {
    if (!selectedCampaign) return;
    
    const validDistributions = distributions
      .filter((d) => d.selected && d.quantidade > 0)
      .map((d) => ({ userId: d.userId, quantidade: d.quantidade }));
    
    if (validDistributions.length === 0) {
      toast({ title: "Selecione pelo menos um vendedor com quantidade", variant: "destructive" });
      return;
    }
    
    if (totalQuantidade > leadsDisponiveis) {
      toast({ title: "Quantidade total excede leads disponíveis", variant: "destructive" });
      return;
    }
    
    distribuirMultiMutation.mutate({
      campaignId: selectedCampaign.id,
      distributions: validDistributions,
    });
  };

  const handleDevolverPool = (stat: DistributionStat) => {
    if (!selectedCampaign) return;
    if (stat.novo === 0) {
      toast({ title: "Nenhum lead com status 'novo' para devolver", variant: "destructive" });
      return;
    }
    devolverPoolMutation.mutate({
      campaignId: selectedCampaign.id,
      userId: stat.userId,
    });
  };

  const handleOpenTransferDialog = (stat: DistributionStat) => {
    setSelectedUserForTransfer(stat);
    setTransferQuantidade(Math.min(stat.novo + stat.emAtendimento, 1));
    setShowTransferDialog(true);
  };

  const handleTransferSubmit = () => {
    if (!selectedCampaign || !selectedUserForTransfer || !transferToUserId) return;
    
    transferirMutation.mutate({
      campaignId: selectedCampaign.id,
      fromUserId: selectedUserForTransfer.userId,
      toUserId: parseInt(transferToUserId),
      quantidade: transferQuantidade,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ativa: "default",
      pausada: "secondary",
      encerrada: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-vendas-campanhas">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas de Vendas</h1>
          <p className="text-muted-foreground">Gerencie campanhas e distribua leads para vendedores</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-nova-campanha">
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-campanhas">{campanhas?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-leads">
              {campanhas?.reduce((acc, c) => acc + (c.totalLeads || 0), 0) || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-leads-disponiveis">
              {campanhas?.reduce((acc, c) => acc + (c.leadsDisponiveis || 0), 0) || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Disponíveis</TableHead>
                <TableHead className="text-right">Distribuídos</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas?.map((campanha) => (
                <TableRow key={campanha.id} data-testid={`row-campanha-${campanha.id}`}>
                  <TableCell className="font-medium">{campanha.nome}</TableCell>
                  <TableCell>{campanha.convenio || "-"}</TableCell>
                  <TableCell>{campanha.uf || "-"}</TableCell>
                  <TableCell>{getStatusBadge(campanha.status)}</TableCell>
                  <TableCell className="text-right">{campanha.totalLeads}</TableCell>
                  <TableCell className="text-right">{campanha.leadsDisponiveis}</TableCell>
                  <TableCell className="text-right">{campanha.leadsDistribuidos}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedCampaign(campanha);
                          setShowDistribuidosDialog(true);
                        }}
                        disabled={(campanha.leadsDistribuidos || 0) === 0}
                        data-testid={`button-ver-distribuidos-${campanha.id}`}
                        title="Ver Distribuídos"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${campanha.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCampaign(campanha);
                              setShowImportDialog(true);
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Importar Leads
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCampaign(campanha);
                              setShowDistribuirDialog(true);
                            }}
                            disabled={(campanha.leadsDisponiveis || 0) === 0}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Distribuir Leads
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCampaign(campanha);
                              setShowDistribuidosDialog(true);
                            }}
                            disabled={(campanha.leadsDistribuidos || 0) === 0}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Distribuídos
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const newStatus = campanha.status === "ativa" ? "pausada" : "ativa";
                              updateMutation.mutate({ id: campanha.id, data: { status: newStatus } });
                            }}
                          >
                            {campanha.status === "ativa" ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir esta campanha?")) {
                                deleteMutation.mutate(campanha.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!campanhas || campanhas.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma campanha encontrada. Clique em "Nova Campanha" para criar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Crie uma nova campanha de vendas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha *</Label>
              <Input
                value={newCampaign.nome}
                onChange={(e) => setNewCampaign({ ...newCampaign, nome: e.target.value })}
                placeholder="Ex: Campanha INSS Dezembro"
                data-testid="input-nome-campanha"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newCampaign.descricao}
                onChange={(e) => setNewCampaign({ ...newCampaign, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Convênio</Label>
                <Input
                  value={newCampaign.convenio}
                  onChange={(e) => setNewCampaign({ ...newCampaign, convenio: e.target.value })}
                  placeholder="Ex: INSS"
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={newCampaign.uf}
                  onChange={(e) => setNewCampaign({ ...newCampaign, uf: e.target.value })}
                  placeholder="Ex: SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(newCampaign)}
              disabled={!newCampaign.nome || createMutation.isPending}
              data-testid="button-criar-campanha"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Leads</DialogTitle>
            <DialogDescription>
              Importe leads para a campanha "{selectedCampaign?.nome}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Arquivo Excel ou CSV</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                data-testid="input-file-leads"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Colunas aceitas: nome (obrigatório), cpf, telefone_1, telefone_2, telefone_3, email, cidade, uf, observacoes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedCampaign && importFile) {
                  importMutation.mutate({ campaignId: selectedCampaign.id, file: importFile });
                }
              }}
              disabled={!importFile || importMutation.isPending}
              data-testid="button-importar-leads"
            >
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDistribuirDialog} onOpenChange={(open) => {
        setShowDistribuirDialog(open);
        if (!open) {
          setDistributions([]);
          setSelectedCampaign(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Distribuir Leads</DialogTitle>
            <DialogDescription>
              Distribua leads da campanha "{selectedCampaign?.nome}" para os vendedores selecionados
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{leadsDisponiveis}</span> leads disponíveis para distribuição
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDistribuirEqual}
                disabled={selectedVendedores.length === 0}
                data-testid="button-distribuir-igual"
              >
                Distribuir Igualmente
              </Button>
            </div>

            <div className="border rounded-md max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Selecionar</TableHead>
                    <TableHead>Nome do Vendedor</TableHead>
                    <TableHead className="w-32">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedores?.map((vendedor) => {
                    const dist = distributions.find((d) => d.userId === vendedor.id);
                    const isSelected = dist?.selected || false;
                    const quantidade = dist?.quantidade || 0;
                    
                    return (
                      <TableRow key={vendedor.id} data-testid={`row-vendedor-${vendedor.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleVendedor(vendedor.id)}
                            data-testid={`checkbox-vendedor-${vendedor.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{vendedor.name}</p>
                            <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={leadsDisponiveis}
                            value={quantidade}
                            onChange={(e) => handleQuantidadeChange(vendedor.id, parseInt(e.target.value) || 0)}
                            disabled={!isSelected}
                            className="w-24"
                            data-testid={`input-quantidade-${vendedor.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!vendedores || vendedores.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nenhum vendedor disponível
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-md ${
              totalQuantidade > leadsDisponiveis ? "bg-destructive/10" : "bg-muted"
            }`}>
              <p className="text-sm font-medium">
                Total: <span className={totalQuantidade > leadsDisponiveis ? "text-destructive" : ""}>{totalQuantidade}</span> / {leadsDisponiveis} disponíveis
              </p>
              {totalQuantidade > leadsDisponiveis && (
                <p className="text-sm text-destructive">Quantidade excede o disponível</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistribuirDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDistribuirSubmit}
              disabled={
                selectedVendedores.length === 0 ||
                totalQuantidade === 0 ||
                totalQuantidade > leadsDisponiveis ||
                distribuirMultiMutation.isPending
              }
              data-testid="button-confirmar-distribuicao"
            >
              {distribuirMultiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Distribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDistribuidosDialog} onOpenChange={(open) => {
        setShowDistribuidosDialog(open);
        if (!open) {
          setSelectedCampaign(null);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Leads Distribuídos - {selectedCampaign?.nome}</DialogTitle>
            <DialogDescription>
              Visualize e gerencie os leads distribuídos para cada vendedor
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-md max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Novos</TableHead>
                  <TableHead className="text-right">Em Atendimento</TableHead>
                  <TableHead className="text-right">Concluídos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributionStats?.map((stat) => (
                  <TableRow key={stat.userId} data-testid={`row-dist-${stat.userId}`}>
                    <TableCell className="font-medium">{stat.userName}</TableCell>
                    <TableCell className="text-right">{stat.total}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{stat.novo}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">{stat.emAtendimento}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{stat.concluido}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDevolverPool(stat)}
                          disabled={stat.novo === 0 || devolverPoolMutation.isPending}
                          title="Devolver leads novos ao pool"
                          data-testid={`button-devolver-${stat.userId}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Devolver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenTransferDialog(stat)}
                          disabled={(stat.novo + stat.emAtendimento) === 0}
                          title="Transferir leads para outro vendedor"
                          data-testid={`button-transferir-${stat.userId}`}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-1" />
                          Transferir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!distributionStats || distributionStats.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum lead distribuído nesta campanha
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistribuidosDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog} onOpenChange={(open) => {
        setShowTransferDialog(open);
        if (!open) {
          setSelectedUserForTransfer(null);
          setTransferToUserId("");
          setTransferQuantidade(1);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Leads</DialogTitle>
            <DialogDescription>
              Transferir leads de {selectedUserForTransfer?.userName} para outro vendedor
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Vendedor de Destino</Label>
              <Select value={transferToUserId} onValueChange={setTransferToUserId}>
                <SelectTrigger data-testid="select-vendedor-destino">
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores?.filter(v => v.id !== selectedUserForTransfer?.userId).map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id.toString()}>
                      {vendedor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={(selectedUserForTransfer?.novo || 0) + (selectedUserForTransfer?.emAtendimento || 0)}
                value={transferQuantidade}
                onChange={(e) => setTransferQuantidade(parseInt(e.target.value) || 1)}
                data-testid="input-quantidade-transferir"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Máximo: {(selectedUserForTransfer?.novo || 0) + (selectedUserForTransfer?.emAtendimento || 0)} leads disponíveis
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={!transferToUserId || transferQuantidade < 1 || transferirMutation.isPending}
              data-testid="button-confirmar-transferencia"
            >
              {transferirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Transferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
