import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, ChevronDown, ChevronUp, TrendingUp, CreditCard, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface BestCoeficiente {
  coeficiente: number;
  tabela: string;
  prazo: number;
}

interface BestCoeficientesResponse {
  consignado: BestCoeficiente | null;
  cartao_beneficio: BestCoeficiente | null;
  cartao_credito: BestCoeficiente | null;
}

interface SimulacaoRapidaProps {
  convenio: string | null | undefined;
  saldo35: number | null | undefined;
  saldo5beneficio: number | null | undefined;
  saldo5cartao: number | null | undefined;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function calcularValor(saldo: number | null | undefined, coeficiente: number | null | undefined): number | null {
  if (saldo == null || coeficiente == null || coeficiente === 0) return null;
  return saldo / coeficiente;
}

interface SimCardProps {
  titulo: string;
  subtitulo: string;
  icon: React.ReactNode;
  accentColor: string;
  saldo: number | null | undefined;
  coef: BestCoeficiente | null | undefined;
  isLoading: boolean;
  testId: string;
}

function SimCard({ titulo, subtitulo, icon, accentColor, saldo, coef, isLoading, testId }: SimCardProps) {
  const saldoNum = saldo ?? 0;
  const temMargem = saldoNum > 0;
  const temTabela = coef != null;
  const valorLiberado = temMargem && temTabela ? calcularValor(saldoNum, coef!.coeficiente) : null;

  return (
    <Card className="bg-muted/50" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div style={{ color: accentColor }}>{icon}</div>
          <div>
            <p className="text-sm font-semibold leading-tight">{titulo}</p>
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {!temMargem ? (
              <p className="text-sm text-muted-foreground italic">Margem indisponível</p>
            ) : !temTabela ? (
              <p className="text-sm text-muted-foreground italic">Sem tabela cadastrada</p>
            ) : (
              <>
                <p className="text-xl font-bold" style={{ color: accentColor }} data-testid={`${testId}-valor`}>
                  {formatCurrency(valorLiberado)}
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="truncate" title={coef!.tabela}>Tabela: {coef!.tabela}</p>
                  <p>Prazo: {coef!.prazo} meses &bull; Coef.: {coef!.coeficiente.toFixed(6)}</p>
                </div>
              </>
            )}
            <div className="pt-1 border-t mt-1">
              <p className="text-xs text-muted-foreground">
                Saldo disponível: <span className="font-medium text-foreground">{formatCurrency(saldoNum)}</span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SimulacaoRapida({ convenio, saldo35, saldo5beneficio, saldo5cartao }: SimulacaoRapidaProps) {
  const [isOpen, setIsOpen] = useState(true);

  const convenioClean = (convenio ?? "").trim();
  const enabled = convenioClean.length > 0;

  const { data, isLoading } = useQuery<BestCoeficientesResponse>({
    queryKey: ["/api/simulation/best-coefficients", convenioClean],
    queryFn: async () => {
      const res = await fetch(`/api/simulation/best-coefficients?convenio=${encodeURIComponent(convenioClean)}`);
      if (!res.ok) throw new Error("Erro ao buscar coeficientes");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  if (!enabled) return null;

  return (
    <Card data-testid="card-simulacao-rapida">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between px-5 py-4 h-auto rounded-none rounded-t-lg"
            data-testid="button-toggle-simulacao-rapida"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Simulação Rápida</span>
              {convenioClean && (
                <span className="text-xs text-muted-foreground font-normal">— {convenioClean}</span>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SimCard
                titulo="Consignado"
                subtitulo="Margem 35%"
                icon={<TrendingUp className="h-4 w-4" />}
                accentColor="#1E88E5"
                saldo={saldo35}
                coef={data?.consignado}
                isLoading={isLoading}
                testId="card-sim-consignado"
              />
              <SimCard
                titulo="Cartão Benefício"
                subtitulo="Margem 5% Benefício"
                icon={<Gift className="h-4 w-4" />}
                accentColor="#10B981"
                saldo={saldo5beneficio}
                coef={data?.cartao_beneficio}
                isLoading={isLoading}
                testId="card-sim-cartao-beneficio"
              />
              <SimCard
                titulo="Cartão de Crédito"
                subtitulo="Margem 5%"
                icon={<CreditCard className="h-4 w-4" />}
                accentColor="#6C2BD9"
                saldo={saldo5cartao}
                coef={data?.cartao_credito}
                isLoading={isLoading}
                testId="card-sim-cartao-credito"
              />
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Simulação estimada com base no melhor coeficiente disponível. Valores sujeitos a aprovação.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
