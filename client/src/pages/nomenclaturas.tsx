import { useState, useRef } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Pencil, Loader2, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import type { Nomenclatura } from "@shared/schema";

const CATEGORIAS = ["ORGAO", "TIPO_CONTRATO", "UPAG", "UF", "OUTRO"] as const;

interface ImportResult {
  message: string;
  total: number;
  inserted: number;
  updated: number;
  errors: { linha: number; erro: string }[];
}

export default function NomenclaturasPage() {
  const { toast } = useToast();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Nomenclatura | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/nomenclaturas/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao importar arquivo");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclaturas"] });
      setImportResult(data);
      toast({ 
        title: "Importação concluída", 
        description: `${data.inserted} inseridos, ${data.updated} atualizados`,
      });
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

  const openImportDialog = () => {
    setSelectedFile(null);
    setImportResult(null);
    setImportDialogOpen(true);
  };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setImportResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "xlsx" && ext !== "xls") {
        toast({ title: "Formato inválido", description: "Use arquivos .xlsx ou .xls", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Nomenclaturas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openImportDialog} data-testid="button-import-excel">
            <Upload className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
          <Button onClick={openCreate} data-testid="button-add-nomenclatura">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </div>
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar Nomenclaturas por Excel
            </DialogTitle>
            <DialogDescription>
              Faça upload de uma planilha Excel (.xlsx) com as colunas: Categoria, Código, Nome e Ativo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-excel"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-10 h-10 mx-auto text-primary" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Escolher outro arquivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Arraste um arquivo ou clique para selecionar</p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-select-file"
                  >
                    Selecionar Arquivo
                  </Button>
                </div>
              )}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">Formato esperado da planilha:</p>
                <div className="text-xs font-mono bg-background rounded p-2 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1">Categoria</th>
                        <th className="text-left p-1">Código</th>
                        <th className="text-left p-1">Nome</th>
                        <th className="text-left p-1">Ativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-1">ORGAO</td>
                        <td className="p-1">20114</td>
                        <td className="p-1">MINISTÉRIO DA FAZENDA</td>
                        <td className="p-1">TRUE</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Categorias válidas: ORGAO, TIPO_CONTRATO, UPAG, UF, OUTRO
                </p>
              </CardContent>
            </Card>

            {importResult && (
              <Card className={importResult.errors.length > 0 ? "border-orange-500" : "border-green-500"}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {importResult.errors.length === 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{importResult.message}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-green-600">Inseridos: {importResult.inserted}</span>
                        <span className="text-blue-600">Atualizados: {importResult.updated}</span>
                        <span className="text-red-600">Erros: {importResult.errors.length}</span>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="mt-3 max-h-32 overflow-y-auto">
                          <p className="text-sm font-medium text-red-600 mb-1">Erros encontrados:</p>
                          {importResult.errors.slice(0, 10).map((err, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground">
                              Linha {err.linha}: {err.erro}
                            </p>
                          ))}
                          {importResult.errors.length > 10 && (
                            <p className="text-xs text-muted-foreground">
                              ...e mais {importResult.errors.length - 10} erros
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>
              {importResult ? "Fechar" : "Cancelar"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importMutation.isPending}
                data-testid="button-import-submit"
              >
                {importMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Importar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
