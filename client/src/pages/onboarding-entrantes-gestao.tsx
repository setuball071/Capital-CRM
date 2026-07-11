import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CheckCircle2,
  Loader2,
  GraduationCap,
  Rocket,
  Map,
  ClipboardList,
  Package,
} from "lucide-react";

interface TentativaOnboarding {
  origem: string | null;
  acertos: number;
  total: number;
  criadoEm: string;
}

interface Entrante {
  userId: number;
  userName: string | null;
  userEmail: string | null;
  experienciaDeclarada: boolean | null;
  bagagemOrigem: string | null;
  onboardingEtapa: string;
  tourConcluido: boolean;
  produtoInicial: string | null;
  baselineNota: string | null;
  baselineNivel: string | null;
  liberadoParaProspectar: boolean;
  liberadoEm: string | null;
  criadoEm: string;
  tentativas: TentativaOnboarding[];
}

const ETAPA_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  entrada: { label: "Não começou", variant: "outline" },
  tour: { label: "No tour", variant: "secondary" },
  teste: { label: "No teste", variant: "secondary" },
  produto: { label: "Produto + exemplos", variant: "secondary" },
  aguardando_liberacao: { label: "Aguardando liberação", variant: "default" },
  liberado: { label: "Liberado", variant: "outline" },
};

const BASELINE_LABEL: Record<string, string> = {
  cru: "Começando do zero",
  tem_nocao: "Tem noção",
  avancado: "Avançado",
};

export default function OnboardingEntrantesGestao() {
  const { toast } = useToast();

  const { data: entrantes, isLoading } = useQuery<Entrante[]>({
    queryKey: ["/api/onboarding/entrantes"],
  });

  const liberarMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/onboarding/entrantes/${userId}/liberar`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/entrantes"] });
      toast({ title: "Entrante liberado!", description: "Ele já pode começar a prospectar." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível liberar", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const lista = entrantes || [];
  const aguardando = lista.filter((e) => e.onboardingEtapa === "aguardando_liberacao");
  const emAndamento = lista.filter(
    (e) => !["aguardando_liberacao", "liberado"].includes(e.onboardingEtapa),
  );
  const liberados = lista.filter((e) => e.onboardingEtapa === "liberado");

  const notaDe = (e: Entrante, origem: string) => {
    const t = e.tentativas.find((t) => t.origem === origem);
    return t ? `${t.acertos}/${t.total}` : "—";
  };

  const EntranteCard = ({ e }: { e: Entrante }) => {
    const etapaInfo = ETAPA_LABEL[e.onboardingEtapa] || ETAPA_LABEL.entrada;
    return (
      <Card data-testid={`card-entrante-${e.userId}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">{e.userName || e.userEmail || `Usuário #${e.userId}`}</CardTitle>
              <CardDescription>{e.userEmail}</CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Badge variant={etapaInfo.variant}>{etapaInfo.label}</Badge>
              {e.experienciaDeclarada !== null && (
                <Badge variant="outline">
                  {e.experienciaDeclarada ? "Com experiência" : "Sem experiência"}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Raio-x */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Bagagem</p>
              <p className="font-medium">{e.bagagemOrigem || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Baseline (teste)</p>
              <p className="font-medium">
                {e.baselineNota !== null ? `${e.baselineNota}%` : "—"}
                {e.baselineNivel ? ` · ${BASELINE_LABEL[e.baselineNivel] || e.baselineNivel}` : ""}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Compreensão (exemplos)</p>
              <p className="font-medium">{notaDe(e, "onboarding_compreensao")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Produto inicial</p>
              <p className="font-medium capitalize">{e.produtoInicial || "portabilidade"}</p>
            </div>
          </div>

          {/* Progresso dos blocos */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Map className="h-3.5 w-3.5" />
              Tour {e.tourConcluido ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : "pendente"}
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" />
              Teste {e.baselineNota !== null ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : "pendente"}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              Produto{" "}
              {["aguardando_liberacao", "liberado"].includes(e.onboardingEtapa) ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                "pendente"
              )}
            </span>
          </div>

          {/* Ação */}
          {e.onboardingEtapa === "aguardando_liberacao" && (
            <Button
              onClick={() => liberarMutation.mutate(e.userId)}
              disabled={liberarMutation.isPending}
              data-testid={`button-liberar-${e.userId}`}
            >
              {liberarMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Liberar para prospectar
            </Button>
          )}
          {e.onboardingEtapa === "liberado" && e.liberadoEm && (
            <p className="text-xs text-muted-foreground">
              Liberado em {new Date(e.liberadoEm).toLocaleDateString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-title">
          <Users className="h-7 w-7" />
          Acompanhar Entrantes
        </h1>
        <p className="text-muted-foreground">
          Raio-x do onboarding de cada entrante — libere quem concluiu a jornada para começar a prospectar
        </p>
      </div>

      {lista.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhum entrante no onboarding ainda.
          </CardContent>
        </Card>
      )}

      {aguardando.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Aguardando liberação
            <Badge>{aguardando.length}</Badge>
          </h2>
          {aguardando.map((e) => (
            <EntranteCard key={e.userId} e={e} />
          ))}
        </div>
      )}

      {emAndamento.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Em andamento
            <Badge variant="secondary">{emAndamento.length}</Badge>
          </h2>
          {emAndamento.map((e) => (
            <EntranteCard key={e.userId} e={e} />
          ))}
        </div>
      )}

      {liberados.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Liberados
            <Badge variant="outline">{liberados.length}</Badge>
          </h2>
          {liberados.map((e) => (
            <EntranteCard key={e.userId} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
