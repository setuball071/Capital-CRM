import React, { useState } from 'react';
import { 
  Home, 
  Target, 
  Calculator, 
  Settings, 
  Users, 
  Shield, 
  GraduationCap, 
  Briefcase,
  Bell,
  Search,
  ChevronDown,
  PlayCircle,
  ListTodo,
  Columns,
  SearchUser,
  Tags,
  Calendar,
  Settings2,
  MoreHorizontal,
  TrendingUp,
  Clock
} from 'lucide-react';

export function TopNav() {
  const [activeTab, setActiveTab] = useState('ALPHA');
  
  const navGroups = [
    { name: 'Home', icon: Home, isHome: true },
    { name: 'ALPHA', icon: Target, items: ['Campanhas', 'Lista Manual', 'Pipeline', 'Consulta Individual', 'Etiquetas', 'Agenda', 'Gestão Pipeline'] },
    { name: 'Simuladores', icon: Calculator, items: ['Simulador de Compra', 'Simulador de Amortização'] },
    { name: 'Operacional', icon: Settings, items: ['Convênios', 'Bancos', 'Tabelas de Coeficientes', 'Roteiros Bancários'] },
    { name: 'Base de Clientes', icon: Users, items: ['Dashboard', 'Importar Base', 'Compra de Lista', 'Consulta Cliente'] },
    { name: 'Administração', icon: Shield, items: ['Admin Pedidos', 'Ambientes', 'Identidade Visual', 'Config. Preços', 'Usuários', 'Funcionários'] },
    { name: 'Desenvolvimento', icon: GraduationCap, items: ['Fundamentos', 'Roleplay IA', 'Abordagem IA', 'Feedbacks', 'Profiler'] },
    { name: 'Gestão Comercial', icon: Briefcase, items: ['Dashboard da Empresa', 'Equipes', 'Metas Mensais', 'Importar Produção', 'Relatórios'] },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* Top Navigation Bar */}
      <header className="h-14 bg-[#1a1f2e] text-white flex items-center px-4 shrink-0 shadow-md relative z-20">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-8">
          <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center font-bold text-[#1a1f2e]">
            C
          </div>
          <span className="font-bold text-lg tracking-tight text-white hidden sm:block">
            Capital<span className="text-amber-500">GO</span>
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 flex h-full items-end overflow-x-auto no-scrollbar">
          {navGroups.map((group) => {
            const isActive = activeTab === group.name;
            return (
              <div key={group.name} className="relative h-full flex flex-col justify-end group">
                <button
                  onClick={() => setActiveTab(group.name)}
                  className={`
                    px-4 h-full flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'text-amber-400 bg-white/5 border-b-2 border-amber-500' 
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border-b-2 border-transparent'
                    }
                  `}
                >
                  {group.isHome ? (
                    <Home className="w-4 h-4" />
                  ) : (
                    <>
                      {group.name}
                      <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isActive ? 'rotate-180 text-amber-500' : ''}`} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10 h-8">
          <button className="text-slate-300 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1f2e]"></span>
          </button>
          
          <button className="flex items-center gap-2 pl-2">
            <img 
              src="https://i.pravatar.cc/150?u=a042581f4e29026704d" 
              alt="User" 
              className="w-8 h-8 rounded-full border-2 border-slate-700 object-cover"
            />
          </button>
        </div>
      </header>

      {/* Dropdown Panel for ALPHA (Shown because it's active in the design context) */}
      {activeTab === 'ALPHA' && (
        <div className="absolute top-14 left-0 w-full bg-white shadow-lg border-b border-slate-200 z-10 animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex gap-8">
            <div className="w-64 shrink-0">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu ALPHA</h3>
              <nav className="flex flex-col space-y-1">
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-amber-50 text-amber-700">
                  <PlayCircle className="w-4 h-4" />
                  Campanhas
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <ListTodo className="w-4 h-4 text-slate-400" />
                  Lista Manual
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <Columns className="w-4 h-4 text-slate-400" />
                  Pipeline
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <SearchUser className="w-4 h-4 text-slate-400" />
                  Consulta Individual
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <Tags className="w-4 h-4 text-slate-400" />
                  Etiquetas
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Agenda
                </button>
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <Settings2 className="w-4 h-4 text-slate-400" />
                  Gestão Pipeline
                </button>
              </nav>
            </div>
            
            {/* Contextual content for the active dropdown item */}
            <div className="flex-1 bg-slate-50 rounded-lg p-5 border border-slate-100 flex flex-col justify-center">
               <div className="flex items-start gap-4">
                 <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                   <PlayCircle className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="text-sm font-bold text-slate-900 mb-1">Gerenciamento de Campanhas</h4>
                   <p className="text-sm text-slate-500 mb-4 max-w-md">
                     Crie, monitore e otimize campanhas de vendas direcionadas para sua base de leads com segmentação avançada.
                   </p>
                   <button className="bg-[#1a1f2e] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
                     Nova Campanha
                   </button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full max-w-7xl mx-auto p-6 transition-all duration-300 ${activeTab === 'ALPHA' ? 'mt-72' : 'mt-0'}`}>
        
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
            <p className="text-slate-500 text-sm mt-1">Acompanhe seus indicadores de desempenho diários.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar cliente ou proposta..."
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-64 shadow-sm"
              />
            </div>
            <button className="p-2 bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 shadow-sm">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <PlayCircle className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12%
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Campanhas Ativas</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">24</h3>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +5.4%
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Leads Hoje</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">148</h3>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Target className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                <MoreHorizontal className="w-3 h-3" /> 0%
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Meta Atingida</p>
            <div className="mt-1 flex items-end gap-2">
              <h3 className="text-3xl font-bold text-slate-900">67%</h3>
              <p className="text-sm text-slate-500 mb-1">de R$ 1.5M</p>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '67%' }}></div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-50 text-rose-600">
                Atenção
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Pedidos Pendentes</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">3</h3>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Atividades Recentes</h2>
            <button className="text-sm text-amber-600 font-medium hover:text-amber-700">Ver todas</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Campanha</th>
                  <th className="px-6 py-3 font-medium">Valor Status</th>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'Maria Silva Costa', id: '123.456.789-00', camp: 'Refinanciamento INSS', value: 'R$ 15.400,00', status: 'Em Análise', date: 'Hoje, 14:30', statusColor: 'bg-amber-100 text-amber-700' },
                  { name: 'João Batista', id: '987.654.321-11', camp: 'Portabilidade BB', value: 'R$ 8.200,00', status: 'Aprovado', date: 'Hoje, 11:15', statusColor: 'bg-emerald-100 text-emerald-700' },
                  { name: 'Ana Paula Rocha', id: '456.789.123-22', camp: 'Novo Cartão Consignado', value: 'R$ 2.500,00', status: 'Contato Feito', date: 'Ontem', statusColor: 'bg-blue-100 text-blue-700' },
                  { name: 'Carlos Eduardo', id: '321.654.987-33', camp: 'Refinanciamento INSS', value: 'R$ 31.000,00', status: 'Pendente Doc', date: 'Ontem', statusColor: 'bg-rose-100 text-rose-700' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{row.id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.camp}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{row.value}</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${row.statusColor}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{row.date}</td>
                    <td className="px-6 py-4">
                      <button className="text-slate-400 hover:text-amber-600 transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      
    </div>
  );
}
