import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Target,
  Map,
  ClipboardList,
  Package,
  FileText,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  Rocket,
  ThumbsUp,
  ThumbsDown,
  GraduationCap,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  ONBOARDING_META_NORTE,
  ONBOARDING_TOUR_PASSOS,
  ONBOARDING_MATERIAL_CONCEITUAL,
  ONBOARDING_PRODUTO_BRIEFING,
  ONBOARDING_EXEMPLOS_PORTABILIDADE,
} from "@shared/academia-conteudo";

interface EstadoOnboarding {
  experienciaDeclarada: boolean | null;
  bagagemOrigem: string | null;
  onboardingEtapa: string;
  tourConcluido: boolean;
  produtoInicial: string;
  baselineNota: string | null;
  baselineNivel: string | null;
  liberadoParaProspectar: boolean;
  liberadoEm: string | null;
}

interface PerguntaOnboarding {
  id: number;
  pergunta: string;
  opcoes: string[];
}

interface ResultadoTeste {
  acertos: number;
  total: number;
  percentual: number;
  baselineNivel?: string;
  onboardingEtapa: string;
}

interface ExtratoItem {
  id: string;
  titulo: string;
  imagem: string;
  perguntas: PerguntaOnboarding[];
}

const BAGAGEM_OPCOES = [
  "Já trabalhei com consignado (banco/correspondente)",
  "Vendas em outra área",
  "Atendimento/telemarketing",
  "Primeiro emprego em vendas",
  "Outro",
];

const BASELINE_LABEL: Record<string, string> = {
  cru: "Começando do zero",
  tem_nocao: "Tem noção",
  avancado: "Avançado",
};

// Mini-renderer de markdown (mesmo padrão da academia-fundamentos)
function renderMarkdown(conteudo: string) {
  return conteudo.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace("## ", "")}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.replace("### ", "")}</h3>;
    }
    if (line.startsWith("- ")) {
      return <li key={i} className="ml-4">{line.replace("- ", "")}</li>;
    }
    if (/^\d+\. /.test(line)) {
      return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
    }
    if (line.startsWith("> ")) {
      return <blockquote key={i} className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground">{line.replace("> ", "")}</blockquote>;
    }
    if (line.trim() === "") {
      return <br key={i} />;
    }
    return <p key={i} className="my-1">{line}</p>;
  });
}

