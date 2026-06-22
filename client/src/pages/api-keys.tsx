import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Key, Loader2, Check, Pencil, Trash2 } from "lucide-react";
import type { ApiKey } from "@shared/schema";

interface ApiKeyWithChave extends ApiKey {
  chave_completa?: string;
}

// Escopos disponíveis. "basico" é sempre incluído (identifica o cliente) e não é editável.
const ESCOPOS = [
  { id: "margens", label: "Margens", desc: "Margem 35%, cartão 5%, total 70%, salário" },
  { id: "contratos", label: "Contratos", desc: "Empréstimos ativos: banco, parcela, saldo devedor" },
] as const;

function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function ApiKeysPage() {
  const { toast } = useToast();

  // Criar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [escoposNovo, setEscoposNovo] = useState<string[]>(["margens", "contratos"]);
  const [novaChave, setNovaChave] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editar
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEscopos, setEditEscopos] = useState<string[]>([]);

  // Excluir
  const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => apiRequest("GET", "/api/admin/api-keys").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { nome: string; escopos: string[] }) =>
      apiRequest("POST", "/api/admin/api-keys", payload).then((r) => r.json()),
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

  const updateMutation = useMutation({
    mutationFn: ({ id, nome, escopos }: { id: number; nome: string; escopos: string[] }) =>
      apiRequest("PATCH", `/api/admin/api-keys/${id}`, { nome, escopos }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setEditKey(null);
      toast({ title: "Chave atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar chave", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/api-keys/${id}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setDeleteKey(null);
      toast({ title: "Chave excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir chave", description: err.message, variant: "destructive" });
    },
  });

  function toggleEscopo(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((e) => e !== id) : [...list, id]);
  }

  function handleCreate() {
    if (!nome.trim()) return;
    createMutation.mutate({ nome: nome.trim(), escopos: escoposNovo });
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setNome("");
    setEscoposNovo(["margens", "contratos"]);
    setNovaChave(null);
    setCopied(false);
  }

  function openEdit(k: ApiKey) {
    setEditKey(k);
    setEditNome(k.nome);
    setEditEscopos(Array.isArray(k.escopos) ? [...k.escopos] : ["margens", "contratos"]);
  }

  function handleUpdate() {
    if (!editKey || !editNome.trim()) return;
    updateMutation.mutate({ id: editKey.id, nome: editNome.trim(), escopos: editEscopos });
  }

  function escoposLabel(escopos: unknown): string[] {
    const arr = Array.isArray(escopos) ? (escopos as string[]) : [];
    return ["Básicos", ...ESCOPOS.filter((e) => arr.includes(e.id)).map((e) => e.label)];
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
            Limite: 120 req/min por chave. Os dados retornados dependem dos escopos da chave.
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
                  <TableHead>Pode buscar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Requisições</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="w-16 text-center">Ativo</TableHead>
                  <TableHead className="w-24 text-center">Ações</TableHead>
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
                      <div className="flex flex-wrap gap-1">
                        {escoposLabel(k.escopos).map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
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
                    <TableCell className="text-center">
                      <Switch
                        checked={k.ativo}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: k.id, ativo: checked })
                        }
                        disabled={toggleMutation.isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(k)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteKey(k)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
              <div className="space-y-2">
                <Label>O que essa chave pode buscar</Label>
                <p className="text-xs text-muted-foreground">
                  Dados básicos (CPF, nome, convênio, órgão, situação) sempre são retornados.
                </p>
                <div className="space-y-2 pt-1">
                  {ESCOPOS.map((e) => (
                    <label key={e.id} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={escoposNovo.includes(e.id)}
                        onCheckedChange={() => toggleEscopo(escoposNovo, setEscoposNovo, e.id)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{e.label}</span>
                        <span className="block text-xs text-muted-foreground">{e.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
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

      {/* Dialog: editar chave */}
      <Dialog open={!!editKey} onOpenChange={(o) => !o && setEditKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do sistema parceiro</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>O que essa chave pode buscar</Label>
              <p className="text-xs text-muted-foreground">
                Dados básicos sempre são retornados.
              </p>
              <div className="space-y-2 pt-1">
                {ESCOPOS.map((e) => (
                  <label key={e.id} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={editEscopos.includes(e.id)}
                      onCheckedChange={() => toggleEscopo(editEscopos, setEditEscopos, e.id)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{e.label}</span>
                      <span className="block text-xs text-muted-foreground">{e.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditKey(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={!editNome.trim() || updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: excluir chave */}
      <AlertDialog open={!!deleteKey} onOpenChange={(o) => !o && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <strong>{deleteKey?.nome}</strong> será removida permanentemente. Qualquer
              sistema usando essa chave deixará de funcionar imediatamente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKey && deleteMutation.mutate(deleteKey.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
