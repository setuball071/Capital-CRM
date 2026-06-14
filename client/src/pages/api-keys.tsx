import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Key, Loader2, Check } from "lucide-react";
import type { ApiKey } from "@shared/schema";

interface ApiKeyWithChave extends ApiKey {
  chave_completa?: string;
}

function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [novaChave, setNovaChave] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => apiRequest("GET", "/api/admin/api-keys").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (nome: string) =>
      apiRequest("POST", "/api/admin/api-keys", { nome }).then((r) => r.json()),
    onSuccess: (data: ApiKeyWithChave) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setNovaChave(data.chave_completa ?? null);
      setNome("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar chave", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      apiRequest("PATCH", `/api/admin/api-keys/${id}/toggle`, { ativo }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar chave", description: err.message, variant: "destructive" });
    },
  });

  function handleCreate() {
    if (!nome.trim()) return;
    createMutation.mutate(nome.trim());
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setNome("");
    setNovaChave(null);
    setCopied(false);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            API Keys Externas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Chaves de acesso para sistemas parceiros consultarem clientes por CPF.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova chave
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint de consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-3 py-2 rounded block">
            GET /api/external/v1/clientes/:cpf
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Envie a chave no header <strong>X-API-Key</strong> ou{" "}
            <strong>Authorization: Bearer &lt;chave&gt;</strong>.
            Limite: 120 req/min por chave.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              Nenhuma chave cadastrada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Sistema</TableHead>
                  <TableHead>Chave (prefixo)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Requisições</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-16 text-center">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.nome}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {k.prefixo}•••
                      </code>
                    </TableCell>
                    <TableCell>
                      {k.ativo ? (
                        <Badge variant="default" className="bg-green-600">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{k.totalRequisicoes.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(k.ultimoUso)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(k.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={k.ativo}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: k.id, ativo: checked })
                        }
                        disabled={toggleMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: criar nova chave */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
          </DialogHeader>

          {!novaChave ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome-sistema">Nome do sistema parceiro</Label>
                <Input
                  id="nome-sistema"
                  placeholder="Ex: Prospecta Leads, Sistema ABC..."
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!nome.trim() || createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gerar chave
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                  Copie agora — esta chave não será exibida novamente.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs break-all bg-white dark:bg-muted rounded p-2 border">
                    {novaChave}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(novaChave)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDialog}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
