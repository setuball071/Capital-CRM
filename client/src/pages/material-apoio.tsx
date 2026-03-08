import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import type { Material } from "@shared/schema";

const CATEGORIES = [
  { key: "tabelas", label: "Tabelas", icon: BarChart3, color: "#6C2BD9" },
  { key: "criativos", label: "Criativos", icon: Smartphone, color: "#E91E63" },
  { key: "processos", label: "Processos", icon: Settings, color: "#1E88E5" },
  { key: "tutoriais", label: "Tutoriais", icon: GraduationCap, color: "#00C853" },
] as const;

const TYPE_CONFIG: Record<string, { icon: typeof FileText; bg: string; label: string }> = {
  pdf: { icon: FileText, bg: "rgba(239,68,68,0.1)", label: "PDF" },
  video: { icon: Video, bg: "rgba(108,43,217,0.1)", label: "Video" },
  image: { icon: ImageIcon, bg: "rgba(30,136,229,0.1)", label: "Imagem" },
  link: { icon: Link2, bg: "rgba(107,114,128,0.1)", label: "Link" },
};

function getCategoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

export default function MaterialApoioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const canManage = user?.role === "master" || user?.role === "coordenacao";

  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get("categoria") || "todos";
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "tabelas",
    type: "pdf",
    url: "",
    description: "",
  });

  const categoryParam = activeCategory !== "todos" ? activeCategory : undefined;
  const { data: materialsList = [], isLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials", categoryParam],
    queryFn: async () => {
      const url = categoryParam
        ? `/api/materials?category=${categoryParam}`
        : "/api/materials";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch materials");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/materials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setDialogOpen(false);
      setFormData({ title: "", category: "tabelas", type: "pdf", url: "", description: "" });
      toast({ title: "Material adicionado" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar material", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover material", variant: "destructive" });
    },
  });

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    const newUrl = cat === "todos" ? "/material-apoio" : `/material-apoio?categoria=${cat}`;
    window.history.replaceState(null, "", newUrl);
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      toast({ title: "Preencha título e URL", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Material de Apoio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acesse tabelas, criativos, tutoriais e processos internos
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-material">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Material
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeCategory === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => handleCategoryChange("todos")}
          data-testid="tab-todos"
        >
          Todos
        </Button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryChange(cat.key)}
              data-testid={`tab-${cat.key}`}
            >
              <Icon className="h-3.5 w-3.5 mr-1.5" />
              {cat.label}
            </Button>
          );
        })}
      </div>

      {activeCategory === "tabelas" ? (
        <TabelasSimulator />
      ) : activeCategory === "criativos" ? (
        <CriativosGallery />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : materialsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4" data-testid="text-empty">
            Nenhum material nesta categoria ainda.
          </p>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-empty">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Material
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materialsList.map((mat) => {
            const catMeta = getCategoryMeta(mat.category);
            const typeCfg = TYPE_CONFIG[mat.type] || TYPE_CONFIG.link;
            const TypeIcon = typeCfg.icon;

            return (
              <Card key={mat.id} className="p-4 flex flex-col gap-3" data-testid={`card-material-${mat.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate" data-testid={`text-title-${mat.id}`}>
                      {mat.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="mt-1.5 text-[10px]"
                      style={{ backgroundColor: `${catMeta.color}15`, color: catMeta.color }}
                    >
                      {catMeta.label}
                    </Badge>
                  </div>
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: typeCfg.bg }}
                  >
                    <TypeIcon className="h-4 w-4" style={{ color: catMeta.color }} />
                  </div>
                </div>

                {mat.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-desc-${mat.id}`}>
                    {mat.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    style={{ background: "linear-gradient(90deg, #6C2BD9, #1E88E5)" }}
                    onClick={() => window.open(mat.url, "_blank")}
                    data-testid={`button-open-${mat.id}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Abrir
                  </Button>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Remover este material?")) {
                          deleteMutation.mutate(mat.id);
                        }
                      }}
                      data-testid={`button-delete-${mat.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-add-material">
          <DialogHeader>
            <DialogTitle>Adicionar Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nome do material"
                data-testid="input-material-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger data-testid="select-material-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger data-testid="select-material-type">
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
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://drive.google.com/..."
                data-testid="input-material-url"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição do material"
                rows={3}
                data-testid="input-material-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-material">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-save-material">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
