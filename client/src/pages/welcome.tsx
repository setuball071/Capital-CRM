import { Calculator, FileText, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function WelcomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "master":
        return "Administrador";
      case "coordenacao":
        return "Coordenador";
      case "vendedor":
        return "Vendedor";
      default:
        return role;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-background p-4">
        <div>
          <h1 className="text-2xl font-bold">Bem-vindo ao CRM pro</h1>
          <p className="text-sm text-muted-foreground">{getRoleLabel(user.role)}</p>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Greeting Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5" data-testid="card-greeting">
            <CardHeader>
              <CardTitle className="text-3xl">
                {getGreeting()}, {user.name}!
              </CardTitle>
              <CardDescription className="text-base">
                Bem-vindo ao sistema de simulações de compra. Utilize as ferramentas abaixo para começar.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card 
              className="hover-elevate active-elevate-2 cursor-pointer transition-all"
              onClick={() => setLocation("/simulador-compra")}
              data-testid="card-new-simulation"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Nova Simulação
                </CardTitle>
                <CardDescription>
                  Criar uma nova simulação de compra para seu cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  data-testid="button-start-simulation"
                >
                  Iniciar Simulação
                </Button>
              </CardContent>
            </Card>

            {user.role === "coordenacao" && (
              <Card 
                className="hover-elevate active-elevate-2 cursor-pointer transition-all"
                onClick={() => setLocation("/users")}
                data-testid="card-manage-team"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Gerenciar Equipe
                  </CardTitle>
                  <CardDescription>
                    Visualizar e gerenciar sua equipe de vendedores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-manage-team"
                  >
                    Ver Equipe
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30" data-testid="card-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Dicas Rápidas
                </CardTitle>
                <CardDescription>
                  Informações úteis para suas simulações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Preencha todos os campos corretamente</li>
                  <li>• Escolha o convênio adequado ao cliente</li>
                  <li>• Verifique os valores antes de salvar</li>
                  <li>• Exporte em PDF para enviar ao cliente</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* System Info */}
          <Card data-testid="card-system-info">
            <CardHeader>
              <CardTitle>Sobre o Sistema</CardTitle>
              <CardDescription>
                O CRM pro permite calcular ofertas de empréstimo para clientes com cartões de crédito e benefícios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Como funciona:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Selecione o convênio do cliente</li>
                  <li>Escolha o tipo de operação (Cartão de Crédito, Cartão Benefício ou Consignado)</li>
                  <li>Informe a parcela atual e o saldo devedor</li>
                  <li>Selecione o banco e o prazo desejado</li>
                  <li>O sistema calculará automaticamente o valor total e o troco</li>
                  <li>Salve a simulação em PDF, JPEG ou PNG para compartilhar</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
