import { useCallback, useMemo, useState } from "react";
import type { DashFiltros, Gran } from "./types";

function defaultFiltros(): DashFiltros {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    inicio: fmt(inicio),
    fim: fmt(hoje),
    gran: "dia",
    banco: [],
    produto: [],
    convenio: [],
    corretor: [],
    parceiro: [],
  };
}

function toQuery(f: DashFiltros): URLSearchParams {
  const p = new URLSearchParams();
  p.set("inicio", f.inicio);
  p.set("fim", f.fim);
  p.set("gran", f.gran);
  if (f.banco.length) p.set("banco", f.banco.join(","));
  if (f.produto.length) p.set("produto", f.produto.join(","));
  if (f.convenio.length) p.set("convenio", f.convenio.join(","));
  if (f.corretor.length) p.set("corretor", f.corretor.join(","));
  if (f.parceiro.length) p.set("parceiro", f.parceiro.join(","));
  return p;
}

export function useDashboardFilters() {
  const [filtros, setState] = useState<DashFiltros>(() => {
    const p = new URLSearchParams(window.location.search);
    const base = defaultFiltros();
    return {
      inicio: p.get("inicio") || base.inicio,
      fim: p.get("fim") || base.fim,
      gran: (p.get("gran") as Gran) || base.gran,
      banco: p.get("banco")?.split(",").filter(Boolean) || [],
      produto: p.get("produto")?.split(",").filter(Boolean) || [],
      convenio: p.get("convenio")?.split(",").filter(Boolean) || [],
      corretor: (p.get("corretor")?.split(",").filter(Boolean) || []).map(Number),
      parceiro: (p.get("parceiro")?.split(",").filter(Boolean) || []).map(Number),
    };
  });

  const setFiltros = useCallback((patch: Partial<DashFiltros>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      window.history.replaceState(null, "", `?${toQuery(next).toString()}`);
      return next;
    });
  }, []);

  const queryString = useMemo(() => toQuery(filtros).toString(), [filtros]);

  return { filtros, setFiltros, queryString };
}
