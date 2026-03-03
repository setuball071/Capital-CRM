import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Clock, Layers, CheckCircle, ArrowRight, Printer, Save, RotateCcw,
} from "lucide-react";

type DiscProfile = "D" | "I" | "S" | "C";

const ETAPA1_ADJETIVOS: { label: string; perfil: DiscProfile }[] = [
  { label: "Decidido", perfil: "D" }, { label: "Competitivo", perfil: "D" }, { label: "Direto", perfil: "D" }, { label: "Assertivo", perfil: "D" }, { label: "Ambicioso", perfil: "D" },
  { label: "Corajoso", perfil: "D" }, { label: "Determinado", perfil: "D" }, { label: "Independente", perfil: "D" }, { label: "Audacioso", perfil: "D" }, { label: "Persistente", perfil: "D" },
  { label: "Entusiasmado", perfil: "I" }, { label: "Persuasivo", perfil: "I" }, { label: "Otimista", perfil: "I" }, { label: "Sociável", perfil: "I" }, { label: "Inspirador", perfil: "I" },
  { label: "Carismático", perfil: "I" }, { label: "Expressivo", perfil: "I" }, { label: "Animado", perfil: "I" }, { label: "Confiante", perfil: "I" }, { label: "Criativo", perfil: "I" },
  { label: "Paciente", perfil: "S" }, { label: "Leal", perfil: "S" }, { label: "Confiável", perfil: "S" }, { label: "Cooperativo", perfil: "S" }, { label: "Estável", perfil: "S" },
  { label: "Calmo", perfil: "S" }, { label: "Consistente", perfil: "S" }, { label: "Atencioso", perfil: "S" }, { label: "Diplomático", perfil: "S" }, { label: "Compreensivo", perfil: "S" },
  { label: "Preciso", perfil: "C" }, { label: "Analítico", perfil: "C" }, { label: "Sistemático", perfil: "C" }, { label: "Organizado", perfil: "C" }, { label: "Detalhista", perfil: "C" },
  { label: "Cauteloso", perfil: "C" }, { label: "Lógico", perfil: "C" }, { label: "Perfeccionista", perfil: "C" }, { label: "Meticuloso", perfil: "C" }, { label: "Reflexivo", perfil: "C" },
];

const ETAPA2_ADJETIVOS: { label: string; perfil: DiscProfile }[] = [
  { label: "Líder", perfil: "D" }, { label: "Rápido", perfil: "D" }, { label: "Forte", perfil: "D" }, { label: "Dominante", perfil: "D" }, { label: "Desafiador", perfil: "D" },
  { label: "Orientado a Resultados", perfil: "D" }, { label: "Autoconfiante", perfil: "D" }, { label: "Empreendedor", perfil: "D" }, { label: "Inovador", perfil: "D" }, { label: "Proativo", perfil: "D" },
  { label: "Comunicativo", perfil: "I" }, { label: "Amigável", perfil: "I" }, { label: "Motivador", perfil: "I" }, { label: "Popular", perfil: "I" }, { label: "Influente", perfil: "I" },
  { label: "Extrovertido", perfil: "I" }, { label: "Alegre", perfil: "I" }, { label: "Espontâneo", perfil: "I" }, { label: "Convincente", perfil: "I" }, { label: "Articulado", perfil: "I" },
  { label: "Apoiador", perfil: "S" }, { label: "Harmonioso", perfil: "S" }, { label: "Previsível", perfil: "S" }, { label: "Colaborador", perfil: "S" }, { label: "Equilibrado", perfil: "S" },
  { label: "Tranquilo", perfil: "S" }, { label: "Acolhedor", perfil: "S" }, { label: "Generoso", perfil: "S" }, { label: "Solidário", perfil: "S" }, { label: "Dedicado", perfil: "S" },
  { label: "Criterioso", perfil: "C" }, { label: "Técnico", perfil: "C" }, { label: "Rigoroso", perfil: "C" }, { label: "Especialista", perfil: "C" }, { label: "Exigente", perfil: "C" },
  { label: "Objetivo", perfil: "C" }, { label: "Metódico", perfil: "C" }, { label: "Investigativo", perfil: "C" }, { label: "Concentrado", perfil: "C" }, { label: "Racional", perfil: "C" },
];

