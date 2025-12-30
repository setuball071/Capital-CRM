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

// Protected route that only allows master users
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
                {() => <ProtectedRoute component={CalculatorPage} />}
              </Route>
              <Route path="/profile">
                {() => <ProtectedRoute component={ProfilePage} />}
              </Route>
              <Route path="/users">
                {() => <ProtectedRoute component={UsersPage} />}
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
                {() => <RoteirosRoute component={RoteirosPage} />}
              </Route>
              <Route path="/bases-clientes">
                {() => <MasterRoute component={BasesClientesPage} />}
              </Route>
              <Route path="/nomenclaturas">
                {() => <MasterRoute component={NomenclaturasPage} />}
              </Route>
              <Route path="/split-txt-csv">
                {() => <MasterRoute component={SplitTxtCsvPage} />}
              </Route>
              <Route path="/dividir-csv">
                {() => <MasterRoute component={DividirCsvPage} />}
              </Route>
              <Route path="/compra-lista">
                {() => <MasterRoute component={CompraListaPage} />}
              </Route>
              <Route path="/consulta-cliente">
                {() => <MasterRoute component={ConsultaClientePage} />}
              </Route>
              <Route path="/admin-pedidos-lista">
                {() => <MasterRoute component={AdminPedidosListaPage} />}
              </Route>
              <Route path="/config-precos">
                {() => <MasterRoute component={ConfigPrecosPage} />}
              </Route>
              <Route path="/academia/fundamentos">
                {() => <ProtectedRoute component={AcademiaFundamentosPage} />}
              </Route>
              <Route path="/academia/quiz">
                {() => <ProtectedRoute component={AcademiaQuizPage} />}
              </Route>
              <Route path="/academia/roleplay">
                {() => <ProtectedRoute component={AcademiaRoleplayPage} />}
              </Route>
              <Route path="/academia/abordagem">
                {() => <ProtectedRoute component={AcademiaAbordagemPage} />}
              </Route>
              <Route path="/academia/admin">
                {() => <AcademiaAdminRoute component={AcademiaAdminPage} />}
              </Route>
              <Route path="/vendas/campanhas">
                {() => <CRMAdminRoute component={VendasCampanhasPage} />}
              </Route>
              <Route path="/vendas/atendimento">
                {() => <ProtectedRoute component={VendasAtendimentoPage} />}
              </Route>
              <Route path="/vendas/agenda">
                {() => <ProtectedRoute component={VendasAgendaPage} />}
              </Route>
              <Route path="/vendas/pipeline">
                {() => <ProtectedRoute component={VendasPipelinePage} />}
              </Route>
              <Route path="/vendas/gestao-pipeline">
                {() => <CRMAdminRoute component={VendasGestaoPipelinePage} />}
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
