import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BookOpen, CheckCircle2, ArrowRight, Target, Users, Heart, Brain } from "lucide-react";

const NIVEIS = [
  {
    nivel: 1,
    titulo: "Descoberta",
    descricao: "Acolhimento e perguntas iniciais para entender o cliente",
    cor: "bg-blue-500",
    conteudo: [
      "Apresentação cordial e criação de rapport",
      "Perguntas sobre vínculo empregatício (onde trabalha, tempo de serviço)",
      "Identificar se tem margem consignável disponível",
      "Mapear contratos existentes (bancos, parcelas, saldos)",
      "Entender objetivo principal do cliente",
    ],
  },
  {
    nivel: 2,
    titulo: "Explicação",
    descricao: "Explicar produtos com clareza, sem jargão técnico",
    cor: "bg-green-500",
    conteudo: [
      "Explicar crédito consignado tradicional de forma simples",
      "Apresentar cartão consignado/benefício e seus diferenciais",
      "Detalhar a COMPRA DE DÍVIDA (refin estratégico)",
      "Usar analogias para facilitar compreensão",
      "Responder dúvidas com paciência",
    ],
  },
  {
    nivel: 3,
    titulo: "Oferta",
    descricao: "Montar proposta com comparação 'antes x depois'",
    cor: "bg-yellow-500",
    conteudo: [
      "Apresentar cenário atual do cliente (dívidas, parcelas, taxas)",
      "Mostrar proposta ConsigOne/Gold com valores concretos",
      "Fazer comparativo visual 'antes x depois'",
      "Destacar economia mensal e ganho real",
      "Personalizar proposta ao objetivo do cliente",
    ],
  },
  {
    nivel: 4,
    titulo: "Objeções",
    descricao: "Lidar com medo, desconfiança e 'vou pensar'",
    cor: "bg-orange-500",
    conteudo: [
      "Técnicas para lidar com 'já tive problemas com financeira'",
      "Como responder ao 'vou pensar'",
      "Superar medo de se endividar mais",
      "Trabalhar desconfiança com transparência",
      "Usar prova social e casos de sucesso",
    ],
  },
  {
    nivel: 5,
    titulo: "Fechamento",
    descricao: "Conduzir próximo passo com segurança",
    cor: "bg-purple-500",
    conteudo: [
      "Identificar sinais de compra",
      "Conduzir ao fechamento sem pressão",
      "Explicar próximos passos com clareza",
      "Documentação necessária",
      "Acompanhamento pós-venda",
    ],
  },
];

const PRODUTOS = [
  {
    nome: "Crédito Consignado Tradicional",
    descricao: "Empréstimo com desconto direto em folha de pagamento",
    pontos: [
      "Taxas mais baixas do mercado",
      "Parcelas descontadas automaticamente",
      "Prazo estendido para menor parcela",
      "Ideal para quem precisa de dinheiro na mão",
    ],
  },
  {
    nome: "Cartão Consignado / Benefício",
    descricao: "Cartão com limite de crédito e saque, desconto mínimo em folha",
    pontos: [
      "Parte limite para compras",
      "Parte disponível para saque",
      "Desconto mínimo em folha (geralmente 5% da margem)",
      "Ideal para quem quer flexibilidade",
    ],
  },
  {
    nome: "Compra de Dívida (Refin Estratégico)",
    descricao: "Trocar dívidas caras por condição mais estruturada",
    pontos: [
      "Consolida múltiplas dívidas em uma só",
      "Melhora condição de pagamento",
      "Pode liberar valor na mão",
      "Ideal para quem está sufocado ou negativado",
    ],
  },
];

export default function AcademiaFundamentos() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" data-testid="page-academia-fundamentos">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-title">Academia ConsigOne</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Fundamentos do atendimento consultivo em crédito consignado
        </p>
      </div>

      {/* Princípios */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Princípios do Atendimento ConsigOne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <Target className="h-6 w-6 mb-2 text-blue-500" />
              <h3 className="font-semibold mb-1">Consultivo</h3>
              <p className="text-sm text-muted-foreground">
                Entender o cenário antes de empurrar produto. O foco é resolver o problema do cliente.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <Users className="h-6 w-6 mb-2 text-green-500" />
              <h3 className="font-semibold mb-1">Humanizado</h3>
              <p className="text-sm text-muted-foreground">
                Tratamento respeitoso, linguagem simples, sem pressão. Construir relacionamento de longo prazo.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <Brain className="h-6 w-6 mb-2 text-purple-500" />
              <h3 className="font-semibold mb-1">Estratégico</h3>
              <p className="text-sm text-muted-foreground">
                Analisar cenário completo, comparar bancos, encontrar a melhor solução estruturada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Produtos Principais</CardTitle>
          <CardDescription>
            Conheça os produtos que você vai trabalhar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {PRODUTOS.map((produto, index) => (
              <AccordionItem key={index} value={`produto-${index}`}>
                <AccordionTrigger className="text-left">
                  <div>
                    <span className="font-semibold">{produto.nome}</span>
                    <p className="text-sm text-muted-foreground font-normal">
                      {produto.descricao}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {produto.pontos.map((ponto, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{ponto}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Níveis de Treinamento */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Jornada de Treinamento</CardTitle>
          <CardDescription>
            5 níveis para dominar o atendimento consultivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {NIVEIS.map((nivel) => (
              <Accordion key={nivel.nivel} type="single" collapsible>
                <AccordionItem value={`nivel-${nivel.nivel}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4">
                      <Badge className={`${nivel.cor} text-white`}>
                        Nível {nivel.nivel}
                      </Badge>
                      <div className="text-left">
                        <p className="font-semibold">{nivel.titulo}</p>
                        <p className="text-sm text-muted-foreground font-normal">
                          {nivel.descricao}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 pt-2">
                      {nivel.conteudo.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg">Pronto para começar?</h3>
              <p className="text-muted-foreground">
                Complete o quiz para liberar os módulos de IA
              </p>
            </div>
            <Link href="/academia/quiz">
              <Button data-testid="button-ir-quiz">
                Fazer Quiz
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
