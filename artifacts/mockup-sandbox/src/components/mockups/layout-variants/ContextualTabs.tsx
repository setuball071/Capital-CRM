import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  Database, 
  BarChart3, 
  Briefcase, 
  Shield, 
  Settings,
  Bell,
  Search,
  Plus,
  MoreHorizontal,
  TrendingUp
} from 'lucide-react';

export function ContextualTabs() {
  const [activeTab, setActiveTab] = useState('Campanhas');
  const [activeModule, setActiveModule] = useState('Alpha');

  const modules = [
    { id: 'Alpha', icon: Target },
    { id: 'Beta', icon: LayoutDashboard },
    { id: 'Gamma', icon: Users },
    { id: 'Delta', icon: Database },
    { id: 'Epsilon', icon: BarChart3 },
    { id: 'Zeta', icon: Briefcase },
    { id: 'Eta', icon: Shield },
    { id: 'Theta', icon: Settings },
  ];

  const tabs = [
    'Campanhas',
    'Lista Manual',
    'Pipeline',
    'Consulta',
    'Etiquetas',
    'Agenda',
    'Gestão Pipeline'
  ];

  const campaigns = [
    {
      id: 1,
      name: 'Digimax Julho',
      leads: '3.200',
      worked: 45,
      status: 'Ativa',
      statusColor: 'bg-green-100 text-green-700'
    },
    {
      id: 2,
      name: 'SIAPE Reserva',
      leads: '12.500',
      worked: 12,
      status: 'Ativa',
      statusColor: 'bg-green-100 text-green-700'
    },
    {
      id: 3,
      name: 'Reforma CBM',
      leads: '8.400',
      worked: 78,
      status: 'Pausada',
      statusColor: 'bg-yellow-100 text-yellow-700'
    },
    {
      id: 4,
      name: 'SIAPE Geral Q2',
      leads: '25.000',
      worked: 95,
      status: 'Concluída',
      statusColor: 'bg-gray-100 text-gray-700'
    }
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* 1. Top bar */}
      <header className="h-[52px] px-4 bg-[#1a1f2e] text-white flex items-center justify-between shadow-sm z-20 relative">
        {/* Logo */}
        <div className="flex items-center gap-2 w-48">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f59e0b] to-orange-600 flex items-center justify-center font-bold text-white shadow-md">
            C
          </div>
          <span className="font-semibold text-lg tracking-tight">CapitalGo</span>
        </div>

        {/* Module Icon Pills (Center) */}
        <div className="flex items-center gap-1.5 bg-[#0f121b] p-1 rounded-full border border-slate-800">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                activeModule === mod.id
                  ? 'bg-[#f59e0b] text-white shadow-md shadow-[#f59e0b]/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={`Módulo ${mod.id}`}
            >
              <mod.icon size={16} strokeWidth={activeModule === mod.id ? 2.5 : 2} />
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4 w-48 justify-end">
          <button className="text-slate-300 hover:text-white relative">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#1a1f2e]"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden">
            <img 
              src="https://i.pravatar.cc/100?img=33" 
              alt="User avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* 2. Sub-tab bar */}
      <div className="h-[40px] bg-white border-b border-slate-200 px-6 flex items-end overflow-x-auto scrollbar-hide z-10">
        <div className="flex items-center gap-6 h-full">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-full px-1 text-sm font-medium transition-colors relative flex items-center whitespace-nowrap ${
                activeTab === tab
                  ? 'text-[#1a1f2e]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f59e0b] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Content Area */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header section of content */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1a1f2e]">Campanhas Ativas</h1>
              <p className="text-sm text-slate-500 mt-1">Gerencie suas bases de leads e distribuição.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar campanha..." 
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50 focus:border-[#f59e0b] transition-all w-64 shadow-sm"
                />
              </div>
              <button className="flex items-center gap-2 bg-[#f59e0b] hover:bg-[#e59409] text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm">
                <Plus size={16} />
                Nova Campanha
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {campaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${campaign.statusColor}`}>
                    {campaign.status}
                  </div>
                  <button className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                
                <h3 className="font-bold text-[#1a1f2e] text-lg mb-1 truncate">
                  {campaign.name}
                </h3>
                
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-6">
                  <Users size={14} />
                  <span>{campaign.leads} leads no total</span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="font-medium text-slate-700">Progresso</span>
                    <span className="font-bold text-[#1a1f2e]">{campaign.worked}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-[#1a1f2e] relative" 
                      style={{ width: `${campaign.worked}%` }}
                    >
                      {/* Sub-progress or gradient effect could go here */}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-right">
                    Trabalhados
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
