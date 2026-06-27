import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VisaoGeralTab from "@/components/dashboard-gerencial/tabs/VisaoGeralTab";
import PerformanceTab from "@/components/dashboard-gerencial/tabs/PerformanceTab";

function EmBreve({ nome }: { nome: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground" data-testid={`tab-placeholder-${nome}`}>
      {nome} — em desenvolvimento.
    </div>
  );
}

export default function GestaoComercialDashboardPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-gestao-dashboard">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard da Empresa</h1>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance">Performance Comercial</TabsTrigger>
          <TabsTrigger value="portabilidades">Portabilidades</TabsTrigger>
          <TabsTrigger value="perfil">Perfil dos Clientes</TabsTrigger>
          <TabsTrigger value="operacional">Gestão Operacional</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligência Comercial</TabsTrigger>
          <TabsTrigger value="dna">DNA do Corretor</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <VisaoGeralTab />
        </TabsContent>
        <TabsContent value="performance" className="mt-4"><PerformanceTab /></TabsContent>
        <TabsContent value="portabilidades" className="mt-4"><EmBreve nome="Portabilidades" /></TabsContent>
        <TabsContent value="perfil" className="mt-4"><EmBreve nome="Perfil dos Clientes" /></TabsContent>
        <TabsContent value="operacional" className="mt-4"><EmBreve nome="Gestão Operacional" /></TabsContent>
        <TabsContent value="inteligencia" className="mt-4"><EmBreve nome="Inteligência Comercial" /></TabsContent>
        <TabsContent value="dna" className="mt-4"><EmBreve nome="DNA do Corretor" /></TabsContent>
      </Tabs>
    </div>
  );
}
