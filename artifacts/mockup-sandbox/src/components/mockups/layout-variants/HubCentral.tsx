import React, { useState } from 'react';
import { 
  Target, 
  Calculator, 
  Settings, 
  Database, 
  Shield, 
  GraduationCap, 
  Briefcase, 
  BookOpen,
  Bell,
  User,
  Plus,
  UserSearch,
  Calendar,
  Landmark,
  ArrowLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export function HubCentral() {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Home state rendering
  const renderHome = () => (
    <div className="flex flex-col min-h-[calc(100vh-48px)] p-6 md:p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      {/* Hero Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Bom dia, Admin
          </h1>
          <p className="text-slate-400 text-lg">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#1a1f2e] border border-slate-700/50 px-4 py-2 rounded-full text-sm font-medium text-amber-500 shadow-sm">
          <Bell size={16} className="animate-pulse" />
          <span>3 notificações pendentes</span>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        {/* ALPHA */}
        <button 
          onClick={() => setActiveModule('ALPHA')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Target size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">ALPHA</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Gestão de campanhas e CRM de vendas avançado</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
              7 campanhas ativas
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Simuladores */}
        <button 
          onClick={() => setActiveModule('Simuladores')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Calculator size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Simuladores</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Cálculo de margem, compra de dívida e amortização</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
              Pronto para uso
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Base de Clientes */}
        <button 
          onClick={() => setActiveModule('Base de Clientes')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Database size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Base de Clientes</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Gestão de carteira, higienização e filtros</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
              148.320 cadastrados
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Gestão Comercial */}
        <button 
          onClick={() => setActiveModule('Gestão Comercial')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-orange-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Briefcase size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Gestão Comercial</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Acompanhamento de metas, pipeline e conversão</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md">
              Meta mensal: 67%
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Operacional */}
        <button 
          onClick={() => setActiveModule('Operacional')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-slate-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-400" />
          <div className="p-3 bg-slate-400/10 text-slate-400 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Settings size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Operacional</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Gerenciamento de convênios, bancos e roteiros</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-slate-400 bg-slate-400/10 px-2 py-1 rounded-md">
              Atualizado hoje
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Material de Apoio */}
        <button 
          onClick={() => setActiveModule('Material de Apoio')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500" />
          <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <BookOpen size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Material de Apoio</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Tabelas, criativos de marketing e tutoriais</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">
              12 novos criativos
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Desenvolvimento */}
        <button 
          onClick={() => setActiveModule('Desenvolvimento')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500" />
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <GraduationCap size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Desenvolvimento</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Treinamento de equipe, avaliações e feedback</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">
              3 feedbacks não lidos
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        {/* Administração */}
        <button 
          onClick={() => setActiveModule('Administração')}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-[#1a1f2e] border border-slate-800 hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 text-left overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl mb-4 group-hover:scale-110 transition-transform">
            <Shield size={28} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-1">Administração</h3>
          <p className="text-slate-400 text-sm mb-6 flex-1">Configurações globais, usuários e segurança</p>
          <div className="w-full flex items-center justify-between pt-4 border-t border-slate-800/50">
            <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-md">
              10 usuários ativos
            </span>
            <ChevronRight size={16} className="text-slate-500 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </div>

      {/* Quick Access */}
      <div className="mt-auto">
        <h4 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">Acesso Rápido</h4>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 rounded-xl border border-slate-700/50 transition-colors text-sm font-medium">
            <Plus size={16} /> Nova Simulação
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 rounded-xl border border-slate-700/50 transition-colors text-sm font-medium">
            <UserSearch size={16} /> Buscar Cliente
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-blue-500/20 hover:text-blue-400 text-slate-300 rounded-xl border border-slate-700/50 transition-colors text-sm font-medium">
            <Calendar size={16} /> Minha Agenda
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-purple-500/20 hover:text-purple-400 text-slate-300 rounded-xl border border-slate-700/50 transition-colors text-sm font-medium">
            <Landmark size={16} /> Tabela de Juros
          </button>
        </div>
      </div>
    </div>
  );

  // Module state rendering (Mockup)
  const renderModule = () => (
    <div className="flex flex-col h-[calc(100vh-48px)] animate-in slide-in-from-right-8 duration-300">
      <div className="bg-[#1a1f2e] border-b border-slate-800 p-6 flex flex-col justify-end min-h-[140px] relative overflow-hidden">
        {/* Decorative gradient based on module (simulated with amber as default for mockup) */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10">
          <div className="flex items-center text-sm font-medium text-amber-500 mb-3 gap-2">
            <Sparkles size={16} /> Módulo Ativo
          </div>
          <h1 className="text-3xl font-bold text-white">{activeModule}</h1>
          <p className="text-slate-400 mt-2">Visão geral e ferramentas do módulo de {activeModule?.toLowerCase()}.</p>
        </div>
      </div>
      
      <div className="flex-1 p-6 md:p-10 bg-[#0a0d14] overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Mockup content inside a module */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1f2e] border border-slate-800/50 rounded-2xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-slate-800 rounded-lg mb-4 animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-800 rounded mb-2 animate-pulse" />
                <div className="h-8 w-3/4 bg-slate-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
          
          <div className="bg-[#1a1f2e] border border-slate-800/50 rounded-2xl p-6 shadow-sm min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-24 bg-slate-800 rounded-lg animate-pulse" />
            </div>
            
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-full bg-slate-800 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-1/3 bg-slate-800 rounded mb-2 animate-pulse" />
                    <div className="h-3 w-1/4 bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-slate-800 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#0a0d14] font-sans selection:bg-amber-500/30">
      {/* Top Bar (Ultra Thin) */}
      <header className="h-12 border-b border-slate-800 bg-[#0a0d14]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {activeModule ? (
            <button 
              onClick={() => setActiveModule(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium hidden sm:inline">Voltar</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center shadow-sm shadow-amber-500/20">
                <div className="w-3 h-3 border-2 border-white rounded-sm" />
              </div>
              <span className="font-bold text-white tracking-tight hidden sm:inline">
                Capital Go <span className="text-amber-500">CRM</span>
              </span>
            </div>
          )}
          
          {/* Breadcrumb if inside module */}
          {activeModule && (
            <div className="flex items-center gap-2 text-sm text-slate-500 pl-4 border-l border-slate-800 hidden sm:flex">
              <button onClick={() => setActiveModule(null)} className="hover:text-white transition-colors">Home</button>
              <ChevronRight size={14} />
              <span className="text-amber-500 font-medium">{activeModule}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400 mr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            Online
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
            <User size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {activeModule ? renderModule() : renderHome()}
      </main>
    </div>
  );
}
