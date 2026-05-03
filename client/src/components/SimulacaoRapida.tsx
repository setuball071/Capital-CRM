import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, ChevronDown, ChevronUp, TrendingUp, CreditCard, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SimCoeficientesResponse {
  consignado: number | null;
  cartao_credito: number | null;
  cartao_beneficio: number | null;
}

interface SimulacaoRapidaProps {
  convenio?: string | null;
  saldo35: number | null | undefined;
  saldo5cartao: number | null | undefined;
  saldo5beneficio: number | null | undefined;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || isNaN(value) || !isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface SimCardProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  saldo: number | null | undefined;
  coefDefault: number | null | undefined;
  isLoading: boolean;
  testId: string;
}

function SimCard({ title, icon, accentColor, saldo, coefDefault, isLoading, testId }: SimCardProps) {
  const saldoNum = saldo ?? 0;
  const temMargem = saldoNum > 0;

  const [parcelaInput, setParcelaInput] = useState<string>("");
  const [coefInput, setCoefInput] = useState<string>("");

  useEffect(() => {
    if (temMargem) {
      setParcelaInput(saldoNum.toFixed(2));
    } else {
      setParcelaInput("");
    }
  }, [saldoNum, temMargem]);

  useEffect(() => {
    if (coefDefault != null) {
      setCoefInput(coefDefault.toFixed(6));
    } else {
      setCoefInput("");
    }
  }, [coefDefault]);

  const parcela = parseFloat(parcelaInput.replace(",", "."));
  const coef = parseFloat(coefInput.replace(",", "."));
  const valorLiberado = !isNaN(parcela) && parcela > 0 && !isNaN(coef) && coef > 0
    ? parcela / coef
    : null;

  return (
    <Card className="bg-muted/50" data-testid={testId}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div style={{ color: accentColor }}>{icon}</div>
          <p className="text-sm font-semibold leading-tight">{title}</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : !temMargem ? (
          <p className="text-sm text-muted-foreground italic py-2">Margem indisponível</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Valor Liberado</p>
              <p
                className="text-2xl font-bold leading-tight"
                style={{ color: accentColor }}
                data-testid={`${testId}-valor`}
              >
                {valorLiberado != null ? formatCurrency(valorLiberado) : "—"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Parcela</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={parcelaInput}
                  onChange={(e) => setParcelaInput(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid={`${testId}-parcela-input`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Coeficiente</label>
                <input
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  value={coefInput}
                  onChange={(e) => setCoefInput(e.target.value)}
                  placeholder={coefDefault == null ? "Digite..." : ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid={`${testId}-coef-input`}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SimulacaoRapida({ convenio, saldo35, saldo5cartao, saldo5beneficio }: SimulacaoRapidaProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useQuery<SimCoeficientesResponse>({
    queryKey: ["/api/simulation/best-coefficients"],
    staleTime: 1000 * 60 * 5,
  });

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
              {convenio && (
                <span className="text-xs text-muted-foreground font-normal">— {convenio}</span>
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
                title="Margem 35% — Consignado"
                icon={<TrendingUp className="h-4 w-4" />}
                accentColor="#1E88E5"
                saldo={saldo35}
                coefDefault={data?.consignado}
                isLoading={isLoading}
                testId="card-sim-consignado"
              />
              <SimCard
                title="Margem 5% — Cartão de Crédito"
                icon={<CreditCard className="h-4 w-4" />}
                accentColor="#6C2BD9"
                saldo={saldo5cartao}
                coefDefault={data?.cartao_credito}
                isLoading={isLoading}
                testId="card-sim-cartao-credito"
              />
              <SimCard
                title="Margem 5% Benefício — Cartão Benefício"
                icon={<Gift className="h-4 w-4" />}
                accentColor="#10B981"
                saldo={saldo5beneficio}
                coefDefault={data?.cartao_beneficio}
                isLoading={isLoading}
                testId="card-sim-cartao-beneficio"
              />
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Simulação estimada com base no coeficiente padrão configurado. Valores sujeitos a aprovação.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
