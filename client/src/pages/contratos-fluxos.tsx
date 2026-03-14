import { GitBranch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ContratosFluxosPage() {
  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Gestão de Fluxos</h1>
        <p className="text-sm text-muted-foreground">Configure os fluxos operacionais para cada produto bancário</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <GitBranch className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Em desenvolvimento</p>
            <p className="text-sm text-muted-foreground mt-1">
              A interface de gestão de fluxos estará disponível em breve.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
