import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, Eye, Wand2, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface SystemUpdate {
  id: number;
  title: string;
  raw_input: string;
  content_what: string;
  content_how: string;
  content_impact: string;
  target_roles: string[];
  image_urls: string[];
  is_active: boolean;
  published_at: string;
  created_by_name: string | null;
  reads_count: number;
  target_count: number;
}

interface UpdateRead {
  user_name: string;
  user_role: string;
  read_at: string;
}

const ROLE_OPTIONS = [
  { value: "todos", label: "Todos os usuários" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "atendimento", label: "Atendimento" },
  { value: "operacional", label: "Operacional" },
  { value: "vendedor", label: "Vendedor" },
];

const ROLE_LABELS: Record<string, string> = {
  todos: "Todos",
  master: "Master",
  coordenacao: "Coordenação",
  atendimento: "Atendimento",
  operacional: "Operacional",
  vendedor: "Vendedor",
};

function getRoleColor(role: string): "default" | "secondary" | "destructive" | "outline" {
  const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    todos: "secondary",
    master: "destructive",
    coordenacao: "default",
    atendimento: "outline",
    operacional: "outline",
    vendedor: "outline",
  };
  return colors[role] ?? "outline";
}

const EMPTY_FORM = {
  title: "",
  rawInput: "",
  contentWhat: "",
  contentHow: "",
  contentImpact: "",
  targetRoles: ["todos"] as string[],
  imageUrls: [] as string[],
  isActive: true,
};

const MAX_IMAGES = 5;
const MAX_IMG_BYTES = 3 * 1024 * 1024;

