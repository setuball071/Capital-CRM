import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import CalculatorPage from "@/pages/calculator";
import DashboardPage from "@/pages/dashboard";
import WelcomePage from "@/pages/welcome";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
import UsersPage from "@/pages/users";
import AgreementsPage from "@/pages/agreements";
import BanksPage from "@/pages/banks";
import CoefficientTablesPage from "@/pages/coefficient-tables";
import RoteirosPage from "@/pages/roteiros";
import BasesClientesPage from "@/pages/bases-clientes";
import NomenclaturasPage from "@/pages/nomenclaturas";
import SplitTxtCsvPage from "@/pages/split-txt-csv";
import DividirCsvPage from "@/pages/dividir-csv";
import CompraListaPage from "@/pages/compra-lista";
import ConsultaClientePage from "@/pages/consulta-cliente";
import AdminPedidosListaPage from "@/pages/admin-pedidos-lista";
import ConfigPrecosPage from "@/pages/config-precos";
import AcademiaFundamentosPage from "@/pages/academia-fundamentos";
import AcademiaQuizPage from "@/pages/academia-quiz";
import AcademiaRoleplayPage from "@/pages/academia-roleplay";
import AcademiaAbordagemPage from "@/pages/academia-abordagem";
import AcademiaAdminPage from "@/pages/academia-admin";
import VendasCampanhasPage from "@/pages/vendas-campanhas";
import VendasAtendimentoPage from "@/pages/vendas-atendimento";
import VendasAgendaPage from "@/pages/vendas-agenda";
import VendasPipelinePage from "@/pages/vendas-pipeline";
import VendasGestaoPipelinePage from "@/pages/vendas-gestao-pipeline";
import VendasConsultaPage from "@/pages/vendas-consulta";
import ConfigPromptsPage from "@/pages/config-prompts";
import AdminTenantsPage from "@/pages/admin-tenants";
import KanbanPage from "@/pages/kanban";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function HomePage() {
  const { user, isLoading } = useAuth();
  
  // Wait for auth to resolve before making any decisions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Only master goes to dashboard, others go to welcome page
  if (user.role === "master") {
    return <Redirect to="/dashboard" />;
  }
  
  return <Redirect to="/welcome" />;
}

// Protected route that only allows master users (fallback)
function MasterRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "master") {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Protected route that checks module permissions
import type { ModuleName } from "@shared/schema";

function ModuleRoute({ component: Component, module, accessType = "view" }: { 
  component: React.ComponentType; 
  module: ModuleName;
  accessType?: "view" | "edit" | "delegate";
}) {
  const { user, isLoading, hasModuleAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!hasModuleAccess(module, accessType)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Protected route for Academia Admin (master and coordenacao)
function AcademiaAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const allowedRoles = ["master", "coordenacao"];
  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Protected route for roteiros (master, atendimento, operacional only)
function RoteirosRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const allowedRoles = ["master", "atendimento", "operacional"];
  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Protected route for compra lista (coordenacao and master only)
function CompraListaRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const allowedRoles = ["master", "coordenacao"];
  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Protected route for CRM admin (master, atendimento only)
function CRMAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const allowedRoles = ["master", "atendimento"];
  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Wait for auth to resolve before rendering any routes
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login">
          {() => <PublicRoute component={LoginPage} />}
        </Route>
        <Route>
          {() => <Redirect to="/login" />}
        </Route>
      </Switch>
    );
  }

  // Redirect authenticated users away from /login
  if (location === "/login") {
    return <Redirect to="/" />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/">
                {() => <HomePage />}
              </Route>
              <Route path="/dashboard">
                {() => <MasterRoute component={DashboardPage} />}
              </Route>
              <Route path="/welcome">
                {() => <ProtectedRoute component={WelcomePage} />}
              </Route>
              <Route path="/simulador-compra">
                {() => <ModuleRoute component={CalculatorPage} module="modulo_simulador" />}
              </Route>
              <Route path="/profile">
                {() => <ProtectedRoute component={ProfilePage} />}
              </Route>
              <Route path="/users">
                {() => <ModuleRoute component={UsersPage} module="modulo_config_usuarios" />}
              </Route>
              <Route path="/agreements">
                {() => <MasterRoute component={AgreementsPage} />}
              </Route>
              <Route path="/banks">
                {() => <MasterRoute component={BanksPage} />}
              </Route>
              <Route path="/coefficient-tables">
                {() => <MasterRoute component={CoefficientTablesPage} />}
              </Route>
              <Route path="/roteiros">
                {() => <ModuleRoute component={RoteirosPage} module="modulo_roteiros" />}
              </Route>
              <Route path="/bases-clientes">
                {() => <ModuleRoute component={BasesClientesPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/nomenclaturas">
                {() => <ModuleRoute component={NomenclaturasPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/split-txt-csv">
                {() => <ModuleRoute component={SplitTxtCsvPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/dividir-csv">
                {() => <ModuleRoute component={DividirCsvPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/compra-lista">
                {() => <ModuleRoute component={CompraListaPage} module="modulo_compra_lista" />}
              </Route>
              <Route path="/consulta-cliente">
                {() => <ModuleRoute component={ConsultaClientePage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/admin-pedidos-lista">
                {() => <ModuleRoute component={AdminPedidosListaPage} module="modulo_compra_lista" />}
              </Route>
              <Route path="/config-precos">
                {() => <ModuleRoute component={ConfigPrecosPage} module="modulo_config_precos" />}
              </Route>
              <Route path="/academia/fundamentos">
                {() => <ModuleRoute component={AcademiaFundamentosPage} module="modulo_academia" />}
              </Route>
              <Route path="/academia/quiz">
                {() => <ModuleRoute component={AcademiaQuizPage} module="modulo_academia" />}
              </Route>
              <Route path="/academia/roleplay">
                {() => <ModuleRoute component={AcademiaRoleplayPage} module="modulo_academia" />}
              </Route>
              <Route path="/academia/abordagem">
                {() => <ModuleRoute component={AcademiaAbordagemPage} module="modulo_academia" />}
              </Route>
              <Route path="/academia/admin">
                {() => <ModuleRoute component={AcademiaAdminPage} module="modulo_academia" accessType="edit" />}
              </Route>
              <Route path="/vendas/campanhas">
                {() => <ModuleRoute component={VendasCampanhasPage} module="modulo_crm_vendas_campanhas" />}
              </Route>
              <Route path="/vendas/atendimento">
                {() => <ModuleRoute component={VendasAtendimentoPage} module="modulo_crm_vendas_atendimento" />}
              </Route>
              <Route path="/vendas/agenda">
                {() => <ModuleRoute component={VendasAgendaPage} module="modulo_crm_vendas_atendimento" />}
              </Route>
              <Route path="/vendas/pipeline">
                {() => <ModuleRoute component={VendasPipelinePage} module="modulo_crm_vendas_atendimento" />}
              </Route>
              <Route path="/vendas/gestao-pipeline">
                {() => <ModuleRoute component={VendasGestaoPipelinePage} module="modulo_crm_vendas_campanhas" />}
              </Route>
              <Route path="/vendas/consulta">
                {() => <ModuleRoute component={VendasConsultaPage} module="modulo_crm_vendas_atendimento" />}
              </Route>
              <Route path="/config-prompts">
                {() => <ProtectedRoute component={ConfigPromptsPage} />}
              </Route>
              <Route path="/admin/tenants">
                {() => <MasterRoute component={AdminTenantsPage} />}
              </Route>
              <Route path="/kanban">
                {() => <ProtectedRoute component={KanbanPage} />}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantThemeProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Router />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </TenantThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
