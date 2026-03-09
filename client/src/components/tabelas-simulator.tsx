import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Star,
  Trophy,
  Calculator,
  Settings,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import Papa from "papaparse";
import type { CommissionTable } from "@shared/schema";

const TIPO_PRODUTO_OPTIONS = [
  { value: "contrato_novo", label: "Contrato Novo" },
  { value: "cartao_beneficio", label: "Cartão Benefício" },
  { value: "cartao_consignado", label: "Cartão Consignado" },
];

const TIPO_LABELS: Record<string, string> = {
  contrato_novo: "Contrato Novo",
  cartao_beneficio: "Cartão Benefício",
  cartao_consignado: "Cartão Consignado",
};

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface SimResult {
  id: number;
  banco: string;
  convenio: string;
  tipoProduto: string;
  prazo: number;
  coeficiente: string;
  pontos: string;
  valorContratoLibera: number;
  parcelaResultante: number;
}

interface CsvRow {
  nome: string;
  convenio: string;
  banco: string;
  tipoProduto: string;
  prazo: string;
  coeficiente: string;
  pontos: string;
}

export function TabelasSimulator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "master" || user?.role === "coordenacao";

  const [convenio, setConvenio] = useState("");
  const [tipoProduto, setTipoProduto] = useState("");
  const [banco, setBanco] = useState("");
  const [prazo, setPrazo] = useState("");
  const [modoCalc, setModoCalc] = useState<"parcela" | "contrato">("parcela");
  const [valorInput, setValorInput] = useState("");
  const [results, setResults] = useState<SimResult[] | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CommissionTable | null>(null);
  const [form, setForm] = useState({
    nome: "",
    convenio: "",
    banco: "",
    tipoProduto: "contrato_novo",
    prazo: "",
    coeficiente: "",
    pontos: "",
    ativo: true,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState("");
  const csvFileRef = useRef<HTMLInputElement>(null);

  const { data: allTables = [], isLoading: tablesLoading } = useQuery<CommissionTable[]>({
    queryKey: ["/api/commission-tables"],
  });

  const uniqueConvenios = useMemo(
    () => [...new Set(allTables.filter((t) => t.ativo !== false).map((t) => t.convenio))].sort(),
    [allTables]
  );
  const uniqueBancos = useMemo(
    () => [...new Set(allTables.filter((t) => t.ativo !== false).map((t) => t.banco))].sort(),
    [allTables]
  );
  const uniquePrazos = useMemo(
    () =>
      [...new Set(allTables.filter((t) => t.ativo !== false).map((t) => t.prazo))]
        .sort((a, b) => a - b),
    [allTables]
  );

  const filteredDrawerTables = useMemo(() => {
    if (!drawerSearch.trim()) return allTables;
    const q = drawerSearch.toLowerCase();
    return allTables.filter(
      (t) =>
        (t.nome || "").toLowerCase().includes(q) ||
        t.convenio.toLowerCase().includes(q) ||
        t.banco.toLowerCase().includes(q)
    );
  }, [allTables, drawerSearch]);

  const canSimulate = convenio && tipoProduto && valorInput && parseFloat(valorInput) > 0;

  const handleSimular = async () => {
    if (!canSimulate) return;
    setSimLoading(true);
    try {
      const params = new URLSearchParams({
        convenio,
        tipoProduto,
        ...(banco && banco !== "__all__" && { banco }),
        ...(prazo && prazo !== "__all__" && { prazo }),
        ...(modoCalc === "parcela"
          ? { parcela: valorInput }
          : { valorContrato: valorInput }),
      });
      const res = await fetch(`/api/commission-tables/simulate?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro");
      const data = await res.json();
      setResults(data);
    } catch {
      toast({ title: "Erro ao simular", variant: "destructive" });
    } finally {
      setSimLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setForm({
      nome: "",
      convenio: "",
      banco: "",
      tipoProduto: "contrato_novo",
      prazo: "",
      coeficiente: "",
      pontos: "",
      ativo: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: CommissionTable) => {
    setEditingItem(item);
    setForm({
      nome: item.nome || "",
      convenio: item.convenio,
      banco: item.banco,
      tipoProduto: item.tipoProduto,
      prazo: String(item.prazo),
      coeficiente: item.coeficiente,
      pontos: item.pontos,
      ativo: item.ativo !== false,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const body = {
        nome: data.nome,
        convenio: data.convenio,
        banco: data.banco,
        tipoProduto: data.tipoProduto,
        prazo: parseInt(data.prazo),
        coeficiente: data.coeficiente,
        pontos: data.pontos,
        ativo: data.ativo,
      };
      if (editingItem) {
        return apiRequest("PUT", `/api/commission-tables/${editingItem.id}`, body);
      }
      return apiRequest("POST", "/api/commission-tables", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tables"] });
      setDialogOpen(false);
      toast({ title: editingItem ? "Tabela atualizada" : "Tabela cadastrada" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/commission-tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tables"] });
      toast({ title: "Tabela removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (tabelas: CsvRow[]) => {
      const body = {
        tabelas: tabelas.map((r) => ({
          nome: r.nome || "",
          convenio: r.convenio,
          banco: r.banco,
          tipoProduto: r.tipoProduto,
          prazo: parseInt(r.prazo),
          coeficiente: r.coeficiente,
          pontos: r.pontos,
          ativo: true,
        })),
      };
      return apiRequest("POST", "/api/commission-tables/import", body);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tables"] });
      setCsvDialogOpen(false);
      setCsvPreview([]);
      setCsvError("");
      toast({ title: `Importação concluída: ${data.inseridas} inseridas, ${data.ignoradas} ignoradas` });
    },
    onError: () => toast({ title: "Erro ao importar", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.convenio.trim() || !form.banco.trim() || !form.prazo || !form.coeficiente || !form.pontos) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  const handleCsvFile = (file: File) => {
    setCsvError("");
    setCsvPreview([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const required = ["nome", "convenio", "banco", "tipoProduto", "prazo", "coeficiente", "pontos"];
        const headers = Object.keys((results.data as Record<string, string>[])[0] || {});
        const missing = required.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          setCsvError(`Colunas faltando: ${missing.join(", ")}`);
          return;
        }
        const validRows = (results.data as CsvRow[]).filter(
          (r) => r.convenio && r.banco && r.tipoProduto && r.prazo && r.coeficiente && r.pontos
        );
        if (validRows.length === 0) {
          setCsvError("Nenhuma linha válida encontrada no CSV");
          return;
        }
        setCsvPreview(validRows);
      },
      error: () => setCsvError("Erro ao ler arquivo CSV"),
    });
  };

  const downloadModelo = () => {
    const modelo = `nome,convenio,banco,tipoProduto,prazo,coeficiente,pontos
SIAPE Facta 96x,SIAPE,Facta,contrato_novo,96,0.021500,3.2000
INSS Pan 84x,INSS,Pan,contrato_novo,84,0.023100,2.8000`;
    const blob = new Blob([modelo], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-tabelas-capitalgo.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="tabelas-simulator">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" style={{ color: "#6C2BD9" }} />
          <h3 className="text-base font-semibold" data-testid="text-simulator-title">
            Simulador de Tabelas
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDrawerOpen(true)}
                data-testid="button-manage-tables"
              >
                <Settings className="h-3.5 w-3.5 mr-1" />
                Gerenciar Tabelas
              </Button>
              <Button size="sm" onClick={openAddDialog} data-testid="button-add-table">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Cadastrar Tabela
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Convênio</Label>
            <Select value={convenio} onValueChange={setConvenio}>
              <SelectTrigger data-testid="select-convenio">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {uniqueConvenios.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
            <Select value={tipoProduto} onValueChange={setTipoProduto}>
              <SelectTrigger data-testid="select-tipo-produto">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_PRODUTO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Banco (opcional)</Label>
            <Select value={banco} onValueChange={setBanco}>
              <SelectTrigger data-testid="select-banco">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {uniqueBancos.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prazo (opcional)</Label>
            <Select value={prazo} onValueChange={setPrazo}>
              <SelectTrigger data-testid="select-prazo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {uniquePrazos.map((p) => (
                  <SelectItem key={String(p)} value={String(p)}>
                    {p === 0 ? "Sem prazo" : `${p} meses`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="modoCalc"
                checked={modoCalc === "parcela"}
                onChange={() => { setModoCalc("parcela"); setValorInput(""); setResults(null); }}
                className="accent-[#6C2BD9]"
              />
              <span className="text-xs font-medium">Informar Parcela</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="modoCalc"
                checked={modoCalc === "contrato"}
                onChange={() => { setModoCalc("contrato"); setValorInput(""); setResults(null); }}
                className="accent-[#6C2BD9]"
              />
              <span className="text-xs font-medium">Informar Valor do Contrato</span>
            </label>
          </div>
          <div className="flex items-end gap-2 flex-1 w-full sm:w-auto">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">
                {modoCalc === "parcela" ? "Parcela (R$)" : "Valor do Contrato (R$)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valorInput}
                onChange={(e) => setValorInput(e.target.value)}
                placeholder="0,00"
                data-testid="input-valor"
              />
            </div>
            <Button
              disabled={!canSimulate || simLoading}
              onClick={handleSimular}
              style={{ background: canSimulate ? "#6C2BD9" : undefined }}
              data-testid="button-simular"
            >
              {simLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Search className="h-4 w-4 mr-1" />
              )}
              Simular
            </Button>
          </div>
        </div>
      </Card>

      {simLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {results !== null && !simLoading && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground" data-testid="text-results-title">
            Top {results.length} — ordenado por rentabilidade
          </h4>

          {results.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground" data-testid="text-no-results">
                Nenhuma tabela disponível para esses filtros.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {results.map((r, idx) => (
                <Card
                  key={r.id}
                  className="p-4"
                  data-testid={`result-card-${r.id}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "rgba(108,43,217,0.08)" }}
                      >
                        <Building2 className="h-4 w-4" style={{ color: "#6C2BD9" }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{r.banco}</span>
                          {idx === 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                              data-testid="badge-best"
                            >
                              <Trophy className="h-3 w-3 mr-1" />
                              Melhor opção
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.prazo > 0 ? `${r.prazo} meses` : "Sem prazo"} · {TIPO_LABELS[r.tipoProduto] || r.tipoProduto}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" style={{ color: "#F59E0B" }} />
                          <span className="text-sm font-semibold">{parseFloat(r.pontos).toFixed(2)}pts</span>
                        </div>
                        <p className="text-xs text-muted-foreground" data-testid={`total-pontos-${r.id}`}>
                          Total: {(parseFloat(r.pontos) * r.valorContratoLibera / 1000).toFixed(2)} pts
                        </p>
                      </div>
                      {canManage && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const table = allTables.find((t) => t.id === r.id);
                              if (table) openEditDialog(table);
                            }}
                            data-testid={`edit-table-${r.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Remover esta tabela?")) deleteMutation.mutate(r.id);
                            }}
                            data-testid={`delete-table-${r.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Valor do Contrato Liberado</p>
                    <p
                      className="text-xl font-bold"
                      style={{ color: "#6C2BD9" }}
                      data-testid={`valor-contrato-${r.id}`}
                    >
                      {formatBRL(r.valorContratoLibera)}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 mt-2 text-xs text-muted-foreground">
                    <span>Coeficiente: <strong className="text-foreground">{r.coeficiente}</strong></span>
                    <span>Parcela: <strong className="text-foreground">{formatBRL(r.parcelaResultante)}</strong></span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tablesLoading && results === null && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-commission-table">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Tabela" : "Cadastrar Tabela"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Tabela</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: SIAPE Facta 96x"
                data-testid="form-nome"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Convênio</Label>
                <Input
                  value={form.convenio}
                  onChange={(e) => setForm({ ...form, convenio: e.target.value })}
                  placeholder="SIAPE, INSS..."
                  data-testid="form-convenio"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  placeholder="Facta, Pan..."
                  data-testid="form-banco"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Produto</Label>
                <Select value={form.tipoProduto} onValueChange={(v) => setForm({ ...form, tipoProduto: v })}>
                  <SelectTrigger data-testid="form-tipo-produto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_PRODUTO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo (meses)</Label>
                <Input
                  type="number"
                  value={form.prazo}
                  onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  placeholder="96"
                  data-testid="form-prazo"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Coeficiente</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={form.coeficiente}
                  onChange={(e) => setForm({ ...form, coeficiente: e.target.value })}
                  placeholder="0.021500"
                  data-testid="form-coeficiente"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pontos</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.pontos}
                  onChange={(e) => setForm({ ...form, pontos: e.target.value })}
                  placeholder="3.2000"
                  data-testid="form-pontos"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                data-testid="form-ativo"
              />
              <Label className="text-xs">Ativo</Label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={saveMutation.isPending}
                onClick={handleSave}
                data-testid="button-save-table"
              >
                {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] flex flex-col p-0" data-testid="drawer-manage-tables">
          <SheetHeader className="px-4 pt-4 pb-3 border-b">
            <SheetTitle>Gerenciar Tabelas</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-3 border-b space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => { openAddDialog(); }} data-testid="drawer-button-add">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Cadastrar Tabela
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setCsvPreview([]); setCsvError(""); setCsvDialogOpen(true); }}
                data-testid="drawer-button-import"
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Importar CSV
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="Buscar tabela..."
                className="pl-8"
                data-testid="input-drawer-search"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredDrawerTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-8 w-8 mb-2" />
                <p className="text-sm">Nenhuma tabela encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredDrawerTables.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    data-testid={`drawer-row-${t.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{t.nome || `${t.convenio} ${t.banco}`}</span>
                        <Badge
                          variant="outline"
                          className={
                            t.ativo !== false
                              ? "text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                              : "text-xs"
                          }
                        >
                          {t.ativo !== false ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.convenio} · {t.banco} · {t.prazo > 0 ? `${t.prazo}m` : "S/prazo"} · {TIPO_LABELS[t.tipoProduto] || t.tipoProduto}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(t)}
                        data-testid={`drawer-edit-${t.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Remover esta tabela?")) deleteMutation.mutate(t.id);
                        }}
                        data-testid={`drawer-delete-${t.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground" data-testid="text-table-count">
              {allTables.length} tabela{allTables.length !== 1 ? "s" : ""} cadastrada{allTables.length !== 1 ? "s" : ""}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-csv-import">
          <DialogHeader>
            <DialogTitle>Importar Tabelas via CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Formato esperado das colunas:</p>
              <p className="font-mono">nome, convenio, banco, tipoProduto, prazo, coeficiente, pontos</p>
              <p className="mt-2">tipoProduto deve ser:</p>
              <p className="font-mono">contrato_novo | cartao_beneficio | cartao_consignado</p>
            </div>
            <Button size="sm" variant="outline" onClick={downloadModelo} data-testid="button-download-modelo">
              <Download className="h-3.5 w-3.5 mr-1" />
              Baixar modelo CSV
            </Button>

            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              data-testid="input-csv-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
              }}
            />

            {csvPreview.length === 0 ? (
              <div
                className="border-2 border-dashed rounded-md p-6 flex flex-col items-center gap-2 cursor-pointer hover-elevate"
                onClick={() => csvFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleCsvFile(file);
                }}
                data-testid="dropzone-csv"
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Arraste o CSV aqui ou clique para selecionar</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="border rounded-md max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Nome</th>
                        <th className="px-2 py-1.5 text-left font-medium">Convênio</th>
                        <th className="px-2 py-1.5 text-left font-medium">Banco</th>
                        <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                        <th className="px-2 py-1.5 text-right font-medium">Prazo</th>
                        <th className="px-2 py-1.5 text-right font-medium">Coef.</th>
                        <th className="px-2 py-1.5 text-right font-medium">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{r.nome}</td>
                          <td className="px-2 py-1">{r.convenio}</td>
                          <td className="px-2 py-1">{r.banco}</td>
                          <td className="px-2 py-1">{r.tipoProduto}</td>
                          <td className="px-2 py-1 text-right">{r.prazo}</td>
                          <td className="px-2 py-1 text-right">{r.coeficiente}</td>
                          <td className="px-2 py-1 text-right">{r.pontos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreview.length > 50 && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando 50 de {csvPreview.length} linhas
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setCsvPreview([]); setCsvError(""); if (csvFileRef.current) csvFileRef.current.value = ""; }}
                  data-testid="button-clear-csv"
                >
                  Trocar arquivo
                </Button>
              </div>
            )}

            {csvError && (
              <p className="text-sm text-destructive" data-testid="text-csv-error">{csvError}</p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={csvPreview.length === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate(csvPreview)}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Importar {csvPreview.length} tabela{csvPreview.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
