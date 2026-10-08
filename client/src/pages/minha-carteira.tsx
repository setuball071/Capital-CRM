import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  Users,
  Clock,
  Phone,
  FolderOpen,
  Search,
  Wallet,
  ExternalLink,
} from "lucide-react";

interface HistoricoItem {
  id: number;
  nome: string;
  totalLeads: number;
  leadsDistribuidos: number;
  createdAt: string;
  counts: Record<string, number>;
}

interface ImportResult {
  message: string;
  total: number;
  unicos: number;
  importados: number;
  encontradosNaBase: number;
  campanhaNome: string;
}

interface ClienteCarteira {
  cpf: string;
  dono_id: number;
  dono_nome: string | null;
  portfolio_id: number | null;
  produtos: string[] | null;
  vendido: boolean;
  importado: boolean;
  desde: string | null;
  nome: string | null;
  telefone: string | null;
  orgao: string | null;
  convenio: string | null;
  uf: string | null;
  margem: string | null;
  margem_cartao: string | null;
  margem_beneficio: string | null;
}

interface PortfolioStats {
  total: number;
  por_produto: Record<string, number>;
  por_convenio: Record<string, number>;
  por_banco: Record<string, number>;
  por_uf: Record<string, number>;
  por_orgao: Record<string, number>;
}

const PRODUCT_LABELS: Record<string, string> = {
  CARTAO: "Cartão",
  CONSIGNADO: "Consignado",
  NOVO: "Novo Empréstimo",
  PORTABILIDADE: "Portabilidade",
  REFINANCIAMENTO: "Refinanciamento",
};

const POR_PAGINA = 200;

