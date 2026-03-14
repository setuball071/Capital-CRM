import React, { useState } from 'react';
import { 
  Home, 
  Target, 
  Database, 
  BarChart2, 
  MoreHorizontal, 
  Menu, 
  Bell, 
  Search, 
  Phone,
  Settings,
  Users,
  Shield,
  X
} from 'lucide-react';

const mockLeads = [
  { id: 1, name: 'Maria Silva', cpf: '***.456.789-**', status: 'Novo', statusColor: 'bg-blue-100 text-blue-700', initials: 'MS', phone: '(11) 98765-4321' },
  { id: 2, name: 'João Santos', cpf: '***.123.456-**', status: 'Em Análise', statusColor: 'bg-yellow-100 text-yellow-700', initials: 'JS', phone: '(11) 91234-5678' },
  { id: 3, name: 'Ana Oliveira', cpf: '***.987.654-**', status: 'Aprovado', statusColor: 'bg-green-100 text-green-700', initials: 'AO', phone: '(21) 99876-5432' },
  { id: 4, name: 'Carlos Pereira', cpf: '***.321.987-**', status: 'Novo', statusColor: 'bg-blue-100 text-blue-700', initials: 'CP', phone: '(31) 98765-1234' },
  { id: 5, name: 'Fernanda Costa', cpf: '***.654.321-**', status: 'Pendente', statusColor: 'bg-orange-100 text-orange-700', initials: 'FC', phone: '(41) 91234-8765' },
  { id: 6, name: 'Roberto Almeida', cpf: '***.789.123-**', status: 'Rejeitado', statusColor: 'bg-red-100 text-red-700', initials: 'RA', phone: '(51) 99876-1234' },
];

export function MobileBottomNav() {
  const [activeTab, setActiveTab] = useState('alpha');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex justify-center overflow-hidden font-sans text-slate-900">
      {/* Mobile Container (Constrained width on desktop for preview, but acts as full width on mobile) */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <header className="h-[52px] bg-[#1a1f2e] text-white flex items-center justify-between px-4 sticky top-0 z-20 shadow-md">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-200" />
          </button>
          
          <h1 className="text-base font-bold tracking-wider tracking-[0.1em] text-white">ALPHA</h1>
          
          <div className="flex items-center gap-3">
            <button className="relative p-1 rounded-full hover:bg-white/10 transition-colors">
              <Bell className="w-5 h-5 text-slate-200" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#f59e0b] rounded-full border border-[#1a1f2e]"></span>
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#f59e0b] to-yellow-300 flex items-center justify-center text-xs font-bold text-[#1a1f2e] border border-white/20 shadow-sm">
              GC
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-[80px] bg-slate-50">
          
          {/* Search Bar */}
          <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#f59e0b] focus:border-[#f59e0b] sm:text-sm transition-all shadow-inner"
                placeholder="Buscar clientes, CPF..."
              />
            </div>
          </div>

          {/* Leads List */}
          <div className="p-3 space-y-3">
            <div className="flex justify-between items-end px-1 pb-1">
              <h2 className="text-sm font-semibold text-slate-700">Leads da Campanha</h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">142 total</span>
            </div>
            
            {mockLeads.map((lead) => (
              <div key={lead.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                  {lead.initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900 truncate pr-2">{lead.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${lead.statusColor}`}>
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{lead.cpf}</p>
                </div>
                
                <button className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors shadow-sm border border-green-100">
                  <Phone className="w-4 h-4 fill-current" />
                </button>
              </div>
            ))}
            
            <div className="py-4 flex justify-center">
              <button className="text-sm font-medium text-[#f59e0b] bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                Carregar mais
              </button>
            </div>
          </div>
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="h-[64px] bg-[#1a1f2e] absolute bottom-0 w-full flex justify-around items-center px-2 pb-safe border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-30">
          
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'home' ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Home className={`w-6 h-6 ${activeTab === 'home' ? 'stroke-current fill-current/20' : 'stroke-[1.5]'}`} />
            <span className="text-[10px] font-medium">Início</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('alpha')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 relative ${activeTab === 'alpha' ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <div className="relative">
              <Target className={`w-6 h-6 ${activeTab === 'alpha' ? 'stroke-current' : 'stroke-[1.5]'}`} />
              <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full shadow-sm border-[1.5px] border-[#1a1f2e]">
                7
              </span>
            </div>
            <span className="text-[10px] font-medium">ALPHA</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('base')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'base' ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Database className={`w-6 h-6 ${activeTab === 'base' ? 'stroke-current' : 'stroke-[1.5]'}`} />
            <span className="text-[10px] font-medium">Base</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'reports' ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <BarChart2 className={`w-6 h-6 ${activeTab === 'reports' ? 'stroke-current' : 'stroke-[1.5]'}`} />
            <span className="text-[10px] font-medium">Relatórios</span>
          </button>
          
          <button 
            onClick={() => setIsMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${isMoreMenuOpen ? 'text-[#f59e0b]' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <MoreHorizontal className={`w-6 h-6 ${isMoreMenuOpen ? 'stroke-current' : 'stroke-[1.5]'}`} />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </nav>

        {/* More Menu Bottom Sheet */}
        {isMoreMenuOpen && (
          <>
            <div 
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMoreMenuOpen(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-full duration-200">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              
              <h3 className="text-lg font-bold text-slate-900 mb-4 px-2">Mais Opções</h3>
              
              <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                {[
                  { icon: Settings, label: 'Ajustes', color: 'text-slate-600 bg-slate-100' },
                  { icon: Users, label: 'Equipe', color: 'text-blue-600 bg-blue-50' },
                  { icon: Shield, label: 'Segurança', color: 'text-emerald-600 bg-emerald-50' },
                  { icon: Target, label: 'Metas', color: 'text-amber-600 bg-amber-50' },
                ].map((item, i) => (
                  <button key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-slate-600">{item.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="mt-8 mb-2">
                <button 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="w-full py-3.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Fechar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Left Sidebar Drawer */}
        {isSidebarOpen && (
          <>
            <div 
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-[#1a1f2e] z-50 flex flex-col animate-in slide-in-from-left duration-200 shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f59e0b] to-yellow-300 flex items-center justify-center text-sm font-bold text-[#1a1f2e]">
                    GC
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-tight">Gabriel Costa</h2>
                    <p className="text-xs text-slate-400">Consultor Sênior</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 py-4 overflow-y-auto">
                <div className="px-3 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 mt-2">Menu Principal</div>
                  
                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white bg-white/5">
                    <Target className="w-5 h-5 text-[#f59e0b]" />
                    <span className="font-medium text-sm">Meus Leads</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                    <BarChart2 className="w-5 h-5 text-slate-400" />
                    <span className="font-medium text-sm">Desempenho</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Database className="w-5 h-5 text-slate-400" />
                    <span className="font-medium text-sm">Base de Clientes</span>
                  </button>
                </div>
              </div>
              
              <div className="p-4 border-t border-white/10">
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 text-slate-300 rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors">
                  Sair do sistema
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
