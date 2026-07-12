import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  Users,
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Receipt,
  Tag,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================================================
// Tipos
// ============================================================================

interface PedidoAdmin {
  id: number;
  coordenador_nome: string;
  coordenador_email: string;
  status: string;
  nome_pacote: string | null;
  quantidade_registros: number;
  custo_estimado: string | null;
  criado_em: string;
}

interface Produto {
  id: number;
  tenant_id: number | null;
  nome: string;
  descricao: string | null;
  tipo: string;
  preco: string | number | null;
  gratuito: boolean;
  cobravel: boolean;
  ativo: boolean;
  created_at: string;
}

interface Promocao {
  id: number;
  produto_id: number | null;
  tipo: string;
  valor: string | number | null;
  escopo: string;
  tenant_alvo: number | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
  produto_nome: string | null;
  tenant_nome: string | null;
}

interface PacotePreco {
  id: number;
  quantidadeMaxima: number;
  nomePacote: string;
  preco: string;
  ordem: number;
  ativo: boolean;
}

interface TenantOption {
  id: number;
  name: string;
  interno?: boolean;
  status?: string;
  isActive?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const TIPO_PRODUTO_LABELS: Record<string, string> = {
  lead: "Lead",
  consulta: "Consulta",
  premium: "Premium",
  dominio_proprio: "Domínio próprio",
  outro: "Outro",
};

const TIPO_PROMOCAO_LABELS: Record<string, string> = {
  desconto_pct: "Desconto %",
  desconto_valor: "Desconto R$",
  bonus: "Bônus",
  beneficio: "Benefício",
};

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Aba Pedidos (replica admin-pedidos-lista.tsx)
// ============================================================================

function AbaPedidos() {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{ type: "aprovar" | "rejeitar"; pedidoId: number } | null>(null);

  const { data: pedidos, isLoading, error } = useQuery<PedidoAdmin[]>({
    queryKey: ["/api/pedidos-lista/admin"],
  });

  const aprovarMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/pedidos-lista/${id}/aprovar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos-lista/admin"] });
      toast({ title: "Pedido aprovado", description: "O pedido foi aprovado com sucesso." });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao aprovar",
        description: err.message || "Não foi possível aprovar o pedido.",
        variant: "destructive",
      });
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/pedidos-lista/${id}/rejeitar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos-lista/admin"] });
      toast({ title: "Pedido rejeitado", description: "O pedido foi rejeitado." });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: err.message || "Não foi possível rejeitar o pedido.",
        variant: "destructive",
      });
    },
  });

  const reprocessarMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/pedidos-lista/${id}/reprocessar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos-lista/admin"] });
      toast({ title: "Pedido reenviado", description: "O pedido foi enviado para reprocessamento." });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao reprocessar",
        description: err.message || "Não foi possível reprocessar o pedido.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case "aprovado":
        return <Badge className="gap-1 bg-blue-600"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
      case "processando":
        return <Badge className="gap-1 bg-yellow-600"><Loader2 className="h-3 w-3 animate-spin" /> Gerando arquivo...</Badge>;
      case "concluido":
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Concluído</Badge>;
      case "rejeitado":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      case "cancelado":
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Cancelado</Badge>;
      case "erro":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "aprovar") {
      aprovarMutation.mutate(confirmAction.pedidoId);
    } else {
      rejeitarMutation.mutate(confirmAction.pedidoId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Erro ao carregar pedidos. Verifique suas permissões.
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendentes = pedidos?.filter((p) => p.status === "pendente") || [];
  const processados = pedidos?.filter((p) => p.status !== "pendente") || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{pedidos?.length || 0}</CardTitle>
            <CardDescription>Total de Pedidos</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-yellow-600">{pendentes.length}</CardTitle>
            <CardDescription>Pendentes</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-green-600">{processados.length}</CardTitle>
            <CardDescription>Processados</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pedidos Pendentes
            </CardTitle>
            <CardDescription>Pedidos aguardando aprovação</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo Estimado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((pedido) => (
                  <TableRow key={pedido.id} data-testid={`row-pedido-${pedido.id}`}>
                    <TableCell className="font-mono text-sm">{formatDate(pedido.criado_em)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{pedido.coordenador_nome}</div>
                          <div className="text-sm text-muted-foreground">{pedido.coordenador_email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{pedido.nome_pacote || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {pedido.quantidade_registros.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(pedido.custo_estimado)}</TableCell>
                    <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setConfirmAction({ type: "aprovar", pedidoId: pedido.id })}
                          disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                          data-testid={`button-aprovar-${pedido.id}`}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setConfirmAction({ type: "rejeitar", pedidoId: pedido.id })}
                          disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                          data-testid={`button-rejeitar-${pedido.id}`}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pedidos</CardTitle>
          <CardDescription>Todos os pedidos realizados</CardDescription>
        </CardHeader>
        <CardContent>
          {pedidos && pedidos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo Estimado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id} data-testid={`row-historico-${pedido.id}`}>
                    <TableCell className="font-mono">#{pedido.id}</TableCell>
                    <TableCell className="font-mono text-sm">{formatDate(pedido.criado_em)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pedido.coordenador_nome}</div>
                        <div className="text-sm text-muted-foreground">{pedido.coordenador_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{pedido.nome_pacote || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {pedido.quantidade_registros.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(pedido.custo_estimado)}</TableCell>
                    <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                    <TableCell className="text-right">
                      {pedido.status === "erro" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => reprocessarMutation.mutate(pedido.id)}
                          disabled={reprocessarMutation.isPending}
                          data-testid={`button-reprocessar-${pedido.id}`}
                        >
                          {reprocessarMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          Reprocessar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "aprovar" ? "Aprovar Pedido" : "Rejeitar Pedido"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "aprovar"
                ? "Tem certeza que deseja aprovar este pedido? O coordenador será notificado e poderá baixar a lista."
                : "Tem certeza que deseja rejeitar este pedido? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aprovarMutation.isPending || rejeitarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
              className={confirmAction?.type === "rejeitar" ? "bg-destructive hover:bg-destructive/90" : ""}
              data-testid="button-confirmar-acao"
            >
              {(aprovarMutation.isPending || rejeitarMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {confirmAction?.type === "aprovar" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Card A — Catálogo de Produtos
// ============================================================================

interface ProdutoForm {
  nome: string;
  descricao: string;
  tipo: string;
  preco: number;
  gratuito: boolean;
  cobravel: boolean;
  ativo: boolean;
}

const EMPTY_PRODUTO_FORM: ProdutoForm = {
  nome: "",
  descricao: "",
  tipo: "lead",
  preco: 0,
  gratuito: false,
  cobravel: true,
  ativo: true,
};

function CardProdutos({ tenants }: { tenants: TenantOption[] }) {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [form, setForm] = useState<ProdutoForm>(EMPTY_PRODUTO_FORM);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);

  // cobrança avulsa
  const [cobrancaProduto, setCobrancaProduto] = useState<Produto | null>(null);
  const [cobrancaForm, setCobrancaForm] = useState<{ tenantId: string; vencimento: string; descricao: string }>({
    tenantId: "",
    vencimento: "",
    descricao: "",
  });

  const { data: produtos, isLoading } = useQuery<Produto[]>({
    queryKey: ["/api/servicos/produtos"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ProdutoForm & { id?: number }) => {
      const body = {
        nome: data.nome,
        descricao: data.descricao,
        tipo: data.tipo,
        preco: data.preco,
        gratuito: data.gratuito,
        cobravel: data.cobravel,
        ativo: data.ativo,
      };
      if (data.id) {
        return apiRequest("PUT", `/api/servicos/produtos/${data.id}`, body);
      }
      return apiRequest("POST", "/api/servicos/produtos", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos/produtos"] });
      toast({ title: editingProduto ? "Produto atualizado" : "Produto criado" });
      setIsFormOpen(false);
      setEditingProduto(null);
      setForm(EMPTY_PRODUTO_FORM);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar produto", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/servicos/produtos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos/produtos"] });
      toast({ title: "Produto excluído" });
      setProdutoToDelete(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir produto", description: err.message, variant: "destructive" });
    },
  });

  const cobrancaMutation = useMutation({
    mutationFn: async (data: { tenantId: number; produtoId: number; vencimento: string | null; descricao: string }) => {
      const res = await apiRequest("POST", "/api/servicos/cobrancas", data);
      return (await res.json()) as { invoiceUrl?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos/produtos"] });
      toast({
        title: "Cobrança gerada",
        description: data.invoiceUrl ? (
          <a
            href={data.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
            data-testid="link-abrir-fatura"
          >
            Abrir fatura
          </a>
        ) : (
          "Cobrança criada com sucesso."
        ),
      });
      setCobrancaProduto(null);
      setCobrancaForm({ tenantId: "", vencimento: "", descricao: "" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar cobrança", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingProduto(null);
    setForm(EMPTY_PRODUTO_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setForm({
      nome: produto.nome,
      descricao: produto.descricao || "",
      tipo: produto.tipo,
      preco: produto.preco !== null ? parseFloat(String(produto.preco)) : 0,
      gratuito: produto.gratuito,
      cobravel: produto.cobravel,
      ativo: produto.ativo,
    });
    setIsFormOpen(true);
  };

  const openCobranca = (produto: Produto) => {
    setCobrancaProduto(produto);
    setCobrancaForm({ tenantId: "", vencimento: "", descricao: produto.nome });
  };

  // ambientes internos não são cobrados; excluídos/inativos não aparecem em nenhum select
  const tenantsSelecionaveis = tenants.filter((t) => t.status !== "excluido" && t.isActive !== false);
  const tenantsCobraveis = tenantsSelecionaveis.filter((t) => t.interno !== true);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de Produtos
          </CardTitle>
          <CardDescription>Produtos e serviços oferecidos aos ambientes</CardDescription>
        </div>
        <Button onClick={openCreate} data-testid="button-novo-produto">
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : produtos && produtos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => (
                <TableRow key={produto.id} data-testid={`row-produto-${produto.id}`}>
                  <TableCell>
                    <div className="font-medium">{produto.nome}</div>
                    {produto.descricao && (
                      <div className="text-sm text-muted-foreground">{produto.descricao}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_PRODUTO_LABELS[produto.tipo] || produto.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(produto.preco)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {produto.gratuito && <Badge className="bg-green-600">Grátis</Badge>}
                      {produto.cobravel && <Badge variant="secondary">Cobrável</Badge>}
                      <Badge variant={produto.ativo ? "default" : "outline"}>
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {produto.cobravel && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openCobranca(produto)}
                          data-testid={`button-gerar-cobranca-${produto.id}`}
                        >
                          <Receipt className="h-4 w-4" />
                          Gerar cobrança
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(produto)}
                        data-testid={`button-edit-produto-${produto.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setProdutoToDelete(produto)}
                        data-testid={`button-delete-produto-${produto.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</div>
        )}
      </CardContent>

      {/* Dialog criar/editar produto */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduto ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>Configure os dados do produto ou serviço</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({ ...form, id: editingProduto?.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="produto-nome">Nome</Label>
              <Input
                id="produto-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                data-testid="input-produto-nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="produto-descricao">Descrição</Label>
              <Textarea
                id="produto-descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                data-testid="input-produto-descricao"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="produto-tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger id="produto-tipo" data-testid="select-produto-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="dominio_proprio">Domínio próprio</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="produto-preco">Preço (R$)</Label>
                <Input
                  id="produto-preco"
                  type="number"
                  step="0.01"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: parseFloat(e.target.value) || 0 })}
                  data-testid="input-produto-preco"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="produto-gratuito"
                  checked={form.gratuito}
                  onCheckedChange={(c) => setForm({ ...form, gratuito: c })}
                  data-testid="switch-produto-gratuito"
                />
                <Label htmlFor="produto-gratuito">Gratuito</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="produto-cobravel"
                  checked={form.cobravel}
                  onCheckedChange={(c) => setForm({ ...form, cobravel: c })}
                  data-testid="switch-produto-cobravel"
                />
                <Label htmlFor="produto-cobravel">Cobrável</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="produto-ativo"
                  checked={form.ativo}
                  onCheckedChange={(c) => setForm({ ...form, ativo: c })}
                  data-testid="switch-produto-ativo"
                />
                <Label htmlFor="produto-ativo">Ativo</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-salvar-produto">
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog cobrança avulsa */}
      <Dialog open={!!cobrancaProduto} onOpenChange={(open) => !open && setCobrancaProduto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar cobrança</DialogTitle>
            <DialogDescription>
              Cobrança avulsa do produto "{cobrancaProduto?.nome}"
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cobrancaProduto || !cobrancaForm.tenantId) return;
              cobrancaMutation.mutate({
                tenantId: parseInt(cobrancaForm.tenantId),
                produtoId: cobrancaProduto.id,
                vencimento: cobrancaForm.vencimento || null,
                descricao: cobrancaForm.descricao || cobrancaProduto.nome,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cobranca-tenant">Ambiente</Label>
              <Select
                value={cobrancaForm.tenantId}
                onValueChange={(v) => setCobrancaForm({ ...cobrancaForm, tenantId: v })}
              >
                <SelectTrigger id="cobranca-tenant" data-testid="select-cobranca-tenant">
                  <SelectValue placeholder="Selecione um ambiente" />
                </SelectTrigger>
                <SelectContent>
                  {tenantsCobraveis.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cobranca-vencimento">Vencimento</Label>
              <Input
                id="cobranca-vencimento"
                type="date"
                value={cobrancaForm.vencimento}
                onChange={(e) => setCobrancaForm({ ...cobrancaForm, vencimento: e.target.value })}
                data-testid="input-cobranca-vencimento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cobranca-descricao">Descrição</Label>
              <Input
                id="cobranca-descricao"
                value={cobrancaForm.descricao}
                onChange={(e) => setCobrancaForm({ ...cobrancaForm, descricao: e.target.value })}
                placeholder={cobrancaProduto?.nome}
                data-testid="input-cobranca-descricao"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCobrancaProduto(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cobrancaMutation.isPending || !cobrancaForm.tenantId}
                data-testid="button-enviar-cobranca"
              >
                {cobrancaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar cobrança
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir produto */}
      <AlertDialog open={!!produtoToDelete} onOpenChange={(open) => !open && setProdutoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{produtoToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => produtoToDelete && deleteMutation.mutate(produtoToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirmar-delete-produto"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================================================
// Card B — Promoções
// ============================================================================

interface PromocaoForm {
  produtoId: string; // "" = todos os produtos (null)
  tipo: string;
  valor: number;
  escopo: string;
  tenantAlvo: string; // "" quando escopo global
  vigenciaInicio: string;
  vigenciaFim: string;
  ativo: boolean;
}

const EMPTY_PROMOCAO_FORM: PromocaoForm = {
  produtoId: "",
  tipo: "desconto_pct",
  valor: 0,
  escopo: "global",
  tenantAlvo: "",
  vigenciaInicio: "",
  vigenciaFim: "",
  ativo: true,
};

const PRODUTO_TODOS = "__todos__";

function CardPromocoes({ tenants, produtos }: { tenants: TenantOption[]; produtos: Produto[] }) {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromocao, setEditingPromocao] = useState<Promocao | null>(null);
  const [form, setForm] = useState<PromocaoForm>(EMPTY_PROMOCAO_FORM);
  const [promocaoToDelete, setPromocaoToDelete] = useState<Promocao | null>(null);

  const { data: promocoes, isLoading } = useQuery<Promocao[]>({
    queryKey: ["/api/servicos/promocoes"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: PromocaoForm & { id?: number }) => {
      const body = {
        produtoId: data.produtoId ? parseInt(data.produtoId) : null,
        tipo: data.tipo,
        valor: data.valor,
        escopo: data.escopo,
        tenantAlvo: data.escopo === "cliente" && data.tenantAlvo ? parseInt(data.tenantAlvo) : null,
        vigenciaInicio: data.vigenciaInicio || null,
        vigenciaFim: data.vigenciaFim || null,
        ativo: data.ativo,
      };
      if (data.id) {
        return apiRequest("PUT", `/api/servicos/promocoes/${data.id}`, body);
      }
      return apiRequest("POST", "/api/servicos/promocoes", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos/promocoes"] });
      toast({ title: editingPromocao ? "Promoção atualizada" : "Promoção criada" });
      setIsFormOpen(false);
      setEditingPromocao(null);
      setForm(EMPTY_PROMOCAO_FORM);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar promoção", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/servicos/promocoes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos/promocoes"] });
      toast({ title: "Promoção excluída" });
      setPromocaoToDelete(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir promoção", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingPromocao(null);
    setForm(EMPTY_PROMOCAO_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (promocao: Promocao) => {
    setEditingPromocao(promocao);
    setForm({
      produtoId: promocao.produto_id ? promocao.produto_id.toString() : "",
      tipo: promocao.tipo,
      valor: promocao.valor !== null ? parseFloat(String(promocao.valor)) : 0,
      escopo: promocao.escopo,
      tenantAlvo: promocao.tenant_alvo ? promocao.tenant_alvo.toString() : "",
      vigenciaInicio: promocao.vigencia_inicio ? promocao.vigencia_inicio.slice(0, 10) : "",
      vigenciaFim: promocao.vigencia_fim ? promocao.vigencia_fim.slice(0, 10) : "",
      ativo: promocao.ativo,
    });
    setIsFormOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Promoções
          </CardTitle>
          <CardDescription>Descontos, bônus e benefícios aplicados aos produtos</CardDescription>
        </div>
        <Button onClick={openCreate} data-testid="button-nova-promocao">
          <Plus className="mr-2 h-4 w-4" />
          Nova promoção
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : promocoes && promocoes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promocoes.map((promocao) => (
                <TableRow key={promocao.id} data-testid={`row-promocao-${promocao.id}`}>
                  <TableCell className="font-medium">{promocao.produto_nome || "Todos"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_PROMOCAO_LABELS[promocao.tipo] || promocao.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {promocao.tipo === "desconto_pct"
                      ? `${promocao.valor ?? 0}%`
                      : formatCurrency(promocao.valor)}
                  </TableCell>
                  <TableCell>
                    {promocao.escopo === "cliente" ? (promocao.tenant_nome || "Cliente") : "Global"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateOnly(promocao.vigencia_inicio)} – {formatDateOnly(promocao.vigencia_fim)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promocao.ativo ? "default" : "outline"}>
                      {promocao.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(promocao)}
                        data-testid={`button-edit-promocao-${promocao.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPromocaoToDelete(promocao)}
                        data-testid={`button-delete-promocao-${promocao.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Nenhuma promoção cadastrada</div>
        )}
      </CardContent>

      {/* Dialog criar/editar promoção */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromocao ? "Editar promoção" : "Nova promoção"}</DialogTitle>
            <DialogDescription>Configure os dados da promoção</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({ ...form, id: editingPromocao?.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="promocao-produto">Produto</Label>
              <Select
                value={form.produtoId === "" ? PRODUTO_TODOS : form.produtoId}
                onValueChange={(v) => setForm({ ...form, produtoId: v === PRODUTO_TODOS ? "" : v })}
              >
                <SelectTrigger id="promocao-produto" data-testid="select-promocao-produto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PRODUTO_TODOS}>Todos os produtos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promocao-tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger id="promocao-tipo" data-testid="select-promocao-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desconto_pct">Desconto %</SelectItem>
                    <SelectItem value="desconto_valor">Desconto R$</SelectItem>
                    <SelectItem value="bonus">Bônus</SelectItem>
                    <SelectItem value="beneficio">Benefício</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promocao-valor">Valor</Label>
                <Input
                  id="promocao-valor"
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                  data-testid="input-promocao-valor"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promocao-escopo">Escopo</Label>
              <Select
                value={form.escopo}
                onValueChange={(v) => setForm({ ...form, escopo: v, tenantAlvo: v === "global" ? "" : form.tenantAlvo })}
              >
                <SelectTrigger id="promocao-escopo" data-testid="select-promocao-escopo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.escopo === "cliente" && (
              <div className="space-y-2">
                <Label htmlFor="promocao-tenant">Ambiente</Label>
                <Select
                  value={form.tenantAlvo}
                  onValueChange={(v) => setForm({ ...form, tenantAlvo: v })}
                >
                  <SelectTrigger id="promocao-tenant" data-testid="select-promocao-tenant">
                    <SelectValue placeholder="Selecione um ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants
                      .filter((t) => t.status !== "excluido" && t.isActive !== false)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promocao-inicio">Vigência início</Label>
                <Input
                  id="promocao-inicio"
                  type="date"
                  value={form.vigenciaInicio}
                  onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                  data-testid="input-promocao-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promocao-fim">Vigência fim</Label>
                <Input
                  id="promocao-fim"
                  type="date"
                  value={form.vigenciaFim}
                  onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                  data-testid="input-promocao-fim"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="promocao-ativo"
                checked={form.ativo}
                onCheckedChange={(c) => setForm({ ...form, ativo: c })}
                data-testid="switch-promocao-ativo"
              />
              <Label htmlFor="promocao-ativo">Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-salvar-promocao">
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir promoção */}
      <AlertDialog open={!!promocaoToDelete} onOpenChange={(open) => !open && setPromocaoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir promoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta promoção? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => promocaoToDelete && deleteMutation.mutate(promocaoToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirmar-delete-promocao"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================================================
// Card C — Tabela de Preços da Lista (replica config-precos.tsx)
// ============================================================================

function CardTabelaPrecos() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    quantidadeMaxima: number;
    nomePacote: string;
    preco: number;
  } | null>(null);

  const { data: allPacotes, isLoading } = useQuery<PacotePreco[]>({
    queryKey: ["/api/pacotes-preco/all"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/pacotes-preco/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pacotes-preco/all"] });
      toast({ title: "Sucesso", description: "Pacote atualizado com sucesso!" });
      setEditingId(null);
      setEditValues(null);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Erro ao atualizar pacote" });
    },
  });

  const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
  const calculatePricePerRecord = (preco: number, quantidade: number) =>
    quantidade ? preco / quantidade : 0;

  const startEditing = (pacote: PacotePreco) => {
    setEditingId(pacote.id);
    setEditValues({
      quantidadeMaxima: pacote.quantidadeMaxima,
      nomePacote: pacote.nomePacote,
      preco: parseFloat(pacote.preco),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const saveEditing = () => {
    if (!editingId || !editValues) return;
    updateMutation.mutate({ id: editingId, data: editValues });
  };

  const pacotesCompletos = allPacotes || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Tabela de Preços da Lista
        </CardTitle>
        <CardDescription>Preços fixos por faixa de quantidade de registros</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Pacote</TableHead>
                <TableHead className="text-right">Até (registros)</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Preço/Registro</TableHead>
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotesCompletos.map((pacote, idx) => {
                const isEditing = editingId === pacote.id;
                const precoNum = parseFloat(pacote.preco);
                const precoUnitario = calculatePricePerRecord(precoNum, pacote.quantidadeMaxima);
                const faixaInferior = idx === 0 ? 1 : pacotesCompletos[idx - 1].quantidadeMaxima + 1;

                return (
                  <TableRow key={pacote.id} data-testid={`row-pacote-${pacote.id}`}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues?.nomePacote || ""}
                          onChange={(e) =>
                            setEditValues((prev) => (prev ? { ...prev, nomePacote: e.target.value } : null))
                          }
                          className="w-full"
                          data-testid={`input-nome-pacote-${pacote.id}`}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {pacote.nomePacote}
                          </Badge>
                        </div>
                      )}
                      {!isEditing && (
                        <span className="text-xs text-muted-foreground">
                          {faixaInferior.toLocaleString("pt-BR")} – {pacote.quantidadeMaxima.toLocaleString("pt-BR")} nomes
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editValues?.quantidadeMaxima || 0}
                          onChange={(e) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, quantidadeMaxima: parseInt(e.target.value) || 0 } : null
                            )
                          }
                          className="w-24 ml-auto text-right"
                          data-testid={`input-quantidade-${pacote.id}`}
                        />
                      ) : (
                        <span className="font-mono">{formatNumber(pacote.quantidadeMaxima)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues?.preco || 0}
                          onChange={(e) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, preco: parseFloat(e.target.value) || 0 } : null
                            )
                          }
                          className="w-28 ml-auto text-right"
                          data-testid={`input-preco-${pacote.id}`}
                        />
                      ) : (
                        <span className="font-bold text-lg text-primary">{formatCurrency(precoNum)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {!isEditing && `~${formatCurrency(precoUnitario)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={saveEditing}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-${pacote.id}`}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={updateMutation.isPending}
                            data-testid={`button-cancel-${pacote.id}`}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(pacote)}
                          data-testid={`button-edit-${pacote.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Aba Produtos & Preços
// ============================================================================

function AbaProdutosPrecos() {
  const { data: tenants = [] } = useQuery<TenantOption[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ["/api/servicos/produtos"],
  });

  return (
    <div className="space-y-6">
      <CardProdutos tenants={tenants} />
      <CardPromocoes tenants={tenants} produtos={produtos} />
      <CardTabelaPrecos />
    </div>
  );
}

// ============================================================================
// Página
// ============================================================================

export default function ServicosCobrancaPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <DollarSign className="h-8 w-8" />
          Serviços & Cobrança
        </h1>
        <p className="text-muted-foreground mt-1">
          Aprove pedidos de lista, gerencie o catálogo de produtos, promoções e a tabela de preços
        </p>
      </div>

      <Tabs defaultValue="pedidos" className="w-full">
        <TabsList>
          <TabsTrigger value="pedidos" className="flex items-center gap-2" data-testid="tab-pedidos">
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2" data-testid="tab-produtos">
            <Package className="h-4 w-4" />
            Produtos & Preços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-6">
          <AbaPedidos />
        </TabsContent>

        <TabsContent value="produtos" className="mt-6">
          <AbaProdutosPrecos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
