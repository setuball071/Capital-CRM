import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart, Target, CreditCard, Trophy, Loader2, Calendar, Users, Building2, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VendedorRanking {
  userId: number;
  nome: string;
  producaoGeral: number;
  producaoCartao: number;
  contratos: number;
  contratosCartao: number;
  metaGeral: number;
  metaCartao: number;
  percentualMeta: number;
  percentualMetaCartao: number;
  posicao: number;
}

interface HistoricoData {
  equipe: {
    metaGeral: number;
    metaCartao: number;
    totalProduzidoGeral: number;
    totalProduzidoCartao: number;
    percentualGeral: number;
    percentualCartao: number;
  };
  rankingGeral: VendedorRanking[];
  rankingCartao: VendedorRanking[];
  mesAno: string;
  equipes: { id: number; nome: string }[];
  visao: string;
}

interface CorretorDiaDia {
  userId: number;
  nome: string;
  clientesConsultados: number;
  clientesEtiquetados: number;
  clientesPipeline: number;
  markers: Record<string, number>;
  producao: number;
  contratos: number;
  diasUteis: number;
  horasTrabalhadas: number;
  clientesPorDia: number;
  clientesPorHora: number;
}

interface DiaDiaData {
  corretores: CorretorDiaDia[];
  periodo: { de: string; ate: string };
  diasUteis: number;
  horasTrabalhadas: number;
  equipes: { id: number; nome: string }[];
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

function RankingAvatar({ nome, posicao }: { nome: string; posicao: number }) {
  const initials = getInitials(nome);
  const bgClass =
    posicao === 1 ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 ring-yellow-500/30" :
    posicao === 2 ? "bg-gray-300/20 text-gray-600 dark:text-gray-300 ring-gray-400/30" :
    posicao === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 ring-orange-500/30" :
    "bg-muted text-muted-foreground ring-border";

  return (
    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ring-1 shrink-0 ${bgClass}`}>
      {initials}
    </div>
  );
}

function MetaCard({ label, icon: Icon, produzido, meta, percentual, variant }: {
  label: string;
  icon: typeof Target;
  produzido: number;
  meta: number;
  percentual: number;
  variant: "geral" | "cartao";
}) {
  const isCartao = variant === "cartao";
  return (
    <Card className={`flex-1 min-w-0 ${isCartao ? "bg-[#1a1a2e] dark:bg-[#111122] border-purple-500/20" : "border-primary/20"}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={16} className={isCartao ? "text-purple-400" : "text-primary"} />
          <h3 className={`font-bold text-sm uppercase tracking-wider ${isCartao ? "text-purple-300" : "text-primary"}`}>{label}</h3>
        </div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${isCartao ? "text-purple-400" : ""}`}>{formatBRL(produzido)}</div>
            <div className={`text-sm ${isCartao ? "text-gray-500" : "text-muted-foreground"}`}>Meta: {formatBRL(meta)}</div>
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-md border ${isCartao ? "bg-purple-500/20 border-purple-500/30" : "bg-primary/10 border-primary/20"}`}>
            <span className={`text-xl font-bold ${isCartao ? "text-purple-400" : "text-primary"}`}>{percentual}%</span>
          </div>
        </div>
        <div className={`w-full h-2.5 rounded-full overflow-hidden ${isCartao ? "bg-gray-700" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isCartao ? "bg-gradient-to-r from-purple-600 to-purple-400" : "bg-gradient-to-r from-primary to-chart-2"}`}
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RankingTableCompact({ title, icon: Icon, data, type }: {
  title: string;
  icon: typeof Trophy;
  data: VendedorRanking[];
  type: "geral" | "cartao";
}) {
  const isCartao = type === "cartao";
  return (
    <Card className="flex flex-col" data-testid={`card-rel-ranking-${type}`}>
      <CardContent className="p-0 flex flex-col flex-1">
        <div className="flex items-center gap-2 p-4 pb-3 border-b shrink-0">
          <Icon size={18} className={isCartao ? "text-purple-400" : "text-primary"} />
          <h3 className="font-bold text-base">{title}</h3>
          <Badge variant="outline" className="ml-auto">{data.length} corretores</Badge>
        </div>
        {data.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Nenhum corretor encontrado</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">{isCartao ? "Prod. Cartão" : "Produção"}</TableHead>
                  <TableHead className="text-right">% Meta</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((v) => {
                  const prod = isCartao ? v.producaoCartao : v.producaoGeral;
                  const pct = isCartao ? v.percentualMetaCartao : v.percentualMeta;
                  const contratos = isCartao ? v.contratosCartao : v.contratos;
                  return (
                    <TableRow key={v.userId}>
                      <TableCell className="text-center">
                        {v.posicao <= 3 ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                            v.posicao === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                            v.posicao === 2 ? "bg-gray-300/30 text-gray-600 dark:text-gray-300" :
                            "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                          }`}>{v.posicao}</span>
                        ) : (
                          <span className="text-muted-foreground">{v.posicao}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RankingAvatar nome={v.nome} posicao={v.posicao} />
                          <span className="font-medium text-sm truncate">{v.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBRL(prod)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct >= 100 ? "default" : "outline"} className={pct >= 100 ? "bg-green-600 text-white no-default-hover-elevate" : ""}>{pct}%</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{contratos}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoricoProducaoTab() {
  const monthOptions = getMonthOptions();
  const [mes, setMes] = useState(monthOptions[0].value);
  const [visao, setVisao] = useState("empresa");
  const [equipeId, setEquipeId] = useState<string>("todas");

  const queryParams = new URLSearchParams({ mes, visao });
  if (visao === "equipe" && equipeId !== "todas") queryParams.set("equipeId", equipeId);

  const { data, isLoading } = useQuery<HistoricoData>({
    queryKey: ["/api/relatorios/historico-producao", mes, visao, equipeId],
    queryFn: async () => {
      const resp = await fetch(`/api/relatorios/historico-producao?${queryParams.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar dados");
      return resp.json();
    },
    retry: 2,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mês de referência</Label>
              <Select value={mes} onValueChange={setMes} data-testid="select-mes">
                <SelectTrigger className="w-52" data-testid="trigger-mes">
                  <Calendar size={14} className="mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} data-testid={`option-mes-${opt.value}`}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Visão</Label>
              <Select value={visao} onValueChange={(v) => { setVisao(v); setEquipeId("todas"); }} data-testid="select-visao">
                <SelectTrigger className="w-44" data-testid="trigger-visao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa" data-testid="option-visao-empresa">
                    <div className="flex items-center gap-2"><Building2 size={14} /> Empresa</div>
                  </SelectItem>
                  <SelectItem value="equipe" data-testid="option-visao-equipe">
                    <div className="flex items-center gap-2"><Users size={14} /> Por Equipe</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {visao === "equipe" && data?.equipes && data.equipes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Equipe</Label>
                <Select value={equipeId} onValueChange={setEquipeId} data-testid="select-equipe">
                  <SelectTrigger className="w-52" data-testid="trigger-equipe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" data-testid="option-equipe-todas">Todas as equipes</SelectItem>
                    {data.equipes.map((eq) => (
                      <SelectItem key={eq.id} value={String(eq.id)} data-testid={`option-equipe-${eq.id}`}>{eq.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetaCard label="Meta Geral" icon={Target} produzido={data.equipe.totalProduzidoGeral} meta={data.equipe.metaGeral} percentual={data.equipe.percentualGeral} variant="geral" />
            <MetaCard label="Meta Cartão" icon={CreditCard} produzido={data.equipe.totalProduzidoCartao} meta={data.equipe.metaCartao} percentual={data.equipe.percentualCartao} variant="cartao" />
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <RankingTableCompact title="Ranking Geral" icon={Trophy} data={data.rankingGeral} type="geral" />
            <RankingTableCompact title="Ranking Cartão" icon={CreditCard} data={data.rankingCartao} type="cartao" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiaDiaTab() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const [de, setDe] = useState(monday.toISOString().split("T")[0]);
  const [ate, setAte] = useState(friday.toISOString().split("T")[0]);
  const [equipeId, setEquipeId] = useState<string>("todas");

  const queryParams = new URLSearchParams({ de, ate });
  if (equipeId !== "todas") queryParams.set("equipeId", equipeId);

  const { data, isLoading } = useQuery<DiaDiaData>({
    queryKey: ["/api/relatorios/dia-a-dia", de, ate, equipeId],
    queryFn: async () => {
      const resp = await fetch(`/api/relatorios/dia-a-dia?${queryParams.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar dados");
      return resp.json();
    },
    retry: 2,
  });

  const totals = data?.corretores?.reduce(
    (acc, c) => ({
      consultados: acc.consultados + c.clientesConsultados,
      etiquetados: acc.etiquetados + c.clientesEtiquetados,
      pipeline: acc.pipeline + c.clientesPipeline,
      producao: acc.producao + c.producao,
      contratos: acc.contratos + c.contratos,
    }),
    { consultados: 0, etiquetados: 0, pipeline: 0, producao: 0, contratos: 0 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" data-testid="input-date-de" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" data-testid="input-date-ate" />
            </div>
            {data?.equipes && data.equipes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Equipe</Label>
                <Select value={equipeId} onValueChange={setEquipeId} data-testid="select-equipe-dia">
                  <SelectTrigger className="w-52" data-testid="trigger-equipe-dia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" data-testid="option-equipe-dia-todas">Todas</SelectItem>
                    {data.equipes.map((eq) => (
                      <SelectItem key={eq.id} value={String(eq.id)} data-testid={`option-equipe-dia-${eq.id}`}>{eq.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {data && (
              <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                <span>{data.diasUteis} dias úteis</span>
                <span>{data.horasTrabalhadas}h de trabalho</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data && data.corretores.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Corretor</TableHead>
                    <TableHead className="text-center" title="Clientes únicos atendidos (interações)">Consultados</TableHead>
                    <TableHead className="text-center" title="Clientes com etiquetas atribuídas">Etiquetados</TableHead>
                    <TableHead className="text-center" title="Clientes com mudança de status no pipeline">Pipeline</TableHead>
                    <TableHead className="text-right">Produção</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-center" title="Clientes por dia útil">Cl/Dia</TableHead>
                    <TableHead className="text-center" title="Clientes por hora de trabalho">Cl/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.corretores.map((c, idx) => (
                    <TableRow key={c.userId} data-testid={`row-diadia-${c.userId}`}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                            idx === 0 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                            idx === 1 ? "bg-gray-300/20 text-gray-600 dark:text-gray-300" :
                            idx === 2 ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" :
                            "bg-muted text-muted-foreground"
                          }`}>{idx + 1}</span>
                          <span className="font-medium text-sm truncate max-w-[150px]">{c.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{c.clientesConsultados}</TableCell>
                      <TableCell className="text-center font-mono">{c.clientesEtiquetados}</TableCell>
                      <TableCell className="text-center font-mono">{c.clientesPipeline}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBRL(c.producao)}</TableCell>
                      <TableCell className="text-center font-mono">{c.contratos}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{c.clientesPorDia}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{c.clientesPorHora}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {totals && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="sticky left-0 bg-muted/50 z-10">Total</TableCell>
                      <TableCell className="text-center font-mono">{totals.consultados}</TableCell>
                      <TableCell className="text-center font-mono">{totals.etiquetados}</TableCell>
                      <TableCell className="text-center font-mono">{totals.pipeline}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBRL(totals.producao)}</TableCell>
                      <TableCell className="text-center font-mono">{totals.contratos}</TableCell>
                      <TableCell className="text-center">-</TableCell>
                      <TableCell className="text-center">-</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : data && data.corretores.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum corretor encontrado para o período selecionado
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function GestaoComercialRelatoriosPage() {
  return (
    <div className="flex flex-col h-full" data-testid="page-gestao-relatorios">
      <header className="border-b bg-background p-4 shrink-0">
        <div className="flex items-center gap-3">
          <FileBarChart className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Histórico de produção e atividade diária dos corretores</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="historico" data-testid="tabs-relatorios">
            <TabsList className="mb-4" data-testid="tabs-list">
              <TabsTrigger value="historico" data-testid="tab-historico">
                <Trophy size={14} className="mr-2" />
                Histórico de Produção
              </TabsTrigger>
              <TabsTrigger value="diadia" data-testid="tab-diadia">
                <ClipboardList size={14} className="mr-2" />
                Dia a Dia
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historico">
              <HistoricoProducaoTab />
            </TabsContent>

            <TabsContent value="diadia">
              <DiaDiaTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
