import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { MODULOS_CATALOGO } from "@shared/modulos";
import { Loader2, Plus, Pencil, Trash2, Layers } from "lucide-react";

// ============================================================================
// Tipos
// ============================================================================

interface PlanoServico {
  produtoId: number;
  incluso: boolean;
}

interface Plano {
  id: number;
  nome: string;
  descricao: string | null;
  ciclo: "mensal" | "anual";
  valor: number;
  max_usuarios: number | null;
  limites: { observacao?: string } & Record<string, unknown>;
  ativo: boolean;
  modulos: string[];
  servicos: PlanoServico[];
}

interface Produto {
  id: number;
  nome: string;
  tipo: string;
  preco: string | number | null;
  cobravel: boolean;
  ativo: boolean;
}

type ServicoEstado = "nao" | "incluso" | "opcional";

interface PlanoForm {
  nome: string;
  descricao: string;
  ciclo: "mensal" | "anual";
  valor: number;
  maxUsuarios: string; // "" = ilimitado
  observacao: string;
  ativo: boolean;
  modulos: string[];
  servicos: Record<number, ServicoEstado>;
}

const EMPTY_FORM: PlanoForm = {
  nome: "",
  descricao: "",
  ciclo: "mensal",
  valor: 0,
  maxUsuarios: "",
  observacao: "",
  ativo: true,
  modulos: [],
  servicos: {},
};

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatValor(plano: Plano): string {
  if (!plano.valor || plano.valor === 0) return "Grátis";
  const sufixo = plano.ciclo === "anual" ? "/ano" : "/mês";
  return `${formatCurrency(plano.valor)}${sufixo}`;
}

// ============================================================================
// Página
// ============================================================================

