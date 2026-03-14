import React, { useState } from 'react';
import { 
  Menu, X, Home, Target, Calculator, Briefcase, Users, Settings, 
  BookOpen, TrendingUp, ChevronDown, ChevronUp, ChevronRight, Bell, Search, 
  User, BarChart3, ArrowUpRight, DollarSign, Clock, LayoutDashboard,
  Filter, MoreHorizontal
} from 'lucide-react';

export function OverlayDrawer() {
  const [isOpen, setIsOpen] = useState(true);

  // Navigation Data
  const navItems = [
    { name: 'Home', icon: Home, isGroup: false },
    {
      name: 'ALPHA',
      icon: Target,
      isGroup: true,
      expanded: true,
      children: [
        { name: 'Campanhas', active: true },
        { name: 'Lista Manual' },
        { name: 'Pipeline' },
        { name: 'Consulta Individual' },
        { name: 'Etiquetas' },
        { name: 'Agenda' },
        { name: 'Gestão Pipeline' },
      ],
    },
    {
      name: 'Simuladores',
      icon: Calculator,
      isGroup: true,
      expanded: false,
      children: [{ name: 'Simulador de Compra' }, { name: 'Simulador de Amortização' }],
    },
    {
      name: 'Operacional',
      icon: Briefcase,
      isGroup: true,
      expanded: false,
      children: [
        { name: 'Convênios' },
        { name: 'Bancos' },
        { name: 'Tabelas de Coeficientes' },
        { name: 'Roteiros Bancários' },
      ],
    },
    {
      name: 'Base de Clientes',
      icon: Users,
      isGroup: true,
      expanded: false,
      children: [
        { name: 'Dashboard' },
        { name: 'Importar Base' },
        { name: 'Compra de Lista' },
        { name: 'Consulta Cliente' },
      ],
    },
    {
      name: 'Administração',
      icon: Settings,
      isGroup: true,
      expanded: false,
      children: [
        { name: 'Admin Pedidos' },
        { name: 'Ambientes' },
        { name: 'Identidade Visual' },
        { name: 'Config. Preços' },
        { name: 'Usuários' },
        { name: 'Funcionários' },
      ],
    },
    {
      name: 'Desenvolvimento',
      icon: BookOpen,
      isGroup: true,
      expanded: false,
      children: [
        { name: 'Fundamentos' },
        { name: 'Roleplay IA' },
        { name: 'Abordagem IA' },
        { name: 'Feedbacks' },
        { name: 'Profiler' },
      ],
    },
    {
      name: 'Gestão Comercial',
      icon: TrendingUp,
      isGroup: true,
      expanded: false,
      children: [
        { name: 'Dashboard da Empresa' },
        { name: 'Equipes' },
        { name: 'Metas Mensais' },
        { name: 'Importar Produção' },
        { name: 'Relatórios' },
      ],
    },
  ];

  return (
    <div className="relative w-full min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP HEADER (100% width) */}
      <header className="w-full h-16 bg-[#1a1f2e] border-b border-white/10 flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f59e0b] to-amber-600 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <span className="text-white font-semibold text-xl tracking-tight hidden sm:block">
              Capital<span className="text-[#f59e0b]">Go</span>
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl px-8 hidden md:block">
          <div className="relative relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar clientes, contratos, campanhas..." 
              className="w-full bg-[#0f131f] border border-white/10 text-white placeholder-slate-400 rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-300 hover:text-white relative">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#1a1f2e]"></span>
          </button>
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          <button className="flex items-center gap-2 hover:bg-white/5 p-1.5 rounded-md transition-colors">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-white/20">
              <User size={16} className="text-slate-300" />
            </div>
            <div className="hidden sm:block text-left text-sm">
              <p className="text-slate-200 font-medium leading-none">João Silva</p>
              <p className="text-slate-400 text-xs mt-0.5">Gestor Comercial</p>
            </div>
          </button>
        </div>
      </header>

      {/* 2. CONTENT AREA (Behind Overlay) */}
      <main className={`flex-1 p-6 md:p-8 overflow-y-auto z-0 transition-all duration-300 ${isOpen ? 'blur-[2px]' : ''}`}>
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard de Campanhas</h1>
              <p className="text-slate-500 text-sm mt-1">Visão geral de desempenho e conversões</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors">
                <Filter size={16} />
                Filtros
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-md text-sm font-medium transition-colors shadow-sm shadow-[#f59e0b]/20">
                Nova Campanha
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Volume Operado</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">R$ 2.45M</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-emerald-600 flex items-center font-medium">
                  <ArrowUpRight size={16} className="mr-1" />
                  +12.5%
                </span>
                <span className="text-slate-400 ml-2">vs último mês</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Leads Ativos</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">1,284</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Users size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-emerald-600 flex items-center font-medium">
                  <ArrowUpRight size={16} className="mr-1" />
                  +5.2%
                </span>
                <span className="text-slate-400 ml-2">vs último mês</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Taxa de Conversão</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">4.6%</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Target size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-rose-600 flex items-center font-medium">
                  <ArrowUpRight size={16} className="mr-1 rotate-90" />
                  -0.8%
                </span>
                <span className="text-slate-400 ml-2">vs último mês</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Tempo Médio (SLA)</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">2h 15m</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Clock size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-emerald-600 flex items-center font-medium">
                  <ArrowUpRight size={16} className="mr-1 rotate-180" />
                  -15m
                </span>
                <span className="text-slate-400 ml-2">vs último mês</span>
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Campanhas Recentes</h3>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreHorizontal size={20} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nome da Campanha</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Convênio</th>
                    <th className="px-6 py-3 font-medium">Leads</th>
                    <th className="px-6 py-3 font-medium text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {[
                    { name: 'Retenção INSS Julho', status: 'Ativo', statusColor: 'bg-emerald-100 text-emerald-700', conv: 'INSS', leads: '4,500', convRate: '5.2%' },
                    { name: 'Siape Refinanciamento', status: 'Ativo', statusColor: 'bg-emerald-100 text-emerald-700', conv: 'SIAPE', leads: '2,100', convRate: '3.8%' },
                    { name: 'FGTS Margem Livre', status: 'Pausado', statusColor: 'bg-amber-100 text-amber-700', conv: 'FGTS', leads: '8,200', convRate: '1.4%' },
                    { name: 'Governo SP Aniversariantes', status: 'Concluído', statusColor: 'bg-slate-100 text-slate-600', conv: 'Gov SP', leads: '1,500', convRate: '6.1%' },
                    { name: 'Forças Armadas 2024', status: 'Ativo', statusColor: 'bg-emerald-100 text-emerald-700', conv: 'Exército', leads: '950', convRate: '4.7%' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.statusColor}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{row.conv}</td>
                      <td className="px-6 py-4">{row.leads}</td>
                      <td className="px-6 py-4 text-right font-medium">{row.convRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* 3. OVERLAY BACKDROP */}
      {isOpen && (
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 4. OVERLAY DRAWER PANEL */}
      <aside 
        className={`absolute top-0 left-0 h-full w-[280px] bg-[#1a1f2e] shadow-2xl z-50 flex flex-col text-slate-300 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header (overlaps top header area) */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f59e0b] to-amber-600 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">
              Capital<span className="text-[#f59e0b]">Go</span>
            </span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Nav */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="px-3 mb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu Principal</p>
          </div>
          
          <nav className="space-y-1 px-3">
            {navItems.map((item, idx) => (
              <div key={idx}>
                {item.isGroup ? (
                  <div className="mb-1">
                    <button className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-md transition-colors group">
                      <div className="flex items-center gap-3">
                        <item.icon size={18} className="text-slate-400 group-hover:text-[#f59e0b] transition-colors" />
                        {item.name}
                      </div>
                      {item.expanded ? (
                        <ChevronUp size={16} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-500" />
                      )}
                    </button>
                    
                    {item.expanded && item.children && (
                      <div className="mt-1 ml-4 pl-4 border-l border-slate-700 space-y-1">
                        {item.children.map((child, cIdx) => (
                          <button 
                            key={cIdx}
                            className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-all ${
                              child.active 
                                ? 'bg-[#f59e0b]/10 text-[#f59e0b] font-medium border-l-2 border-[#f59e0b] -ml-[1px]' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-md transition-colors group">
                    <item.icon size={18} className="text-slate-400 group-hover:text-[#f59e0b] transition-colors" />
                    {item.name}
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              <img 
                src={`https://ui-avatars.com/api/?name=João+Silva&background=0f131f&color=f59e0b`} 
                alt="User" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">João Silva</p>
              <p className="text-xs text-slate-400 truncate">joao@capitalgo.com.br</p>
            </div>
            <Settings size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

    </div>
  );
}
