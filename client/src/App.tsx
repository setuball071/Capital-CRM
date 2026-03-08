import { useState } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
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
import BaseDashboardPage from "@/pages/base-dashboard";
import AdminPedidosListaPage from "@/pages/admin-pedidos-lista";
import ConfigPrecosPage from "@/pages/config-precos";
import AcademiaFundamentosPage from "@/pages/academia-fundamentos";
import AcademiaQuizPage from "@/pages/academia-quiz";
import AcademiaRoleplayPage from "@/pages/academia-roleplay";
import AcademiaAbordagemPage from "@/pages/academia-abordagem";
import AcademiaAdminPage from "@/pages/academia-admin";
import DesenvolvimentoProfilerPage from "@/pages/desenvolvimento-profiler";
import DesenvolvimentoProfilerGestaoPage from "@/pages/desenvolvimento-profiler-gestao";
import DesenvolvimentoFeedbacksPage from "@/pages/desenvolvimento-feedbacks";
import VendasCampanhasPage from "@/pages/vendas-campanhas";
import VendasAtendimentoPage from "@/pages/vendas-atendimento";
import VendasAgendaPage from "@/pages/vendas-agenda";
import VendasPipelinePage from "@/pages/vendas-pipeline";
import VendasGestaoPipelinePage from "@/pages/vendas-gestao-pipeline";
import VendasImportarHigienizadosPage from "@/pages/vendas-importar-higienizados";
import VendasConsultaPage from "@/pages/vendas-consulta";
import VendasEtiquetasPage from "@/pages/vendas-etiquetas";
import ConfigPromptsPage from "@/pages/config-prompts";
import AdminTenantsPage from "@/pages/admin-tenants";
import AdminBrandingPage from "@/pages/admin-branding";
import SimuladorPortabilidadePage from "@/pages/simulador-portabilidade";
import FuncionariosPage from "@/pages/funcionarios";
import EquipesPage from "@/pages/equipes";
import DashboardVendedorPage from "@/pages/dashboard-vendedor";
import GestaoComercialDashboardPage from "@/pages/gestao-comercial-dashboard";
import GestaoComercialImportarPage from "@/pages/gestao-comercial-importar";
import GestaoComercialMetasPage from "@/pages/gestao-comercial-metas";
import GestaoComercialRegulamentoPage from "@/pages/gestao-comercial-regulamento";
import GestaoComercialRelatoriosPage from "@/pages/gestao-comercial-relatorios";
import GestaoComercialHistoricoPage from "@/pages/gestao-comercial-historico";
import MetasMensaisPage from "@/pages/gestao-comercial-metas-mensais";
import MaterialApoioPage from "@/pages/material-apoio";
import { MaterialApoioModal } from "@/components/material-apoio-modal";
import NotFound from "@/pages/not-found";
import { Loader2, BarChart3, Smartphone, Settings, GraduationCap, MessageCircle } from "lucide-react";
import SolicitacoesBoletoPage from "@/pages/SolicitacoesBoleto";
import { NotificationBell } from "@/components/notification-bell";

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

  if (user.isMaster) {
    return <Redirect to="/dashboard" />;
  }
  
  if (hasModuleAccess("modulo_meu_painel")) {
    return <Redirect to="/dashboard-vendedor" />;
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

  if (!user.isMaster) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function RoleRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles: string[] }) {
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

  if (!user.isMaster && !allowedRoles.includes(user.role)) {
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

function TenantFeatureRoute({ component: Component, feature }: { component: React.ComponentType; feature: string }) {
  const { user, isLoading } = useAuth();
  const tenant = useTenant();
  const featureEnabled = (tenant as any)[feature] === true;

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

  if (!featureEnabled) {
    return <Redirect to="/welcome" />;
  }

  return <Component />;
}

// REFACTORED: All legacy role-based routes removed
// Use ModuleRoute with appropriate module permissions instead:
// - AcademiaAdminRoute -> ModuleRoute with modulo_academia + edit access
// - RoteirosRoute -> ModuleRoute with modulo_roteiros
// - CompraListaRoute -> ModuleRoute with modulo_bases + edit access
// - CRMAdminRoute -> ModuleRoute with modulo_crm + edit access

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
  const [location, navigate] = useLocation();
  const [modalAberto, setModalAberto] = useState(false);
  const [modalCategoria, setModalCategoria] = useState("");

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

  const rotasDeVenda = ["/vendas/campanhas", "/vendas/atendimento", "/vendas/consulta", "/vendas/pipeline"];
  const estaNaVenda = rotasDeVenda.some((r) => location.startsWith(r));

  const handleAtalho = (categoria: string) => {
    if (categoria === "processos") {
      window.open("/material-apoio?categoria=processos", "_blank");
      return;
    }
    if (estaNaVenda) {
      setModalCategoria(categoria);
      setModalAberto(true);
    } else {
      navigate(`/material-apoio?categoria=${categoria}`);
    }
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1">
              {[
                { key: "tabelas", label: "Tabelas", Icon: BarChart3 },
                { key: "criativos", label: "Criativos", Icon: Smartphone },
                { key: "processos", label: "Processos", Icon: Settings },
                { key: "tutoriais", label: "Tutoriais", Icon: GraduationCap },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleAtalho(s.key)}
                  className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                  style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#6C2BD9"; e.currentTarget.style.backgroundColor = "rgba(108,43,217,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.backgroundColor = "transparent"; }}
                  data-testid={`header-shortcut-${s.key}`}
                >
                  <s.Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {import.meta.env.VITE_WHATSAPP_PLATFORM_URL && (
                <a
                  href={import.meta.env.VITE_WHATSAPP_PLATFORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                  style={{ color: "#25D366", fontFamily: "Inter, sans-serif" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(37,211,102,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  data-testid="header-shortcut-whatsapp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Meu WhatsApp
                </a>
              )}
              <NotificationBell />
            </div>
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
                {() => <ModuleRoute component={AgreementsPage} module="modulo_roteiros" />}
              </Route>
              <Route path="/banks">
                {() => <ModuleRoute component={BanksPage} module="modulo_roteiros" />}
              </Route>
              <Route path="/coefficient-tables">
                {() => <ModuleRoute component={CoefficientTablesPage} module="modulo_roteiros" />}
              </Route>
              <Route path="/solicitar-boleto">
                {() => <ModuleRoute component={SolicitacoesBoletoPage} module="modulo_roteiros" />}
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
                {() => <ModuleRoute component={CompraListaPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/consulta-cliente">
                {() => <ModuleRoute component={ConsultaClientePage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/base-dashboard">
                {() => <ModuleRoute component={BaseDashboardPage} module="modulo_base_clientes" />}
              </Route>
              <Route path="/admin-pedidos-lista">
                {() => <ModuleRoute component={AdminPedidosListaPage} module="modulo_base_clientes" accessType="edit" />}
              </Route>
              <Route path="/config-precos">
                {() => <ModuleRoute component={ConfigPrecosPage} module="modulo_config_usuarios" accessType="edit" />}
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
              <Route path="/desenvolvimento/fundamentos">
                {() => <ModuleRoute component={AcademiaFundamentosPage} module="modulo_academia" />}
              </Route>
              <Route path="/desenvolvimento/roleplay">
                {() => <ModuleRoute component={AcademiaRoleplayPage} module="modulo_academia" />}
              </Route>
              <Route path="/desenvolvimento/abordagem">
                {() => <ModuleRoute component={AcademiaAbordagemPage} module="modulo_academia" />}
              </Route>
              <Route path="/desenvolvimento/feedbacks">
                {() => <ModuleRoute component={DesenvolvimentoFeedbacksPage} module="modulo_academia" />}
              </Route>
              <Route path="/desenvolvimento/profiler">
                {() => <ModuleRoute component={DesenvolvimentoProfilerPage} module="modulo_academia" />}
              </Route>
              <Route path="/desenvolvimento/profiler-gestao">
                {() => <RoleRoute component={DesenvolvimentoProfilerGestaoPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/campanhas">
                {() => <ModuleRoute component={VendasCampanhasPage} module="modulo_alpha" />}
              </Route>
              <Route path="/vendas/importar-higienizados">
                {() => <ModuleRoute component={VendasImportarHigienizadosPage} module="modulo_alpha" />}
              </Route>
              <Route path="/vendas/atendimento">
                {() => <ModuleRoute component={VendasAtendimentoPage} module="modulo_alpha" />}
              </Route>
              <Route path="/vendas/agenda">
                {() => <ModuleRoute component={VendasAgendaPage} module="modulo_alpha" />}
              </Route>
              <Route path="/vendas/pipeline">
                {() => <ModuleRoute component={VendasPipelinePage} module="modulo_alpha" />}
              </Route>
              <Route path="/vendas/gestao-pipeline">
                {() => <ModuleRoute component={VendasGestaoPipelinePage} module="modulo_alpha" accessType="edit" />}
              </Route>
              <Route path="/vendas/consulta">
                {() => <ModuleRoute component={VendasConsultaPage} module="modulo_alpha" />}
              </Route>
              <Route path="/config-prompts">
                {() => <ProtectedRoute component={ConfigPromptsPage} />}
              </Route>
              <Route path="/admin/tenants">
                {() => <MasterRoute component={AdminTenantsPage} />}
              </Route>
              <Route path="/admin/branding">
                {() => <MasterRoute component={AdminBrandingPage} />}
              </Route>
              <Route path="/simulador-portabilidade">
                {() => <ModuleRoute component={SimuladorPortabilidadePage} module="modulo_simulador" />}
              </Route>
              <Route path="/funcionarios">
                {() => <ModuleRoute component={FuncionariosPage} module="modulo_config_usuarios" />}
              </Route>
              <Route path="/equipes">
                {() => <ModuleRoute component={EquipesPage} module="modulo_config_usuarios" />}
              </Route>
              <Route path="/dashboard-vendedor">
                {() => <ModuleRoute component={DashboardVendedorPage} module="modulo_meu_painel" />}
              </Route>
              <Route path="/vendas/gestao-comercial/dashboard">
                {() => <RoleRoute component={GestaoComercialDashboardPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/importar-producao">
                {() => <RoleRoute component={GestaoComercialImportarPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/historico-importacoes">
                {() => <RoleRoute component={GestaoComercialHistoricoPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/metas-mensais">
                {() => <RoleRoute component={MetasMensaisPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/metas-niveis">
                {() => <RoleRoute component={GestaoComercialMetasPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/regulamento">
                {() => <RoleRoute component={GestaoComercialRegulamentoPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/gestao-comercial/relatorios">
                {() => <RoleRoute component={GestaoComercialRelatoriosPage} allowedRoles={["master", "coordenacao"]} />}
              </Route>
              <Route path="/vendas/etiquetas">
                {() => <ModuleRoute component={VendasEtiquetasPage} module="modulo_alpha" />}
              </Route>
              <Route path="/material-apoio">
                {() => <ProtectedRoute component={MaterialApoioPage} />}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
      <MaterialApoioModal
        aberto={modalAberto}
        categoria={modalCategoria}
        onClose={() => setModalAberto(false)}
      />
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