export default function AdminPlanosPage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [form, setForm] = useState<PlanoForm>(EMPTY_FORM);
  const [planoToDelete, setPlanoToDelete] = useState<Plano | null>(null);

  const { data: planos, isLoading } = useQuery<Plano[]>({
    queryKey: ["/api/admin/planos"],
  });

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ["/api/servicos/produtos"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { form: PlanoForm; id?: number }) => {
      const { form: f, id } = data;
      const servicos: PlanoServico[] = Object.entries(f.servicos)
        .filter(([, estado]) => estado !== "nao")
        .map(([produtoId, estado]) => ({
          produtoId: parseInt(produtoId),
          incluso: estado === "incluso",
        }));
      const body: Record<string, unknown> = {
        nome: f.nome,
        descricao: f.descricao,
        ciclo: f.ciclo,
        valor: f.valor,
        maxUsuarios: f.maxUsuarios.trim() === "" ? null : parseInt(f.maxUsuarios),
        limites: { observacao: f.observacao },
        modulos: f.modulos,
        servicos,
      };
      if (id) {
        body.ativo = f.ativo;
        return apiRequest("PUT", `/api/admin/planos/${id}`, body);
      }
      return apiRequest("POST", "/api/admin/planos", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/planos"] });
      toast({ title: editingPlano ? "Plano atualizado" : "Plano criado" });
      setIsFormOpen(false);
      setEditingPlano(null);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar plano", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/planos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/planos"] });
      toast({ title: "Plano excluído" });
      setPlanoToDelete(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir plano", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingPlano(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (plano: Plano) => {
    setEditingPlano(plano);
    const servicos: Record<number, ServicoEstado> = {};
    for (const s of plano.servicos || []) {
      servicos[s.produtoId] = s.incluso ? "incluso" : "opcional";
    }
    setForm({
      nome: plano.nome,
      descricao: plano.descricao || "",
      ciclo: plano.ciclo,
      valor: plano.valor ?? 0,
      maxUsuarios: plano.max_usuarios !== null && plano.max_usuarios !== undefined
        ? String(plano.max_usuarios)
        : "",
      observacao: plano.limites?.observacao ?? "",
      ativo: plano.ativo,
      modulos: plano.modulos || [],
      servicos,
    });
    setIsFormOpen(true);
  };

  const toggleModulo = (key: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      modulos: checked ? [...f.modulos, key] : f.modulos.filter((k) => k !== key),
    }));
  };

  const setServicoEstado = (produtoId: number, estado: ServicoEstado) => {
    setForm((f) => ({ ...f, servicos: { ...f.servicos, [produtoId]: estado } }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Layers className="h-6 w-6" />
            Planos
          </h1>
          <p className="text-muted-foreground mt-1">Modelos de assinatura da plataforma</p>
        </div>
        <Button onClick={openCreate} data-testid="button-novo-plano">
          <Plus className="mr-2 h-4 w-4" />
          Novo plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
          <CardDescription>Configure valores, limites, módulos e serviços de cada plano</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : planos && planos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                  <TableHead className="text-right">Módulos</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((plano) => (
                  <TableRow key={plano.id} data-testid={`row-plano-${plano.id}`}>
                    <TableCell>
                      <div className="font-medium">{plano.nome}</div>
                      {plano.descricao && (
                        <div className="text-sm text-muted-foreground">{plano.descricao}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{plano.ciclo === "anual" ? "Anual" : "Mensal"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatValor(plano)}</TableCell>
                    <TableCell className="text-right">
                      {plano.max_usuarios ?? "Ilimitado"}
                    </TableCell>
                    <TableCell className="text-right">{plano.modulos?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={plano.ativo ? "default" : "outline"}>
                        {plano.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(plano)}
                          data-testid={`button-edit-plano-${plano.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPlanoToDelete(plano)}
                          data-testid={`button-delete-plano-${plano.id}`}
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
            <div className="text-center py-8 text-muted-foreground">Nenhum plano cadastrado</div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar plano */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlano ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>Configure os dados, módulos e serviços do plano</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({ form, id: editingPlano?.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="plano-nome">Nome</Label>
              <Input
                id="plano-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                data-testid="input-plano-nome"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plano-descricao">Descrição</Label>
              <Textarea
                id="plano-descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={2}
                data-testid="input-plano-descricao"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plano-ciclo">Ciclo</Label>
                <Select
                  value={form.ciclo}
                  onValueChange={(v) => setForm({ ...form, ciclo: v as "mensal" | "anual" })}
                >
                  <SelectTrigger id="plano-ciclo" data-testid="select-plano-ciclo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plano-valor">Valor (R$)</Label>
                <Input
                  id="plano-valor"
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                  data-testid="input-plano-valor"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plano-max-usuarios">Máx. usuários</Label>
                <Input
                  id="plano-max-usuarios"
                  type="number"
                  min={1}
                  value={form.maxUsuarios}
                  onChange={(e) => setForm({ ...form, maxUsuarios: e.target.value })}
                  placeholder="Ilimitado"
                  data-testid="input-plano-max-usuarios"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plano-observacao">Observação de limite</Label>
                <Input
                  id="plano-observacao"
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  data-testid="input-plano-observacao"
                />
              </div>
            </div>

            {/* Módulos liberados */}
            <div className="space-y-2">
              <Label>Módulos liberados</Label>
              <div className="grid gap-2 sm:grid-cols-2 rounded-md border p-3">
                {MODULOS_CATALOGO.map((m) => (
                  <div key={m.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`modulo-${m.key}`}
                      checked={form.modulos.includes(m.key)}
                      onCheckedChange={(c) => toggleModulo(m.key, c === true)}
                      data-testid={`checkbox-modulo-${m.key}`}
                    />
                    <Label htmlFor={`modulo-${m.key}`} className="font-normal cursor-pointer">
                      {m.nome}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Serviços */}
            <div className="space-y-2">
              <Label>Serviços</Label>
              {produtos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
              ) : (
                <div className="space-y-3 rounded-md border p-3">
                  {produtos.map((produto) => {
                    const estado = form.servicos[produto.id] ?? "nao";
                    return (
                      <div
                        key={produto.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                        data-testid={`servico-row-${produto.id}`}
                      >
                        <span className="text-sm font-medium">{produto.nome}</span>
                        <RadioGroup
                          value={estado}
                          onValueChange={(v) => setServicoEstado(produto.id, v as ServicoEstado)}
                          className="flex gap-4"
                        >
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem
                              value="nao"
                              id={`servico-${produto.id}-nao`}
                              data-testid={`radio-servico-${produto.id}-nao`}
                            />
                            <Label htmlFor={`servico-${produto.id}-nao`} className="font-normal cursor-pointer">
                              Não incluído
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem
                              value="incluso"
                              id={`servico-${produto.id}-incluso`}
                              data-testid={`radio-servico-${produto.id}-incluso`}
                            />
                            <Label htmlFor={`servico-${produto.id}-incluso`} className="font-normal cursor-pointer">
                              Incluso
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem
                              value="opcional"
                              id={`servico-${produto.id}-opcional`}
                              data-testid={`radio-servico-${produto.id}-opcional`}
                            />
                            <Label htmlFor={`servico-${produto.id}-opcional`} className="font-normal cursor-pointer">
                              Opcional
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="plano-ativo"
                checked={form.ativo}
                onCheckedChange={(c) => setForm({ ...form, ativo: c })}
                data-testid="switch-plano-ativo"
              />
              <Label htmlFor="plano-ativo">Ativo</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-salvar-plano">
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir plano */}
      <AlertDialog open={!!planoToDelete} onOpenChange={(open) => !open && setPlanoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano "{planoToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planoToDelete && deleteMutation.mutate(planoToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirmar-delete-plano"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