const PERFIL_CONFIG: Record<DiscProfile, { sigla: string; nome: string; cor: string; bgCor: string; borderCor: string; subtitulo: string; categoria: string; habilidades: string; vantagens: string; atencao: string }> = {
  D: {
    sigla: "EXE", nome: "Executor", cor: "text-red-600 dark:text-red-400", bgCor: "bg-red-500/15", borderCor: "border-red-500/30",
    subtitulo: "Orientado a resultados, direto e decisivo",
    categoria: "Liderança e Ação",
    habilidades: "Executores são profissionais orientados a resultados que prosperam em ambientes desafiadores. Têm capacidade natural de tomar decisões rápidas, liderar equipes sob pressão e transformar estratégias em ações concretas. São altamente competitivos e focados em alcançar metas ambiciosas.",
    vantagens: "Determinação inabalável para atingir objetivos, capacidade de tomar decisões difíceis rapidamente, liderança natural em situações de crise, foco claro em resultados mensuráveis e habilidade de superar obstáculos com resiliência.",
    atencao: "Pode parecer impaciente com processos lentos ou detalhados. Tendência a ser direto demais, podendo parecer insensível. Importante desenvolver escuta ativa, paciência com diferentes ritmos de trabalho e considerar o impacto emocional das decisões nas pessoas ao redor.",
  },
  I: {
    sigla: "COM", nome: "Comunicador", cor: "text-yellow-600 dark:text-yellow-400", bgCor: "bg-yellow-500/15", borderCor: "border-yellow-500/30",
    subtitulo: "Entusiasta, persuasivo e sociável",
    categoria: "Influência e Comunicação",
    habilidades: "Comunicadores são profissionais carismáticos que se destacam em ambientes sociais e colaborativos. Possuem habilidade natural para influenciar, motivar equipes e criar conexões genuínas. São criativos na resolução de problemas e excelentes em apresentações e negociações.",
    vantagens: "Capacidade excepcional de networking e construção de relacionamentos, entusiasmo contagiante que motiva equipes, criatividade para encontrar soluções inovadoras, habilidade persuasiva em vendas e negociações, e otimismo que inspira confiança.",
    atencao: "Pode ter dificuldade com detalhes e acompanhamento de processos. Tendência a assumir muitos compromissos simultaneamente. Importante desenvolver foco em tarefas específicas, organização pessoal e capacidade de dizer 'não' quando necessário.",
  },
  S: {
    sigla: "PLA", nome: "Planejador", cor: "text-green-600 dark:text-green-400", bgCor: "bg-green-500/15", borderCor: "border-green-500/30",
    subtitulo: "Estável, cooperativo e confiável",
    categoria: "Estabilidade e Cooperação",
    habilidades: "Planejadores são profissionais confiáveis que se destacam em ambientes estruturados e colaborativos. Possuem habilidade natural para manter a harmonia da equipe, seguir processos consistentes e oferecer suporte genuíno aos colegas. São excelentes ouvintes e mediadores de conflitos.",
    vantagens: "Lealdade e comprometimento excepcionais com a equipe, capacidade de manter a calma em situações de estresse, consistência e previsibilidade no trabalho, habilidade natural para criar ambientes harmoniosos e apoio genuíno ao desenvolvimento dos colegas.",
    atencao: "Pode ter resistência a mudanças repentinas ou ambientes muito dinâmicos. Tendência a evitar confrontos necessários. Importante desenvolver assertividade, adaptabilidade a mudanças e capacidade de expressar discordância de forma construtiva.",
  },
  C: {
    sigla: "ANA", nome: "Analista", cor: "text-blue-600 dark:text-blue-400", bgCor: "bg-blue-500/15", borderCor: "border-blue-500/30",
    subtitulo: "Preciso, lógico e orientado a qualidade",
    categoria: "Análise e Qualidade",
    habilidades: "Analistas são profissionais meticulosos que se destacam em ambientes que exigem precisão e qualidade. Possuem habilidade natural para análise de dados, identificação de padrões e garantia de conformidade com padrões. São excelentes em planejamento detalhado e resolução de problemas complexos.",
    vantagens: "Precisão e atenção aos detalhes que garantem qualidade, capacidade analítica para decisões baseadas em dados, organização excepcional e planejamento meticuloso, pensamento lógico e sistemático para resolver problemas complexos, e alto padrão de exigência que eleva a qualidade geral.",
    atencao: "Pode parecer excessivamente crítico ou perfeccionista. Tendência a demorar na tomada de decisões por buscar informações exaustivas. Importante desenvolver tolerância à imperfeição, agilidade na ação mesmo sem dados completos e comunicação mais empática.",
  },
};

