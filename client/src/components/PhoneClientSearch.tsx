import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface PhoneSearchResult {
  pessoa_id: number;
  cpf: string | null;
  matricula: string | null;
  nome: string | null;
  convenio: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  sit_func: string | null;
}

interface PhoneClientSearchProps {
  onSelect: (result: PhoneSearchResult) => void;
  autoSelectSingle?: boolean;
  placeholder?: string;
  buttonLabel?: string;
  inputTestId?: string;
  buttonTestId?: string;
}

export function PhoneClientSearch({
  onSelect,
  autoSelectSingle = true,
  placeholder = "(11) 99999-9999",
  buttonLabel = "Buscar",
  inputTestId = "input-phone-search",
  buttonTestId = "button-phone-search",
}: PhoneClientSearchProps) {
  const { toast } = useToast();
  const [telefone, setTelefone] = useState("");
  const [results, setResults] = useState<PhoneSearchResult[] | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (input: string) => {
      const cleanTel = input.replace(/\D/g, "");
      if (cleanTel.length < 8 || cleanTel.length > 11) {
        throw new Error("Telefone inválido. Informe entre 8 e 11 dígitos.");
      }
      const res = await apiRequest("POST", "/api/vendas/consulta/buscar-telefone", {
        telefone: cleanTel,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao buscar por telefone");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const list: PhoneSearchResult[] = data.resultados || [];
      setResults(list);
      if (list.length === 0) {
        toast({
          title: "Nenhum cliente encontrado",
          description: "Não localizamos clientes com esse telefone.",
        });
      } else if (autoSelectSingle && list.length === 1) {
        onSelect(list[0]);
      }
    },
    onError: (err: unknown) => {
      setResults(null);
      const description =
        err instanceof Error ? err.message : "Não foi possível buscar por telefone.";
      toast({
        title: "Erro",
        description,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!telefone.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o telefone",
        variant: "destructive",
      });
      return;
    }
    setResults(null);
    searchMutation.mutate(telefone.trim());
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          data-testid={inputTestId}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={searchMutation.isPending}
          data-testid={buttonTestId}
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {buttonLabel}
        </Button>
      </div>

      {results && results.length > 1 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {results.length} clientes encontrados com este telefone. Selecione um para abrir:
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.map((r) => (
              <Card
                key={r.pessoa_id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => onSelect(r)}
                data-testid={`phone-result-${r.pessoa_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {r.nome || "(sem nome)"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        CPF: {r.cpf || "-"}
                        {r.matricula ? ` · Matrícula: ${r.matricula}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {[r.convenio, r.orgao, r.uf, r.municipio]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
