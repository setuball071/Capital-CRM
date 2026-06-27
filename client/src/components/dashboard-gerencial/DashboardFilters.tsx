import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import type { DashFiltros, DashOpcoes, Gran } from "./types";

interface Props {
  filtros: DashFiltros;
  opcoes?: DashOpcoes;
  onChange: (patch: Partial<DashFiltros>) => void;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: string): { inicio: string; fim: string } {
  const hoje = new Date();
  if (preset === "mes-atual") {
    return { inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: fmt(hoje) };
  }
  if (preset === "mes-anterior") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { inicio: fmt(ini), fim: fmt(fim) };
  }
  if (preset === "30d") {
    const ini = new Date(hoje); ini.setDate(ini.getDate() - 29);
    return { inicio: fmt(ini), fim: fmt(hoje) };
  }
  // 90d
  const ini = new Date(hoje); ini.setDate(ini.getDate() - 89);
  return { inicio: fmt(ini), fim: fmt(hoje) };
}

const GRANS: { v: Gran; label: string }[] = [
  { v: "dia", label: "Dia" },
  { v: "semana", label: "Semana" },
  { v: "mes", label: "Mês" },
];

export function DashboardFilters({ filtros, opcoes, onChange }: Props) {
  const corretorLabel = (id: string) =>
    opcoes?.corretores.find((c) => String(c.id) === id)?.nome || id;
  const parceiroLabel = (id: string) =>
    opcoes?.parceiros.find((p) => String(p.id) === id)?.nome || id;

  return (
    <Card data-testid="dashboard-filtros">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <Input
              type="date"
              value={filtros.inicio}
              onChange={(e) => onChange({ inicio: e.target.value })}
              className="h-9 w-[150px]"
              data-testid="filtro-inicio"
            />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input
              type="date"
              value={filtros.fim}
              onChange={(e) => onChange({ fim: e.target.value })}
              className="h-9 w-[150px]"
              data-testid="filtro-fim"
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onChange(presetRange("mes-atual"))}>Mês atual</Button>
            <Button size="sm" variant="outline" onClick={() => onChange(presetRange("mes-anterior"))}>Mês anterior</Button>
            <Button size="sm" variant="outline" onClick={() => onChange(presetRange("30d"))}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => onChange(presetRange("90d"))}>90d</Button>
          </div>
          <div className="flex gap-1 items-center">
            <Label className="text-xs mr-1">Granularidade:</Label>
            {GRANS.map((g) => (
              <Button
                key={g.v}
                size="sm"
                variant={filtros.gran === g.v ? "default" : "outline"}
                onClick={() => onChange({ gran: g.v })}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <MultiSelectCombobox
            options={opcoes?.bancos || []}
            value={filtros.banco}
            onValueChange={(v) => onChange({ banco: v })}
            placeholder="Banco"
            className="w-[180px]"
            data-testid="filtro-banco"
          />
          <MultiSelectCombobox
            options={opcoes?.produtos || ["NOVO", "PORTABILIDADE", "REFINANCIAMENTO", "CARTAO"]}
            value={filtros.produto}
            onValueChange={(v) => onChange({ produto: v })}
            placeholder="Produto"
            className="w-[180px]"
            data-testid="filtro-produto"
          />
          <MultiSelectCombobox
            options={opcoes?.convenios || []}
            value={filtros.convenio}
            onValueChange={(v) => onChange({ convenio: v })}
            placeholder="Convênio"
            className="w-[180px]"
            data-testid="filtro-convenio"
          />
          <MultiSelectCombobox
            options={(opcoes?.corretores || []).map((c) => String(c.id))}
            value={filtros.corretor.map(String)}
            onValueChange={(v) => onChange({ corretor: v.map(Number) })}
            placeholder="Corretor"
            getLabel={corretorLabel}
            className="w-[180px]"
            data-testid="filtro-corretor"
          />
          <MultiSelectCombobox
            options={(opcoes?.parceiros || []).map((p) => String(p.id))}
            value={filtros.parceiro.map(String)}
            onValueChange={(v) => onChange({ parceiro: v.map(Number) })}
            placeholder="Parceiro"
            getLabel={parceiroLabel}
            className="w-[180px]"
            data-testid="filtro-parceiro"
          />
        </div>
      </CardContent>
    </Card>
  );
}
