import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function GestaoComercialMetasPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-metas">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Metas & Níveis</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Metas e Níveis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-placeholder">
            Módulo de metas e níveis em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
