// components/tag-manager.tsx
// Uso nas telas: <TagManager leadId={lead.id} telefones={[...]} />

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tag, Plus, X, Check, Pencil, Trash2, Loader2 } from "lucide-react";

const COR_PALETA = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#64748b", "#0ea5e9", "#10b981", "#f59e0b",
];

interface LeadTagData {
  id: number;
  nome: string;
  cor: string;
  telefone?: string;
}

interface TagManagerProps {
  leadId: number;
  // Telefones disponíveis do lead para vincular
  telefones?: string[];
}

function formatPhone(phone: string): string {
  const c = phone.replace(/\D/g, "");
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return phone;
}

export function TagManager({ leadId, telefones = [] }: TagManagerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<"listar" | "criar" | "aplicar" | "editar">("listar");
  const [tagParaAplicar, setTagParaAplicar] = useState<LeadTagData | null>(null);
  const [telefoneEscolhido, setTelefoneEscolhido] = useState("");
  const [telefoneManual, setTelefoneManual] = useState("");
  const [novaTag, setNovaTag] = useState({ nome: "", cor: "#6366f1" });
  const [editandoTag, setEditandoTag] = useState<LeadTagData | null>(null);

  const { data: tagsDoLead = [], isLoading: loadingTagsLead } = useQuery<LeadTagData[]>({
    queryKey: ["/api/crm/leads", leadId, "tags"],
    enabled: !!leadId,
  });

  const { data: todasTags = [] } = useQuery<LeadTagData[]>({
    queryKey: ["/api/lead-tags"],
  });

  const tagsDisponiveis = todasTags.filter(t => !tagsDoLead.some(lt => lt.id === t.id));

  const aplicarMutation = useMutation({
    mutationFn: async ({ tagId, telefone }: { tagId: number; telefone: string }) =>
      apiRequest("POST", `/api/crm/leads/${leadId}/tags`, { tagId, telefone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags", tagParaAplicar?.id, "clientes"] });
      setModo("listar");
      setTagParaAplicar(null);
      setTelefoneEscolhido("");
      setTelefoneManual("");
    },
    onError: () => toast({ title: "Erro ao aplicar etiqueta", variant: "destructive" }),
  });

  const removerMutation = useMutation({
    mutationFn: async (tagId: number) =>
      apiRequest("DELETE", `/api/crm/leads/${leadId}/tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId, "tags"] });
    },
    onError: () => toast({ title: "Erro ao remover etiqueta", variant: "destructive" }),
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/lead-tags", novaTag);
      return res.json();
    },
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      // Abre o modo de aplicar com a tag recém-criada
      setTagParaAplicar(tag);
      setNovaTag({ nome: "", cor: "#6366f1" });
      setModo("aplicar");
      toast({ title: "Etiqueta criada! Agora escolha o telefone." });
    },
    onError: async (e: any) => {
      const msg = e?.message?.includes("409") ? "Você já tem uma etiqueta com este nome" : "Erro ao criar etiqueta";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: number; nome: string; cor: string }) =>
      apiRequest("PATCH", `/api/lead-tags/${id}`, { nome, cor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId, "tags"] });
      setEditandoTag(null);
      setModo("listar");
      toast({ title: "Etiqueta atualizada!" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const excluirMutation = useMutation({
    mutationFn: async (tagId: number) => apiRequest("DELETE", `/api/lead-tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId, "tags"] });
    },
    onError: () => toast({ title: "Erro ao excluir etiqueta", variant: "destructive" }),
  });

  const handleAplicar = () => {
    if (!tagParaAplicar) return;
    const tel = telefoneManual.trim() || telefoneEscolhido;
    if (!tel) return toast({ title: "Escolha ou informe um telefone", variant: "destructive" });
    aplicarMutation.mutate({ tagId: tagParaAplicar.id, telefone: tel.replace(/\D/g, "") });
  };

  const iniciarAplicar = (tag: LeadTagData) => {
    setTagParaAplicar(tag);
    setTelefoneEscolhido(telefones[0] || "");
    setTelefoneManual("");
    setModo("aplicar");
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Tags aplicadas */}
      {loadingTagsLead ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        tagsDoLead.map((tag) => (
          <Badge
            key={tag.id}
            className="text-xs px-2 py-0.5 gap-1 cursor-default"
            style={{ backgroundColor: tag.cor, color: "#fff", border: "none" }}
          >
            {tag.nome}
            <button
              onClick={() => removerMutation.mutate(tag.id)}
              className="ml-0.5 hover:opacity-70"
              type="button"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))
      )}

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setModo("listar"); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1" type="button">
            <Tag className="h-3 w-3" />
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-3" align="start">

          {/* MODO CRIAR */}
          {modo === "criar" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nova etiqueta</p>
                <Button variant="ghost" size="sm" onClick={() => setModo("listar")} className="h-6 px-2 text-xs">Voltar</Button>
              </div>
              <Input
                value={novaTag.nome}
                onChange={e => setNovaTag({ ...novaTag, nome: e.target.value })}
                placeholder="Nome..."
                className="h-8 text-sm"
                maxLength={50}
                autoFocus
                onKeyDown={e => e.key === "Enter" && criarMutation.mutate()}
              />
              <div className="grid grid-cols-6 gap-1.5">
                {COR_PALETA.map(cor => (
                  <button
                    key={cor} type="button"
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: cor, borderColor: novaTag.cor === cor ? "#000" : "transparent" }}
                    onClick={() => setNovaTag({ ...novaTag, cor })}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <Badge style={{ backgroundColor: novaTag.cor, color: "#fff", border: "none" }} className="text-xs">
                  {novaTag.nome || "Etiqueta"}
                </Badge>
              </div>
              <Button size="sm" className="w-full" onClick={() => criarMutation.mutate()} disabled={criarMutation.isPending}>
                {criarMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Criar etiqueta
              </Button>
            </div>
          )}

          {/* MODO APLICAR — escolher telefone */}
          {modo === "aplicar" && tagParaAplicar && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Vincular telefone</p>
                <Button variant="ghost" size="sm" onClick={() => setModo("listar")} className="h-6 px-2 text-xs">Voltar</Button>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tagParaAplicar.cor }} />
                <span className="text-sm font-medium">{tagParaAplicar.nome}</span>
              </div>
              <p className="text-xs text-muted-foreground">Escolha o telefone vinculado a esta etiqueta:</p>
              {telefones.length > 0 && (
                <Select value={telefoneEscolhido} onValueChange={setTelefoneEscolhido}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar telefone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {telefones.map(tel => (
                      <SelectItem key={tel} value={tel}>{formatPhone(tel)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {telefones.length > 0 ? "Ou informe outro:" : "Informe o telefone:"}
                </p>
                <Input
                  value={telefoneManual}
                  onChange={e => setTelefoneManual(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="h-8 text-sm"
                />
              </div>
              <Button
                size="sm" className="w-full"
                onClick={handleAplicar}
                disabled={aplicarMutation.isPending}
              >
                {aplicarMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Aplicar etiqueta
              </Button>
            </div>
          )}

          {/* MODO EDITAR */}
          {modo === "editar" && editandoTag && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Editar etiqueta</p>
                <Button variant="ghost" size="sm" onClick={() => setModo("listar")} className="h-6 px-2 text-xs">Voltar</Button>
              </div>
              <Input
                value={editandoTag.nome}
                onChange={e => setEditandoTag({ ...editandoTag, nome: e.target.value })}
                className="h-8 text-sm"
                maxLength={50}
                autoFocus
              />
              <div className="grid grid-cols-6 gap-1.5">
                {COR_PALETA.map(cor => (
                  <button
                    key={cor} type="button"
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: cor, borderColor: editandoTag.cor === cor ? "#000" : "transparent" }}
                    onClick={() => setEditandoTag({ ...editandoTag, cor })}
                  />
                ))}
              </div>
              <Button
                size="sm" className="w-full"
                onClick={() => editarMutation.mutate({ id: editandoTag.id, nome: editandoTag.nome, cor: editandoTag.cor })}
                disabled={editarMutation.isPending}
              >
                {editarMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          )}

          {/* MODO LISTAR */}
          {modo === "listar" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Etiquetas</p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setModo("criar")}>
                  <Plus className="h-3 w-3" />Nova
                </Button>
              </div>

              {tagsDisponiveis.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">Clique para aplicar</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {tagsDisponiveis.map(tag => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer group"
                        onClick={() => iniciarAplicar(tag)}
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.cor }} />
                        <span className="text-sm flex-1">{tag.nome}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button type="button" className="p-0.5 rounded hover:bg-muted-foreground/20"
                            onClick={() => { setEditandoTag(tag); setModo("editar"); }}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button type="button" className="p-0.5 rounded hover:bg-destructive/20"
                            onClick={() => { if (window.confirm(`Excluir "${tag.nome}"?`)) excluirMutation.mutate(tag.id); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tagsDoLead.length > 0 && (
                <>
                  {tagsDisponiveis.length > 0 && <Separator />}
                  <p className="text-xs text-muted-foreground">Aplicadas</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {tagsDoLead.map(tag => (
                      <div key={tag.id} className="flex items-center gap-2 px-2 py-1 rounded group">
                        <Check className="h-3 w-3 text-green-600 shrink-0" />
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.cor }} />
                        <span className="text-sm flex-1 text-muted-foreground line-through">{tag.nome}</span>
                        <button type="button" className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20"
                          onClick={() => removerMutation.mutate(tag.id)}>
                          <X className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {todasTags.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-2">Nenhuma etiqueta criada ainda</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setModo("criar")}>
                    Criar primeira etiqueta
                  </Button>
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
