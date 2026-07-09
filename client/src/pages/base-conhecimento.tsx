import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIAS_LABEL, NOME_MASCOTE, AVATAR_URL } from "@/components/assistente/config";

type Artigo = {
  id: number; titulo: string; conteudo: string; categoria: string;
  banco: string | null; status: string; origem: string; updatedAt: string;
};
type Sugestao = {
  id: number; tituloProposto: string; conteudoProposto: string;
  categoriaProposta: string | null; bancoProposto: string | null;
  origem: string; createdAt: string;
  conflito: { id: number; titulo: string; conteudo: string } | null;
};

const FORM_VAZIO = { id: 0, titulo: "", conteudo: "", categoria: "regras_banco", banco: "", status: "rascunho" };

export default function BaseConhecimentoPage() {
  const { user, hasSubItemAccess } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<typeof FORM_VAZIO | null>(null);

  const podeGerenciar =
    !!user &&
    (user.isMaster ||
      user.role === "master" ||
      hasSubItemAccess("modulo_assistente", "base_conhecimento"));

  const { data: artigos = [] } = useQuery<Artigo[]>({
    queryKey: ["/api/assistente/kb"],
    enabled: podeGerenciar,
  });
  const { data: sugestoes = [] } = useQuery<Sugestao[]>({
    queryKey: ["/api/assistente/kb/sugestoes"],
    enabled: podeGerenciar,
  });
  const { data: metricas } = useQuery<any>({
    queryKey: ["/api/assistente/metricas"],
    enabled: podeGerenciar,
  });

  const salvar = useMutation({
    mutationFn: async (f: typeof FORM_VAZIO) => {
      const body = { titulo: f.titulo, conteudo: f.conteudo, categoria: f.categoria, banco: f.banco || null, status: f.status };
      const res = f.id
        ? await apiRequest("PATCH", `/api/assistente/kb/${f.id}`, body)
        : await apiRequest("POST", "/api/assistente/kb", body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
      setForm(null);
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao salvar", variant: "destructive" }),
  });

  const decidir = useMutation({
    mutationFn: async (p: { id: number; acao: "aprovar" | "rejeitar"; modo?: "novo" | "substituir" }) => {
      const res = await apiRequest("POST", `/api/assistente/kb/sugestoes/${p.id}/decidir`, { acao: p.acao, modo: p.modo });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb/sugestoes"] });
      qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao decidir", variant: "destructive" }),
  });

  const uploadPdf = async (file: File) => {
    const fd = new FormData();
    fd.append("arquivo", file);
    const res = await fetch("/api/assistente/kb/upload", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Falha no upload");
      return;
    }
    qc.invalidateQueries({ queryKey: ["/api/assistente/kb"] });
    alert("PDF importado como rascunho — revise e publique!");
  };

  if (!podeGerenciar) return <div className="p-6">Acesso restrito.</div>;

  return (
    <div className="space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <img src={AVATAR_URL} alt={NOME_MASCOTE} className="h-9 w-9 object-contain" />
        Base de Conhecimento do {NOME_MASCOTE}
      </h1>

      <Tabs defaultValue="artigos">
        <TabsList>
          <TabsTrigger value="artigos">Artigos ({artigos.length})</TabsTrigger>
          <TabsTrigger value="fila">
            Fila de Aprovação{sugestoes.length > 0 && <Badge className="ml-2">{sugestoes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        {/* -------- ARTIGOS -------- */}
        <TabsContent value="artigos" className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={() => setForm({ ...FORM_VAZIO })}>Novo artigo</Button>
            <label>
              <Button variant="outline" asChild><span>Importar PDF</span></Button>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <div className="space-y-2">
            {artigos.map((a) => (
              <Card key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() =>
                setForm({ id: a.id, titulo: a.titulo, conteudo: a.conteudo, categoria: a.categoria, banco: a.banco || "", status: a.status })
              }>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {CATEGORIAS_LABEL[a.categoria] || a.categoria}
                      {a.banco ? ` · ${a.banco}` : ""} · origem: {a.origem}
                    </div>
                  </div>
                  <Badge variant={a.status === "publicado" ? "default" : a.status === "rascunho" ? "secondary" : "outline"}>
                    {a.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* -------- FILA -------- */}
        <TabsContent value="fila" className="space-y-3">
          {sugestoes.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma sugestão pendente. 🎉</div>}
          {sugestoes.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.tituloProposto}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  origem: {s.origem}
                  {s.categoriaProposta ? ` · ${CATEGORIAS_LABEL[s.categoriaProposta] || s.categoriaProposta}` : ""}
                  {s.bancoProposto ? ` · ${s.bancoProposto}` : ""}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.conflito ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-amber-400 p-2">
                      <div className="mb-1 text-xs font-semibold text-amber-600">JÁ EXISTE: {s.conflito.titulo}</div>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">{s.conflito.conteudo}</div>
                    </div>
                    <div className="rounded border border-green-500 p-2">
                      <div className="mb-1 text-xs font-semibold text-green-600">NOVO</div>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">{s.conteudoProposto}</div>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded border p-2 text-xs">{s.conteudoProposto}</div>
                )}
                <div className="flex gap-2">
                  {s.conflito ? (
                    <>
                      <Button size="sm" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar", modo: "substituir" })}>
                        Substituir o antigo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar", modo: "novo" })}>
                        Manter os dois
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => decidir.mutate({ id: s.id, acao: "aprovar" })}>
                      Aprovar e publicar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => decidir.mutate({ id: s.id, acao: "rejeitar" })}>
                    Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* -------- MÉTRICAS -------- */}
        <TabsContent value="metricas" className="space-y-4">
          {metricas && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalPerguntas}</div><div className="text-xs text-muted-foreground">Perguntas ({metricas.periodoDias}d)</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalSemResposta}</div><div className="text-xs text-muted-foreground">Sem resposta (pauta de conteúdo!)</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metricas.totalFeedbackDown}</div><div className="text-xs text-muted-foreground">Respostas com 👎</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Perguntas sem resposta — o que falta cadastrar</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {(metricas.semResposta || []).map((x: any, i: number) => (
                    <div key={i} className="border-b py-1 text-sm">{x.conteudo}</div>
                  ))}
                  {!metricas.semResposta?.length && <div className="text-xs text-muted-foreground">Nenhuma 🎉</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Respostas com 👎</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(metricas.feedbackDown || []).map((x: any, i: number) => (
                    <div key={i} className="border-b pb-1 text-xs">
                      <div className="font-medium">P: {x.pergunta}</div>
                      <div className="text-muted-foreground">R: {String(x.resposta).slice(0, 200)}…</div>
                    </div>
                  ))}
                  {!metricas.feedbackDown?.length && <div className="text-xs text-muted-foreground">Nenhuma 🎉</div>}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* -------- dialog de edição/criação -------- */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <input
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="Título"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
              <div className="flex gap-2">
                <select
                  className="rounded border bg-background px-2 py-2 text-sm"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {Object.entries(CATEGORIAS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  className="flex-1 rounded border bg-background px-3 py-2 text-sm"
                  placeholder="Banco (opcional)"
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                />
                <select
                  className="rounded border bg-background px-2 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
              <textarea
                className="h-64 w-full rounded border bg-background px-3 py-2 text-sm"
                placeholder="Conteúdo (markdown)"
                value={form.conteudo}
                onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button
                  disabled={!form.titulo.trim() || !form.conteudo.trim() || salvar.isPending}
                  onClick={() => salvar.mutate(form)}
                >
                  {salvar.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
