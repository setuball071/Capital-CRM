import React from 'react';
import { 
  Home, 
  Megaphone, 
  ListTodo, 
  KanbanSquare, 
  UserSearch, 
  Tags, 
  Calendar, 
  Settings2,
  Calculator,
  Briefcase,
  Users,
  ShieldCheck,
  GraduationCap,
  TrendingUp,
  Bell,
  Search,
  CircleUser,
  LogOut,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';

export function IconRail() {
  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      {/* 
        LEFT COLUMN: Icon Rail 
        Width: 60px 
        Theme: Dark Navy (#1a1f2e)
        Active Color: Amber (#f59e0b)
      */}
      <div className="w-[60px] flex-shrink-0 bg-[#1a1f2e] border-r border-[#2c3345] flex flex-col justify-between z-20">
        
        {/* Top: App Logo / Branding */}
        <div className="h-16 flex items-center justify-center border-b border-[#2c3345]">
          <div className="w-8 h-8 bg-gradient-to-br from-[#f59e0b] to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg leading-none">C</span>
          </div>
        </div>

        {/* Scrollable Icon List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-4 flex flex-col gap-1 items-center">
          
          {/* Section 1: Home */}
          <RailItem icon={<Home size={20} />} label="Home" />
          
          <div className="w-8 h-px bg-[#2c3345] my-2"></div>
          
          {/* Section 2: ALPHA (Expanded) */}
          <RailItem icon={<Megaphone size={20} />} label="Campanhas" isActive />
          <RailItem icon={<ListTodo size={20} />} label="Lista Manual" />
          <RailItem icon={<KanbanSquare size={20} />} label="Pipeline" />
          <RailItem icon={<UserSearch size={20} />} label="Consulta Individual" />
          <RailItem icon={<Tags size={20} />} label="Etiquetas" />
          <RailItem icon={<Calendar size={20} />} label="Agenda" />
          <RailItem icon={<Settings2 size={20} />} label="Gestão Pipeline" />

          <div className="w-8 h-px bg-[#2c3345] my-2"></div>

          {/* Section 3+: Compressed Groups */}
          <RailItem icon={<Calculator size={20} />} label="Simuladores" />
          <RailItem icon={<Briefcase size={20} />} label="Operacional" />
          <RailItem icon={<Users size={20} />} label="Base de Clientes" />
          <RailItem icon={<ShieldCheck size={20} />} label="Administração" />
          <RailItem icon={<GraduationCap size={20} />} label="Desenvolvimento" />
          <RailItem icon={<TrendingUp size={20} />} label="Gestão Comercial" />

        </div>

        {/* Bottom: User Avatar */}
        <div className="py-4 border-t border-[#2c3345] flex flex-col items-center gap-4">
          <button 
            className="w-10 h-10 rounded-full bg-[#2c3345] border-2 border-transparent hover:border-[#f59e0b] transition-colors overflow-hidden focus:outline-none"
            title="Perfil do Usuário"
          >
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=f59e0b" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800 tracking-tight">CRM Capital</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-200">
              Alpha
            </span>
          </div>

          <div className="flex items-center gap-5">
            {/* Search */}
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 sm:text-sm transition-all" 
                placeholder="Buscar clientes, leads..." 
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>

            <div className="h-6 w-px bg-gray-200"></div>

            {/* User Dropdown Profile */}
            <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700 leading-none">João Silva</p>
                <p className="text-xs text-gray-500 mt-1">Gestor Comercial</p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#f8fafc]">
          
          {/* Page Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span className="hover:text-amber-600 cursor-pointer">ALPHA</span>
                <span>/</span>
                <span className="text-gray-900 font-medium">Campanhas</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Visão Geral de Campanhas</h2>
            </div>
            
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1a1f2e] text-white text-sm font-medium rounded-lg hover:bg-[#2c3345] shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#1a1f2e]">
              <LayoutDashboard size={16} />
              Nova Campanha
            </button>
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Campanhas Ativas" 
              value="24" 
              trend="+12%" 
              trendUp={true}
              icon={<Megaphone className="text-blue-600" size={24} />}
              bgColor="bg-blue-50"
            />
            <StatCard 
              title="Leads Hoje" 
              value="148" 
              trend="+5.4%" 
              trendUp={true}
              icon={<Users className="text-amber-600" size={24} />}
              bgColor="bg-amber-50"
            />
            <StatCard 
              title="Meta Atingida" 
              value="67%" 
              trend="-2.1%" 
              trendUp={false}
              icon={<TrendingUp className="text-emerald-600" size={24} />}
              bgColor="bg-emerald-50"
            />
            <StatCard 
              title="Pedidos Pendentes" 
              value="3" 
              trend="Requer atenção" 
              trendUp={null}
              icon={<ListTodo className="text-rose-600" size={24} />}
              bgColor="bg-rose-50"
            />
          </div>

          {/* Main Chart / Table Area Placeholder */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Desempenho de Campanhas Recentes</h3>
              <button className="text-sm text-amber-600 font-medium hover:text-amber-700">Ver todas</button>
            </div>
            <div className="flex-1 p-6 flex items-center justify-center bg-gray-50/50">
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4">
                  <TrendingUp className="text-gray-300 h-8 w-8" />
                </div>
                <p className="text-gray-500 font-medium">Área de gráfico detalhado</p>
                <p className="text-sm text-gray-400 mt-1 max-w-[250px]">O conteúdo detalhado ocupará esta região expansiva no layout final.</p>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

interface RailItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

function RailItem({ icon, label, isActive }: RailItemProps) {
  return (
    <button
      title={label}
      className={`
        relative group w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200
        ${isActive 
          ? 'text-[#f59e0b] bg-[#f59e0b]/10' 
          : 'text-slate-400 hover:text-white hover:bg-[#2c3345]'
        }
      `}
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#f59e0b] rounded-r-md shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
      )}
      
      {icon}
      
      {/* Optional: Add custom tooltip if default 'title' is too basic. 
          But native title is fine per specs. */}
    </button>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean | null;
  icon: React.ReactNode;
  bgColor: string;
}

function StatCard({ title, value, trend, trendUp, icon, bgColor }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-default">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-gray-500 text-sm font-medium mb-1">{title}</h4>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900 tracking-tight">{value}</span>
          
          {trendUp !== null && (
            <span className={`text-sm font-medium ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend}
            </span>
          )}
          {trendUp === null && (
            <span className="text-sm font-medium text-amber-600">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
