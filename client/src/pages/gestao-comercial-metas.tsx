import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Plus, Pencil, Trash2, GripVertical,
  Gem, Trophy, Medal, Star, Crown, Shield, Award, Flame, Rocket, Zap,
  TrendingUp, CircleDollarSign, Wheat, Dog, CreditCard, Swords, Coins,
  Wallet, PiggyBank, Landmark, Mountain
} from "lucide-react";
import type { MetaNivel } from "@shared/schema";

const ICON_OPTIONS = [
  { value: "Gem", label: "Diamante", icon: Gem },
  { value: "Trophy", label: "Troféu", icon: Trophy },
  { value: "Medal", label: "Medalha", icon: Medal },
  { value: "Star", label: "Estrela", icon: Star },
  { value: "Crown", label: "Coroa", icon: Crown },
  { value: "Target", label: "Alvo", icon: Target },
  { value: "Shield", label: "Escudo", icon: Shield },
  { value: "Award", label: "Prêmio", icon: Award },
  { value: "Flame", label: "Chama", icon: Flame },
  { value: "Rocket", label: "Foguete", icon: Rocket },
  { value: "Zap", label: "Raio", icon: Zap },
  { value: "TrendingUp", label: "Crescimento", icon: TrendingUp },
  { value: "Wheat", label: "Milho", icon: Wheat },
  { value: "Dog", label: "Lobo", icon: Dog },
  { value: "CreditCard", label: "Cartão", icon: CreditCard },
  { value: "Swords", label: "Titan", icon: Swords },
  { value: "Coins", label: "Moedas", icon: Coins },
  { value: "Wallet", label: "Carteira", icon: Wallet },
  { value: "PiggyBank", label: "Cofrinho", icon: PiggyBank },
  { value: "Landmark", label: "Banco", icon: Landmark },
  { value: "Mountain", label: "Montanha", icon: Mountain },
];

