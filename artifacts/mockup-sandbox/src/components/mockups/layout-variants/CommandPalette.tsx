import React from 'react';
import {
  Search,
  Command,
  ChevronRight,
  Target,
  BarChart2,
  UserSearch,
  Zap,
  Plus,
  Upload,
  FileText,
  Clock,
  X,
  User
} from 'lucide-react';

export function CommandPalette() {
  return (
    <div className="min-h-screen w-full bg-[#1a1f2e] text-white flex flex-col font-sans relative overflow-hidden">
      {/* BACKGROUND CONTENT (Blurred) */}
      <div className="absolute inset-0 z-0 flex flex-col blur-sm scale-[0.99] transition-all">
        {/* TOP BAR */}
        <header className="h-12 w-full border-b border-white/10 flex items-center justify-between px-6 bg-[#1a1f2e]">
          <div className="flex items-center gap-2 text-[#f59e0b] font-bold text-xl">
            <Command className="w-5 h-5" />
            <span>CapitalGo</span>
          </div>

          <button className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-1.5 rounded-md text-sm text-gray-400 w-96 max-w-full transition-colors">
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Buscar ou navegar...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-gray-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <User className="w-4 h-4 text-gray-300" />
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Visão Geral</h1>
              <span className="text-sm text-gray-400">Última atualização: hoje às 09:41</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">Vendas (Mês)</p>
                <p className="text-3xl font-bold text-white">R$ 1.2M</p>
                <p className="text-sm text-emerald-400 mt-2">+14% vs mês anterior</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">Leads Ativos</p>
                <p className="text-3xl font-bold text-white">4.392</p>
                <p className="text-sm text-emerald-400 mt-2">+124 novos hoje</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">Conversão Média</p>
                <p className="text-3xl font-bold text-white">8.4%</p>
                <p className="text-sm text-rose-400 mt-2">-1.2% vs mês anterior</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl h-96 flex items-center justify-center">
              <p className="text-gray-500">Gráfico de Desempenho (Simulação)</p>
            </div>
          </div>
        </main>
      </div>

      {/* OVERLAY & COMMAND PALETTE */}
      <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4">
        
        {/* MODAL */}
        <div className="w-full max-w-[580px] bg-[#1a1f2e] rounded-xl border border-white/20 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* SEARCH INPUT */}
          <div className="flex items-center px-4 py-4 border-b border-white/10">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              type="text"
              value="campanhas"
              readOnly
              className="flex-1 bg-transparent border-none outline-none px-3 text-lg text-white placeholder:text-gray-500"
              placeholder="Buscar ou navegar..."
            />
            <button className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* RESULTS LIST */}
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4 custom-scrollbar [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
            
            {/* GROUP: NAVEGAÇÃO */}
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <ChevronRight className="w-3 h-3" />
                Navegação
              </div>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg border border-[#f59e0b]/20">
                  <Target className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">Campanhas</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#f59e0b]/20">Ir para</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <BarChart2 className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 text-left">Gestão Pipeline</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <UserSearch className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 text-left">Consulta Individual</span>
                </button>
              </div>
            </div>

            {/* GROUP: AÇÕES RÁPIDAS */}
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Ações Rápidas
              </div>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <Plus className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 text-left">Nova campanha</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 text-left">Importar base</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 text-left">Gerar relatório</span>
                </button>
              </div>
            </div>

            {/* GROUP: RECENTES */}
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recentes
              </div>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  </div>
                  <span className="flex-1 text-left truncate">Pedido #44 — SIAPE</span>
                  <span className="text-xs text-gray-500">Há 2h</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  </div>
                  <span className="flex-1 text-left truncate">Feedback para Marcos</span>
                  <span className="text-xs text-gray-500">Ontem</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-gray-300 transition-colors">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  </div>
                  <span className="flex-1 text-left truncate">Campanha Digimax Julho</span>
                  <span className="text-xs text-gray-500">Há 3 dias</span>
                </button>
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="border-t border-white/10 px-4 py-3 flex items-center gap-4 text-xs text-gray-500 bg-white/[0.02]">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 font-mono text-[10px] text-gray-400">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 font-mono text-[10px] text-gray-400">↓</kbd>
              <span>navegar</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 font-mono text-[10px] text-gray-400">↵</kbd>
              <span>selecionar</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-white/20 bg-white/5 font-mono text-[10px] text-gray-400">esc</kbd>
              <span>fechar</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
