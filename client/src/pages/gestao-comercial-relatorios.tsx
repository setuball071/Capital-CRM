import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart } from "lucide-react";

export default function GestaoComercialRelatoriosPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-relatorios">
      <div className="flex items-center gap-3">
        <FileBarChart className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Relatórios</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Comerciais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-placeholder">
            Módulo de relatórios em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