const COLOR_PRESETS = [
  { value: "#cd7f32", label: "Bronze" },
  { value: "#94a3b8", label: "Prata" },
  { value: "#fbbf24", label: "Ouro" },
  { value: "#22d3ee", label: "Ciano" },
  { value: "#a855f7", label: "Roxo" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#22c55e", label: "Verde" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#f97316", label: "Laranja" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#8b5cf6", label: "Violeta" },
];

function getIconComponent(iconName: string | null) {
  const found = ICON_OPTIONS.find((i) => i.value === iconName);
  return found ? found.icon : Star;
}

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

interface NivelFormData {
  nomeNivel: string;
  pontosMinimos: string;
  pontosMaximos: string;
  premio: string;
  ordem: string;
  cor: string;
  icone: string;
}

const EMPTY_FORM: NivelFormData = {
  nomeNivel: "",
  pontosMinimos: "",
  pontosMaximos: "",
  premio: "",
  ordem: "1",
  cor: "#cd7f32",
  icone: "Star",
};

function NiveisTab({ categoria, niveis, isLoading }: { categoria: "GERAL" | "CARTAO"; niveis: MetaNivel[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<NivelFormData>(EMPTY_FORM);

  const filtered = niveis
    .filter((n) => n.categoria === categoria)
    .sort((a, b) => parseFloat(String(a.pontosMinimos)) - parseFloat(String(b.pontosMinimos)));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/meta-niveis", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-niveis"] });
      setDialogOpen(false);
      toast({ title: "Nível criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar nível", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/meta-niveis/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-niveis"] });
      setDialogOpen(false);
      setEditingId(null);
      toast({ title: "Nível atualizado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar nível", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/meta-niveis/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-niveis"] });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast({ title: "Nível removido com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover nível", description: err.message, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ordem: String(filtered.length + 1) });
    setDialogOpen(true);
  }

  function openEdit(nivel: MetaNivel) {
    setEditingId(nivel.id);
    setForm({
      nomeNivel: nivel.nomeNivel,
      pontosMinimos: String(nivel.pontosMinimos),
      pontosMaximos: nivel.pontosMaximos ? String(nivel.pontosMaximos) : "",
      premio: String(nivel.premio),
      ordem: String(nivel.ordem),
      cor: nivel.cor || "#cd7f32",
      icone: nivel.icone || "Star",
    });
    setDialogOpen(true);
  }

  function openDelete(id: number) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.nomeNivel.trim()) {
      toast({ title: "Nome do nível é obrigatório", variant: "destructive" });
      return;
    }
    if (!form.pontosMinimos || parseFloat(form.pontosMinimos) <= 0) {
      toast({ title: "Pontos mínimos deve ser maior que zero", variant: "destructive" });
      return;
    }
    if (!form.premio || parseFloat(form.premio) < 0) {
      toast({ title: "Valor do prêmio é obrigatório", variant: "destructive" });
      return;
    }

    const payload = {
      categoria,
      nomeNivel: form.nomeNivel.trim(),
      pontosMinimos: form.pontosMinimos,
      pontosMaximos: form.pontosMaximos || null,
      premio: form.premio,
      ordem: form.ordem,
      cor: form.cor,
      icone: form.icone,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const IconComponent = getIconComponent(form.icone);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "nível configurado" : "níveis configurados"}
        </p>
        <Button onClick={openCreate} data-testid={`button-add-nivel-${categoria.toLowerCase()}`}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Nível
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" data-testid={`text-empty-${categoria.toLowerCase()}`}>
              Nenhum nível configurado para {categoria === "GERAL" ? "Produção Geral" : "Produção Cartão"}.
              <br />
              Clique em "Adicionar Nível" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Ordem</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Pontos Mínimos</TableHead>
                  <TableHead className="text-right">Prêmio</TableHead>
                  <TableHead className="w-16 text-center">Cor</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((nivel, index) => {
                  const Icon = getIconComponent(nivel.icone);
                  return (
                    <TableRow key={nivel.id} data-testid={`row-nivel-${nivel.id}`}>
                      <TableCell className="text-center font-mono text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Icon className="h-5 w-5" style={{ color: nivel.cor || undefined }} />
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold" style={{ color: nivel.cor || undefined }} data-testid={`text-nivel-name-${nivel.id}`}>
                          {nivel.nomeNivel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-nivel-min-${nivel.id}`}>
                        {parseFloat(String(nivel.pontosMinimos)).toLocaleString("pt-BR")} pts
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-nivel-premio-${nivel.id}`}>
                        {formatCurrency(nivel.premio)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div
                          className="w-6 h-6 rounded-md mx-auto border border-border"
                          style={{ backgroundColor: nivel.cor || "#888" }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(nivel)}
                            data-testid={`button-edit-nivel-${nivel.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDelete(nivel.id)}
                            data-testid={`button-delete-nivel-${nivel.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Preview - Como aparece no Dashboard
            </p>
            <div className="flex flex-wrap gap-2">
              {filtered.map((nivel) => {
                const Icon = getIconComponent(nivel.icone);
                return (
                  <Badge
                    key={nivel.id}
                    variant="outline"
                    className="px-3 py-1.5 text-sm font-semibold gap-1.5"
                    style={{ borderColor: nivel.cor || undefined, color: nivel.cor || undefined }}
                    data-testid={`badge-preview-${nivel.id}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {nivel.nomeNivel}
                    <span className="text-xs font-normal ml-1 opacity-70">
                      {formatCurrency(nivel.premio)}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-nivel-form">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nomeNivel">Nome do Nível</Label>
              <Input
                id="nomeNivel"
                placeholder="Ex: BRONZE, PRATA, OURO..."
                value={form.nomeNivel}
                onChange={(e) => setForm({ ...form, nomeNivel: e.target.value })}
                data-testid="input-nome-nivel"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pontosMinimos">Pontos Mínimos</Label>
                <Input
                  id="pontosMinimos"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="100"
                  value={form.pontosMinimos}
                  onChange={(e) => setForm({ ...form, pontosMinimos: e.target.value })}
                  data-testid="input-pontos-minimos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="premio">Valor do Prêmio (R$)</Label>
                <Input
                  id="premio"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="500.00"
                  value={form.premio}
                  onChange={(e) => setForm({ ...form, premio: e.target.value })}
                  data-testid="input-premio"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pontosMaximos">Pontos Máximos</Label>
                <Input
                  id="pontosMaximos"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Opcional"
                  value={form.pontosMaximos}
                  onChange={(e) => setForm({ ...form, pontosMaximos: e.target.value })}
                  data-testid="input-pontos-maximos"
                />
                <p className="text-[10px] text-muted-foreground">Deixe vazio para o nível mais alto</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  min="1"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: e.target.value })}
                  data-testid="input-ordem"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={form.icone} onValueChange={(v) => setForm({ ...form, icone: v })}>
                <SelectTrigger data-testid="select-icone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => {
                    const I = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <I className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="w-7 h-7 rounded-md border-2 transition-transform"
                    style={{
                      backgroundColor: c.value,
                      borderColor: form.cor === c.value ? "hsl(var(--foreground))" : "transparent",
                      transform: form.cor === c.value ? "scale(1.15)" : "scale(1)",
                    }}
                    onClick={() => setForm({ ...form, cor: c.value })}
                    title={c.label}
                    data-testid={`button-color-${c.value.replace("#", "")}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  className="w-10 h-9 p-1 cursor-pointer"
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  data-testid="input-color-custom"
                />
                <Input
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  placeholder="#000000"
                  className="w-28 font-mono text-sm"
                  data-testid="input-color-hex"
                />
              </div>
            </div>

            <div className="border border-border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.cor + "20" }}>
                  <IconComponent className="h-5 w-5" style={{ color: form.cor }} />
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: form.cor }}>{form.nomeNivel || "Nome do Nível"}</p>
                  <p className="text-xs text-muted-foreground">
                    A partir de {form.pontosMinimos ? `${parseFloat(form.pontosMinimos).toLocaleString("pt-BR")} pts` : "0 pts"} — Prêmio: {form.premio ? formatCurrency(form.premio) : "R$ 0,00"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-nivel">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-nivel">
              {isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Nível"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-delete-nivel">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja remover este nível? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GestaoComercialMetasPage() {
  const { data: niveis = [], isLoading } = useQuery<MetaNivel[]>({
    queryKey: ["/api/meta-niveis"],
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl" data-testid="page-gestao-metas">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Target className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Metas & Níveis</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          Configure os níveis de premiação da produção geral e de cartão.
        </p>
      </div>

      <Tabs defaultValue="GERAL" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md" data-testid="tabs-categoria">
          <TabsTrigger value="GERAL" className="gap-2" data-testid="tab-geral">
            <CircleDollarSign className="h-4 w-4" />
            Produção Geral
          </TabsTrigger>
          <TabsTrigger value="CARTAO" className="gap-2" data-testid="tab-cartao">
            <TrendingUp className="h-4 w-4" />
            Produção Cartão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="GERAL" className="mt-4">
          <NiveisTab categoria="GERAL" niveis={niveis} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="CARTAO" className="mt-4">
          <NiveisTab categoria="CARTAO" niveis={niveis} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