const fmtCpf = (cpf: string) => {
  const d = (cpf || "").replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const fmtTelefone = (t: string | null) => {
  const d = (t || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || "";
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const num = (v: string | null) => (v == null || v === "" ? null : Number(v));

export default function MinhaCarteiraPage() {
  const { user } = useAuth();
  const canViewOthers = !!user && ["master", "atendimento", "coordenacao"].includes(user.role);
  const isManagerRole = !!user && (user.isMaster || user.role === "master" || user.role === "coordenacao");
  const isMaster = !!user && (user.isMaster || user.role === "master");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <p className="text-muted-foreground mt-1">
          Seus clientes: os que você vendeu e os que você importou.
        </p>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes" data-testid="tab-carteira-clientes">
            <Wallet className="h-4 w-4 mr-1.5" />
            Meus Clientes
          </TabsTrigger>
          <TabsTrigger value="importar" data-testid="tab-carteira-importar">
            <Upload className="h-4 w-4 mr-1.5" />
            Importar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-4">
          <MeusClientes canViewOthers={canViewOthers} isManagerRole={isManagerRole} isMaster={isMaster} />
        </TabsContent>
        <TabsContent value="importar" className="mt-4">
          <Importar />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MeusClientes({
  canViewOthers,
  isManagerRole,
  isMaster,
}: {
  canViewOthers: boolean;
  isManagerRole: boolean;
  isMaster: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [busca, setBusca] = useState("");
  const [orgao, setOrgao] = useState("__todos__");
  const [origem, setOrigem] = useState("__todos__");
  const [ordem, setOrdem] = useState("margem_desc");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [transferindo, setTransferindo] = useState<ClienteCarteira | null>(null);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: teamMembers } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/crm/team-members"],
    enabled: canViewOthers,
  });

  const url = vendorId
    ? `/api/vendas/minha-carteira/clientes?vendorId=${vendorId}`
    : "/api/vendas/minha-carteira/clientes";
  const { data: clientes = [], isLoading } = useQuery<ClienteCarteira[]>({
    queryKey: ["/api/vendas/minha-carteira/clientes", vendorId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar a carteira");
      return res.json();
    },
  });

  const { data: stats } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
    enabled: isManagerRole,
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { portfolioId: number; toVendorId: number; reason: string }) =>
      apiRequest("POST", "/api/portfolio/transfer", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/minha-carteira/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({ title: "Cliente transferido com sucesso" });
      setTransferindo(null);
      setDestino("");
      setMotivo("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    },
  });

  const orgaos = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.orgao).filter(Boolean) as string[])).sort(),
    [clientes],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = termo.replace(/\D/g, "");
    let lista = clientes.filter((c) => {
      if (orgao !== "__todos__" && c.orgao !== orgao) return false;
      if (origem === "vendido" && !c.vendido) return false;
      if (origem === "importado" && !c.importado) return false;
      if (termo) {
        const porNome = (c.nome || "").toLowerCase().includes(termo);
        const porCpf = termoDigitos.length > 0 && c.cpf.includes(termoDigitos);
        if (!porNome && !porCpf) return false;
      }
      return true;
    });
    const margem = (c: ClienteCarteira) => num(c.margem);
    lista = [...lista].sort((a, b) => {
      if (ordem === "nome") return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
      if (ordem === "recentes") return (b.desde || "").localeCompare(a.desde || "");
      const ma = margem(a);
      const mb = margem(b);
      if (ma == null && mb == null) return 0;
      if (ma == null) return 1;
      if (mb == null) return -1;
      return ordem === "margem_asc" ? ma - mb : mb - ma;
    });
    return lista;
  }, [clientes, busca, orgao, origem, ordem]);

  const totalVendidos = clientes.filter((c) => c.vendido).length;
  const totalImportados = clientes.filter((c) => c.importado).length;
  const visiveis = filtrados.slice(0, limite);

  const statsCards: { titulo: string; dados: Record<string, number>; rotulos?: Record<string, string> }[] = stats
    ? [
        { titulo: "Vendidos por produto", dados: stats.por_produto, rotulos: PRODUCT_LABELS },
        { titulo: "Top convênios", dados: stats.por_convenio },
        { titulo: "Top bancos", dados: stats.por_banco },
        { titulo: "Top órgãos", dados: stats.por_orgao },
        { titulo: "Top UFs", dados: stats.por_uf },
      ]
    : [];

  return (
    <div className="space-y-4">
      {isManagerRole && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="panel-carteira-stats">
          <div className="rounded-md border bg-card p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Vendidos no ambiente
            </div>
            <span className="text-2xl font-bold leading-none">{stats.total}</span>
          </div>
          {statsCards.map((card) => (
            <div key={card.titulo} className="rounded-md border bg-card p-3 flex flex-col gap-1.5">
              <div className="text-xs text-muted-foreground">{card.titulo}</div>
              <div className="flex flex-col gap-0.5">
                {Object.entries(card.dados).slice(0, 5).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-1 text-xs">
                    <span className="text-muted-foreground truncate" title={k}>{card.rotulos?.[k] || k}</span>
                    <span className="font-medium tabular-nums">{v}</span>
                  </div>
                ))}
                {Object.keys(card.dados).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canViewOthers && teamMembers && teamMembers.length > 0 && (
          <Select
            value={vendorId || "__all__"}
            onValueChange={(v) => {
              setVendorId(v === "__all__" ? "" : v);
              setLimite(POR_PAGINA);
            }}
          >
            <SelectTrigger className="w-52" data-testid="select-carteira-vendedor">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os vendedores</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_PAGINA);
            }}
            placeholder="Buscar por nome ou CPF"
            className="pl-8"
            data-testid="input-carteira-busca"
          />
        </div>
        <Select value={orgao} onValueChange={(v) => { setOrgao(v); setLimite(POR_PAGINA); }}>
          <SelectTrigger className="w-60" data-testid="select-carteira-orgao">
            <SelectValue placeholder="Órgão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os órgãos</SelectItem>
            {orgaos.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origem} onValueChange={(v) => { setOrigem(v); setLimite(POR_PAGINA); }}>
          <SelectTrigger className="w-40" data-testid="select-carteira-origem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todas as origens</SelectItem>
            <SelectItem value="vendido">Vendidos</SelectItem>
            <SelectItem value="importado">Importados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger className="w-44" data-testid="select-carteira-ordem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="margem_desc">Maior margem</SelectItem>
            <SelectItem value="margem_asc">Menor margem</SelectItem>
            <SelectItem value="nome">Nome (A–Z)</SelectItem>
            <SelectItem value="recentes">Mais recentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-carteira-contagem">
        {clientes.length} clientes · {totalVendidos} vendidos · {totalImportados} importados
        {filtrados.length !== clientes.length && ` · ${filtrados.length} no filtro`}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-1">
            <Wallet className="h-10 w-10 mx-auto opacity-40 mb-2" />
            <p>Nenhum cliente na carteira ainda.</p>
            <p className="text-xs">Entram aqui os clientes que você vende e os CPFs que você importa na aba Importar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto" data-testid="table-carteira-wrapper">
          <table className="w-full text-sm" data-testid="table-carteira">
            <thead className="bg-muted/60">
              <tr className="border-b">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CPF</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Órgão</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Convênio</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Margem</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Origem</th>
                {canViewOthers && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Vendedor</th>}
                {isMaster && <th className="px-3 py-2.5"></th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c, idx) => {
                const margem = num(c.margem);
                return (
                  <tr
                    key={`${c.cpf}-${c.dono_id}`}
                    className={`border-b last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                    data-testid={`row-carteira-${c.cpf}`}
                  >
                    <td className="px-3 py-2.5 font-medium max-w-[240px] truncate" title={c.nome || ""}>
                      {c.nome || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <a
                        href={`/vendas/consulta?cpf=${c.cpf}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                        title="Abrir a consulta em nova aba"
                        data-testid={`link-cpf-${c.cpf}`}
                      >
                        {fmtCpf(c.cpf)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {c.telefone ? fmtTelefone(c.telefone) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[260px] truncate" title={c.orgao || ""}>
                      {c.orgao || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.convenio || "—"}</td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium ${
                        margem != null && margem < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {margem != null ? fmtMoeda(margem) : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.vendido && (
                          <Badge
                            variant="default"
                            className="text-[10px]"
                            title={(c.produtos || []).map((p) => PRODUCT_LABELS[p] || p).join(", ")}
                          >
                            Vendido
                          </Badge>
                        )}
                        {c.importado && (
                          <Badge variant="outline" className="text-[10px]">Importado</Badge>
                        )}
                      </div>
                    </td>
                    {canViewOthers && (
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.dono_nome || "—"}</td>
                    )}
                    {isMaster && (
                      <td className="px-3 py-2.5">
                        {c.vendido && c.portfolio_id != null && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTransferindo(c)}
                            data-testid={`button-transfer-${c.cpf}`}
                          >
                            Transferir
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum cliente com esse filtro.</p>
          )}
        </div>
      )}

      {filtrados.length > limite && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimite((l) => l + POR_PAGINA)} data-testid="button-carteira-mais">
            Mostrar mais ({filtrados.length - limite} restantes)
          </Button>
        </div>
      )}

      <Dialog open={!!transferindo} onOpenChange={(o) => !o && setTransferindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Cliente</DialogTitle>
          </DialogHeader>
          {transferindo && (
            <div className="space-y-4 py-2">
              <div className="text-sm font-medium">{transferindo.nome || fmtCpf(transferindo.cpf)}</div>
              <div className="space-y-2">
                <Label htmlFor="transfer-vendor">Vendedor destino</Label>
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger id="transfer-vendor" data-testid="select-transfer-vendor">
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teamMembers || [])
                      .filter((m) => m.id !== transferindo.dono_id)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-reason">Motivo (opcional)</Label>
                <Textarea
                  id="transfer-reason"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Informe o motivo da transferência..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferindo(null)}>Cancelar</Button>
            <Button
              disabled={!destino || transferMutation.isPending}
              onClick={() => {
                if (!transferindo?.portfolio_id || !destino) return;
                transferMutation.mutate({
                  portfolioId: transferindo.portfolio_id,
                  toVendorId: Number(destino),
                  reason: motivo,
                });
              }}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Importar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: historico = [], isLoading: loadingHistorico } = useQuery<HistoricoItem[]>({
    queryKey: ["/api/vendas/minha-carteira/historico"],
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);

      const res = await fetch("/api/vendas/minha-carteira/importar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao importar");

      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/minha-carteira/historico"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/minha-carteira/clientes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
      toast({ title: "Carteira importada com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Como importar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong></p>
          <p>• CPFs na <strong>primeira coluna</strong> (com ou sem formatação)</p>
          <p>• Limite: <strong>5.000 CPFs</strong> por importação</p>
          <p>• Os dados (nome, telefone, margem) são buscados automaticamente na base do sistema</p>
          <p>• Os clientes aparecem em <strong>Meus Clientes</strong> e entram na sua fila da <strong>Lista Manual</strong></p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Clique para selecionar o arquivo</p>
                <p className="text-sm text-muted-foreground">.xlsx, .xls ou .csv com CPFs na 1ª coluna</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button className="w-full" disabled={!file || loading} onClick={handleSubmit}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar para Minha Carteira
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Importação concluída!</span>
            </div>
            <p className="text-sm text-muted-foreground">{result.campanhaNome}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {result.importados} leads importados
              </Badge>
              <Badge variant="outline">
                <Phone className="h-3 w-3 mr-1" />
                {result.encontradosNaBase} com dados na base
              </Badge>
              {result.total !== result.unicos && (
                <Badge variant="secondary">
                  {result.total - result.unicos} CPFs duplicados removidos
                </Badge>
              )}
            </div>
            <p className="text-xs text-green-700 dark:text-green-400">
              Os clientes já estão em <strong>Meus Clientes</strong> e na sua fila da <strong>Lista Manual</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <FolderOpen className="h-4 w-4" />
          Histórico de Importações
        </h2>

        {loadingHistorico ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : historico.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma importação ainda. Envie seu primeiro arquivo acima.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {historico.map((item) => {
              const novo = item.counts["novo"] || 0;
              const atendendo = item.counts["em_atendimento"] || 0;
              const total = item.totalLeads || 0;
              // Trabalhado = tudo que saiu de "novo" (em atendimento, vendido,
              // sem interesse, descartado, concluído...).
              const trabalhados = Object.entries(item.counts)
                .filter(([s]) => s !== "novo")
                .reduce((acc, [, n]) => acc + n, 0);
              const finalizados = trabalhados - atendendo;
              const progresso = total > 0 ? Math.min(100, Math.round((trabalhados / total) * 100)) : 0;
              return (
                <Card key={item.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(item.createdAt)} · {total} leads
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {novo > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {novo} novos
                          </Badge>
                        )}
                        {atendendo > 0 && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                            <Phone className="h-3 w-3 mr-1" />
                            {atendendo} em atend.
                          </Badge>
                        )}
                        {finalizados > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {finalizados} finalizados
                          </Badge>
                        )}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span>{progresso}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
