import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Wand2, Lock, ArrowRight, Copy, Phone, MessageCircle, Check, Sparkles, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Perfil {
  perfil: {
    quizAprovado: boolean;
  };
}

interface AbordagemGerada {
  abertura_resumida: string;
  objetivo_abordagem: string;
  perguntas_consultivas: string[];
  exploracao_dor: string;
  proposta_valor: string;
  gatilhos_usados: string[];
  script_pronto_ligacao: string;
  script_pronto_whatsapp: string;
}

interface AbordagemHistorico {
  id: number;
  canal: string;
  tipoCliente: string;
  produtoFoco: string;
  scriptLigacao: string;
  scriptWhatsapp: string;
  criadoEm: string;
}

const TIPOS_CLIENTE = [
  { value: "cliente_negativado", label: "Cliente Negativado" },
  { value: "cliente_antigo", label: "Cliente Antigo" },
  { value: "novo_servidor", label: "Novo Servidor Público" },
  { value: "indicacao", label: "Indicação" },
];

const PRODUTOS = [
  { value: "compra_divida", label: "Compra de Dívida (Refin)" },
  { value: "cartao", label: "Cartão Consignado/Benefício" },
  { value: "consignado", label: "Crédito Consignado" },
];

const ESTILOS_TOM = [
  { value: "consultiva_acolhedora", label: "Consultiva / Acolhedora", desc: "Tom empático, sem pressão. Para clientes sensíveis." },
  { value: "direta_objetiva", label: "Direta / Objetiva", desc: "Foco em benefício prático. Para clientes ocupados." },
  { value: "persuasiva_profissional", label: "Persuasiva Profissional", desc: "Com autoridade e prova social. Tom de especialista." },
  { value: "alta_conversao", label: "Alta Conversão", desc: "Urgência saudável. Para clientes indecisos." },
  { value: "ultra_premium", label: "Ultra Premium", desc: "Estilo consultor. Para servidores de alto salário." },
];

