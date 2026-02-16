import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function GestaoComercialDashboardPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-dashboard">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard da Empresa</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-placeholder">
            Painel de indicadores da empresa em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
