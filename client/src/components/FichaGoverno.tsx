/**
 * Ficha de servidor das BASES DE GOVERNO (ES, PR, MA...). Usada em dois lugares:
 * a tela Consulta Governo e o quadro "Também é servidor do governo" da Consulta
 * Individual. Os dados vêm de /api/bases-governo/*, que só responde para o
 * ambiente liberado e para o master.
 */
import { useQuery } from "@tanstack/react-query";
import { Landmark, Copy, Mail, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, IconeWhatsApp } from "@/components/ContatosDoCliente";

export type GovVinculo = {
  cpf: string;
  nome: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  idade: number | null;
  nome_mae: string | null;
  matricula: string | null;
  orgao: string | null;
  lotacao: string | null;
  cargo: string | null;
  regime: string | null;
  situacao: string | null;
  tipo_cargo: string | null;
  admissao: string | null;
  desligamento: string | null;
  remuneracao: string | number | null;
  renda_estimada: string | number | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  margens: Record<string, unknown> | null;
  extras: Record<string, any> | null;
};

export type GovContato = {
  tipo: "telefone" | "email";
  valor: string;
  fonte: string | null;
  celular: boolean;
  nao_perturbe: boolean;
};

/** "2019-02-18..." -> "18/02/2019", sem passar por Date (fuso deslocava um dia). */
export function dataBR(v: string | null | undefined): string {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function moeda(v: string | number | null | undefined): string {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

export function corSituacaoGov(s: string | null | undefined): string {
  const t = String(s || "").toUpperCase();
  if (t === "ATIVO") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (t === "DESLIGADO") return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
}

function nomeFonte(fonte: string | null, base: string): string {
  if (fonte === "BASE") return `Base ${base.replace("-", " ")}`;
  if (fonte === "SERASA" || fonte === "LEMIT") return fonte === "LEMIT" ? "Lemit" : "Serasa";
  return "Anatel";
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-medium break-words">{valor}</p>
    </div>
  );
}

export function DadosPessoaisGoverno({ v }: { v: GovVinculo }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Campo rotulo="Nascimento" valor={v.data_nascimento ? `${dataBR(v.data_nascimento)}${v.idade != null ? ` (${v.idade} anos)` : ""}` : ""} />
      <Campo rotulo="Sexo" valor={v.sexo === "M" ? "Masculino" : v.sexo === "F" ? "Feminino" : ""} />
      <Campo rotulo="Nome da mãe" valor={v.nome_mae} />
      <Campo rotulo="Nome do pai" valor={v.extras?.nome_pai} />
    </div>
  );
}

