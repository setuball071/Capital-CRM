import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { TabelasSimulator } from "@/components/tabelas-simulator";
import { CriativosGallery } from "@/components/criativos-gallery";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  Smartphone,
  Settings,
  GraduationCap,
  FileText,
  Video,
  ImageIcon,
  Link2,
  Trash2,
  Plus,
  FolderOpen,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import type { Material } from "@shared/schema";

const CATEGORIES = [
  { key: "tabelas", label: "Tabelas", icon: BarChart3, color: "#6C2BD9" },
  { key: "criativos", label: "Criativos", icon: Smartphone, color: "#E91E63" },
  { key: "processos", label: "Processos", icon: Settings, color: "#1E88E5" },
  { key: "tutoriais", label: "Tutoriais", icon: GraduationCap, color: "#00C853" },
] as const;

const TYPE_CONFIG: Record<string, { icon: typeof FileText; bg: string }> = {
  pdf: { icon: FileText, bg: "rgba(239,68,68,0.1)" },
  video: { icon: Video, bg: "rgba(108,43,217,0.1)" },
  image: { icon: ImageIcon, bg: "rgba(30,136,229,0.1)" },
  link: { icon: Link2, bg: "rgba(107,114,128,0.1)" },
};

function getCategoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

interface Props {
  aberto: boolean;
  categoria: string;
  onClose: () => void;
}

export function MaterialApoioModal({ aberto, categoria, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "master" || user?.role === "coordenacao";
  const catMeta = getCategoryMeta(categoria);
  const CatIcon = catMeta.icon;

  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: categoria,
    type: "pdf",
    url: "",
    description: "",
  });

  useEffect(() => {
    setFormData((f) => ({ ...f, category: categoria }));
  }, [categoria]);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (aberto) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [aberto, handleEsc]);

  const { data: materialsList = [], isLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials", categoria],
    queryFn: async () => {
      const res = await fetch(`/api/materials?category=${categoria}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: aberto && !!categoria,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => apiRequest("POST", "/api/materials", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials", categoria] });
      setAddOpen(false);
      setFormData({ title: "", category: categoria, type: "pdf", url: "", description: "" });
      toast({ title: "Material adicionado" });
    },
    onError: () => toast({ title: "Erro ao adicionar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials", categoria] });
      toast({ title: "Material removido" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      data-testid="modal-material-overlay"
    >
      <div
        className="bg-background rounded-2xl flex flex-col overflow-hidden"
        style={{ width: "min(90vw, 900px)", height: "min(85vh, 700px)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-material-content"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${catMeta.color}15` }}
            >
              <CatIcon className="h-4 w-4" style={{ color: catMeta.color }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" data-testid="modal-material-title">
                {catMeta.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Carregando..." : `${materialsList.length} material(is)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && categoria !== "tabelas" && categoria !== "criativos" && (
              <Button size="sm" onClick={() => setAddOpen(!addOpen)} data-testid="modal-btn-add">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="modal-btn-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {addOpen && (
          <div className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nome do material"
                  data-testid="modal-input-title"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="modal-select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://drive.google.com/..."
                data-testid="modal-input-url"
              />
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição"
                rows={2}
                data-testid="modal-input-desc"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={createMutation.isPending}
                onClick={() => {
                  if (!formData.title.trim() || !formData.url.trim()) {
                    toast({ title: "Preencha título e URL", variant: "destructive" });
                    return;
                  }
                  createMutation.mutate(formData);
                }}
                data-testid="modal-btn-save"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {categoria === "tabelas" ? (
            <TabelasSimulator />
          ) : categoria === "criativos" ? (
            <CriativosGallery />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : materialsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm" data-testid="modal-empty">
                Nenhum material nesta categoria ainda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {materialsList.map((mat) => {
                const typeCfg = TYPE_CONFIG[mat.type] || TYPE_CONFIG.link;
                const TypeIcon = typeCfg.icon;
                return (
                  <Card key={mat.id} className="p-3 flex flex-col gap-2" data-testid={`modal-card-${mat.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm truncate flex-1">{mat.title}</h3>
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center"
                        style={{ backgroundColor: typeCfg.bg }}
                      >
                        <TypeIcon className="h-3.5 w-3.5" style={{ color: catMeta.color }} />
                      </div>
                    </div>
                    {mat.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{mat.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        style={{ background: "linear-gradient(90deg, #6C2BD9, #1E88E5)" }}
                        onClick={() => window.open(mat.url, "_blank")}
                        data-testid={`modal-open-${mat.id}`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Abrir
                      </Button>
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Remover este material?")) deleteMutation.mutate(mat.id);
                          }}
                          data-testid={`modal-delete-${mat.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
