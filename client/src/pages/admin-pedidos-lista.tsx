import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, ShieldCheck, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface PedidoAdmin {
  id: number;
  coordenador_id: number;
  coordenador_nome: string;
  coordenador_email: string;
  filtros_usados: Record<string, any>;
  quantidade_registros: number;
  tipo: string;
  status: string;
  criado_em: string;
  atualizado_em: string;
}

export default function AdminPedidosLista() {
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
      toast({
        title: "Pedido aprovado",
        description: "O pedido foi aprovado com sucesso.",
      });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message || "Não foi possível aprovar o pedido.",
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
      toast({
        title: "Pedido rejeitado",
        description: "O pedido foi rejeitado.",
      });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.message || "Não foi possível rejeitar o pedido.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case "aprovado":
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      case "cancelado":
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const extractConvenio = (filtros: Record<string, any>) => {
    return filtros?.convenio || "-";
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
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
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Erro ao carregar pedidos. Verifique suas permissões.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendentes = pedidos?.filter(p => p.status === "pendente") || [];
  const processados = pedidos?.filter(p => p.status !== "pendente") || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <ShieldCheck className="h-8 w-8" />
          Administração de Pedidos
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os pedidos de lista criados pelos coordenadores
        </p>
      </div>

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
                  <TableHead>Convênio</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((pedido) => (
                  <TableRow key={pedido.id} data-testid={`row-pedido-${pedido.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(pedido.criado_em)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{pedido.coordenador_nome}</div>
                          <div className="text-sm text-muted-foreground">{pedido.coordenador_email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{extractConvenio(pedido.filtros_usados)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {pedido.quantidade_registros.toLocaleString("pt-BR")}
                    </TableCell>
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
                  <TableHead>Convênio</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id} data-testid={`row-historico-${pedido.id}`}>
                    <TableCell className="font-mono">#{pedido.id}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDate(pedido.criado_em)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pedido.coordenador_nome}</div>
                        <div className="text-sm text-muted-foreground">{pedido.coordenador_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{extractConvenio(pedido.filtros_usados)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {pedido.quantidade_registros.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido encontrado
            </div>
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