export default function AcademiaAbordagem() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [canal, setCanal] = useState<string>("whatsapp");
  const [tipoCliente, setTipoCliente] = useState<string>("");
  const [produtoFoco, setProdutoFoco] = useState<string>("");
  const [tom, setTom] = useState<string>("persuasiva_profissional");
  const [contexto, setContexto] = useState<string>("");
  const [abordagem, setAbordagem] = useState<AbordagemGerada | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const isMaster = user?.role === "master";
  const isCoordinator = user?.role === "coordenacao";
  const canBypassQuiz = isMaster || isCoordinator;

  const { data: perfilData, isLoading: loadingPerfil } = useQuery<Perfil>({
    queryKey: ["/api/academia/perfil"],
  });

  const { data: historico } = useQuery<AbordagemHistorico[]>({
    queryKey: ["/api/academia/abordagens"],
    enabled: !!perfilData?.perfil?.quizAprovado || canBypassQuiz,
  });

  const quizAprovado = perfilData?.perfil?.quizAprovado || canBypassQuiz;

  const gerarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/treinador-consigone", {
        modo: "abordagem_ia",
        canal,
        tipoCliente,
        produtoFoco,
        tom,
        contexto: contexto || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAbordagem(data);
      queryClient.invalidateQueries({ queryKey: ["/api/academia/abordagens"] });
      toast({
        title: "Abordagem gerada!",
        description: "Scripts prontos para uso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a abordagem",
        variant: "destructive",
      });
    },
  });

  const handleGerar = () => {
    if (!tipoCliente || !produtoFoco) {
      toast({
        title: "Atenção",
        description: "Selecione o tipo de cliente e produto",
        variant: "destructive",
      });
      return;
    }
    gerarMutation.mutate();
  };

  const handleCopiar = async (texto: string, tipo: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
      toast({ title: "Copiado!", description: "Script copiado para a área de transferência" });
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };

  if (loadingPerfil) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check quiz approval
  if (!quizAprovado) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl" data-testid="page-academia-abordagem">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2" data-testid="text-bloqueado">Módulo Bloqueado</h2>
            <p className="text-muted-foreground mb-6">
              Complete o quiz de fundamentos para liberar o Gerador de Abordagem.
            </p>
            <Link href="/academia/quiz">
              <Button data-testid="button-ir-quiz">
                Fazer Quiz
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" data-testid="page-academia-abordagem">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Wand2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">Gerador de Abordagem IA</h1>
            <p className="text-muted-foreground text-sm">
              Gere scripts personalizados para WhatsApp e ligação
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Configurar Abordagem
            </CardTitle>
            <CardDescription>
              Defina o perfil do cliente e produto para gerar scripts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Canal */}
            <div className="space-y-2">
              <Label>Canal de Abordagem</Label>
              <div className="flex gap-2">
                <Button
                  variant={canal === "whatsapp" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCanal("whatsapp")}
                  data-testid="button-canal-whatsapp"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant={canal === "ligacao" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCanal("ligacao")}
                  data-testid="button-canal-ligacao"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Ligação
                </Button>
              </div>
            </div>

            {/* Tipo de Cliente */}
            <div className="space-y-2">
              <Label>Tipo de Cliente</Label>
              <Select value={tipoCliente} onValueChange={setTipoCliente}>
                <SelectTrigger data-testid="select-tipo-cliente">
                  <SelectValue placeholder="Selecione o tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CLIENTE.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produto */}
            <div className="space-y-2">
              <Label>Produto em Foco</Label>
              <Select value={produtoFoco} onValueChange={setProdutoFoco}>
                <SelectTrigger data-testid="select-produto">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map((produto) => (
                    <SelectItem key={produto.value} value={produto.value}>
                      {produto.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estilo da Abordagem (Tom) */}
            <div className="space-y-2">
              <Label>Estilo da Abordagem</Label>
              <Select value={tom} onValueChange={setTom}>
                <SelectTrigger data-testid="select-tom">
                  <SelectValue placeholder="Selecione o tom da abordagem" />
                </SelectTrigger>
                <SelectContent>
                  {ESTILOS_TOM.map((estilo) => (
                    <SelectItem key={estilo.value} value={estilo.value}>
                      <div className="flex flex-col">
                        <span>{estilo.label}</span>
                        <span className="text-xs text-muted-foreground">{estilo.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contexto */}
            <div className="space-y-2">
              <Label>Contexto Adicional (opcional)</Label>
              <Textarea
                placeholder="Ex: Cliente ligou perguntando sobre cartão, tem 3 contratos antigos..."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                className="min-h-[80px]"
                data-testid="textarea-contexto"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleGerar}
              disabled={gerarMutation.isPending || !tipoCliente || !produtoFoco}
              data-testid="button-gerar"
            >
              {gerarMutation.isPending ? (
                "Gerando..."
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Abordagem
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Result */}
        <div className="space-y-6">
          {abordagem ? (
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="text-lg">Scripts Gerados</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={canal} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="whatsapp">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="ligacao">
                      <Phone className="h-4 w-4 mr-2" />
                      Ligação
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="whatsapp" className="mt-4">
                    <div className="relative">
                      <ScrollArea className="h-64 rounded-lg border p-4 bg-muted/50">
                        <p className="text-sm whitespace-pre-wrap" data-testid="text-script-whatsapp">
                          {abordagem.script_pronto_whatsapp}
                        </p>
                      </ScrollArea>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => handleCopiar(abordagem.script_pronto_whatsapp, "whatsapp")}
                        data-testid="button-copiar-whatsapp"
                      >
                        {copiado === "whatsapp" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="ligacao" className="mt-4">
                    <div className="relative">
                      <ScrollArea className="h-64 rounded-lg border p-4 bg-muted/50">
                        <p className="text-sm whitespace-pre-wrap" data-testid="text-script-ligacao">
                          {abordagem.script_pronto_ligacao}
                        </p>
                      </ScrollArea>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => handleCopiar(abordagem.script_pronto_ligacao, "ligacao")}
                        data-testid="button-copiar-ligacao"
                      >
                        {copiado === "ligacao" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Additional Info */}
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold mb-1">Objetivo:</p>
                    <p className="text-sm text-muted-foreground">{abordagem.objetivo_abordagem}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Perguntas Consultivas:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {abordagem.perguntas_consultivas?.map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Gatilhos Usados:</p>
                    <div className="flex flex-wrap gap-1">
                      {abordagem.gatilhos_usados?.map((g, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Configure e clique em "Gerar Abordagem" para ver os scripts
                </p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          {historico && historico.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {historico.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {item.canal === "whatsapp" ? (
                            <MessageCircle className="h-4 w-4" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                          <span>
                            {TIPOS_CLIENTE.find((t) => t.value === item.tipoCliente)?.label || item.tipoCliente}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {PRODUTOS.find((p) => p.value === item.produtoFoco)?.label || item.produtoFoco}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
