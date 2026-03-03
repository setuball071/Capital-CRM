import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Loader2, Users, CheckCircle, Clock } from "lucide-react";

interface TeamProfile {
  id: number;
  name: string;
  avatarUrl: string | null;
  perfilDisc: string | null;
  perfilDiscData: { d: number; i: number; s: number; c: number } | null;
  perfilDiscCompletedAt: string | null;
}

const PERFIL_DISPLAY: Record<string, { sigla: string; nome: string; cor: string; bgCor: string; borderCor: string; subtitulo: string; categoria: string; habilidades: string; vantagens: string; atencao: string }> = {
  EXECUTOR: { sigla: "EXE", nome: "Executor", cor: "text-red-600 dark:text-red-400", bgCor: "bg-red-500/15", borderCor: "border-red-500/30", subtitulo: "Orientado a resultados, direto e decisivo", categoria: "Liderança e Ação", habilidades: "Executores são profissionais orientados a resultados que prosperam em ambientes desafiadores.", vantagens: "Determinação inabalável para atingir objetivos, capacidade de tomar decisões difíceis rapidamente.", atencao: "Pode parecer impaciente com processos lentos. Desenvolver escuta ativa e paciência." },
  COMUNICADOR: { sigla: "COM", nome: "Comunicador", cor: "text-yellow-600 dark:text-yellow-400", bgCor: "bg-yellow-500/15", borderCor: "border-yellow-500/30", subtitulo: "Entusiasta, persuasivo e sociável", categoria: "Influência e Comunicação", habilidades: "Comunicadores são carismáticos e se destacam em ambientes sociais e colaborativos.", vantagens: "Networking excepcional, entusiasmo contagiante, criatividade para soluções inovadoras.", atencao: "Dificuldade com detalhes e foco em tarefas específicas. Desenvolver organização." },
  PLANEJADOR: { sigla: "PLA", nome: "Planejador", cor: "text-green-600 dark:text-green-400", bgCor: "bg-green-500/15", borderCor: "border-green-500/30", subtitulo: "Estável, cooperativo e confiável", categoria: "Estabilidade e Cooperação", habilidades: "Planejadores são confiáveis e se destacam em ambientes estruturados e colaborativos.", vantagens: "Lealdade e comprometimento excepcionais, calma em situações de estresse.", atencao: "Resistência a mudanças repentinas. Desenvolver assertividade e adaptabilidade." },
  ANALISTA: { sigla: "ANA", nome: "Analista", cor: "text-blue-600 dark:text-blue-400", bgCor: "bg-blue-500/15", borderCor: "border-blue-500/30", subtitulo: "Preciso, lógico e orientado a qualidade", categoria: "Análise e Qualidade", habilidades: "Analistas são meticulosos e se destacam em ambientes que exigem precisão e qualidade.", vantagens: "Precisão nos detalhes, capacidade analítica e pensamento lógico e sistemático.", atencao: "Pode parecer excessivamente crítico. Desenvolver tolerância à imperfeição." },
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DesenvolvimentoProfilerGestaoPage() {
  const [selectedUser, setSelectedUser] = useState<TeamProfile | null>(null);

  const { data: profiles = [], isLoading } = useQuery<TeamProfile[]>({
    queryKey: ["/api/users/team-profiles"],
  });

  const completedCount = profiles.filter((p) => p.perfilDiscCompletedAt).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-perfis-equipe-title">
          <Users className="h-5 w-5" /> Perfis da Equipe
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {completedCount}/{profiles.length} vendedores completaram o profiler
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum vendedor encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => {
            const perfConf = p.perfilDisc ? PERFIL_DISPLAY[p.perfilDisc] : null;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer hover-elevate ${p.perfilDiscCompletedAt ? "" : "opacity-60"}`}
                onClick={() => p.perfilDiscCompletedAt ? setSelectedUser(p) : null}
                data-testid={`card-profile-${p.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm">{getInitials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      {perfConf ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs border ${perfConf.bgCor} ${perfConf.cor} ${perfConf.borderCor}`}>
                            {perfConf.sigla} - {perfConf.nome}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" /> Pendente
                        </span>
                      )}
                    </div>
                    {p.perfilDiscCompletedAt && (
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {formatDate(p.perfilDiscCompletedAt)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          {selectedUser && selectedUser.perfilDisc && PERFIL_DISPLAY[selectedUser.perfilDisc] && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getInitials(selectedUser.name)}</AvatarFallback>
                  </Avatar>
                  {selectedUser.name}
                </DialogTitle>
              </DialogHeader>
              {(() => {
                const conf = PERFIL_DISPLAY[selectedUser.perfilDisc!];
                const data = selectedUser.perfilDiscData;
                const bars = [
                  { label: "Executor (D)", value: data?.d || 0, color: "bg-red-500" },
                  { label: "Comunicador (I)", value: data?.i || 0, color: "bg-yellow-500" },
                  { label: "Planejador (S)", value: data?.s || 0, color: "bg-green-500" },
                  { label: "Analista (C)", value: data?.c || 0, color: "bg-blue-500" },
                ];
                return (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <Badge className={`text-base px-3 py-1 ${conf.bgCor} ${conf.cor} ${conf.borderCor} border`}>
                        {conf.sigla}
                      </Badge>
                      <h3 className={`text-lg font-bold ${conf.cor}`}>{conf.nome}</h3>
                      <p className="text-sm text-muted-foreground">{conf.subtitulo}</p>
                    </div>
                    <div className="space-y-2">
                      {bars.map((bar) => (
                        <div key={bar.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{bar.label}</span>
                            <span className="text-muted-foreground">{bar.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold mb-1">Habilidades ({conf.categoria})</p>
                        <p className="text-muted-foreground">{conf.habilidades}</p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Vantagens</p>
                        <p className="text-muted-foreground">{conf.vantagens}</p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Pontos de Atenção</p>
                        <p className="text-muted-foreground">{conf.atencao}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
