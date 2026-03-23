import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PRODUCT_LABELS: Record<string, string> = {
  CARTAO: "Cartão",
  CONSIGNADO: "Consignado",
  NOVO: "Novo Empréstimo",
  PORTABILIDADE: "Portabilidade",
  REFINANCIAMENTO: "Refinanciamento",
};

interface PortfolioRule {
  id?: number;
  product_type: string;
  duration_months: number;
}

export default function PortfolioRulesPage() {
  const { toast } = useToast();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery<PortfolioRule[]>({
    queryKey: ["/api/portfolio/rules"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ productType, durationMonths }: { productType: string; durationMonths: number }) => {
      const res = await apiRequest("PUT", `/api/portfolio/rules/${productType}`, { durationMonths });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao salvar regra");
      }
      return res.json();
    },
    onSuccess: (_, { productType }) => {
      toast({ title: "Regra salva com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/rules"] });
      setEditedValues((prev) => {
        const next = { ...prev };
        delete next[productType];
        return next;
      });
      setSavingProduct(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      setSavingProduct(null);
    },
  });

  const handleSave = (productType: string, currentValue: number) => {
    const value = editedValues[productType] ?? currentValue;
    if (!value || isNaN(value) || value < 1) {
      toast({ title: "Prazo inválido. Deve ser pelo menos 1 mês.", variant: "destructive" });
      return;
    }
    setSavingProduct(productType);
    saveMutation.mutate({ productType, durationMonths: value });
  };

  const getValue = (rule: PortfolioRule): number => {
    return editedValues[rule.product_type] ?? rule.duration_months;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Regras de Carteira</h1>
          <p className="text-sm text-muted-foreground">
            Configure o prazo de bloqueio (em meses) por tipo de produto. Clientes ficam vinculados ao vendedor por este período após um contrato ser confirmado.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prazos por Produto</CardTitle>
          <CardDescription>
            Edite o prazo de cada produto e clique em "Salvar" para confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-48">Prazo (meses)</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.product_type}>
                    <TableCell className="font-medium">
                      {PRODUCT_LABELS[rule.product_type] || rule.product_type}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={getValue(rule)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setEditedValues((prev) => ({ ...prev, [rule.product_type]: isNaN(v) ? 0 : v }));
                        }}
                        className="w-24"
                        data-testid={`input-duration-${rule.product_type}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleSave(rule.product_type, rule.duration_months)}
                        disabled={savingProduct === rule.product_type || saveMutation.isPending}
                        data-testid={`button-save-${rule.product_type}`}
                      >
                        {savingProduct === rule.product_type ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
