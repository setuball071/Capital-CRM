import { useState, useEffect } from "react";
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
  if (value == null || isNaN(value) || !isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface SimCardProps {
  label: string;
  produto: string;
  accentColor: string;
  icon: React.ReactNode;
  saldo: number | null | undefined;
  coef: BestCoeficiente | null | undefined;
  isLoading: boolean;
  testId: string;
}

function SimCard({ label, produto, accentColor, icon, saldo, coef, isLoading, testId }: SimCardProps) {
  const [coefInput, setCoefInput] = useState<string>("");

  useEffect(() => {
    if (coef?.coeficiente != null) {
      setCoefInput(coef.coeficiente.toFixed(6));
    } else {
      setCoefInput("");
    }
  }, [coef]);

  const saldoNum = saldo ?? 0;
  const temMargem = saldoNum > 0;
  const coefNum = parseFloat(coefInput.replace(",", "."));
  const valorLiberado = temMargem && coefNum > 0 ? saldoNum / coefNum : null;

  return (
    <Card className="bg-muted/50" data-testid={testId}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div style={{ color: accentColor }}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className="text-sm font-semibold leading-tight">{produto}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !temMargem ? (
          <div className="py-2">
            <p className="text-sm text-muted-foreground italic">Margem indisponível</p>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo: <span className="font-medium text-foreground">{formatCurrency(saldoNum)}</span>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p
                className="text-2xl font-bold leading-tight"
                style={{ color: accentColor }}
                data-testid={`${testId}-valor`}
              >
                {valorLiberado != null ? formatCurrency(valorLiberado) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Liberando com este coef.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Coeficiente</label>
              <input
                type="number"
                step="0.000001"
                min="0.000001"
                value={coefInput}
                onChange={(e) => setCoefInput(e.target.value)}
                placeholder={coef == null ? "Digite o coeficiente" : ""}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid={`${testId}-coef-input`}
              />
              {coef == null && (
                <p className="text-xs text-muted-foreground italic">Sem tabela cadastrada</p>
              )}
            </div>

            {coef != null && (
              <p className="text-xs text-muted-foreground truncate" title={coef.tabela}>
                Tabela: {coef.tabela} — {coef.prazo}x
              </p>
            )}

            <p className="text-xs text-muted-foreground border-t pt-2">
              Saldo: <span className="font-medium text-foreground">{formatCurrency(saldoNum)}</span>
            </p>
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
                label="Margem 35%"
                produto="Consignado"
                icon={<TrendingUp className="h-4 w-4" />}
                accentColor="#1E88E5"
                saldo={saldo35}
                coef={data?.consignado}
                isLoading={isLoading}
                testId="card-sim-consignado"
              />
              <SimCard
                label="Margem 5% Benefício"
                produto="Cartão Benefício"
                icon={<Gift className="h-4 w-4" />}
                accentColor="#10B981"
                saldo={saldo5beneficio}
                coef={data?.cartao_beneficio}
                isLoading={isLoading}
                testId="card-sim-cartao-beneficio"
              />
              <SimCard
                label="Margem 5%"
                produto="Cartão de Crédito"
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
