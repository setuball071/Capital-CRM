import { useQuery } from "@tanstack/react-query";
import type { ModuloKey } from "@shared/modulos";

// Módulos contratados pelo AMBIENTE atual (complementa o hasModuleAccess por-usuário).
// Enquanto carrega (ou em erro), considera tudo liberado para não piscar/esconder telas à toa.
export function useTenantModules() {
  const { data, isLoading } = useQuery<{ modulos: string[] }>({
    queryKey: ["/api/tenant/modulos"],
    staleTime: 5 * 60 * 1000,
  });

  const hasTenantModule = (key: ModuloKey | string): boolean => {
    if (isLoading || !data?.modulos) return true;
    return data.modulos.includes(key);
  };

  return { modulos: data?.modulos, isLoading, hasTenantModule };
}
