import { cn } from "@/lib/utils";

/** Ícone Material Symbols Rounded (mesmo set do design Capital Go). */
export function MatIcon({ name, size = 19, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("cg-icon shrink-0 select-none", className)} style={{ fontSize: size, ...style }} aria-hidden>
      {name}
    </span>
  );
}