// Bloco de perguntas reutilizável (teste e compreensão)
function QuizBloco({
  endpoint,
  onFinalizado,
  titulo,
  descricao,
}: {
  endpoint: "teste" | "compreensao";
  onFinalizado: () => void;
  titulo: string;
  descricao: string;
}) {
  const { toast } = useToast();
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);

  const { data, isLoading } = useQuery<{ perguntas: PerguntaOnboarding[] }>({
    queryKey: [`/api/onboarding/${endpoint}`],
  });

  const submeterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/onboarding/${endpoint}`, { respostas });
      return res.json();
    },
    onSuccess: (data: ResultadoTeste) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/estado"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar as respostas", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const perguntas = data?.perguntas || [];
  const todasRespondidas = perguntas.every((p) => respostas[p.id] !== undefined);

  if (resultado) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h3 className="text-xl font-bold" data-testid={`text-resultado-${endpoint}`}>
            Você acertou {resultado.acertos} de {resultado.total} ({resultado.percentual}%)
          </h3>
          {resultado.baselineNivel && (
            <Badge variant="secondary" className="text-sm">
              Seu ponto de partida: {BASELINE_LABEL[resultado.baselineNivel] || resultado.baselineNivel}
            </Badge>
          )}
          <p className="text-muted-foreground text-sm">
            Este teste mede seu ponto de partida — não reprova ninguém. Ele ajuda seu gestor a te acompanhar melhor.
          </p>
          <Button onClick={onFinalizado} data-testid={`button-continuar-${endpoint}`}>
            Continuar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {perguntas.map((p, idx) => (
          <div key={p.id} className="space-y-2">
            <p className="font-medium">
              {idx + 1}. {p.pergunta}
            </p>
            <div className="grid gap-2">
              {p.opcoes.map((opcao, oIdx) => (
                <button
                  key={oIdx}
                  onClick={() => setRespostas((prev) => ({ ...prev, [p.id]: oIdx }))}
                  className={`text-left text-sm p-3 rounded-lg border transition-colors ${
                    respostas[p.id] === oIdx
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-accent"
                  }`}
                  data-testid={`option-${p.id}-${oIdx}`}
                >
                  {opcao}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button
          className="w-full"
          disabled={!todasRespondidas || submeterMutation.isPending}
          onClick={() => submeterMutation.mutate()}
          data-testid={`button-enviar-${endpoint}`}
        >
          {submeterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enviar respostas
        </Button>
      </CardContent>
    </Card>
  );
}

// Bloco de Leitura de Extrato — diagnóstico só para experientes (imagem + perguntas)
function ExtratoBloco({ onFinalizado }: { onFinalizado: () => void }) {
  const { toast } = useToast();
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);

  const { data, isLoading } = useQuery<{ itens: ExtratoItem[] }>({
    queryKey: ["/api/onboarding/extrato"],
  });

  const submeterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/extrato", { respostas });
      return res.json();
    },
    onSuccess: (data: ResultadoTeste) => {
      setResultado(data);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/estado"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar as respostas", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const itens = data?.itens || [];
  const totalPerguntas = itens.reduce((acc, it) => acc + it.perguntas.length, 0);
  const todasRespondidas =
    totalPerguntas > 0 &&
    itens.every((it) => it.perguntas.every((p) => respostas[p.id] !== undefined));

  if (resultado) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h3 className="text-xl font-bold" data-testid="text-resultado-extrato">
            Você acertou {resultado.acertos} de {resultado.total} ({resultado.percentual}%)
          </h3>
          <p className="text-muted-foreground text-sm">
            Este é um diagnóstico de leitura de extrato. Seu gestor usa esse resultado para calibrar o acompanhamento.
          </p>
          <Button onClick={onFinalizado} data-testid="button-continuar-extrato">
            Continuar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {itens.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base">{item.titulo}</CardTitle>
            <CardDescription>Analise o extrato e responda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <a
              href={item.imagem}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative group"
              data-testid={`img-${item.id}`}
            >
              <img
                src={item.imagem}
                alt={item.titulo}
                className="w-full max-h-[520px] object-contain rounded-lg border bg-muted"
              />
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs bg-background/90 border rounded px-2 py-1 text-muted-foreground">
                <ExternalLink className="h-3 w-3" /> ampliar
              </span>
            </a>
            {item.perguntas.map((p, idx) => (
              <div key={p.id} className="space-y-2">
                <p className="font-medium">
                  {idx + 1}. {p.pergunta}
                </p>
                <div className="grid gap-2">
                  {p.opcoes.map((opcao, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => setRespostas((prev) => ({ ...prev, [p.id]: oIdx }))}
                      className={`text-left text-sm p-3 rounded-lg border transition-colors ${
                        respostas[p.id] === oIdx
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:bg-accent"
                      }`}
                      data-testid={`option-${p.id}-${oIdx}`}
                    >
                      {opcao}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button
        className="w-full"
        disabled={!todasRespondidas || submeterMutation.isPending}
        onClick={() => submeterMutation.mutate()}
        data-testid="button-enviar-extrato"
      >
        {submeterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enviar respostas
      </Button>
    </div>
  );
}

export default function OnboardingEntrante() {
  const { toast } = useToast();
  const [experiencia, setExperiencia] = useState<boolean | null>(null);
  const [bagagem, setBagagem] = useState("");
  const [passoTourAberto, setPassoTourAberto] = useState<string | null>("tour.1");
  const [conceitualLido, setConceitualLido] = useState(false);

  const { data: estado, isLoading } = useQuery<EstadoOnboarding>({
    queryKey: ["/api/onboarding/estado"],
  });

  const refetchEstado = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding/estado"] });

  const declaracaoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/declaracao", {
        experiencia,
        bagagemOrigem: bagagem || null,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchEstado();
      toast({ title: "Vamos lá!", description: "Bem-vindo(a) ao onboarding." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" });
    },
  });

  const tourMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/tour/concluir", {});
      return res.json();
    },
    onSuccess: () => refetchEstado(),
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível concluir o tour", variant: "destructive" });
    },
  });

  if (isLoading || !estado) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const etapa = estado.onboardingEtapa || "entrada";
  const semExperiencia = estado.experienciaDeclarada === false;
  const comExperiencia = estado.experienciaDeclarada === true;
  const fimDaJornada = etapa === "aguardando_liberacao" || etapa === "liberado";

  // Progresso dos blocos (o de extrato só existe para experientes)
  const blocos = [
    { id: "tour", titulo: "Tour do Sistema", icon: Map, concluido: estado.tourConcluido },
    { id: "teste", titulo: "Teste de Conhecimento", icon: ClipboardList, concluido: estado.baselineNota !== null },
    {
      id: "produto",
      titulo: "Produto + Exemplos",
      icon: Package,
      concluido: etapa === "extrato" || fimDaJornada,
    },
    ...(comExperiencia
      ? [
          {
            id: "extrato",
            titulo: "Leitura de Extrato",
            icon: FileText,
            concluido: fimDaJornada,
          },
        ]
      : []),
  ];
  const concluidos = blocos.filter((b) => b.concluido).length;
  const progressoPercent = (concluidos / blocos.length) * 100;

  const exemplos = ONBOARDING_EXEMPLOS_PORTABILIDADE.filter(
    (ex) => !ex.apenasIniciante || semExperiencia,
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho + meta-norte */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-title">Onboarding</h1>
            <p className="text-muted-foreground">Sua jornada de entrada — do zero até estar pronto para prospectar</p>
          </div>
          {(etapa === "aguardando_liberacao" || (etapa !== "liberado" && etapa !== "entrada")) && (
            <Badge variant="secondary" className="text-sm" data-testid="badge-em-treinamento">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Em treinamento
            </Badge>
          )}
        </div>

        {/* Meta-norte sempre visível */}
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Target className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="font-bold" data-testid="text-meta-norte">{ONBOARDING_META_NORTE.titulo}</p>
              <p className="text-sm text-muted-foreground">{ONBOARDING_META_NORTE.descricao}</p>
            </div>
          </CardContent>
        </Card>

        {/* Barra de progresso dos 3 blocos */}
        {etapa !== "entrada" && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {blocos.map((bloco, i) => {
                  const Icon = bloco.icon;
                  return (
                    <div key={bloco.id} className="flex items-center gap-2 flex-1">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          bloco.concluido ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {bloco.concluido ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-sm ${bloco.concluido ? "font-medium" : "text-muted-foreground"}`}>
                        {i + 1}. {bloco.titulo}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Progress value={progressoPercent} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== ETAPA: ENTRADA (auto-declaração) ===== */}
      {etapa === "entrada" && (
        <Card>
          <CardHeader>
            <CardTitle>Antes de começar, nos conte sobre você</CardTitle>
            <CardDescription>
              Isso ajusta o conteúdo do seu onboarding — quem já tem experiência faz uma versão mais direta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="font-medium">Você já tem experiência com vendas/prospecção?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExperiencia(true)}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    experiencia === true ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-accent"
                  }`}
                  data-testid="button-experiencia-sim"
                >
                  Sim, já vendi antes
                </button>
                <button
                  onClick={() => setExperiencia(false)}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    experiencia === false ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-accent"
                  }`}
                  data-testid="button-experiencia-nao"
                >
                  Não, estou começando
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium">De onde você vem?</p>
              <Select value={bagagem} onValueChange={setBagagem}>
                <SelectTrigger data-testid="select-bagagem">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {BAGAGEM_OPCOES.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={experiencia === null || declaracaoMutation.isPending}
              onClick={() => declaracaoMutation.mutate()}
              data-testid="button-comecar"
            >
              {declaracaoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Começar o onboarding
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== ETAPA: TOUR ===== */}
      {etapa === "tour" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                Bloco 1 — Tour do Sistema
              </CardTitle>
              <CardDescription>
                Conheça as áreas que você vai usar todos os dias. Leia cada uma antes de concluir.
              </CardDescription>
            </CardHeader>
          </Card>
          {ONBOARDING_TOUR_PASSOS.map((passo, idx) => (
            <Collapsible
              key={passo.id}
              open={passoTourAberto === passo.id}
              onOpenChange={(open) => setPassoTourAberto(open ? passo.id : null)}
            >
              <Card>
                <CollapsibleTrigger className="w-full text-left" data-testid={`trigger-${passo.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {idx + 1}. {passo.titulo}
                      </CardTitle>
                      <CardDescription>{passo.resumo}</CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {renderMarkdown(passo.conteudo)}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          <Button
            className="w-full"
            disabled={tourMutation.isPending}
            onClick={() => tourMutation.mutate()}
            data-testid="button-concluir-tour"
          >
            {tourMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Li tudo — concluir o tour
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ===== ETAPA: TESTE ===== */}
      {etapa === "teste" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Bloco 2 — Teste de Conhecimento
              </CardTitle>
              <CardDescription>
                {semExperiencia
                  ? "Primeiro leia o material de apoio abaixo. Depois responda o teste — ele mede seu ponto de partida, não reprova."
                  : "Responda o teste — ele mede seu ponto de partida e ajuda seu gestor a te acompanhar."}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Material conceitual só para quem não tem experiência */}
          {semExperiencia && !conceitualLido && (
            <div className="space-y-4">
              {ONBOARDING_MATERIAL_CONCEITUAL.map((licao) => (
                <Collapsible key={licao.id}>
                  <Card>
                    <CollapsibleTrigger className="w-full text-left" data-testid={`trigger-${licao.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-base">{licao.titulo}</CardTitle>
                          <CardDescription>{licao.resumo}</CardDescription>
                        </div>
                        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {renderMarkdown(licao.conteudo)}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
              <Button className="w-full" onClick={() => setConceitualLido(true)} data-testid="button-conceitual-lido">
                Li o material — ir para o teste
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {(!semExperiencia || conceitualLido) && (
            <QuizBloco
              endpoint="teste"
              titulo="Teste de Conhecimento"
              descricao="Responda com sinceridade — o resultado é o seu ponto de partida."
              onFinalizado={refetchEstado}
            />
          )}
        </div>
      )}

      {/* ===== ETAPA: PRODUTO + EXEMPLOS ===== */}
      {etapa === "produto" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Bloco 3 — {ONBOARDING_PRODUTO_BRIEFING.titulo}
              </CardTitle>
              <CardDescription>
                Conheça o produto, estude os exemplos de abordagem e responda as perguntas de compreensão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {renderMarkdown(ONBOARDING_PRODUTO_BRIEFING.conteudo)}
              </div>
            </CardContent>
          </Card>

          <h3 className="font-semibold text-lg mt-2">Exemplos de abordagem</h3>
          {exemplos.map((ex) => (
            <Card key={ex.id} className={ex.tipo === "ruim" ? "border-red-300 dark:border-red-800" : "border-green-300 dark:border-green-800"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {ex.tipo === "bom" ? (
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                  )}
                  {ex.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted p-3 rounded-lg text-sm italic">"{ex.mensagem}"</div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">{ex.tipo === "bom" ? "Por que funciona: " : "Por que NÃO funciona: "}</span>
                  {ex.analise}
                </p>
              </CardContent>
            </Card>
          ))}

          <QuizBloco
            endpoint="compreensao"
            titulo="Você entendeu os exemplos?"
            descricao="Perguntas sobre os exemplos que você acabou de ler."
            onFinalizado={refetchEstado}
          />
        </div>
      )}

      {/* ===== ETAPA: LEITURA DE EXTRATO (só experiente) ===== */}
      {etapa === "extrato" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Leitura de Extrato
              </CardTitle>
              <CardDescription>
                Como você já tem experiência, este bloco mede sua leitura de extrato de consignação na prática.
                Analise cada extrato e responda — é um diagnóstico, não reprova ninguém.
              </CardDescription>
            </CardHeader>
          </Card>
          <ExtratoBloco onFinalizado={refetchEstado} />
        </div>
      )}

      {/* ===== ETAPA: AGUARDANDO LIBERAÇÃO ===== */}
      {etapa === "aguardando_liberacao" && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Lock className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-2xl font-bold" data-testid="text-aguardando">Onboarding concluído!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Você completou todos os blocos. Agora seu gestor vai revisar seu percurso e liberar você para começar a
              prospectar. Aguarde a liberação — você será avisado.
            </p>
            <Badge variant="secondary" className="text-sm">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Em treinamento — aguardando liberação
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* ===== ETAPA: LIBERADO ===== */}
      {etapa === "liberado" && (
        <Card className="border-green-300 dark:border-green-800">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Rocket className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold" data-testid="text-liberado">Você está liberado para prospectar! 🎉</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Seu gestor liberou você. Agora é pra valer: <strong>{ONBOARDING_META_NORTE.titulo}</strong>. Boas vendas!
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Link href="/vendas/atendimento">
                <Button data-testid="button-ir-atendimento">
                  Ir para o Atendimento
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/dashboard-vendedor">
                <Button variant="outline" data-testid="button-ir-dashboard">
                  Ver meu painel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
