import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, Save, Zap } from "lucide-react";
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

interface SimCoeficientes {
  consignado: number | null;
  cartao_credito: number | null;
  cartao_beneficio: number | null;
}

export default function PortfolioRulesPage() {
  const { toast } = useToast();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);

  const [coefConsignado, setCoefConsignado] = useState<string>("");
  const [coefCartaoCredito, setCoefCartaoCredito] = useState<string>("");
  const [coefCartaoBeneficio, setCoefCartaoBeneficio] = useState<string>("");

  const { data: rules = [], isLoading } = useQuery<PortfolioRule[]>({
    queryKey: ["/api/portfolio/rules"],
  });

  const { data: simCoefs } = useQuery<SimCoeficientes>({
    queryKey: ["/api/simulation/best-coefficients"],
    staleTime: 0,
  });

  useEffect(() => {
    if (simCoefs) {
      setCoefConsignado(simCoefs.consignado != null ? simCoefs.consignado.toFixed(6) : "");
      setCoefCartaoCredito(simCoefs.cartao_credito != null ? simCoefs.cartao_credito.toFixed(6) : "");
      setCoefCartaoBeneficio(simCoefs.cartao_beneficio != null ? simCoefs.cartao_beneficio.toFixed(6) : "");
    }
  }, [simCoefs]);

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

  const saveCoefsMutation = useMutation({
    mutationFn: async (body: { consignado: number | null; cartao_credito: number | null; cartao_beneficio: number | null }) => {
      const res = await apiRequest("PUT", "/api/portfolio/rules/simulation-coefs", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao salvar coeficientes");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Coeficientes salvos com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/simulation/best-coefficients"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar coeficientes", description: err.message, variant: "destructive" });
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

  const handleSaveCoefs = () => {
    const toNum = (v: string) => {
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) || v.trim() === "" ? null : n;
    };
    saveCoefsMutation.mutate({
      consignado: toNum(coefConsignado),
      cartao_credito: toNum(coefCartaoCredito),
      cartao_beneficio: toNum(coefCartaoBeneficio),
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle>Coeficientes Padrão da Simulação</CardTitle>
          </div>
          <CardDescription>
            Defina os coeficientes padrão usados na Simulação Rápida exibida nas consultas de clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Consignado</label>
              <p className="text-xs text-muted-foreground">Margem 35%</p>
              <Input
                type="number"
                step="0.000001"
                min="0"
                placeholder="ex: 0.021000"
                value={coefConsignado}
                onChange={(e) => setCoefConsignado(e.target.value)}
                className="font-mono"
                data-testid="input-coef-consignado"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cartão de Crédito</label>
              <p className="text-xs text-muted-foreground">Margem 5%</p>
              <Input
                type="number"
                step="0.000001"
                min="0"
                placeholder="ex: 0.025000"
                value={coefCartaoCredito}
                onChange={(e) => setCoefCartaoCredito(e.target.value)}
                className="font-mono"
                data-testid="input-coef-cartao-credito"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cartão Benefício</label>
              <p className="text-xs text-muted-foreground">Margem 5% Benefício</p>
              <Input
                type="number"
                step="0.000001"
                min="0"
                placeholder="ex: 0.024000"
                value={coefCartaoBeneficio}
                onChange={(e) => setCoefCartaoBeneficio(e.target.value)}
                className="font-mono"
                data-testid="input-coef-cartao-beneficio"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveCoefs}
              disabled={saveCoefsMutation.isPending}
              data-testid="button-save-coefs"
            >
              {saveCoefsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Coeficientes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