const MIN_SELECT = 5;

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function DesenvolvimentoProfilerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [etapa, setEtapa] = useState<"intro" | "etapa1" | "etapa2" | "resultado">(
    user?.perfilDiscCompletedAt ? "resultado" : "intro"
  );
  const [sel1, setSel1] = useState<Set<string>>(new Set());
  const [sel2, setSel2] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ d: number; i: number; s: number; c: number } | null>(
    user?.perfilDiscData ? user.perfilDiscData as any : null
  );
  const [perfilDominante, setPerfilDominante] = useState<DiscProfile | null>(
    user?.perfilDisc ? ({ EXECUTOR: "D", COMUNICADOR: "I", PLANEJADOR: "S", ANALISTA: "C" }[user.perfilDisc] as DiscProfile) || null : null
  );
  const [shuffledEtapa1] = useState(() => shuffleArray(ETAPA1_ADJETIVOS));
  const [shuffledEtapa2] = useState(() => shuffleArray(ETAPA2_ADJETIVOS));

  const salvarMutation = useMutation({
    mutationFn: async (data: { perfilDisc: string; perfilDiscData: any }) => {
      await apiRequest("PATCH", "/api/users/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Perfil salvo com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar perfil", variant: "destructive" });
    },
  });

  function calcular() {
    const pontos = { D: 0, I: 0, S: 0, C: 0 };
    for (const label of sel1) {
      const adj = ETAPA1_ADJETIVOS.find((a) => a.label === label);
      if (adj) pontos[adj.perfil]++;
    }
    for (const label of sel2) {
      const adj = ETAPA2_ADJETIVOS.find((a) => a.label === label);
      if (adj) pontos[adj.perfil]++;
    }
    const total = pontos.D + pontos.I + pontos.S + pontos.C;
    const pcts = {
      d: total > 0 ? Math.round((pontos.D / total) * 100) : 0,
      i: total > 0 ? Math.round((pontos.I / total) * 100) : 0,
      s: total > 0 ? Math.round((pontos.S / total) * 100) : 0,
      c: total > 0 ? Math.round((pontos.C / total) * 100) : 0,
    };
    const dominante = (Object.entries(pontos).sort((a, b) => b[1] - a[1])[0][0]) as DiscProfile;
    setResultado(pcts);
    setPerfilDominante(dominante);
    setEtapa("resultado");
  }

  function refazer() {
    setSel1(new Set());
    setSel2(new Set());
    setResultado(null);
    setPerfilDominante(null);
    setEtapa("intro");
  }

  function salvar() {
    if (!resultado || !perfilDominante) return;
    const nomeMap: Record<DiscProfile, string> = { D: "EXECUTOR", I: "COMUNICADOR", S: "PLANEJADOR", C: "ANALISTA" };
    salvarMutation.mutate({ perfilDisc: nomeMap[perfilDominante], perfilDiscData: resultado });
  }

  function toggleSel(set: Set<string>, setFn: (s: Set<string>) => void, label: string) {
    const next = new Set(set);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setFn(next);
  }

  if (etapa === "intro") {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-profiler-title">Profiler Comportamental</CardTitle>
            <CardDescription className="text-base mt-2">Descubra seu perfil comportamental e entenda suas principais habilidades, vantagens e pontos de desenvolvimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">5-10 min</p>
                <p className="text-xs text-muted-foreground">Duração</p>
              </div>
              <div className="space-y-1">
                <Layers className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">2 etapas</p>
                <p className="text-xs text-muted-foreground">Etapas</p>
              </div>
              <div className="space-y-1">
                <CheckCircle className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Onboarding</p>
                <p className="text-xs text-muted-foreground">Obrigatório</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => setEtapa("etapa1")} data-testid="button-iniciar-teste">
              Iniciar Teste <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === "etapa1" || etapa === "etapa2") {
    const isEtapa1 = etapa === "etapa1";
    const adjetivos = isEtapa1 ? shuffledEtapa1 : shuffledEtapa2;
    const sel = isEtapa1 ? sel1 : sel2;
    const setFn = isEtapa1 ? setSel1 : setSel2;
    const titulo = isEtapa1 ? "Como você realmente é" : "Como esperam que você seja";
    const progressValue = isEtapa1 ? 50 : 100;

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Etapa {isEtapa1 ? "1" : "2"} de 2</span>
            <span className="text-sm font-medium" data-testid="text-selecionados-count">{sel.size}/{MIN_SELECT} selecionados</span>
          </div>
          <Progress value={progressValue} className="h-2" data-testid="progress-etapa" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-etapa-titulo">{titulo}</CardTitle>
            <CardDescription>Selecione no mínimo {MIN_SELECT} adjetivos que melhor descrevem {isEtapa1 ? "quem você realmente é" : "como as pessoas esperam que você seja"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" data-testid="grid-adjetivos">
              {adjetivos.map((adj) => {
                const selected = sel.has(adj.label);
                return (
                  <button
                    key={adj.label}
                    onClick={() => toggleSel(sel, setFn, adj.label)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover-elevate"
                    }`}
                    data-testid={`button-adj-${adj.label.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {adj.label}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-6 gap-3">
              {!isEtapa1 && (
                <Button variant="outline" onClick={() => setEtapa("etapa1")} data-testid="button-voltar-etapa">
                  Voltar
                </Button>
              )}
              <Button
                className={isEtapa1 ? "w-full" : "flex-1"}
                disabled={sel.size < MIN_SELECT}
                onClick={() => {
                  if (isEtapa1) setEtapa("etapa2");
                  else calcular();
                }}
                data-testid={isEtapa1 ? "button-proxima-etapa" : "button-ver-resultado"}
              >
                {isEtapa1 ? "Próxima Etapa" : "Ver Resultado"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === "resultado" && resultado && perfilDominante) {
    const config = PERFIL_CONFIG[perfilDominante];
    const bars: { key: DiscProfile; label: string; value: number; color: string }[] = [
      { key: "D", label: "Executor (D)", value: resultado.d, color: "bg-red-500" },
      { key: "I", label: "Comunicador (I)", value: resultado.i, color: "bg-yellow-500" },
      { key: "S", label: "Planejador (S)", value: resultado.s, color: "bg-green-500" },
      { key: "C", label: "Analista (C)", value: resultado.c, color: "bg-blue-500" },
    ];

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <Badge className={`text-lg px-4 py-1.5 ${config.bgCor} ${config.cor} ${config.borderCor} border`} data-testid="badge-perfil-sigla">
                {config.sigla}
              </Badge>
              <h2 className={`text-2xl font-bold ${config.cor}`} data-testid="text-perfil-nome">{config.nome}</h2>
              <p className="text-muted-foreground">{config.subtitulo}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição do Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bars.map((bar) => (
              <div key={bar.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{bar.label}</span>
                  <span className="text-muted-foreground">{bar.value}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${bar.color} transition-all`} style={{ width: `${bar.value}%` }} data-testid={`bar-${bar.key.toLowerCase()}`} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Habilidades Básicas</CardTitle>
            <CardDescription>{config.categoria}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{config.habilidades}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Principais Vantagens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{config.vantagens}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pontos de Atenção e Desenvolvimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{config.atencao}</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.print()} data-testid="button-imprimir">
            <Printer className="h-4 w-4 mr-2" /> Imprimir Resultado
          </Button>
          <Button onClick={salvar} disabled={salvarMutation.isPending} data-testid="button-salvar-perfil">
            <Save className="h-4 w-4 mr-2" /> {salvarMutation.isPending ? "Salvando..." : "Salvar no Perfil"}
          </Button>
          <Button variant="outline" onClick={refazer} data-testid="button-refazer">
            <RotateCcw className="h-4 w-4 mr-2" /> Refazer Teste
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
