import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Plus, Pencil, Trash2, Check, X, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Partner { id: number; name: string; isActive: boolean; }

export default function ContratosConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [novoNome, setNovoNome] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/contracts/partners"],
    queryFn: async () => {
      const res = await fetch("/api/contracts/partners", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/contracts/partners"] });

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/contracts/partners", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Erro");
    },
    onSuccess: () => { invalidate(); setNovoNome(""); toast({ title: "Parceiro adicionado" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/contracts/partners/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Erro");
    },
    onSuccess: () => { invalidate(); setEditingId(null); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/contracts/partners/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error("Erro ao excluir");
    },
    onSuccess: () => { invalidate(); setDeleteConfirm(null); toast({ title: "Parceiro removido" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground">Configurações do módulo de contratos (uso interno).</p>
      </div>

      {/* Parceiros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Handshake className="h-4 w-4" /> Parceiros
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Lista de parceiros por onde os contratos são cadastrados. Uso interno — o corretor não vê.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Adicionar */}
          <div className="flex gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do parceiro"
              onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim()) createMut.mutate(novoNome.trim()); }}
            />
            <Button className="gap-1.5" disabled={!novoNome.trim() || createMut.isPending} onClick={() => createMut.mutate(novoNome.trim())}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />)}</div>
          ) : partners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum parceiro cadastrado.</p>
          ) : (
            <div className="space-y-1.5">
              {partners.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border border-border p-2.5">
                  {editingId === p.id ? (
                    <>
                      <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8 text-sm flex-1" autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") updateMut.mutate({ id: p.id, data: { name: editNome.trim() } }); if (e.key === "Escape") setEditingId(null); }} />
                      <button className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30" onClick={() => updateMut.mutate({ id: p.id, data: { name: editNome.trim() } })}><Check className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm font-medium ${p.isActive ? "" : "text-muted-foreground line-through"}`}>{p.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {p.isActive ? "Ativo" : "Inativo"}
                        <Switch checked={p.isActive} onCheckedChange={(v) => updateMut.mutate({ id: p.id, data: { isActive: v } })} />
                      </span>
                      <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => { setEditingId(p.id); setEditNome(p.name); }}><Pencil className="h-3.5 w-3.5" /></button>
                      {deleteConfirm === p.id ? (
                        <div className="flex items-center gap-1">
                          <button className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => deleteMut.mutate(p.id)}><Check className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setDeleteConfirm(null)}><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDeleteConfirm(p.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">Mais configurações serão adicionadas aqui.</p>
    </div>
  );
}
