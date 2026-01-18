import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Palette } from "lucide-react";

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientConfig {
  stops: GradientStop[];
  direction: string;
}

interface GradientEditorProps {
  value: GradientConfig;
  onChange: (config: GradientConfig) => void;
  label?: string;
  testIdPrefix?: string;
}

const DIRECTION_OPTIONS = [
  { value: "90deg", label: "Horizontal →" },
  { value: "180deg", label: "Vertical ↓" },
  { value: "135deg", label: "Diagonal ↘" },
  { value: "45deg", label: "Diagonal ↗" },
  { value: "225deg", label: "Diagonal ↙" },
  { value: "315deg", label: "Diagonal ↖" },
];

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export function generateGradientCSS(config: GradientConfig): string {
  if (!config.stops || config.stops.length === 0) {
    return "";
  }
  if (config.stops.length === 1) {
    return config.stops[0].color;
  }
  const sortedStops = [...config.stops].sort((a, b) => a.position - b.position);
  const stopsString = sortedStops
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
  return `linear-gradient(${config.direction}, ${stopsString})`;
}

export function parseGradientCSS(css: string): GradientConfig | null {
  if (!css || !css.includes("linear-gradient")) {
    return null;
  }
  
  const match = css.match(/linear-gradient\((\d+deg),\s*(.+)\)/);
  if (!match) return null;
  
  const direction = match[1];
  const stopsString = match[2];
  
  const stopRegex = /(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgb\([^)]+\))\s+(\d+)%/g;
  const stops: GradientStop[] = [];
  let stopMatch: RegExpExecArray | null;
  
  while ((stopMatch = stopRegex.exec(stopsString)) !== null) {
    stops.push({
      color: stopMatch[1],
      position: parseInt(stopMatch[2], 10),
    });
  }
  
  if (stops.length === 0) return null;
  
  return { stops, direction };
}

export function GradientEditor({ value, onChange, label, testIdPrefix = "gradient" }: GradientEditorProps) {
  const addStop = () => {
    if (value.stops.length >= 5) return;
    
    const lastPosition = value.stops.length > 0 
      ? value.stops[value.stops.length - 1].position 
      : 0;
    const newPosition = Math.min(lastPosition + 25, 100);
    const newColorIndex = value.stops.length % DEFAULT_COLORS.length;
    
    onChange({
      ...value,
      stops: [...value.stops, { color: DEFAULT_COLORS[newColorIndex], position: newPosition }],
    });
  };

  const removeStop = (index: number) => {
    if (value.stops.length <= 1) return;
    onChange({
      ...value,
      stops: value.stops.filter((_, i) => i !== index),
    });
  };

  const updateStopColor = (index: number, color: string) => {
    const newStops = [...value.stops];
    newStops[index] = { ...newStops[index], color };
    onChange({ ...value, stops: newStops });
  };

  const updateStopPosition = (index: number, position: number) => {
    const newStops = [...value.stops];
    newStops[index] = { ...newStops[index], position };
    onChange({ ...value, stops: newStops });
  };

  const updateDirection = (direction: string) => {
    onChange({ ...value, direction });
  };

  const gradientCSS = generateGradientCSS(value);

  return (
    <div className="space-y-4">
      {label && <Label className="font-medium">{label}</Label>}
      
      <div className="space-y-3">
        <Label className="text-sm text-muted-foreground">Cores do Gradiente</Label>
        
        {value.stops.map((stop, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground w-14">Cor {index + 1}:</span>
              <div className="relative">
                <Input
                  type="color"
                  value={stop.color}
                  onChange={(e) => updateStopColor(index, e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer border-2"
                  data-testid={`${testIdPrefix}-color-${index}`}
                />
              </div>
              <Input
                type="text"
                value={stop.color}
                onChange={(e) => updateStopColor(index, e.target.value)}
                className="w-24 text-sm"
                placeholder="#000000"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Posição:</span>
              <Slider
                value={[stop.position]}
                onValueChange={([pos]) => updateStopPosition(index, pos)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
                data-testid={`${testIdPrefix}-position-${index}`}
              />
              <span className="text-sm w-10 text-right">{stop.position}%</span>
            </div>
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeStop(index)}
              disabled={value.stops.length <= 1}
              className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
              data-testid={`${testIdPrefix}-remove-${index}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {value.stops.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStop}
            className="w-full"
            data-testid={`${testIdPrefix}-add-color`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cor
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Direção do Gradiente</Label>
        <Select value={value.direction} onValueChange={updateDirection}>
          <SelectTrigger data-testid={`${testIdPrefix}-direction`}>
            <SelectValue placeholder="Selecione a direção" />
          </SelectTrigger>
          <SelectContent>
            {DIRECTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Preview</Label>
        <div
          className="h-16 rounded-lg border-2 border-dashed"
          style={{ background: gradientCSS || "#e5e7eb" }}
          data-testid={`${testIdPrefix}-preview`}
        />
        <p className="text-xs text-muted-foreground font-mono break-all">
          {gradientCSS || "Adicione cores para gerar o gradiente"}
        </p>
      </div>
    </div>
  );
}

export const DEFAULT_GRADIENT_CONFIG: GradientConfig = {
  stops: [
    { color: "#3b82f6", position: 0 },
    { color: "#8b5cf6", position: 50 },
    { color: "#ec4899", position: 100 },
  ],
  direction: "135deg",
};
