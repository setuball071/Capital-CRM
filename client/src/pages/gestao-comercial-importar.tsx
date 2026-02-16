import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function GestaoComercialImportarPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-importar">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Importar Produção</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Importação de Dados de Produção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-placeholder">
            Módulo de importação de produção em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
