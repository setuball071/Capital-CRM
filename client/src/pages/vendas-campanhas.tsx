import { useState } from "react";
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
import { Loader2, Plus, Upload, Users, MoreVertical, Trash2, Edit, Pause, Play } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SalesCampaign } from "@shared/schema";

export default function VendasCampanhas() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDistribuirDialog, setShowDistribuirDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<SalesCampaign | null>(null);
  const [newCampaign, setNewCampaign] = useState({ nome: "", descricao: "", convenio: "", uf: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [distribuirData, setDistribuirData] = useState({ userId: "", quantidade: 50 });

  const { data: campanhas, isLoading } = useQuery<SalesCampaign[]>({
    queryKey: ["/api/vendas/campanhas"],
  });

  const { data: vendedores } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ["/api/vendas/vendedores"],
  });

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

  const distribuirMutation = useMutation({
    mutationFn: async ({ campaignId, userId, quantidade }: { campaignId: number; userId: number; quantidade: number }) => {
      const res = await apiRequest("POST", `/api/vendas/campanhas/${campaignId}/distribuir-leads`, { userId, quantidade });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/campanhas"] });
      toast({ title: `Distribuídos ${data.quantidade} leads!` });
      setShowDistribuirDialog(false);
      setDistribuirData({ userId: "", quantidade: 50 });
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

      <Dialog open={showDistribuirDialog} onOpenChange={setShowDistribuirDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir Leads</DialogTitle>
            <DialogDescription>
              Distribua leads da campanha "{selectedCampaign?.nome}" para um vendedor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendedor</Label>
              <Select
                value={distribuirData.userId}
                onValueChange={(v) => setDistribuirData({ ...distribuirData, userId: v })}
              >
                <SelectTrigger data-testid="select-vendedor">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores?.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name} ({v.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade de Leads</Label>
              <Input
                type="number"
                min={1}
                max={selectedCampaign?.leadsDisponiveis || 100}
                value={distribuirData.quantidade}
                onChange={(e) => setDistribuirData({ ...distribuirData, quantidade: parseInt(e.target.value) || 1 })}
                data-testid="input-quantidade-leads"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCampaign?.leadsDisponiveis || 0} leads disponíveis
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistribuirDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedCampaign && distribuirData.userId) {
                  distribuirMutation.mutate({
                    campaignId: selectedCampaign.id,
                    userId: parseInt(distribuirData.userId),
                    quantidade: distribuirData.quantidade,
                  });
                }
              }}
              disabled={!distribuirData.userId || distribuirMutation.isPending}
              data-testid="button-distribuir-leads"
            >
              {distribuirMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Distribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
