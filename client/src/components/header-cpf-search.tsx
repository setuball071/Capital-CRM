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
      className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4 px-3 h-9 rounded-lg border bg-background focus-within:border-primary transition-colors"
      data-testid="header-cpf-search-container"
    >
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Buscar cliente por CPF..."
        className="flex-1 min-w-0 bg-transparent outline-none text-sm"
        style={{ fontFamily: "Inter, sans-serif" }}
        data-testid="header-cpf-search"
        inputMode="numeric"
      />
      <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border text-muted-foreground shrink-0">
        ⌘K
      </kbd>
    </div>
  );
}
