import React from "react";
import { 
  Target, 
  Bell, 
  User, 
  Plus, 
  ChevronRight, 
  Home, 
  Briefcase 
} from "lucide-react";

export function HubCampanhas() {
  return (
    <div className="min-h-screen w-full bg-[#0f1219] text-slate-300 font-sans flex flex-col">
      {/* Top Bar */}
      <header className="h-12 bg-[#0f1219] border-b border-slate-800/50 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">C</span>
          </div>
          <span className="font-semibold text-white tracking-wide text-sm">CAPITAL GO</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            <span>Hub</span>
          </button>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <button className="flex items-center gap-1.5 text-slate-400 hover:text-amber-500 transition-colors">
            <Briefcase className="w-4 h-4" />
            <span>ALPHA</span>
          </button>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-white font-medium">Campanhas</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0f1219]"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Campanhas</h1>
            <p className="text-slate-400 text-sm">Gerencie suas campanhas ativas e o progresso dos leads.</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </button>
        </div>

        {/* Campaign Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1 */}
          <div className="group relative bg-[#1a1f2e] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 overflow-hidden transition-all duration-300 flex flex-col hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight group-hover:text-amber-500 transition-colors">Digimax Julho</h3>
                  <span className="text-xs text-slate-500">Módulo ALPHA</span>
                </div>
              </div>
              <div className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-500/20">
                Ativa
              </div>
            </div>

            <div className="mt-2 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">3.200 leads totais</span>
                <span className="text-white font-medium">45% trabalhados</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <button className="text-sm font-medium text-amber-500 hover:text-amber-400 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
                Abrir Campanha
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative bg-[#1a1f2e] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 overflow-hidden transition-all duration-300 flex flex-col hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight group-hover:text-amber-500 transition-colors">SIAPE Reserva</h3>
                  <span className="text-xs text-slate-500">Módulo ALPHA</span>
                </div>
              </div>
              <div className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-500/20">
                Ativa
              </div>
            </div>

            <div className="mt-2 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">12.500 leads totais</span>
                <span className="text-white font-medium">12% trabalhados</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '12%' }}></div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <button className="text-sm font-medium text-amber-500 hover:text-amber-400 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
                Abrir Campanha
              </button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative bg-[#1a1f2e] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 overflow-hidden transition-all duration-300 flex flex-col hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight group-hover:text-amber-500 transition-colors">Reforma CBM PM</h3>
                  <span className="text-xs text-slate-500">Módulo ALPHA</span>
                </div>
              </div>
              <div className="bg-yellow-500/10 text-yellow-500 px-2.5 py-1 rounded-md text-xs font-semibold border border-yellow-500/20">
                Pausada
              </div>
            </div>

            <div className="mt-2 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">8.400 leads totais</span>
                <span className="text-white font-medium">78% trabalhados</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <button className="text-sm font-medium text-amber-500 hover:text-amber-400 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
                Abrir Campanha
              </button>
            </div>
          </div>

          {/* Card 4 */}
          <div className="group relative bg-[#1a1f2e] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 overflow-hidden transition-all duration-300 flex flex-col hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight group-hover:text-amber-500 transition-colors">SIAPE Geral Q2</h3>
                  <span className="text-xs text-slate-500">Módulo ALPHA</span>
                </div>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-500/20">
                Concluída
              </div>
            </div>

            <div className="mt-2 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">25.000 leads totais</span>
                <span className="text-white font-medium">95% trabalhados</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '95%' }}></div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <button className="text-sm font-medium text-amber-500 hover:text-amber-400 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
                Abrir Campanha
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
