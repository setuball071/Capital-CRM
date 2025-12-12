import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Tag } from "lucide-react";
import type { LeadTag } from "@shared/schema";

interface TagUsage {
  tagId: number;
  count: number;
}

const COLOR_OPTIONS = [
  { value: "#22c55e", label: "Verde", class: "bg-green-500" },
  { value: "#3b82f6", label: "Azul", class: "bg-blue-500" },
  { value: "#ef4444", label: "Vermelho", class: "bg-red-500" },
  { value: "#eab308", label: "Amarelo", class: "bg-yellow-500" },
  { value: "#a855f7", label: "Roxo", class: "bg-purple-500" },
  { value: "#f97316", label: "Laranja", class: "bg-orange-500" },
  { value: "#ec4899", label: "Rosa", class: "bg-pink-500" },
];

export default function VendasEtiquetas() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTag, setSelectedTag] = useState<LeadTag | null>(null);
  const [formData, setFormData] = useState({ nome: "", cor: "#3b82f6" });

  const { data: tags, isLoading: loadingTags } = useQuery<LeadTag[]>({
    queryKey: ["/api/vendas/tags"],
  });

  const { data: usage, isLoading: loadingUsage } = useQuery<TagUsage[]>({
    queryKey: ["/api/vendas/tags/usage"],
  });

  const getUsageCount = (tagId: number): number => {
    return usage?.find((u) => u.tagId === tagId)?.count || 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string }) => {
      return apiRequest("POST", "/api/vendas/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags/usage"] });
      toast({ title: "Etiqueta criada com sucesso!" });
      setShowCreateDialog(false);
      setFormData({ nome: "", cor: "#3b82f6" });
    },
    onError: () => {
      toast({ title: "Erro ao criar etiqueta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { nome?: string; cor?: string } }) => {
      return apiRequest("PATCH", `/api/vendas/tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags"] });
      toast({ title: "Etiqueta atualizada com sucesso!" });
      setShowEditDialog(false);
      setSelectedTag(null);
      setFormData({ nome: "", cor: "#3b82f6" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar etiqueta", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/vendas/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/tags/usage"] });
      toast({ title: "Etiqueta excluída com sucesso!" });
      setShowDeleteDialog(false);
      setSelectedTag(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir etiqueta", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = () => {
    if (!selectedTag || !formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedTag.id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedTag) return;
    deleteMutation.mutate(selectedTag.id);
  };

  const openEditDialog = (tag: LeadTag) => {
    setSelectedTag(tag);
    setFormData({ nome: tag.nome, cor: tag.cor });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (tag: LeadTag) => {
    setSelectedTag(tag);
    setShowDeleteDialog(true);
  };

  const openCreateDialog = () => {
    setFormData({ nome: "", cor: "#3b82f6" });
    setShowCreateDialog(true);
  };

  const isLoading = loadingTags || loadingUsage;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gestão de Etiquetas
            </CardTitle>
            <CardDescription>
              Crie e gerencie etiquetas para organizar seus leads
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-nova-etiqueta">
            <Plus className="h-4 w-4 mr-2" />
            Nova Etiqueta
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !tags || tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma etiqueta criada. Clique em "Nova Etiqueta" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
                    <TableCell>
                      <Badge
                        style={{ backgroundColor: tag.cor, color: "#fff" }}
                        data-testid={`badge-tag-${tag.id}`}
                      >
                        {tag.nome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: tag.cor }}
                          data-testid={`color-indicator-${tag.id}`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {COLOR_OPTIONS.find((c) => c.value === tag.cor)?.label || tag.cor}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" data-testid={`usage-count-${tag.id}`}>
                        {getUsageCount(tag.id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(tag)}
                          data-testid={`button-edit-${tag.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteDialog(tag)}
                          data-testid={`button-delete-${tag.id}`}
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Etiqueta</DialogTitle>
            <DialogDescription>
              Crie uma nova etiqueta para organizar seus leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Interessado, Retornar, VIP..."
                data-testid="input-nome"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, cor: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.cor === color.value ? "ring-2 ring-offset-2 ring-primary" : ""
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                    data-testid={`color-option-${color.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label>Prévia</Label>
              <div className="mt-2">
                <Badge style={{ backgroundColor: formData.cor, color: "#fff" }}>
                  {formData.nome || "Nome da etiqueta"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-salvar-criar"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Etiqueta</DialogTitle>
            <DialogDescription>
              Altere o nome ou a cor da etiqueta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Interessado, Retornar, VIP..."
                data-testid="input-edit-nome"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, cor: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.cor === color.value ? "ring-2 ring-offset-2 ring-primary" : ""
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                    data-testid={`edit-color-option-${color.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label>Prévia</Label>
              <div className="mt-2">
                <Badge style={{ backgroundColor: formData.cor, color: "#fff" }}>
                  {formData.nome || "Nome da etiqueta"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateMutation.isPending}
              data-testid="button-salvar-editar"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etiqueta "{selectedTag?.nome}"?
              Esta ação não pode ser desfeita e a etiqueta será removida de todos os leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirmar-excluir"
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
