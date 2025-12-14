import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Users, BarChart3, ArrowRightLeft, RotateCcw, Search, 
  User, Filter, ChevronDown, CheckCircle2, XCircle, Phone
} from "lucide-react";
import { 
  LEAD_MARKERS, 
  LEAD_MARKER_LABELS,
  type LeadMarker,
} from "@shared/schema";

interface MarkerSummary {
  count: number;
  somaMargens: number;
  somaPropostas: number;
}

interface UserSummary {
  userId: number;
  userName: string;
  totals: Record<LeadMarker, number>;
  totalLeads: number;
  somaMargens: number;
  somaPropostas: number;
}

interface PipelineOverview {
  totals: Record<LeadMarker, MarkerSummary>;
  byUser: UserSummary[];
  totalLeads: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface PipelineLead {
  id: number;
  nome: string;
  cpf: string | null;
  telefone1: string | null;
  leadMarker: LeadMarker;
  campaignNome: string;
  assignedUserName: string;
  assignedUserId: number;
  assignmentId: number;
}

const MARKER_COLORS: Record<LeadMarker, string> = {
  NOVO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  EM_ATENDIMENTO: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  INTERESSADO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  AGUARDANDO_RETORNO: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  PROPOSTA_ENVIADA: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  VENDIDO: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  NAO_ATENDE: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  TELEFONE_INVALIDO: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ENGANO: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  SEM_INTERESSE: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  RETORNAR_DEPOIS: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  TRANSFERIR: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export default function VendasGestaoPipeline() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterMarker, setFilterMarker] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [repescagemDialogOpen, setRepescagemDialogOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>("");

  const { data: overview, isLoading: loadingOverview } = useQuery<PipelineOverview>({
    queryKey: ["/api/crm/pipeline/overview"],
  });

  const { data: allLeads, isLoading: loadingLeads } = useQuery<PipelineLead[]>({
    queryKey: ["/api/crm/pipeline/all-leads", filterUserId, filterMarker],
    enabled: selectedTab === "leads",
  });

  const { data: teamMembers } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/crm/team-members"],
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async (data: { leadIds: number[]; targetUserId: number }) => {
      return apiRequest("POST", "/api/crm/pipeline/bulk-reassign", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      toast({ title: "Leads remanejados com sucesso" });
      setReassignDialogOpen(false);
      setSelectedLeads([]);
      setTargetUserId("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remanejar", description: error.message, variant: "destructive" });
    },
  });

  const repescagemMutation = useMutation({
    mutationFn: async (data: { leadIds: number[] }) => {
      return apiRequest("POST", "/api/crm/pipeline/repescagem", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      toast({ title: "Leads devolvidos ao pool" });
      setRepescagemDialogOpen(false);
      setSelectedLeads([]);
    },
    onError: (error: Error) => {
      toast({ title: "Erro na repescagem", description: error.message, variant: "destructive" });
    },
  });

  const filteredLeads = useMemo(() => {
    if (!allLeads) return [];
    let result = allLeads;
    
    if (filterUserId !== "all") {
      result = result.filter(l => l.assignedUserId === parseInt(filterUserId));
    }
    if (filterMarker !== "all") {
      result = result.filter(l => l.leadMarker === filterMarker);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(l => 
        l.nome.toLowerCase().includes(term) ||
        l.cpf?.includes(term) ||
        l.telefone1?.includes(term)
      );
    }
    return result;
  }, [allLeads, filterUserId, filterMarker, searchTerm]);

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const handleReassign = () => {
    if (!targetUserId || selectedLeads.length === 0) return;
    bulkReassignMutation.mutate({
      leadIds: selectedLeads,
      targetUserId: parseInt(targetUserId),
    });
  };

  const handleRepescagem = () => {
    if (selectedLeads.length === 0) return;
    repescagemMutation.mutate({ leadIds: selectedLeads });
  };

  if (loadingOverview && selectedTab === "overview") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Gestão de Pipeline</h1>
        <p className="text-muted-foreground">Visão macro e gerenciamento de leads da equipe</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="leads" data-testid="tab-leads">
            <Users className="h-4 w-4 mr-2" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {LEAD_MARKERS.slice(0, 6).map((marker) => (
              <Card key={marker}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    {LEAD_MARKER_LABELS[marker]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`text-total-${marker}`}>
                    {overview?.totals?.[marker]?.count ?? 0}
                  </div>
                  {overview?.totals?.[marker] && (overview.totals[marker].somaMargens > 0 || overview.totals[marker].somaPropostas > 0) && (
                    <div className="mt-1 text-xs space-y-0.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Margens:</span>
                        <span>{formatCurrency(overview.totals[marker].somaMargens)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Propostas:</span>
                        <span>{formatCurrency(overview.totals[marker].somaPropostas)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Distribuição por Corretor
              </CardTitle>
              <CardDescription>
                Quantidade de leads por estágio para cada membro da equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Corretor</TableHead>
                      {LEAD_MARKERS.slice(0, 6).map((marker) => (
                        <TableHead key={marker} className="text-center min-w-[80px]">
                          <Badge className={MARKER_COLORS[marker]} variant="outline">
                            {LEAD_MARKER_LABELS[marker].slice(0, 8)}
                          </Badge>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Margens</TableHead>
                      <TableHead className="text-center">Propostas</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview?.byUser?.map((userSummary) => (
                      <TableRow 
                        key={userSummary.userId} 
                        data-testid={`row-user-${userSummary.userId}`}
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          navigate(`/vendas/pipeline?userId=${userSummary.userId}&mode=gestor`);
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {userSummary.userName}
                          </div>
                        </TableCell>
                        {LEAD_MARKERS.slice(0, 6).map((marker) => (
                          <TableCell key={marker} className="text-center">
                            {userSummary.totals[marker] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">
                          {userSummary.totalLeads}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatCurrency(userSummary.somaMargens || 0)}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatCurrency(userSummary.somaPropostas || 0)}
                        </TableCell>
                        <TableCell>
                          <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!overview?.byUser || overview.byUser.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          Nenhum corretor com leads atribuídos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-leads"
                />
              </div>
            </div>
            <div className="min-w-[180px]">
              <Label>Corretor</Label>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger data-testid="select-filter-user">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label>Estágio</Label>
              <Select value={filterMarker} onValueChange={setFilterMarker}>
                <SelectTrigger data-testid="select-filter-marker">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {LEAD_MARKERS.map((marker) => (
                    <SelectItem key={marker} value={marker}>
                      {LEAD_MARKER_LABELS[marker]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedLeads.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedLeads.length} lead(s) selecionado(s)
              </span>
              <Button size="sm" onClick={() => setReassignDialogOpen(true)} data-testid="button-reassign">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Remanejar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRepescagemDialogOpen(true)} data-testid="button-repescagem">
                <RotateCcw className="h-4 w-4 mr-2" />
                Devolver ao Pool
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedLeads([])}>
                Limpar seleção
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {loadingLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Estágio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => (
                        <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLeadSelection(lead.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{lead.nome}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {formatPhone(lead.telefone1)}
                            </div>
                          </TableCell>
                          <TableCell>{lead.campaignNome}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {lead.assignedUserName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={MARKER_COLORS[lead.leadMarker]}>
                              {LEAD_MARKER_LABELS[lead.leadMarker]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredLeads.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum lead encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remanejar Leads</DialogTitle>
            <DialogDescription>
              Transfira {selectedLeads.length} lead(s) para outro corretor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Novo corretor</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger data-testid="select-target-user">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleReassign} 
              disabled={!targetUserId || bulkReassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {bulkReassignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={repescagemDialogOpen} onOpenChange={setRepescagemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver ao Pool</DialogTitle>
            <DialogDescription>
              {selectedLeads.length} lead(s) serão devolvidos ao pool da campanha e ficarão disponíveis para redistribuição.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepescagemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRepescagem} 
              disabled={repescagemMutation.isPending}
              data-testid="button-confirm-repescagem"
            >
              {repescagemMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
