import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileText, Save, Pencil, Clock, Tag, User } from "lucide-react";
import { Loader2 } from "lucide-react";

interface RegulamentoData {
  id: number;
  tenant_id: number;
  texto: string;
  versao: string;
  data_atualizacao: string;
  criado_por: number | null;
  criado_por_nome: string | null;
  created_at: string;
}

export default function GestaoComercialRegulamentoPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState("");
  const [versao, setVersao] = useState("");

  const { data: regulamento, isLoading } = useQuery<RegulamentoData | null>({
    queryKey: ["/api/regulamento"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { texto: string; versao: string }) => {
      const res = await apiRequest("POST", "/api/regulamento", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regulamento"] });
      setEditing(false);
      toast({ title: "Regulamento criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar regulamento", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { texto: string; versao: string }) => {
      const res = await apiRequest("PUT", `/api/regulamento/${regulamento!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regulamento"] });
      setEditing(false);
      toast({ title: "Regulamento atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar regulamento", variant: "destructive" });
    },
  });

  const handleEdit = () => {
    setTexto(regulamento?.texto || "");
    setVersao(regulamento?.versao || "1.0");
    setEditing(true);
  };

  const handleCreate = () => {
    setTexto("");
    setVersao("1.0");
    setEditing(true);
  };

  const handleSave = () => {
    if (!texto.trim() || !versao.trim()) {
      toast({ title: "Preencha o texto e a versão", variant: "destructive" });
      return;
    }
    if (regulamento) {
      updateMutation.mutate({ texto, versao });
    } else {
      createMutation.mutate({ texto, versao });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-regulamento">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Regulamento Comercial</h1>
        </div>
        {!editing && (
          <Button
            onClick={regulamento ? handleEdit : handleCreate}
            data-testid="button-edit-regulamento"
          >
            {regulamento ? <><Pencil className="mr-2 h-4 w-4" /> Editar Regulamento</> : <><FileText className="mr-2 h-4 w-4" /> Criar Regulamento</>}
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="versao" className="text-sm font-semibold">Versão</Label>
              <Input
                id="versao"
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                placeholder="Ex: 1.0, 2.1, 3.0"
                data-testid="input-versao"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="texto" className="text-sm font-semibold">Texto do Regulamento</Label>
              <Textarea
                id="texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Digite o texto completo do regulamento aqui..."
                className="min-h-[400px] text-sm leading-relaxed"
                data-testid="textarea-regulamento"
              />
              <p className="text-xs text-muted-foreground">
                Use linhas em branco para separar parágrafos. O texto será exibido preservando as quebras de linha.
              </p>
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isPending}
                data-testid="button-save-regulamento"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Regulamento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : regulamento ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span className="font-semibold">Versão {regulamento.versao}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Atualizado em {formatDate(regulamento.data_atualizacao)}</span>
              </div>
              {regulamento.criado_por_nome && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Por {regulamento.criado_por_nome}</span>
                </div>
              )}
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="text-regulamento-content">
              {regulamento.texto.split("\n").map((line, i) => (
                <p key={i} className={`text-sm leading-relaxed ${line.trim() === "" ? "h-3" : "text-foreground"}`}>
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-medium mb-2">Nenhum regulamento cadastrado</p>
            <p className="text-muted-foreground text-sm mb-6">Clique no botão acima para criar o regulamento comercial.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
