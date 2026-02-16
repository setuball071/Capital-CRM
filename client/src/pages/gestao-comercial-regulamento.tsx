import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function GestaoComercialRegulamentoPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-regulamento">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Regulamento</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Regulamento Comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-placeholder">
            Módulo de regulamento em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
