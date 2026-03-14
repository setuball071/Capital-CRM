import React from "react";
import {
  Target,
  ArrowLeft,
  ChevronRight,
  Megaphone,
  Users,
  Kanban,
  UserSearch,
  Tag,
  Calendar,
  BarChart3,
  Search,
  Settings,
  Bell,
  User
} from "lucide-react";

export function HubInsideAlpha() {
  const subModules = [
    {
      title: "Campanhas",
      subtitle: "7 ativas, 89.2k leads",
      icon: Megaphone,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "hover:border-amber-500/50"
    },
    {
      title: "Lista Manual",
      subtitle: "5 leads pendentes",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "hover:border-blue-500/50"
    },
    {
      title: "Pipeline",
      subtitle: "12.320 em NOVO",
      icon: Kanban,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "hover:border-emerald-500/50"
    },
    {
      title: "Consulta Individual",
      subtitle: "Busca por CPF",
      icon: UserSearch,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      border: "hover:border-indigo-500/50"
    },
    {
      title: "Etiquetas",
      subtitle: "16 etiquetas criadas",
      icon: Tag,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "hover:border-rose-500/50"
    },
    {
      title: "Agenda",
      subtitle: "3 compromissos hoje",
      icon: Calendar,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "hover:border-purple-500/50"
    },
    {
      title: "Gestão Pipeline",
      subtitle: "Visão do gestor",
      icon: BarChart3,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      border: "hover:border-cyan-500/50"
    }
  ];

  return (
    <div className="min-h-screen w-full bg-[#0f1219] font-sans text-slate-300 flex flex-col">
      {/* Top Bar */}
      <header className="h-12 border-b border-slate-800/50 bg-[#0f1219] flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-amber-500 font-medium flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              ALPHA
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar em ALPHA..." 
              className="w-64 h-8 bg-[#1a1f2e] border border-slate-800 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
            />
          </div>
          <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center ml-2">
            <User className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-8 flex flex-col gap-10">
        {/* Module Hero */}
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <Target className="w-8 h-8 text-amber-500 ml-1.5" />
          </div>
          <div className="pt-1">
            <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
              ALPHA <span className="text-slate-600 font-normal hidden sm:inline">|</span> <span className="text-slate-300 sm:text-white">CRM de Vendas</span>
            </h1>
            <p className="text-slate-400 mt-2 text-base sm:text-lg">
              Gerencie campanhas, leads e pipeline de vendas.
            </p>
          </div>
        </div>

        {/* Sub-modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subModules.map((item, index) => (
            <button 
              key={index}
              className={`group relative bg-[#1a1f2e] border border-slate-800 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${item.border} overflow-hidden`}
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${item.bg.replace('/10', '')} opacity-0 group-hover:opacity-100 transition-opacity`} />
              
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              
              <h3 className="text-white font-medium mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.subtitle}</p>
            </button>
          ))}
          
          {/* Empty slot placeholder for 8th card */}
          <div className="border border-dashed border-slate-800 rounded-2xl flex items-center justify-center p-5 opacity-50 hover:opacity-100 transition-opacity">
            <button className="flex flex-col items-center gap-2 text-slate-500 hover:text-slate-400">
              <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Adicionar Atalho</span>
            </button>
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="mt-4 pb-12">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            Atividade Recente
          </h2>
          
          <div className="bg-[#1a1f2e] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="divide-y divide-slate-800/50">
              
              {/* Activity 1 */}
              <div className="p-4 flex sm:flex-row flex-col sm:items-center gap-4 hover:bg-slate-800/20 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 hidden sm:flex">
                  <Kanban className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 sm:hidden">
                     <Kanban className="w-4 h-4 text-emerald-500" />
                     <span className="text-xs text-slate-500">Há 15 min</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Lead <span className="font-medium text-white">Maria Silva</span> atualizado para <span className="text-emerald-400 font-medium px-1.5 py-0.5 bg-emerald-500/10 rounded">EM NEGOCIAÇÃO</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 hidden sm:block">Há 15 minutos • Pipeline INSS</p>
                </div>
                <button className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 transition-colors w-fit">
                  Ver lead
                </button>
              </div>

              {/* Activity 2 */}
              <div className="p-4 flex sm:flex-row flex-col sm:items-center gap-4 hover:bg-slate-800/20 transition-colors">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 hidden sm:flex">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 sm:hidden">
                     <Megaphone className="w-4 h-4 text-amber-500" />
                     <span className="text-xs text-slate-500">Há 2 horas</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Campanha <span className="font-medium text-white">Retenção SIAPE Abril</span> iniciada
                  </p>
                  <p className="text-xs text-slate-500 mt-1 hidden sm:block">Há 2 horas • 1.250 leads adicionados</p>
                </div>
                <button className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 transition-colors w-fit">
                  Ver campanha
                </button>
              </div>

              {/* Activity 3 */}
              <div className="p-4 flex sm:flex-row flex-col sm:items-center gap-4 hover:bg-slate-800/20 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 hidden sm:flex">
                  <Calendar className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1 sm:hidden">
                     <Calendar className="w-4 h-4 text-blue-500" />
                     <span className="text-xs text-slate-500">Hoje, 14:30</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Novo agendamento com <span className="font-medium text-white">João Pedro</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 hidden sm:block">Hoje, 14:30 • Retorno de proposta</p>
                </div>
                <button className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 transition-colors w-fit">
                  Ver agenda
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
