import { useState, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Download,
  Palette,
  Settings2,
  ImageIcon,
  FolderOpen,
} from "lucide-react";
import { CardFinalizer } from "@/components/card-finalizer";
import type { Creative, CreativePack } from "@shared/schema";

export function CriativosGallery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "master" || user?.role === "coordenacao";

  const [tipoFilter, setTipoFilter] = useState("todos");
  const [packFilter, setPackFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null);
  const [packsDialogOpen, setPacksDialogOpen] = useState(false);
  const [packForm, setPackForm] = useState({ nome: "", descricao: "" });
  const [editingPack, setEditingPack] = useState<CreativePack | null>(null);

  const [finalizerOpen, setFinalizerOpen] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  const [form, setForm] = useState({
    title: "",
    packId: "",
    imageUrl: "",
    tipo: "personalizavel",
    ativo: true,
  });

  const { data: packs = [], isLoading: packsLoading } = useQuery<CreativePack[]>({
    queryKey: ["/api/creative-packs"],
  });

  const { data: allCreatives = [], isLoading: creativesLoading } = useQuery<Creative[]>({
    queryKey: ["/api/creatives"],
  });

  const filtered = useMemo(() => {
    let list = allCreatives;
    if (tipoFilter !== "todos") list = list.filter((c) => c.tipo === tipoFilter);
    if (packFilter !== "todos") list = list.filter((c) => String(c.packId) === packFilter);
    return list;
  }, [allCreatives, tipoFilter, packFilter]);

  const packMap = useMemo(() => {
    const m: Record<number, string> = {};
    packs.forEach((p) => { m[p.id] = p.nome; });
    return m;
  }, [packs]);

  const openAddCreative = () => {
    setEditingCreative(null);
    setForm({ title: "", packId: packs[0]?.id ? String(packs[0].id) : "", imageUrl: "", tipo: "personalizavel", ativo: true });
    setDialogOpen(true);
  };

  const openEditCreative = (c: Creative) => {
    setEditingCreative(c);
    setForm({ title: c.title, packId: String(c.packId), imageUrl: c.imageUrl, tipo: c.tipo, ativo: c.ativo !== false });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const body = { title: data.title, packId: parseInt(data.packId), imageUrl: data.imageUrl, tipo: data.tipo, ativo: data.ativo };
      if (editingCreative) return apiRequest("PUT", `/api/creatives/${editingCreative.id}`, body);
      return apiRequest("POST", "/api/creatives", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creatives"] });
      setDialogOpen(false);
      toast({ title: editingCreative ? "Criativo atualizado" : "Criativo adicionado" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/creatives/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creatives"] });
      toast({ title: "Criativo removido" });
    },
  });

  const savePackMutation = useMutation({
    mutationFn: async (data: typeof packForm) => {
      if (editingPack) return apiRequest("PUT", `/api/creative-packs/${editingPack.id}`, data);
      return apiRequest("POST", "/api/creative-packs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creative-packs"] });
      setEditingPack(null);
      setPackForm({ nome: "", descricao: "" });
      toast({ title: editingPack ? "Pack atualizado" : "Pack criado" });
    },
    onError: () => toast({ title: "Erro ao salvar pack", variant: "destructive" }),
  });

  const deletePackMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/creative-packs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creative-packs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/creatives"] });
      toast({ title: "Pack removido" });
    },
  });

  const isLoading = packsLoading || creativesLoading;

  return (
    <div className="space-y-5" data-testid="criativos-gallery">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" style={{ color: "#E91E63" }} />
          <h3 className="text-base font-semibold" data-testid="text-criativos-title">Galeria de Criativos</h3>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditingPack(null); setPackForm({ nome: "", descricao: "" }); setPacksDialogOpen(true); }} data-testid="button-manage-packs">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Gerenciar Packs
            </Button>
            <Button size="sm" onClick={openAddCreative} data-testid="button-add-creative">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar Criativo
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="personalizavel">Personalizáveis</SelectItem>
            <SelectItem value="avulso">Avulsos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={packFilter} onValueChange={setPackFilter}>
          <SelectTrigger className="w-[220px]" data-testid="filter-pack">
            <SelectValue placeholder="Pack" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os packs</SelectItem>
            {packs.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm mb-3" data-testid="text-empty-criativos">
            Nenhum criativo disponível ainda.
          </p>
          {canManage && (
            <Button size="sm" onClick={openAddCreative}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar Criativo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="overflow-hidden flex flex-col" data-testid={`creative-card-${c.id}`}>
              <div className="relative aspect-[4/5] bg-muted">
                <img
                  src={c.imageUrl}
                  alt={c.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {canManage && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1" style={{ visibility: "visible" }}>
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => openEditCreative(c)} data-testid={`edit-creative-${c.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover este criativo?")) deleteMutation.mutate(c.id); }} data-testid={`delete-creative-${c.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <h4 className="text-xs font-semibold truncate flex-1">{c.title}</h4>
                  <Badge variant={c.tipo === "personalizavel" ? "default" : "secondary"} className="text-[10px] flex-shrink-0" style={c.tipo === "personalizavel" ? { background: "#6C2BD9" } : {}}>
                    {c.tipo === "personalizavel" ? "Personalizável" : "Avulso"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{packMap[c.packId] || ""}</p>
                <div className="mt-auto">
                  {c.tipo === "personalizavel" ? (
                    <Button
                      size="sm"
                      className="w-full"
                      style={{ background: "linear-gradient(90deg, #9b3dd6, #e91e8c)" }}
                      onClick={() => { setSelectedCreative(c); setFinalizerOpen(true); }}
                      data-testid={`personalize-${c.id}`}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Personalizar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(c.imageUrl, "_blank")} data-testid={`download-${c.id}`}>
                      <Download className="h-3 w-3 mr-1" />
                      Baixar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-creative">
          <DialogHeader>
            <DialogTitle>{editingCreative ? "Editar Criativo" : "Adicionar Criativo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do criativo" data-testid="form-creative-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pack</Label>
                <Select value={form.packId} onValueChange={(v) => setForm({ ...form, packId: v })}>
                  <SelectTrigger data-testid="form-creative-pack">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {packs.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger data-testid="form-creative-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personalizavel">Personalizável</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL da Imagem</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://drive.google.com/..." data-testid="form-creative-url" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} data-testid="form-creative-ativo" />
              <Label className="text-xs">Ativo</Label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                disabled={saveMutation.isPending}
                onClick={() => {
                  if (!form.title.trim() || !form.imageUrl.trim() || !form.packId) {
                    toast({ title: "Preencha todos os campos", variant: "destructive" });
                    return;
                  }
                  saveMutation.mutate(form);
                }}
                data-testid="button-save-creative"
              >
                {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={packsDialogOpen} onOpenChange={setPacksDialogOpen}>
        <DialogContent data-testid="dialog-packs">
          <DialogHeader>
            <DialogTitle>Gerenciar Packs</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-auto">
              {packs.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-muted-foreground truncate">{p.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditingPack(p); setPackForm({ nome: p.nome, descricao: p.descricao || "" }); }} data-testid={`edit-pack-${p.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover pack e todos seus criativos?")) deletePackMutation.mutate(p.id); }} data-testid={`delete-pack-${p.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {packs.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum pack criado.</p>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium">{editingPack ? "Editar Pack" : "Novo Pack"}</p>
              <Input value={packForm.nome} onChange={(e) => setPackForm({ ...packForm, nome: e.target.value })} placeholder="Nome do pack" data-testid="form-pack-nome" />
              <Input value={packForm.descricao} onChange={(e) => setPackForm({ ...packForm, descricao: e.target.value })} placeholder="Descrição (opcional)" data-testid="form-pack-descricao" />
              <div className="flex gap-2 justify-end">
                {editingPack && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingPack(null); setPackForm({ nome: "", descricao: "" }); }}>
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={savePackMutation.isPending}
                  onClick={() => {
                    if (!packForm.nome.trim()) { toast({ title: "Informe o nome do pack", variant: "destructive" }); return; }
                    savePackMutation.mutate(packForm);
                  }}
                  data-testid="button-save-pack"
                >
                  {savePackMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {editingPack ? "Salvar" : "Criar Pack"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCreative && (
        <CardFinalizer
          aberto={finalizerOpen}
          criativo={selectedCreative}
          onClose={() => { setFinalizerOpen(false); setSelectedCreative(null); }}
        />
      )}
    </div>
  );
}
