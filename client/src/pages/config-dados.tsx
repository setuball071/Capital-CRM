import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Database, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type FonteMargem = "D8" | "CONTRACHEQUE";

export default function ConfigDadosPage() {
  const { toast } = useToast();
  const [fonteSelecionada, setFonteSelecionada] = useState<FonteMargem>("D8");

  const { data, isLoading } = useQuery<{ fonte_margem: FonteMargem }>({
    queryKey: ["/api/admin/configuracoes-dados"],
    queryFn: async () => {
      const res = await fetch("/api/admin/configuracoes-dados", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar configurações");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.fonte_margem) setFonteSelecionada(data.fonte_margem);
  }, [data]);

  const salvarMutation = useMutation({
    mutationFn: async (fonte: FonteMargem) =>
      apiRequest("PUT", "/api/admin/configuracoes-dados", { fonte_margem: fonte }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/configuracoes-dados"] });
      toast({ title: "Configuração salva", description: "Fonte de referência atualizada com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a configuração.", variant: "destructive" });
    },
  });

  const opcoes: { value: FonteMargem; label: string; descricao: string }[] = [
    {
      value: "D8",
      label: "D8 / Folha SIAPE",
      descricao: "Usa os valores importados via arquivo D8. Fonte mais estável e consistente para cálculo de margens e filtros.",
    },
    {
      value: "CONTRACHEQUE",
      label: "Contracheque SIAPE",
      descricao: "Usa os valores extraídos do PDF do contracheque. Pode ter base de cálculo diferente do D8 (salário cheio vs. remuneração base).",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configurações de Dados</h1>
          <p className="text-muted-foreground text-sm">Defina a fonte de referência padrão para margens e filtros</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fonte de Referência para Margens</CardTitle>
          <CardDescription>
            Esta configuração define qual fonte de dados é usada por padrão para exibir margens na consulta de clientes
            e nos filtros de base. O master pode sobrescrever individualmente em cada consulta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : (
            <>
              {opcoes.map((op) => (
                <button
                  key={op.value}
                  onClick={() => setFonteSelecionada(op.value)}
                  className={`w-full text-left flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                    fonteSelecionada === op.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    fonteSelecionada === op.value ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {fonteSelecionada === op.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{op.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{op.descricao}</div>
                  </div>
                </button>
              ))}

              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {data?.fonte_margem === fonteSelecionada
                    ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" />Configuração atual</span>
                    : "Configuração alterada — salve para aplicar"
                  }
                </span>
                <Button
                  onClick={() => salvarMutation.mutate(fonteSelecionada)}
                  disabled={salvarMutation.isPending || data?.fonte_margem === fonteSelecionada}
                >
                  {salvarMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</>
                  ) : "Salvar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