export default function SystemUpdatesPage() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [readsSheet, setReadsSheet] = useState<SystemUpdate | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const processImageFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setForm(prev => {
      const slots = MAX_IMAGES - prev.imageUrls.length;
      if (slots <= 0) {
        toast({ title: `Máximo de ${MAX_IMAGES} imagens por atualização`, variant: "destructive" });
        return prev;
      }
      const toProcess = arr.slice(0, slots);
      toProcess.forEach(file => {
        if (file.size > MAX_IMG_BYTES) {
          toast({ title: `"${file.name}" excede 3MB e foi ignorado`, variant: "destructive" });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (!dataUrl) return;
          setForm(p => {
            if (p.imageUrls.length >= MAX_IMAGES) return p;
            return { ...p, imageUrls: [...p.imageUrls, dataUrl] };
          });
        };
        reader.readAsDataURL(file);
      });
      return prev;
    });
  }, [toast]);

  useEffect(() => {
    if (!openDialog) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0) {
        e.preventDefault();
        processImageFiles(items);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [openDialog, processImageFiles]);

  const { data: updates = [], isLoading } = useQuery<SystemUpdate[]>({
    queryKey: ["/api/system-updates"],
    queryFn: () => apiRequest("GET", "/api/system-updates").then(r => r.json()),
  });

  const { data: reads = [], isLoading: readsLoading } = useQuery<UpdateRead[]>({
    queryKey: ["/api/system-updates", readsSheet?.id, "reads"],
    queryFn: () => apiRequest("GET", `/api/system-updates/${readsSheet!.id}/reads`).then(r => r.json()),
    enabled: !!readsSheet,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("POST", "/api/system-updates", data).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Atualização criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-updates"] });
      setOpenDialog(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Erro ao criar atualização", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest("PUT", `/api/system-updates/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Atualização salva com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-updates"] });
      setOpenDialog(false);
      setEditingUpdate(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Erro ao salvar atualização", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/system-updates/${id}`),
    onSuccess: () => {
      toast({ title: "Atualização removida" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-updates"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Erro ao remover atualização", variant: "destructive" }),
  });

  function openCreate() {
    setEditingUpdate(null);
    setForm(EMPTY_FORM);
    setOpenDialog(true);
  }

  function openEdit(u: SystemUpdate) {
    setEditingUpdate(u);
    setForm({
      title: u.title,
      rawInput: u.raw_input,
      contentWhat: u.content_what,
      contentHow: u.content_how,
      contentImpact: u.content_impact,
      targetRoles: u.target_roles,
      imageUrls: u.image_urls ?? [],
      isActive: u.is_active,
    });
    setOpenDialog(true);
  }

  async function generateWithAI() {
    if (!form.rawInput.trim() || form.rawInput.trim().length < 10) {
      toast({ title: "Digite o texto técnico antes de gerar com IA", variant: "destructive" });
      return;
    }
    setGeneratingAI(true);
    try {
      const res = await apiRequest("POST", "/api/system-updates/generate", { rawInput: form.rawInput });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForm(prev => ({
        ...prev,
        contentWhat: data.contentWhat,
        contentHow: data.contentHow,
        contentImpact: data.contentImpact,
      }));
      toast({ title: "Conteúdo gerado com sucesso pela IA" });
    } catch (err: any) {
      toast({ title: err?.message || "Erro ao gerar conteúdo", variant: "destructive" });
    } finally {
      setGeneratingAI(false);
    }
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" }); return;
    }
    if (!form.rawInput.trim()) {
      toast({ title: "Texto técnico é obrigatório", variant: "destructive" }); return;
    }
    if (!form.contentWhat.trim() || !form.contentHow.trim() || !form.contentImpact.trim()) {
      toast({ title: "Gere o conteúdo com IA antes de salvar", variant: "destructive" }); return;
    }
    if (form.targetRoles.length === 0) {
      toast({ title: "Selecione pelo menos um público-alvo", variant: "destructive" }); return;
    }

    if (editingUpdate) {
      editMutation.mutate({ id: editingUpdate.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function toggleRole(role: string) {
    if (role === "todos") {
      setForm(prev => ({
        ...prev,
        targetRoles: prev.targetRoles.includes("todos") ? [] : ["todos"],
      }));
      return;
    }
    setForm(prev => {
      const without = prev.targetRoles.filter(r => r !== "todos" && r !== role);
      const hasRole = prev.targetRoles.includes(role);
      return { ...prev, targetRoles: hasRole ? without : [...without, role] };
    });
  }

  const isPending = createMutation.isPending || editMutation.isPending;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Central de Atualizações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie avisos do sistema para colaboradores</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-update">
          <Plus className="h-4 w-4 mr-2" />
          Nova Atualização
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base">Nenhuma atualização publicada ainda.</p>
          <p className="text-sm mt-1">Clique em "Nova Atualização" para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <div key={u.id} className="rounded-md border border-border bg-card">
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{u.title}</span>
                    {!u.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                    )}
                    {u.target_roles.map(r => (
                      <Badge key={r} variant={getRoleColor(r)} className="text-xs">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{format(new Date(u.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    {u.created_by_name && <span>por {u.created_by_name}</span>}
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setReadsSheet(u)}
                      data-testid={`button-reads-${u.id}`}
                    >
                      <Eye className="h-3 w-3" />
                      {u.reads_count} / {u.target_count} leituras
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                    data-testid={`button-expand-${u.id}`}
                  >
                    {expandedId === u.id
                      ? <ChevronUp className="h-4 w-4" />
                      : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(u)}
                    data-testid={`button-edit-${u.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteId(u.id)}
                    data-testid={`button-delete-${u.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {expandedId === u.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">O que mudou</p>
                    <p className="text-sm whitespace-pre-line">{u.content_what}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Como funciona</p>
                    <p className="text-sm whitespace-pre-line">{u.content_how}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Impacto no dia a dia</p>
                    <p className="text-sm whitespace-pre-line">{u.content_impact}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog criar / editar */}
      <Dialog open={openDialog} onOpenChange={open => { if (!open) { setOpenDialog(false); setEditingUpdate(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUpdate ? "Editar Atualização" : "Nova Atualização"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="update-title">Título *</Label>
              <Input
                id="update-title"
                placeholder="Ex: Novo módulo de contratos disponível"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                data-testid="input-update-title"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="update-raw">Texto técnico (input para IA) *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={generateWithAI}
                  disabled={generatingAI}
                  data-testid="button-generate-ai"
                >
                  {generatingAI
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Gerando...</>
                    : <><Wand2 className="h-3.5 w-3.5 mr-1.5" />Gerar com IA</>}
                </Button>
              </div>
              <Textarea
                id="update-raw"
                placeholder="Cole aqui o changelog técnico, descrição da tarefa, diff ou notas do sistema..."
                value={form.rawInput}
                onChange={e => setForm(p => ({ ...p, rawInput: e.target.value }))}
                rows={4}
                data-testid="textarea-update-raw"
              />
              <p className="text-xs text-muted-foreground">A IA vai transformar isso em linguagem simples para os colaboradores</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="update-what">O que mudou *</Label>
              <Textarea
                id="update-what"
                placeholder="Gerado pela IA ou escreva manualmente..."
                value={form.contentWhat}
                onChange={e => setForm(p => ({ ...p, contentWhat: e.target.value }))}
                rows={2}
                data-testid="textarea-update-what"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="update-how">Como funciona *</Label>
              <Textarea
                id="update-how"
                placeholder="Gerado pela IA ou escreva manualmente..."
                value={form.contentHow}
                onChange={e => setForm(p => ({ ...p, contentHow: e.target.value }))}
                rows={2}
                data-testid="textarea-update-how"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="update-impact">Impacto no dia a dia *</Label>
              <Textarea
                id="update-impact"
                placeholder="Gerado pela IA ou escreva manualmente..."
                value={form.contentImpact}
                onChange={e => setForm(p => ({ ...p, contentImpact: e.target.value }))}
                rows={2}
                data-testid="textarea-update-impact"
              />
            </div>

            {/* Image upload section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Imagens <span className="text-muted-foreground font-normal">(opcional — até {MAX_IMAGES}, máx 3MB cada)</span></Label>
                {form.imageUrls.length > 0 && (
                  <span className="text-xs text-muted-foreground">{form.imageUrls.length}/{MAX_IMAGES}</span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) processImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {/* Drop zone */}
              {form.imageUrls.length < MAX_IMAGES && (
                <div
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-5 transition-colors cursor-pointer ${
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragOver(false);
                    processImageFiles(e.dataTransfer.files);
                  }}
                  data-testid="drop-zone-images"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Clique, arraste ou cole (Ctrl+V) uma imagem
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">PNG, JPG, WebP — máx 3MB</p>
                  </div>
                </div>
              )}

              {/* Thumbnails */}
              {form.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {form.imageUrls.map((src, idx) => (
                    <div key={idx} className="relative group" data-testid={`thumb-image-${idx}`}>
                      <img
                        src={src}
                        alt={`Imagem ${idx + 1}`}
                        className="h-20 w-20 rounded-md object-cover border border-border"
                      />
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setForm(p => ({ ...p, imageUrls: p.imageUrls.filter((_, i) => i !== idx) }))}
                        data-testid={`button-remove-image-${idx}`}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Público-alvo *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${opt.value}`}
                      checked={form.targetRoles.includes(opt.value)}
                      onCheckedChange={() => toggleRole(opt.value)}
                      data-testid={`checkbox-role-${opt.value}`}
                    />
                    <label htmlFor={`role-${opt.value}`} className="text-sm cursor-pointer select-none">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="update-active"
                checked={form.isActive}
                onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))}
                data-testid="switch-update-active"
              />
              <Label htmlFor="update-active">Ativo (exibe o popup para usuários)</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setOpenDialog(false); setEditingUpdate(null); setForm(EMPTY_FORM); }}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-save-update"
            >
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publicando...</> : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atualização?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A atualização e todos os registros de leitura serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sheet de leituras */}
      <Sheet open={!!readsSheet} onOpenChange={open => !open && setReadsSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Quem leu</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {readsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : reads.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma leitura registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {reads.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.user_name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[r.user_role] ?? r.user_role}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(r.read_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
