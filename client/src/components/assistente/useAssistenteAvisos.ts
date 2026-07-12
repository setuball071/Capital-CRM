import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type Aviso = {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  proposalId: number | null;
  criadaEm: string;
};

export type Pergunta = {
  id: number;
  pergunta: string;
  corretorId: number;
  corretorNome: string | null;
  createdAt: string;
};

export function useAssistenteAvisos(enabled: boolean, gestor: boolean) {
  const qc = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/assistente/avisos/count"],
    enabled,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: avisos = [] } = useQuery<Aviso[]>({
    queryKey: ["/api/assistente/avisos"],
    enabled,
    refetchInterval: 60000,
  });

  const { data: perguntas = [] } = useQuery<Pergunta[]>({
    queryKey: ["/api/assistente/perguntas"],
    enabled: enabled && gestor,
    refetchInterval: 60000,
  });

  const marcarLidas = useMutation({
    mutationFn: async (ids?: number[]) => {
      const res = await apiRequest("POST", "/api/assistente/avisos/marcar-lidas", ids ? { ids } : {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/avisos/count"] });
      qc.invalidateQueries({ queryKey: ["/api/assistente/avisos"] });
    },
  });

  const responder = useMutation({
    mutationFn: async ({ id, resposta, salvarNaBase }: { id: number; resposta: string; salvarNaBase?: boolean }) => {
      const res = await apiRequest("POST", `/api/assistente/perguntas/${id}/responder`, { resposta, salvarNaBase });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/perguntas"] });
    },
  });

  const descartar = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/assistente/perguntas/${id}/descartar`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/assistente/perguntas"] });
    },
  });

  return { count: countData?.count ?? 0, avisos, marcarLidas, perguntas, responder, descartar };
}
