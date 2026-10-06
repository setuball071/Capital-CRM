import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/components/tenant-theme-provider";

// Converte #RRGGBB em rgba() para as bolas de luz do fundo.
function rgba(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(108,43,217,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  // Marca do ambiente: cada cliente tem a sua. Sem logo cadastrada, mostramos o
  // nome do ambiente em texto — nunca a marca de outro cliente.
  const { tenant, primaryColor, secondaryColor, loginBgColor, loginGradient, useLoginGradient, welcomeText } = useTenant();
  const nomeAmbiente = tenant?.name || "Sistema";
  const logoAmbiente = tenant?.logoLoginUrl || tenant?.logoUrl || null;
  const corPrimaria = primaryColor || "#6C2BD9";
  const corSecundaria = secondaryColor || corPrimaria;
  // Fundo do painel da marca: gradiente do ambiente, se ligado; senão a cor lisa.
  const fundoMarca = useLoginGradient && loginGradient ? loginGradient : (loginBgColor || "#121212");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Erro", description: "Por favor, preencha todos os campos", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: "Login realizado com sucesso!", description: "Redirecionando..." });
    } catch (error: any) {
      toast({ title: "Erro ao fazer login", description: error.message || "Credenciais inválidas", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 42, borderRadius: 8,
    border: "1px solid #D1D5DB", padding: "0 12px", fontFamily: "Inter, sans-serif",
    fontSize: 13, color: "#333", background: "#F9FAFB", outline: "none",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, sans-serif" }} data-testid="login-container">
      <style>{`
        @keyframes cgOrbA { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(30px,-40px) scale(1.12);} }
        @keyframes cgOrbB { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-40px,30px) scale(1.08);} }
        @keyframes cgOrbC { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(20px,25px) scale(0.94);} }
        @keyframes cgFormIn { 0%{opacity:0;transform:translateX(24px);} 100%{opacity:1;transform:translateX(0);} }
      `}</style>

      {/* Painel esquerdo — marca */}
      <div className="hidden md:flex md:w-[52%]" style={{ background: fundoMarca, position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(corPrimaria, 0.55)}, transparent 70%)`, top: -80, left: -60, filter: "blur(14px)", animation: "cgOrbA 10s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(corSecundaria, 0.5)}, transparent 70%)`, bottom: -100, right: -60, filter: "blur(14px)", animation: "cgOrbB 12s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(corPrimaria, 0.4)}, transparent 70%)`, top: "35%", right: "10%", filter: "blur(14px)", animation: "cgOrbC 9s ease-in-out infinite" }} />
        <div style={{ position: "relative", textAlign: "center", padding: "0 40px" }}>
          {logoAmbiente ? (
            <img src={logoAmbiente} alt={nomeAmbiente} style={{ height: 120, maxWidth: "90%", marginBottom: 24, objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginBottom: 24, letterSpacing: "-0.02em" }}>{nomeAmbiente}</div>
          )}
          {/* Texto do ambiente, definido em Branding. Antes eram quatro frases
              fixas no codigo que se revezavam — iguais em todo cliente. */}
          {welcomeText && (
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.3, maxWidth: 400, margin: "0 auto" }}>
              {welcomeText}
            </div>
          )}
        </div>
      </div>

      {/* Painel direito — form */}
      <div className="w-full md:w-[48%]" style={{ background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ width: 300, maxWidth: "100%", animation: "cgFormIn 650ms cubic-bezier(.22,1,.36,1) 200ms both" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#121212", marginBottom: 6 }}>Bem-vindo de volta</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 26 }}>Entre com sua conta {nomeAmbiente}</div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5 }}>Login</div>
          <input
            type="text" placeholder="1234 ou email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading} autoComplete="username" data-testid="input-email"
            style={{ ...inputStyle, marginBottom: 14 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = corPrimaria)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5 }}>Senha</div>
          <input
            type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading} autoComplete="current-password" data-testid="input-password"
            style={{ ...inputStyle, marginBottom: 20 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = corPrimaria)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />

          <button
            type="submit" disabled={isLoading} data-testid="button-login"
            style={{ width: "100%", height: 44, borderRadius: 8, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, background: corPrimaria, opacity: isLoading ? 0.75 : 1, cursor: isLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 150ms" }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.opacity = "1"; }}
          >
            {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />Entrando...</>) : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
