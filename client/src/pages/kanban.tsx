import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, GripVertical, X, Edit, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { KANBAN_COLUMNS, TASK_PRIORITIES, type PersonalTask, type KanbanColumn, type TaskPriority } from "@shared/schema";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  backlog: "Backlog",
  a_fazer: "A Fazer",
  em_execucao: "Em Execução",
  aguardando: "Aguardando",
  concluido: "Concluído",
};

const COLUMN_COLORS: Record<KanbanColumn, string> = {
  backlog: "border-t-muted-foreground",
  a_fazer: "border-t-blue-500",
  em_execucao: "border-t-amber-500",
  aguardando: "border-t-purple-500",
  concluido: "border-t-green-500",
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  alta: { label: "Alta", variant: "destructive" },
  media: { label: "Média", variant: "default" },
  baixa: { label: "Baixa", variant: "secondary" },
};

export default function KanbanPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
  const [draggedTask, setDraggedTask] = useState<PersonalTask | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "media" as TaskPriority,
    column: "backlog" as KanbanColumn,
    tags: "",
    dueDate: "",
  });

  const { data: tasks = [], isLoading } = useQuery<PersonalTask[]>({
    queryKey: ["/api/kanban/tasks"],
  });

  const { data: stats = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/kanban/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const body = {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        column: data.column,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      };
      return apiRequest("/api/kanban/tasks", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/stats"] });
      setAddDialogOpen(false);
      setNewTask({ title: "", description: "", priority: "media", column: "backlog", tags: "", dueDate: "" });
      toast({ title: "Tarefa criada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar tarefa", description: error.message || "Tente novamente", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      return apiRequest(`/api/kanban/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/stats"] });
      setEditingTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tarefa", description: error.message || "Tente novamente", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/kanban/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/stats"] });
      toast({ title: "Tarefa excluída" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir tarefa", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ column, taskIds }: { column: string; taskIds: number[] }) => {
      return apiRequest("/api/kanban/reorder", { method: "POST", body: JSON.stringify({ column, taskIds }), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao reordenar", description: error.message, variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent, task: PersonalTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetColumn: KanbanColumn) => {
    e.preventDefault();
    if (!draggedTask) return;

    if (draggedTask.column !== targetColumn) {
      const targetTasks = tasks.filter(t => t.column === targetColumn);
      updateMutation.mutate({ 
        id: draggedTask.id, 
        column: targetColumn,
        orderIndex: targetTasks.length 
      });
    }
    setDraggedTask(null);
  };

  const getColumnTasks = (column: KanbanColumn) => {
    return tasks.filter(t => t.column === column).sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    createMutation.mutate(newTask);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    const formData = {
      title: (document.getElementById("edit-title") as HTMLInputElement)?.value,
      description: (document.getElementById("edit-description") as HTMLTextAreaElement)?.value || null,
      priority: (document.getElementById("edit-priority") as HTMLSelectElement)?.value as TaskPriority,
      tags: (document.getElementById("edit-tags") as HTMLInputElement)?.value?.split(",").map(t => t.trim()).filter(Boolean) || null,
      dueDate: (document.getElementById("edit-dueDate") as HTMLInputElement)?.value ? new Date((document.getElementById("edit-dueDate") as HTMLInputElement)?.value).toISOString() : null,
    };
    updateMutation.mutate({ id: editingTask.id, ...formData });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-kanban">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden" data-testid="page-kanban">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Kanban Pessoal</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas tarefas pessoais</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-task">
              <Plus className="w-4 h-4 mr-2" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <Input
                placeholder="Título da tarefa"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                data-testid="input-task-title"
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                data-testid="input-task-description"
              />
              <div className="flex gap-2">
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newTask.column} onValueChange={(v) => setNewTask({ ...newTask, column: v as KanbanColumn })}>
                  <SelectTrigger data-testid="select-task-column">
                    <SelectValue placeholder="Coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map((c) => (
                      <SelectItem key={c} value={c}>{COLUMN_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Tags (separadas por vírgula)"
                value={newTask.tags}
                onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
                data-testid="input-task-tags"
              />
              <Input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                data-testid="input-task-due-date"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-task">
                  {createMutation.isPending ? "Criando..." : "Criar Tarefa"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => {
          const columnTasks = getColumnTasks(column);
          const isExecutionColumn = column === "em_execucao";
          const atLimit = isExecutionColumn && columnTasks.length >= 3;

          return (
            <div
              key={column}
              className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
              data-testid={`column-${column}`}
            >
              <div className={`p-3 border-t-4 ${COLUMN_COLORS[column]} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{COLUMN_LABELS[column]}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnTasks.length}{isExecutionColumn && "/3"}
                  </Badge>
                </div>
                {isExecutionColumn && atLimit && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Limite atingido
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                {columnTasks.map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    className={`cursor-move hover-elevate ${draggedTask?.id === task.id ? "opacity-50" : ""}`}
                    data-testid={`task-card-${task.id}`}
                  >
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm line-clamp-2">{task.title}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setEditingTask(task)}
                            data-testid={`button-edit-task-${task.id}`}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => deleteMutation.mutate(task.id)}
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={PRIORITY_CONFIG[task.priority as TaskPriority]?.variant || "default"} className="text-xs">
                          {PRIORITY_CONFIG[task.priority as TaskPriority]?.label || task.priority}
                        </Badge>
                        {task.tags && Array.isArray(task.tags) && task.tags.map((tag: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 mt-2 text-xs ${isPast(new Date(task.dueDate)) && task.column !== "concluido" ? "text-destructive" : isToday(new Date(task.dueDate)) ? "text-amber-600" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                      {task.column === "concluido" && task.completedAt && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Concluído em {format(new Date(task.completedAt), "dd/MM", { locale: ptBR })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <Input
                id="edit-title"
                placeholder="Título"
                defaultValue={editingTask.title}
                data-testid="input-edit-title"
              />
              <Textarea
                id="edit-description"
                placeholder="Descrição"
                defaultValue={editingTask.description || ""}
                data-testid="input-edit-description"
              />
              <Select defaultValue={editingTask.priority}>
                <SelectTrigger id="edit-priority" data-testid="select-edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="edit-tags"
                placeholder="Tags"
                defaultValue={Array.isArray(editingTask.tags) ? editingTask.tags.join(", ") : ""}
                data-testid="input-edit-tags"
              />
              <Input
                id="edit-dueDate"
                type="date"
                defaultValue={editingTask.dueDate ? format(new Date(editingTask.dueDate), "yyyy-MM-dd") : ""}
                data-testid="input-edit-due-date"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTask(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
