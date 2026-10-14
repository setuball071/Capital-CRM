/**
 * Consulta Governo -- bases de servidores estaduais compradas por assinantes.
 * Cada ambiente só vê as bases liberadas para ele (o servidor recusa as outras);
 * o master vê todas. Ver server/bases-governo.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Landmark, Search, Download, Loader2, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/components/ContatosDoCliente";
import {
  ContatosGoverno, DadosPessoaisGoverno, EnderecoGoverno, VinculosGoverno,
  corSituacaoGov, moeda, type GovContato, type GovVinculo,
} from "@/components/FichaGoverno";

type Base = { codigo: string; nome: string; uf: string; total_servidores: number };
type Opcao = { valor: string; qtd: number };
type Filtros = { situacoes: Opcao[]; regimes: Opcao[]; orgaos: Opcao[]; cargos: Opcao[]; cidades: Opcao[] };
type Linha = {
  cpf: string; nome: string; orgao: string | null; cargo: string | null; situacao: string | null;
  regime: string | null; cidade: string | null; remuneracao: string | null; idade: number | null; telefone: string | null;
};
type Ficha = { base: string; cpf: string; vinculos: GovVinculo[]; contatos: GovContato[]; tambemSiape: boolean };

const TODOS = "__todos__";
const VAZIO = { q: "", situacao: "ATIVO", orgao: "", cargo: "", regime: "", cidade: "", idade_min: "", idade_max: "", rem_min: "", rem_max: "", com_celular: false };

const fmtCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

export default function ConsultaGovernoPage() {
  const { user } = useAuth();
  const [, navegar] = useLocation();
  const podeExportar = (user as any)?.isMaster || ["master", "coordenacao"].includes(String(user?.role));

  const { data: bases = [], isLoading: carregandoBases } = useQuery<Base[]>({ queryKey: ["/api/bases-governo/minhas"] });
  const [base, setBase] = useState<string>("");
  useEffect(() => {
    if (!base && bases.length > 0) setBase(bases[0].codigo);
  }, [bases, base]);

  const [rascunho, setRascunho] = useState(VAZIO);
  const [aplicado, setAplicado] = useState(VAZIO);
  const [pagina, setPagina] = useState(1);
  const [cpfAberto, setCpfAberto] = useState<string | null>(null);

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ["/api/bases-governo", base, "filtros"],
    enabled: !!base,
    staleTime: 5 * 60_000,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(aplicado).forEach(([k, v]) => {
      if (k === "com_celular") { if (v) p.set(k, "1"); }
      else if (v) p.set(k, String(v));
    });
    return p;
  }, [aplicado]);

  const { data: resultado, isFetching } = useQuery<{ total: number; pagina: number; porPagina: number; linhas: Linha[] }>({
    queryKey: [`/api/bases-governo/${base}/busca?${params.toString()}&pagina=${pagina}`],
    enabled: !!base,
  });

  const { data: ficha, isLoading: carregandoFicha } = useQuery<Ficha>({
    queryKey: ["/api/bases-governo", base, "servidor", cpfAberto],
    enabled: !!base && !!cpfAberto,
  });

  const buscar = () => { setPagina(1); setAplicado(rascunho); };
  const limpar = () => { setRascunho(VAZIO); setAplicado(VAZIO); setPagina(1); };
  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.porPagina)) : 1;
  const set = (k: keyof typeof VAZIO) => (v: any) => setRascunho((r) => ({ ...r, [k]: v }));

  if (carregandoBases) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (bases.length === 0) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma base de governo liberada para este ambiente.</CardContent></Card>
      </div>
    );
  }
  const baseAtual = bases.find((b) => b.codigo === base);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Consulta Governo</h1>
            <p className="text-sm text-muted-foreground">
              {baseAtual ? `${baseAtual.nome} · ${Number(baseAtual.total_servidores || 0).toLocaleString("pt-BR")} servidores` : ""}
            </p>
          </div>
        </div>
        {bases.length > 1 && (
          <Select value={base} onValueChange={(v) => { setBase(v); limpar(); setCpfAberto(null); }}>
            <SelectTrigger className="w-64" data-testid="select-base-governo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {bases.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="CPF, nome ou telefone"
              value={rascunho.q}
              onChange={(e) => set("q")(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              data-testid="input-busca-governo"
            />
            <div className="flex gap-2">
              <Button onClick={buscar} data-testid="button-buscar-governo"><Search className="h-4 w-4 mr-1" />Buscar</Button>
              <Button variant="outline" onClick={limpar}><X className="h-4 w-4 mr-1" />Limpar</Button>
              {podeExportar && (
                <Button variant="outline" asChild>
                  <a href={`/api/bases-governo/${base}/exportar?${params.toString()}`} data-testid="button-exportar-governo">
                    <Download className="h-4 w-4 mr-1" />Exportar
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Situação</Label>
              <Select value={rascunho.situacao || TODOS} onValueChange={(v) => set("situacao")(v === TODOS ? "" : v)}>
                <SelectTrigger data-testid="select-situacao-governo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {filtros?.situacoes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.valor} ({o.qtd.toLocaleString("pt-BR")})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Regime</Label>
              <Select value={rascunho.regime || TODOS} onValueChange={(v) => set("regime")(v === TODOS ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {filtros?.regimes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.valor}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Órgão</Label>
              <Input list="gov-orgaos" value={rascunho.orgao} onChange={(e) => set("orgao")(e.target.value)} placeholder="Todos" />
              <datalist id="gov-orgaos">{filtros?.orgaos.map((o) => <option key={o.valor} value={o.valor} />)}</datalist>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Cargo</Label>
              <Input list="gov-cargos" value={rascunho.cargo} onChange={(e) => set("cargo")(e.target.value)} placeholder="Todos" />
              <datalist id="gov-cargos">{filtros?.cargos.map((o) => <option key={o.valor} value={o.valor} />)}</datalist>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Cidade</Label>
              <Input list="gov-cidades" value={rascunho.cidade} onChange={(e) => set("cidade")(e.target.value)} placeholder="Todas" />
              <datalist id="gov-cidades">{filtros?.cidades.map((o) => <option key={o.valor} value={o.valor} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Idade de</Label>
              <Input type="number" value={rascunho.idade_min} onChange={(e) => set("idade_min")(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">até</Label>
              <Input type="number" value={rascunho.idade_max} onChange={(e) => set("idade_max")(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remuneração de</Label>
              <Input type="number" value={rascunho.rem_min} onChange={(e) => set("rem_min")(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">até</Label>
              <Input type="number" value={rascunho.rem_max} onChange={(e) => set("rem_max")(e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm col-span-2">
              <Checkbox checked={rascunho.com_celular} onCheckedChange={(v) => set("com_celular")(v === true)} />
              Só quem tem celular
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Servidores</CardTitle>
            <CardDescription>
              {resultado ? `${resultado.total.toLocaleString("pt-BR")} encontrados` : ""}
              {isFetching && <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin" />}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="icon" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>{pagina} / {totalPaginas}</span>
            <Button variant="ghost" size="icon" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Remuneração</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado?.linhas.map((l, i) => (
                <TableRow key={`${l.cpf}-${i}`} className="cursor-pointer" onClick={() => setCpfAberto(l.cpf)} data-testid={`linha-governo-${i}`}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtCpf(l.cpf)}</TableCell>
                  <TableCell>{l.idade ?? ""}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={l.orgao || ""}>{l.orgao}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={l.cargo || ""}>{l.cargo}</TableCell>
                  <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded ${corSituacaoGov(l.situacao)}`}>{l.situacao}</span></TableCell>
                  <TableCell>{l.cidade}</TableCell>
                  <TableCell className="whitespace-nowrap">{moeda(l.remuneracao)}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.telefone ? formatPhone(l.telefone) : ""}</TableCell>
                </TableRow>
              ))}
              {resultado && resultado.linhas.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nenhum servidor com esses filtros.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!cpfAberto} onOpenChange={(o) => !o && setCpfAberto(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {carregandoFicha || !ficha ? (
            <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{ficha.vinculos[0]?.nome}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <span>CPF {fmtCpf(ficha.cpf)}</span>
                  <Badge variant="outline">{baseAtual?.nome}</Badge>
                  {ficha.tambemSiape && (
                    <Button size="sm" variant="secondary" className="h-6 px-2"
                      onClick={() => navegar(`/vendas/consulta?cpf=${ficha.cpf}`)} data-testid="button-tambem-siape">
                      Também é SIAPE <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <DadosPessoaisGoverno v={ficha.vinculos[0]} />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Vínculo{ficha.vinculos.length > 1 ? `s (${ficha.vinculos.length})` : ""}</h3>
                  <VinculosGoverno vinculos={ficha.vinculos} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Contatos</h3>
                  <ContatosGoverno contatos={ficha.contatos} base={ficha.base} />
                  <EnderecoGoverno v={ficha.vinculos[0]} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