export function VinculosGoverno({ vinculos }: { vinculos: GovVinculo[] }) {
  return (
    <div className="space-y-3">
      {vinculos.map((v, i) => (
        <div key={i} className="rounded-md border p-3 space-y-3" data-testid={`gov-vinculo-${i}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${corSituacaoGov(v.situacao)}`}>{v.situacao || "Sem situação"}</span>
            {v.regime && <Badge variant="outline">{v.regime}</Badge>}
            {v.tipo_cargo && <Badge variant="outline">{v.tipo_cargo}</Badge>}
            {v.extras?.lote === "complementar" && <Badge variant="secondary">Lote complementar</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Campo rotulo="Órgão" valor={v.orgao ? `${v.orgao}${v.extras?.sigla ? ` (${v.extras.sigla})` : ""}` : ""} />
            <Campo rotulo="Lotação" valor={v.lotacao} />
            <Campo rotulo="Cargo" valor={v.cargo} />
            <Campo rotulo="Matrícula" valor={v.matricula} />
            <Campo rotulo="Admissão" valor={dataBR(v.admissao)} />
            <Campo rotulo="Desligamento" valor={dataBR(v.desligamento)} />
            <Campo rotulo="Última remuneração bruta" valor={moeda(v.remuneracao)} />
            <Campo rotulo="Renda estimada" valor={moeda(v.renda_estimada)} />
            <Campo rotulo="Cidade de lotação" valor={v.extras?.municipio_lotacao} />
          </div>
          {v.margens && Object.keys(v.margens).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
              {Object.entries(v.margens).map(([k, val]) => (
                <Campo key={k} rotulo={k} valor={typeof val === "number" ? moeda(val) : String(val ?? "")} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function EnderecoGoverno({ v }: { v: GovVinculo }) {
  const linha = [v.endereco, v.numero, v.complemento].filter(Boolean).join(", ");
  const cidade = [v.bairro, v.cidade, v.uf].filter(Boolean).join(" · ");
  if (!linha && !cidade) return null;
  const fonte = v.extras?.fontes?.endereco === "ANATEL" ? "Anatel" : linha ? "Base comprada" : "";
  return (
    <div className="flex items-start gap-2 text-sm">
      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div title={fonte ? `Fonte: ${fonte}` : undefined} className={fonte ? "cursor-help" : undefined}>
        {linha && <p className="font-medium">{linha}</p>}
        <p className="text-muted-foreground">{cidade}{v.cep ? ` · CEP ${v.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : ""}</p>
        {!linha && v.extras?.endereco_orgao && (
          <p className="text-xs text-muted-foreground">Endereço do órgão: {v.extras.endereco_orgao}</p>
        )}
      </div>
    </div>
  );
}

export function ContatosGoverno({ contatos, base }: { contatos: GovContato[]; base: string }) {
  const { toast } = useToast();
  const telefones = contatos.filter((c) => c.tipo === "telefone");
  const emails = contatos.filter((c) => c.tipo === "email");
  const copiar = (t: string) => {
    navigator.clipboard?.writeText(t);
    toast({ title: "Copiado", description: t });
  };
  if (telefones.length === 0 && emails.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem telefone ou e-mail nesta base.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {telefones.map((t, i) => (
          <div key={t.valor} className="flex items-center gap-1.5 text-sm" data-testid={`gov-telefone-${i}`}>
            <span className="font-medium cursor-help" title={`Fonte: ${nomeFonte(t.fonte, base)}`}>
              {formatPhone(t.valor)}
            </span>
            {!t.celular && <span className="text-xs text-muted-foreground">fixo</span>}
            {/* Só AVISO: o número continua clicável e copiável. */}
            {t.nao_perturbe && (
              <span className="cursor-help leading-none" title="Não me perturbe" aria-label="Não me perturbe">❗</span>
            )}
            {t.celular && (
              <a href={`https://wa.me/55${t.valor}`} target="_blank" rel="noreferrer"
                className="text-green-600 hover:text-green-700" title="Abrir conversa no WhatsApp">
                <IconeWhatsApp className="h-3.5 w-3.5" />
              </a>
            )}
            <button type="button" onClick={() => copiar(t.valor)} className="text-muted-foreground hover:text-foreground" title="Copiar">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {emails.map((e) => (
        <div key={e.valor} className="flex items-center gap-1.5 text-sm">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <span title={`Fonte: ${nomeFonte(e.fonte, base)}`} className="cursor-help">{e.valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Quadro da Consulta Individual. Aparece só quando a pessoa está numa base de
 * governo LIBERADA para o ambiente; para os demais a rota devolve [] e nada é
 * desenhado -- nem o aviso de que a pessoa existe na base comprada.
 */
export function QuadroGovernoConsulta({ cpf }: { cpf: string | null | undefined }) {
  const limpo = String(cpf || "").replace(/\D/g, "").padStart(11, "0");
  const { data } = useQuery<{ base: string; nomeBase: string; vinculos: GovVinculo[]; contatos: GovContato[] }[]>({
    queryKey: ["/api/bases-governo/por-cpf", limpo],
    enabled: limpo.length === 11 && limpo !== "00000000000",
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <>
      {data.map((b) => (
        <Card key={b.base} className="border-sky-300 dark:border-sky-800" data-testid={`quadro-governo-${b.base}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-sky-600" />
              Também é servidor do {b.nomeBase}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VinculosGoverno vinculos={b.vinculos} />
            <ContatosGoverno contatos={b.contatos} base={b.base} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
