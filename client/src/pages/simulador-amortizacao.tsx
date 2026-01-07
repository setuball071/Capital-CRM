import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Clock } from "lucide-react";

export default function SimuladorAmortizacaoPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Simulador de Amortização
          </h1>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Em Breve
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Calcule amortizações e reduza o valor das parcelas ou prazo do contrato
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <TrendingDown className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Funcionalidade em Desenvolvimento</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            O Simulador de Amortização está sendo desenvolvido e estará disponível em breve.
            Esta ferramenta permitirá calcular o impacto de amortizações extraordinárias
            no seu contrato de crédito consignado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 max-w-2xl mx-auto">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Redução de Parcela</h3>
              <p className="text-sm text-muted-foreground">
                Simule quanto pode reduzir o valor mensal
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Redução de Prazo</h3>
              <p className="text-sm text-muted-foreground">
                Veja quantos meses pode economizar
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Economia Total</h3>
              <p className="text-sm text-muted-foreground">
                Calcule a economia em juros
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
