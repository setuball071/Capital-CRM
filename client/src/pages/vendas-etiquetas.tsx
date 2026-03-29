// pages/vendas-etiquetas.tsx
// Área de gestão de etiquetas — acessível pelo menu lateral

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Tag, Plus, Pencil, Trash2, Loader2, Users, Phone, Copy,
  ChevronLeft, X, Check
} from "lucide-react";

const COR_PALETA = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#64748b", "#0ea5e9", "#10b981", "#f59e0b",
];

interface LeadTag {
  id: number;
  nome: string;
  cor: string;
  userId: number;
  vendedorNome?: string;
  createdAt: string;
}

interface ClienteTag {
  assignmentId: number;
  leadId: number;
  nome: string;
  cpf: string;
  telefone: string;
  createdAt: string;
}

function formatPhone(phone: string): string {
  const c = phone.replace(/\D/g, "");
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return phone;
}

function formatName(name: string | null): string {
  if (!name) return "-";
  const prep = ["de", "da", "do", "das", "dos", "e"];
  return name.toLowerCase().split(" ").map((w, i) =>
    i > 0 && prep.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");
}

export default function VendasEtiquetas() {
  const { toast } = useToast();
  const { user } = useAuth();
  const podeExportar = user?.role === 'master' || user?.role === 'coordenacao' || user?.isMaster;
  const [tagSelecionada, setTagSelecionada] = useState<LeadTag | null>(null);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalEditar, setModalEditar] = useState<LeadTag | null>(null);
  const [form, setForm] = useState({ nome: "", cor: "#6366f1" });
  const [busca, setBusca] = useState("");

  const { data: tags = [], isLoading } = useQuery<LeadTag[]>({
    queryKey: ["/api/lead-tags"],
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery<ClienteTag[]>({
    queryKey: ["/api/lead-tags", tagSelecionada?.id, "clientes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lead-tags/${tagSelecionada!.id}/clientes`);
      return res.json();
    },
    enabled: !!tagSelecionada,
  });

  const criarMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/lead-tags", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      setModalCriar(false);
      setForm({ nome: "", cor: "#6366f1" });
      toast({ title: "Tag criada!" });
    },
    onError: async (e: any) => {
      const msg = e?.message?.includes("409") ? "Você já tem uma tag com este nome" : "Erro ao criar tag";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: number; nome: string; cor: string }) =>
      apiRequest("PATCH", `/api/lead-tags/${id}`, { nome, cor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      if (tagSelecionada) {
        setTagSelecionada(prev => prev ? { ...prev, nome: form.nome, cor: form.cor } : null);
      }
      setModalEditar(null);
      toast({ title: "Tag atualizada!" });
    },
    onError: () => toast({ title: "Erro ao atualizar tag", variant: "destructive" }),
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/lead-tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      if (tagSelecionada) setTagSelecionada(null);
      toast({ title: "Tag excluída!" });
    },
    onError: () => toast({ title: "Erro ao excluir tag", variant: "destructive" }),
  });

  const handleCriar = () => {
    if (!form.nome.trim()) return toast({ title: "Informe o nome", variant: "destructive" });
    criarMutation.mutate();
  };

  const handleEditar = () => {
    if (!modalEditar || !form.nome.trim()) return;
    editarMutation.mutate({ id: modalEditar.id, nome: form.nome, cor: form.cor });
  };

  const handleExcluir = (tag: LeadTag) => {
    if (!window.confirm(`Excluir "${tag.nome}"? Os clientes serão desetiquetados.`)) return;
    excluirMutation.mutate(tag.id);
  };

  const copiarTelefone = async (tel: string) => {
    try {
      await navigator.clipboard.writeText(tel.replace(/\D/g, ""));
      toast({ title: "Telefone copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const exportarCSV = () => {
    if (!clientes.length || !tagSelecionada) return;
    const linhas = ["Nome,CPF,Telefone"];
    clientes.forEach(c => linhas.push(`"${formatName(c.nome)}","${c.cpf}","${c.telefone}"`));
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etiqueta-${tagSelecionada.nome.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  );

  // Agrupar tags por vendedor (para gestor)
  const tagsPorVendedor = tags.reduce((acc, tag) => {
    const key = tag.vendedorNome || "Minhas tags";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {} as Record<string, LeadTag[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-7 w-7" />
            Tags
          </h1>
          <p className="text-muted-foreground">Organize seus leads com tags personalizadas</p>
        </div>
        <Button onClick={() => { setForm({ nome: "", cor: "#6366f1" }); setModalCriar(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tag
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LISTA DE ETIQUETAS */}
        <div className="lg:col-span-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tags.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Tag className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm text-center">Nenhuma tag ainda</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { setForm({ nome: "", cor: "#6366f1" }); setModalCriar(true); }}>
                  Criar primeira tag
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(tagsPorVendedor).map(([vendedor, tagsDoVendedor]) => (
              <div key={vendedor}>
                {Object.keys(tagsPorVendedor).length > 1 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">{vendedor}</p>
                )}
                <div className="space-y-2">
                  {tagsDoVendedor.map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                        tagSelecionada?.id === tag.id ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setTagSelecionada(tagSelecionada?.id === tag.id ? null : tag)}
                    >
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.cor }} />
                      <span className="font-medium flex-1 truncate">{tag.nome}</span>
                      {tagSelecionada?.id === tag.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setModalEditar(tag); setForm({ nome: tag.nome, cor: tag.cor }); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                          onClick={() => handleExcluir(tag)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* PAINEL DE CLIENTES DA ETIQUETA */}
        <div className="lg:col-span-2">
          {!tagSelecionada ? (
            <Card className="border-2 border-dashed h-full">
              <CardContent className="flex flex-col items-center justify-center h-full py-16">
                <Users className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Selecione uma tag para ver os clientes</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tagSelecionada.cor }} />
                    <CardTitle className="text-base">{tagSelecionada.nome}</CardTitle>
                    <Badge variant="secondary">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {podeExportar && clientes.length > 0 && (
                      <Button variant="outline" size="sm" onClick={exportarCSV} data-testid="button-exportar-csv">
                        Exportar CSV
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTagSelecionada(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {clientes.length > 0 && (
                  <Input
                    placeholder="Filtrar por nome ou telefone..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="mt-2 h-8 text-sm"
                  />
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loadingClientes ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    {clientes.length === 0 ? "Nenhum cliente nesta tag ainda" : "Nenhum resultado para a busca"}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="w-16">Copiar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((c) => (
                        <TableRow key={c.assignmentId}>
                          <TableCell className="font-medium">{formatName(c.nome)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{c.cpf}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{formatPhone(c.telefone)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => copiarTelefone(c.telefone)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL CRIAR */}
      <Dialog open={modalCriar} onOpenChange={setModalCriar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome da tag..."
              maxLength={50}
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCriar()}
            />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Cor</p>
              <div className="grid grid-cols-6 gap-2">
                {COR_PALETA.map(cor => (
                  <button
                    key={cor} type="button"
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: cor, borderColor: form.cor === cor ? "#000" : "transparent" }}
                    onClick={() => setForm({ ...form, cor })}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <Badge style={{ backgroundColor: form.cor, color: "#fff", border: "none" }}>
                {form.nome || "Tag"}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCriar(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={criarMutation.isPending}>
              {criarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR */}
      <Dialog open={!!modalEditar} onOpenChange={v => !v && setModalEditar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              maxLength={50}
              autoFocus
            />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Cor</p>
              <div className="grid grid-cols-6 gap-2">
                {COR_PALETA.map(cor => (
                  <button
                    key={cor} type="button"
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: cor, borderColor: form.cor === cor ? "#000" : "transparent" }}
                    onClick={() => setForm({ ...form, cor })}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <Badge style={{ backgroundColor: form.cor, color: "#fff", border: "none" }}>
                {form.nome || "Tag"}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={editarMutation.isPending}>
              {editarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
