import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Pencil, Loader2 } from "lucide-react";
import type { Nomenclatura } from "@shared/schema";

const CATEGORIAS = ["ORGAO", "TIPO_CONTRATO", "UPAG", "UF", "OUTRO"] as const;

export default function NomenclaturasPage() {
  const { toast } = useToast();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Nomenclatura | null>(null);
  
  const [formData, setFormData] = useState({
    categoria: "ORGAO" as string,
    codigo: "",
    nome: "",
    ativo: true,
  });

  const queryParams = new URLSearchParams();
  if (categoriaFiltro && categoriaFiltro !== "todas") {
    queryParams.set("categoria", categoriaFiltro);
  }
  if (busca.trim()) {
    queryParams.set("busca", busca.trim());
  }

  const { data: nomenclaturas = [], isLoading } = useQuery<Nomenclatura[]>({
    queryKey: ["/api/nomenclaturas", categoriaFiltro, busca],
    queryFn: async () => {
      const url = `/api/nomenclaturas${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar nomenclaturas");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/nomenclaturas", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclaturas"] });
      toast({ title: "Nomenclatura criada com sucesso" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return apiRequest(`/api/nomenclaturas/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclaturas"] });
      toast({ title: "Nomenclatura atualizada" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      return apiRequest(`/api/nomenclaturas/${id}`, "PUT", { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclaturas"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({ categoria: "ORGAO", codigo: "", nome: "", ativo: true });
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ categoria: "ORGAO", codigo: "", nome: "", ativo: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Nomenclatura) => {
    setEditingItem(item);
    setFormData({
      categoria: item.categoria,
      codigo: item.codigo,
      nome: item.nome,
      ativo: item.ativo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.codigo.trim() || !formData.nome.trim()) {
      toast({ title: "Preencha código e nome", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Nomenclaturas</h1>
        <Button onClick={openCreate} data-testid="button-add-nomenclatura">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-48">
              <Label>Categoria</Label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger data-testid="select-categoria-filtro">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Código ou nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                  data-testid="input-busca"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : nomenclaturas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma nomenclatura encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Categoria</TableHead>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24 text-center">Ativo</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nomenclaturas.map((item) => (
                  <TableRow key={item.id} data-testid={`row-nomenclatura-${item.id}`}>
                    <TableCell className="font-mono text-sm">{item.categoria}</TableCell>
                    <TableCell className="font-mono">{item.codigo}</TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.ativo}
                        onCheckedChange={(checked) => 
                          toggleAtivoMutation.mutate({ id: item.id, ativo: checked })
                        }
                        data-testid={`switch-ativo-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(item)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Nomenclatura" : "Nova Nomenclatura"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                disabled={!!editingItem}
              >
                <SelectTrigger data-testid="select-categoria-form">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: 20114"
                data-testid="input-codigo"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: MINISTERIO DA FAZENDA"
                data-testid="input-nome"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                data-testid="switch-ativo-form"
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-salvar">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
