import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock } from "lucide-react";

export default function SimuladorPortabilidadePage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Simulador de Portabilidade
          </h1>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Em Breve
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Compare taxas e simule a portabilidade do seu empréstimo para outro banco
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <RefreshCw className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Funcionalidade em Desenvolvimento</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            O Simulador de Portabilidade está sendo desenvolvido e estará disponível em breve.
            Esta ferramenta permitirá comparar as condições do seu empréstimo atual
            com ofertas de outros bancos.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 max-w-2xl mx-auto">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Comparar Taxas</h3>
              <p className="text-sm text-muted-foreground">
                Compare taxas de diferentes bancos
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Simulação Rápida</h3>
              <p className="text-sm text-muted-foreground">
                Veja a economia potencial em segundos
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-1">Melhores Ofertas</h3>
              <p className="text-sm text-muted-foreground">
                Encontre as melhores condições do mercado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
