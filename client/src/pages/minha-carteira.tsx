import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  Users,
  Clock,
  Phone,
  BarChart3,
  FolderOpen,
} from "lucide-react";

interface HistoricoItem {
  id: number;
  nome: string;
  totalLeads: number;
  leadsDistribuidos: number;
  createdAt: string;
  counts: Record<string, number>;
}

interface ImportResult {
  message: string;
  total: number;
  unicos: number;
  importados: number;
  encontradosNaBase: number;
  campanhaNome: string;
}

export default function MinhaCarteiraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: historico = [], isLoading: loadingHistorico } = useQuery<HistoricoItem[]>({
    queryKey: ["/api/vendas/minha-carteira/historico"],
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);

      const res = await fetch("/api/vendas/minha-carteira/importar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao importar");

      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/minha-carteira/historico"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendas/atendimento/resumo"] });
      toast({ title: "Carteira importada com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao importar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const getStatusCounts = (counts: Record<string, number>) => {
    const novo = counts["novo"] || 0;
    const atendendo = counts["em_atendimento"] || 0;
    const concluido = counts["concluido"] || 0;
    return { novo, atendendo, concluido };
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Carteira</h1>
        <p className="text-muted-foreground mt-1">
          Importe sua lista de CPFs e os leads entram direto na sua fila de atendimento — no Pipeline e na Lista Manual.
        </p>
      </div>

      {/* Format info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Como importar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong></p>
          <p>• CPFs na <strong>primeira coluna</strong> (com ou sem formatação)</p>
          <p>• Limite: <strong>5.000 CPFs</strong> por importação</p>
          <p>• Os dados (nome, telefone) são buscados automaticamente na base do sistema</p>
          <p>• Os leads entram na sua fila no <strong>Pipeline</strong> e na <strong>Lista Manual</strong></p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Clique para selecionar o arquivo</p>
                <p className="text-sm text-muted-foreground">.xlsx, .xls ou .csv com CPFs na 1ª coluna</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button className="w-full" disabled={!file || loading} onClick={handleSubmit}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar para Minha Carteira
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Importação concluída!</span>
            </div>
            <p className="text-sm text-muted-foreground">{result.campanhaNome}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {result.importados} leads importados
              </Badge>
              <Badge variant="outline">
                <Phone className="h-3 w-3 mr-1" />
                {result.encontradosNaBase} com dados na base
              </Badge>
              {result.total !== result.unicos && (
                <Badge variant="secondary">
                  {result.total - result.unicos} CPFs duplicados removidos
                </Badge>
              )}
            </div>
            <p className="text-xs text-green-700 dark:text-green-400">
              Acesse o <strong>Pipeline</strong> ou a <strong>Lista Manual</strong> para começar o atendimento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <FolderOpen className="h-4 w-4" />
          Histórico de Importações
        </h2>

        {loadingHistorico ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : historico.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma importação ainda. Envie seu primeiro arquivo acima.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {historico.map((item) => {
              const { novo, atendendo, concluido } = getStatusCounts(item.counts);
              const total = item.totalLeads || 0;
              const progresso = total > 0 ? Math.round(((atendendo + concluido) / total) * 100) : 0;
              return (
                <Card key={item.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(item.createdAt)} · {total} leads
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {novo > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {novo} novos
                          </Badge>
                        )}
                        {atendendo > 0 && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                            <Phone className="h-3 w-3 mr-1" />
                            {atendendo} em atend.
                          </Badge>
                        )}
                        {concluido > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {concluido} concluídos
                          </Badge>
                        )}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span>{progresso}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
