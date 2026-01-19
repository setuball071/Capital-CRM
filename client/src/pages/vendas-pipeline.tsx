import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, Phone, MessageSquare, User, Building, Calendar, 
  Clock, ChevronRight, GripVertical, Search, Filter, X, 
  ArrowRight, Check, Copy, ArrowLeft, Trash2
} from "lucide-react";
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
  LEAD_MARKERS, 
  LEAD_MARKER_LABELS, 
  MARKERS_REQUIRING_MOTIVO,
  type SalesLead, 
  type LeadMarker,
  type LeadContact,
} from "@shared/schema";

interface PipelineLead {
  id: number;
  nome: string;
  cpf: string | null;
  telefone1: string | null;
  telefone2: string | null;
  telefone3: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  leadMarker: LeadMarker;
  retornoEm: string | null;
  motivo: string | null;
  ultimoContatoEm: string | null;
  ultimoTipoContato: string | null;
  campaignId: number;
  campaignNome: string;
  assignmentId: number;
}

interface ColumnSummary {
  count: number;
  somaMargens: number;
  somaPropostas: number;
}

interface PipelineData {
  leads: PipelineLead[];
  summary: Record<LeadMarker, ColumnSummary>;
}

interface LeadInteractionHistory {
  id: number;
  tipoContato: string;
  leadMarker: string;
  motivo: string | null;
  observacao: string | null;
  retornoEm: string | null;
  margemValor: string | null;
  propostaValorEstimado: string | null;
  createdAt: string;
  userName: string;
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

const KANBAN_COLUMNS: LeadMarker[] = [
  "NOVO",
  "EM_ATENDIMENTO", 
  "INTERESSADO",
  "AGUARDANDO_RETORNO",
  "PROPOSTA_ENVIADA",
  "VENDIDO",
];

const KANBAN_COLUMNS_SECONDARY: LeadMarker[] = [
  "NAO_ATENDE",
  "TELEFONE_INVALIDO",
  "ENGANO",
  "SEM_INTERESSE",
  "RETORNAR_DEPOIS",
  "TRANSFERIR",
];

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

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

interface LeadCardProps {
  lead: PipelineLead;
  onCardClick: (lead: PipelineLead) => void;
  onDragStart: (e: React.DragEvent, lead: PipelineLead) => void;
}

function LeadCard({ lead, onCardClick, onDragStart }: LeadCardProps) {
  return (
    <Card 
      className="cursor-pointer hover-elevate mb-2"
      onClick={() => onCardClick(lead)}
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      data-testid={`card-lead-${lead.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 cursor-grab" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" data-testid={`text-lead-nome-${lead.id}`}>
              {lead.nome}
            </p>
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${lead.telefone1 ? 'text-primary font-medium' : 'text-muted-foreground italic'}`}>
              <Phone className="h-3 w-3" />
              {lead.telefone1 ? formatPhone(lead.telefone1) : 'Sem telefone'}
            </p>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {lead.campaignNome}
              </Badge>
              {lead.retornoEm && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(lead.retornoEm)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface KanbanColumnProps {
  marker: LeadMarker;
  leads: PipelineLead[];
  summary: ColumnSummary | undefined;
  onCardClick: (lead: PipelineLead) => void;
  onDragStart: (e: React.DragEvent, lead: PipelineLead) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, marker: LeadMarker) => void;
}

function KanbanColumn({ marker, leads, summary, onCardClick, onDragStart, onDragOver, onDrop }: KanbanColumnProps) {
  return (
    <div 
      className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, marker)}
      data-testid={`column-${marker}`}
    >
      <div className="p-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <Badge className={MARKER_COLORS[marker]}>
            {LEAD_MARKER_LABELS[marker]}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">{leads.length}</span>
        </div>
        {summary && (summary.somaMargens > 0 || summary.somaPropostas > 0) && (
          <div className="mt-2 text-xs space-y-0.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Margens:</span>
              <span className="font-medium text-foreground">{formatCurrency(summary.somaMargens)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Propostas:</span>
              <span className="font-medium text-foreground">{formatCurrency(summary.somaPropostas)}</span>
            </div>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              onCardClick={onCardClick}
              onDragStart={onDragStart}
            />
          ))}
          {leads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum lead
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function VendasPipeline() {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  
  // Parse query params
  const searchParams = new URLSearchParams(searchString);
  const viewUserId = searchParams.get("userId");
  const isGestorMode = searchParams.get("mode") === "gestor";
  
  // Check if user can view other pipelines
  const canViewOthers = user && ["master", "atendimento", "coordenacao"].includes(user.role);

  // Fetch team members for filter dropdown
  const { data: teamMembers } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/crm/team-members"],
    enabled: !!canViewOthers,
  });

  // Handler to change corretor filter
  const handleCorretorChange = (value: string) => {
    if (value === "__my_pipeline__") {
      navigate("/vendas/pipeline");
    } else {
      navigate(`/vendas/pipeline?userId=${value}`);
    }
  };
  
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<PipelineLead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<PipelineLead | null>(null);
  const [addObsDialogOpen, setAddObsDialogOpen] = useState(false);
  const [newObservacao, setNewObservacao] = useState("");
  const [newTipoContato, setNewTipoContato] = useState("observacao");
  
  const [newMarker, setNewMarker] = useState<LeadMarker>("EM_ATENDIMENTO");
  const [tipoContato, setTipoContato] = useState<string>("ligacao");
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [retornoEm, setRetornoEm] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [margemValor, setMargemValor] = useState<string>("");
  const [propostaValorEstimado, setPropostaValorEstimado] = useState<string>("");
  const [leadContacts, setLeadContacts] = useState<LeadContact[]>([]);
  const [leadInteractions, setLeadInteractions] = useState<LeadInteractionHistory[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  // Build API URL with optional userId
  const pipelineApiUrl = viewUserId ? `/api/crm/pipeline?userId=${viewUserId}` : "/api/crm/pipeline";

  const { data: pipelineData, isLoading } = useQuery<PipelineData>({
    queryKey: ["/api/crm/pipeline", viewUserId],
    queryFn: async () => {
      const res = await fetch(pipelineApiUrl);
      if (!res.ok) throw new Error("Erro ao carregar pipeline");
      return res.json();
    },
  });

  const moveStageMutation = useMutation({
    mutationFn: async (data: { 
      leadId: number; 
      marker: LeadMarker; 
      tipoContato: string;
      observacao?: string;
      motivo?: string;
      retornoEm?: string;
      contactId?: number;
      margemValor: string;
      propostaValorEstimado: string;
    }) => {
      return apiRequest("PATCH", `/api/crm/leads/${data.leadId}/stage`, {
        marker: data.marker,
        tipoContato: data.tipoContato,
        observacao: data.observacao,
        motivo: data.motivo,
        retornoEm: data.retornoEm,
        contactId: data.contactId,
        margemValor: data.margemValor,
        propostaValorEstimado: data.propostaValorEstimado,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      toast({ title: "Lead movido com sucesso" });
      setMoveDialogOpen(false);
      setDetailsOpen(false);
      resetMoveForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao mover lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const res = await apiRequest("DELETE", `/api/crm/leads/${leadId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao excluir lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      toast({ title: "Lead excluído com sucesso" });
      setDeleteDialogOpen(false);
      setDetailsOpen(false);
      setLeadToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lead", description: error.message, variant: "destructive" });
    },
  });

  const addObservationMutation = useMutation({
    mutationFn: async (data: { leadId: number; observacao: string; tipoContato: string }) => {
      return apiRequest("POST", `/api/crm/leads/${data.leadId}/observation`, {
        observacao: data.observacao,
        tipoContato: data.tipoContato,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      toast({ title: "Observação adicionada com sucesso" });
      setAddObsDialogOpen(false);
      setNewObservacao("");
      setNewTipoContato("observacao");
      // Recarregar interações
      if (selectedLead) {
        fetch(`/api/crm/leads/${selectedLead.id}/interactions`)
          .then(res => res.ok ? res.json() : [])
          .then(data => setLeadInteractions(data))
          .catch(() => {});
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar observação", description: error.message, variant: "destructive" });
    },
  });

  const handleAddObservation = () => {
    if (!selectedLead || !newObservacao.trim()) {
      toast({ title: "Digite uma observação", variant: "destructive" });
      return;
    }
    addObservationMutation.mutate({
      leadId: selectedLead.id,
      observacao: newObservacao.trim(),
      tipoContato: newTipoContato,
    });
  };

  const handleDeleteLead = () => {
    if (leadToDelete) {
      deleteLeadMutation.mutate(leadToDelete.id);
    }
  };

  const openDeleteDialog = (lead: PipelineLead) => {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  };

  const resetMoveForm = () => {
    setNewMarker("EM_ATENDIMENTO");
    setTipoContato("ligacao");
    setObservacao("");
    setMotivo("");
    setRetornoEm("");
    setContactId("");
    setMargemValor("");
    setPropostaValorEstimado("");
    setLeadContacts([]);
  };

  useEffect(() => {
    if (detailsOpen && selectedLead) {
      setLoadingInteractions(true);
      fetch(`/api/crm/leads/${selectedLead.id}/interactions`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setLeadInteractions(data))
        .catch(() => setLeadInteractions([]))
        .finally(() => setLoadingInteractions(false));
    } else {
      setLeadInteractions([]);
    }
  }, [detailsOpen, selectedLead]);

  const handleCardClick = (lead: PipelineLead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, lead: PipelineLead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, marker: LeadMarker) => {
    e.preventDefault();
    if (!draggedLead) return;
    
    if (draggedLead.leadMarker === marker) {
      setDraggedLead(null);
      return;
    }

    // Não permitir mover para NOVO
    if (marker === "NOVO") {
      setDraggedLead(null);
      toast({ title: "Não é possível mover para NOVO", variant: "destructive" });
      return;
    }

    // Para marcadores que exigem motivo, abrir modal
    if (MARKERS_REQUIRING_MOTIVO.includes(marker)) {
      setSelectedLead(draggedLead);
      setNewMarker(marker);
      setMoveDialogOpen(true);
      
      // Buscar contatos do lead
      try {
        const response = await fetch(`/api/crm/leads/${draggedLead.id}/contacts`);
        if (response.ok) {
          const contacts = await response.json();
          setLeadContacts(contacts);
          const primary = contacts.find((c: LeadContact) => c.isPrimary);
          if (primary) {
            setContactId(String(primary.id));
          } else if (contacts.length > 0) {
            setContactId(String(contacts[0].id));
          }
        }
      } catch (error) {
        console.error("Erro ao buscar contatos:", error);
      }
      
      setDraggedLead(null);
      return;
    }

    // Movimentação direta sem modal para marcadores normais
    const leadToMove = draggedLead;
    setDraggedLead(null);
    
    try {
      const response = await fetch(`/api/crm/leads/${leadToMove.id}/move-quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marker }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast({ title: error.message || "Erro ao mover lead", variant: "destructive" });
        return;
      }
      
      toast({ title: `Lead movido para ${LEAD_MARKER_LABELS[marker]}` });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
    } catch (error) {
      console.error("Erro ao mover lead:", error);
      toast({ title: "Erro ao mover lead", variant: "destructive" });
    }
  };

  const handleMoveSubmit = () => {
    if (!selectedLead) return;
    
    if (MARKERS_REQUIRING_MOTIVO.includes(newMarker) && !motivo.trim()) {
      toast({ title: "Motivo é obrigatório", variant: "destructive" });
      return;
    }

    if (leadContacts.length > 0 && !contactId) {
      toast({ title: "Selecione o contato utilizado", variant: "destructive" });
      return;
    }

    if (!margemValor || parseFloat(margemValor) < 0) {
      toast({ title: "Informe a margem (valor)", variant: "destructive" });
      return;
    }

    if (!propostaValorEstimado || parseFloat(propostaValorEstimado) < 0) {
      toast({ title: "Informe o valor estimado da proposta", variant: "destructive" });
      return;
    }

    moveStageMutation.mutate({
      leadId: selectedLead.id,
      marker: newMarker,
      tipoContato,
      observacao: observacao.trim() || undefined,
      motivo: motivo.trim() || undefined,
      retornoEm: retornoEm || undefined,
      contactId: contactId ? parseInt(contactId) : undefined,
      margemValor,
      propostaValorEstimado,
    });
  };

  const openMoveDialog = async (lead: PipelineLead) => {
    setSelectedLead(lead);
    // Se o lead está em NOVO, mover para EM_ATENDIMENTO por padrão
    setNewMarker(lead.leadMarker === "NOVO" ? "EM_ATENDIMENTO" : lead.leadMarker);
    setMoveDialogOpen(true);
    
    // Buscar contatos do lead
    try {
      const response = await fetch(`/api/crm/leads/${lead.id}/contacts`);
      if (response.ok) {
        const contacts = await response.json();
        setLeadContacts(contacts);
        // Se tiver contato primário, selecionar automaticamente
        const primary = contacts.find((c: LeadContact) => c.isPrimary);
        if (primary) {
          setContactId(String(primary.id));
        } else if (contacts.length > 0) {
          setContactId(String(contacts[0].id));
        }
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!pipelineData?.leads) return [];
    if (!searchTerm.trim()) return pipelineData.leads;
    
    const term = searchTerm.toLowerCase();
    return pipelineData.leads.filter(lead => 
      lead.nome.toLowerCase().includes(term) ||
      lead.cpf?.includes(term) ||
      lead.telefone1?.includes(term) ||
      lead.campaignNome.toLowerCase().includes(term)
    );
  }, [pipelineData?.leads, searchTerm]);

  const leadsByMarker = useMemo(() => {
    const grouped: Record<LeadMarker, PipelineLead[]> = {} as Record<LeadMarker, PipelineLead[]>;
    LEAD_MARKERS.forEach(marker => {
      grouped[marker] = [];
    });
    filteredLeads.forEach(lead => {
      if (grouped[lead.leadMarker as LeadMarker]) {
        grouped[lead.leadMarker as LeadMarker].push(lead);
      }
    });
    return grouped;
  }, [filteredLeads]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {isGestorMode && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => navigate("/vendas/gestao-pipeline")}
                data-testid="button-back-to-gestao"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                {isGestorMode ? "Pipeline do Corretor" : "Meu Pipeline"}
              </h1>
              <p className="text-muted-foreground">
                {isGestorMode 
                  ? "Visualizando pipeline de outro usuário (somente leitura para gestão)"
                  : "Gerencie seus leads arrastando entre as colunas"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canViewOthers && teamMembers && teamMembers.length > 0 && (
              <Select value={viewUserId || "__my_pipeline__"} onValueChange={handleCorretorChange}>
                <SelectTrigger className="w-48" data-testid="select-corretor">
                  <SelectValue placeholder="Meu Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__my_pipeline__">Meu Pipeline</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lead..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search"
              />
              {searchTerm && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant={showSecondary ? "secondary" : "outline"}
              onClick={() => setShowSecondary(!showSecondary)}
              data-testid="button-toggle-secondary"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showSecondary ? "Ocultar descarte" : "Ver descarte"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 min-w-max h-full">
          {KANBAN_COLUMNS.map((marker) => (
            <KanbanColumn
              key={marker}
              marker={marker}
              leads={leadsByMarker[marker] || []}
              summary={pipelineData?.summary?.[marker]}
              onCardClick={handleCardClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
          {showSecondary && (
            <>
              <Separator orientation="vertical" className="mx-2" />
              {KANBAN_COLUMNS_SECONDARY.map((marker) => (
                <KanbanColumn
                  key={marker}
                  marker={marker}
                  leads={leadsByMarker[marker] || []}
                  summary={pipelineData?.summary?.[marker]}
                  onCardClick={handleCardClick}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Lead
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold">{selectedLead.nome}</p>
                <Badge className={MARKER_COLORS[selectedLead.leadMarker]}>
                  {LEAD_MARKER_LABELS[selectedLead.leadMarker]}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">CPF</Label>
                  <div className="flex items-center gap-1">
                    {selectedLead.cpf ? (
                      <a 
                        href={`/vendas/consulta?cpf=${selectedLead.cpf.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                        data-testid="link-cpf-consulta"
                      >
                        {formatCPF(selectedLead.cpf)}
                      </a>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Campanha</Label>
                  <p>{selectedLead.campaignNome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone 1
                  </Label>
                  <div className="flex items-center gap-1">
                    <p className={selectedLead.telefone1 ? 'text-primary font-medium' : ''}>
                      {formatPhone(selectedLead.telefone1)}
                    </p>
                    {selectedLead.telefone1 && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedLead.telefone1!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone 2
                  </Label>
                  <div className="flex items-center gap-1">
                    <p className={selectedLead.telefone2 ? 'text-primary font-medium' : ''}>
                      {formatPhone(selectedLead.telefone2)}
                    </p>
                    {selectedLead.telefone2 && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedLead.telefone2!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {selectedLead.telefone3 && (
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone 3
                    </Label>
                    <div className="flex items-center gap-1">
                      <p className="text-primary font-medium">{formatPhone(selectedLead.telefone3)}</p>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(selectedLead.telefone3!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Cidade/UF</Label>
                  <p>{selectedLead.cidade || "-"} {selectedLead.uf ? `/ ${selectedLead.uf}` : ""}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Retorno agendado</Label>
                  <p>{formatDateTime(selectedLead.retornoEm)}</p>
                </div>
              </div>

              {selectedLead.observacoes && (
                <div>
                  <Label className="text-muted-foreground">Observações</Label>
                  <p className="text-sm">{selectedLead.observacoes}</p>
                </div>
              )}

              {selectedLead.ultimoContatoEm && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Último contato: {formatDateTime(selectedLead.ultimoContatoEm)}
                  {selectedLead.ultimoTipoContato && ` (${selectedLead.ultimoTipoContato})`}
                </div>
              )}

              <Separator />
              
              <div>
                <Label className="text-muted-foreground mb-2 block">Histórico de Interações</Label>
                {loadingInteractions ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : leadInteractions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma interação registrada</p>
                ) : (
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {leadInteractions.map((interaction) => (
                        <div key={interaction.id} className="text-xs border rounded p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-xs">
                              {LEAD_MARKER_LABELS[interaction.leadMarker as LeadMarker] || interaction.leadMarker}
                            </Badge>
                            <span className="text-muted-foreground">{formatDateTime(interaction.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{interaction.tipoContato}</span>
                            <span>|</span>
                            <span>{interaction.userName}</span>
                          </div>
                          {(interaction.margemValor || interaction.propostaValorEstimado) && (
                            <div className="flex gap-3 text-muted-foreground">
                              {interaction.margemValor && <span>Margem: {formatCurrency(parseFloat(interaction.margemValor))}</span>}
                              {interaction.propostaValorEstimado && <span>Proposta: {formatCurrency(parseFloat(interaction.propostaValorEstimado))}</span>}
                            </div>
                          )}
                          {interaction.observacao && (
                            <p className="text-muted-foreground">{interaction.observacao}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button 
              variant="destructive" 
              onClick={() => openDeleteDialog(selectedLead!)}
              className="mr-auto"
              data-testid="button-delete-lead"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setAddObsDialogOpen(true)}
              data-testid="button-add-observation"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Adicionar Observação
            </Button>
            <Button onClick={() => { setDetailsOpen(false); openMoveDialog(selectedLead!); }}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Mover estágio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{leadToDelete?.nome}</strong>? 
              Esta ação não pode ser desfeita e todas as interações associadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeadToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLead}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLeadMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteLeadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de adicionar observação */}
      <Dialog open={addObsDialogOpen} onOpenChange={setAddObsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Adicionar Observação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Contato</Label>
              <Select value={newTipoContato} onValueChange={setNewTipoContato}>
                <SelectTrigger data-testid="select-obs-tipo-contato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observacao">Observação Interna</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observação *</Label>
              <Textarea
                value={newObservacao}
                onChange={(e) => setNewObservacao(e.target.value)}
                placeholder="Digite sua observação ou registro de interação..."
                rows={4}
                data-testid="input-obs-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddObsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddObservation}
              disabled={addObservationMutation.isPending || !newObservacao.trim()}
              data-testid="button-confirm-add-obs"
            >
              {addObservationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Marcador do Lead *</Label>
              <Select value={newMarker} onValueChange={(v) => setNewMarker(v as LeadMarker)}>
                <SelectTrigger data-testid="select-new-marker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_MARKERS.filter(marker => marker !== "NOVO").map((marker) => (
                    <SelectItem key={marker} value={marker}>
                      {LEAD_MARKER_LABELS[marker]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contato utilizado *</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger data-testid="select-contact">
                  <SelectValue placeholder="Selecione o contato" />
                </SelectTrigger>
                <SelectContent>
                  {leadContacts.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum contato cadastrado</SelectItem>
                  ) : (
                    leadContacts.map((contact) => (
                      <SelectItem key={contact.id} value={String(contact.id)}>
                        {contact.type === "phone" ? formatPhone(contact.value) : contact.value}
                        {contact.label && ` (${contact.label})`}
                        {contact.isPrimary && " - Principal"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Margem (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={margemValor}
                  onChange={(e) => setMargemValor(e.target.value)}
                  placeholder="0,00"
                  data-testid="input-margem"
                />
              </div>
              <div>
                <Label>Proposta Estimada (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={propostaValorEstimado}
                  onChange={(e) => setPropostaValorEstimado(e.target.value)}
                  placeholder="0,00"
                  data-testid="input-proposta"
                />
              </div>
            </div>

            <div>
              <Label>Tipo de contato</Label>
              <Select value={tipoContato} onValueChange={setTipoContato}>
                <SelectTrigger data-testid="select-tipo-contato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {MARKERS_REQUIRING_MOTIVO.includes(newMarker) && (
              <div>
                <Label>Motivo *</Label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Informe o motivo"
                  data-testid="input-motivo"
                />
              </div>
            )}

            {(newMarker === "AGUARDANDO_RETORNO" || newMarker === "RETORNAR_DEPOIS") && (
              <div>
                <Label>Data de retorno</Label>
                <Input
                  type="datetime-local"
                  value={retornoEm}
                  onChange={(e) => setRetornoEm(e.target.value)}
                  data-testid="input-retorno"
                />
              </div>
            )}

            <div>
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observações sobre o atendimento"
                rows={3}
                data-testid="textarea-observacao"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveDialogOpen(false); resetMoveForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMoveSubmit} 
              disabled={moveStageMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveStageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
