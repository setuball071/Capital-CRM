import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";

/**
 * Busca global de cliente por CPF no header (atalho ⌘K / Ctrl+K).
 * Ao dar Enter, navega para /vendas/consulta?cpf=<digitos>, que auto-busca.
 */
export function HeaderCpfSearch() {
  const [, navigate] = useLocation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = () => {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 3) {
      navigate(`/vendas/consulta?cpf=${digits}`);
      setValue("");
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="hidden md:flex items-center gap-2.5 flex-1 max-w-[460px] px-3 h-[38px] rounded-[9px] border bg-muted/50 focus-within:border-primary transition-colors"
      data-testid="header-cpf-search-container"
    >
      <span className="cg-icon shrink-0 text-muted-foreground" style={{ fontSize: 18 }} aria-hidden>search</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Buscar cliente por CPF..."
        className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px]"
        style={{ fontFamily: "Inter, sans-serif" }}
        data-testid="header-cpf-search"
        inputMode="numeric"
      />
      <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[11.5px] font-semibold rounded-[5px] border bg-sidebar text-muted-foreground shrink-0">
        ⌘K
      </kbd>
    </div>
  );
}
