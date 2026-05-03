import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Trash2, FileText, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MesSiape {
  mes_pagamento: string;
  total: string;
  servidores: string;
  aposentados: string;
  pensionistas: string;
  ultima_importacao: string;
}

function formatarMes(mes: string): string {
  // "ABR2026" → "ABR/2026"
  return mes.replace(/^([A-Z]+)(\d{4})$/, '$1/$2');
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function SiapeHistorico() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmMes, setConfirmMes] = useState<string | null>(null);

  const isAllowed =
    user?.isMaster ||
    ["master", "coordenacao", "financeiro"].includes(user?.role || "");

  const { data, isLoading, refetch } = useQuery<{ meses: MesSiape[] }>({
    queryKey: ["/api/siape/historico"],
    queryFn: () => apiRequest("GET", "/api/siape/historico").then((r) => r.json()),
    enabled: isAllowed,
  });

  const deleteMutation = useMutation({
    mutationFn: (mes: string) =>
      apiRequest("DELETE", `/api/siape/historico/${mes}`).then((r) => r.json()),
    onSuccess: (_, mes) => {
      toast({
        title: "Mês removido",
        description: `Os contracheques de ${formatarMes(mes)} foram excluídos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/siape/historico"] });
      setConfirmMes(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o mês.",
        variant: "destructive",
      });
    },
  });

  if (!isAllowed) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Sem permissão para acessar esta área.</p>
      </div>
    );
  }

  const meses = data?.meses || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Histórico SIAPE</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Contracheques importados — máximo 3 meses armazenados por CPF
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : meses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum contracheque importado ainda.</p>
            <p className="text-sm mt-1">
              Execute o script <code>importar_siape_capital.py</code> na sua máquina para importar os dados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meses.map((item) => (
            <Card key={item.mes_pagamento}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">
                    {formatarMes(item.mes_pagamento)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      <Users className="w-4 h-4 mr-1" />
                      {parseInt(item.total).toLocaleString("pt-BR")} registros
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                      onClick={() => setConfirmMes(item.mes_pagamento)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir mês
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                  <span>
                    🟢 <strong>{parseInt(item.servidores).toLocaleString("pt-BR")}</strong> servidores ativos
                  </span>
                  <span>
                    🔵 <strong>{parseInt(item.aposentados).toLocaleString("pt-BR")}</strong> aposentados
                  </span>
                  <span>
                    🟡 <strong>{parseInt(item.pensionistas).toLocaleString("pt-BR")}</strong> pensionistas
                  </span>
                  <span className="ml-auto">
                    Importado em {formatarData(item.ultima_importacao)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Instruções de uso */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-800">Como importar um novo mês</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-1">
          <p>1. Processe os PDFs SIAPE com <code>processar_pdf_siape.py</code></p>
          <p>2. Abra o terminal e execute:</p>
          <pre className="bg-blue-100 rounded px-3 py-2 text-xs font-mono mt-1">
            python importar_siape_capital.py
          </pre>
          <p className="text-xs text-blue-600 mt-2">
            O script lê os arquivos <code>CLIENTES*.csv</code> e <code>RUBRICAS*.csv</code> da
            pasta <code>_Import_PDFs</code> e importa direto no banco. Aguarde a conclusão.
          </p>
        </CardContent>
      </Card>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmMes} onOpenChange={() => setConfirmMes(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmMes ? formatarMes(confirmMes) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os contracheques do mês{" "}
              <strong>{confirmMes ? formatarMes(confirmMes) : ""}</strong> serão removidos
              permanentemente do banco. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmMes && deleteMutation.mutate(confirmMes)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
