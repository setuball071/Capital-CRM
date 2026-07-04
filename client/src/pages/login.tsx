import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const FRASES = [
  ["O melhor time de", "crédito consignado"],
  ["Cada contrato fechado", "é uma vitória do time"],
  ["Foco, consistência", "e resultado"],
  ["Vamos bater a meta", "de hoje juntos"],
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

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
        @keyframes cgPhrase { 0%{opacity:0;transform:translateY(6px);} 3%{opacity:1;transform:translateY(0);} 22%{opacity:1;transform:translateY(0);} 25%{opacity:0;transform:translateY(-6px);} 100%{opacity:0;} }
        @keyframes cgFormIn { 0%{opacity:0;transform:translateX(24px);} 100%{opacity:1;transform:translateX(0);} }
      `}</style>

      {/* Painel esquerdo — marca */}
      <div className="hidden md:flex md:w-[52%]" style={{ background: "#121212", position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,30,99,0.55), transparent 70%)", top: -80, left: -60, filter: "blur(14px)", animation: "cgOrbA 10s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,136,229,0.5), transparent 70%)", bottom: -100, right: -60, filter: "blur(14px)", animation: "cgOrbB 12s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.55), transparent 70%)", top: "35%", right: "10%", filter: "blur(14px)", animation: "cgOrbC 9s ease-in-out infinite" }} />
        <div style={{ position: "relative", textAlign: "center", padding: "0 40px" }}>
          <img src="/capital-go-white.png" alt="Capital Go" style={{ height: 120, maxWidth: "90%", marginBottom: 24, objectFit: "contain" }} />
          <div style={{ position: "relative", height: 64, width: 400, maxWidth: "90vw", margin: "0 auto" }}>
            {FRASES.map((linhas, i) => (
              <div key={i} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.3, opacity: 0, animation: `cgPhrase 12s ease-in-out infinite ${i * 3}s` }}>
                {linhas[0]}<br />{linhas[1]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — form */}
      <div className="w-full md:w-[48%]" style={{ background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ width: 300, maxWidth: "100%", animation: "cgFormIn 650ms cubic-bezier(.22,1,.36,1) 200ms both" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#121212", marginBottom: 6 }}>Bem-vindo de volta</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 26 }}>Entre com sua conta Capital Go</div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5 }}>Login</div>
          <input
            type="text" placeholder="1234 ou email" value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading} autoComplete="username" data-testid="input-email"
            style={{ ...inputStyle, marginBottom: 14 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6C2BD9")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5 }}>Senha</div>
          <input
            type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading} autoComplete="current-password" data-testid="input-password"
            style={{ ...inputStyle, marginBottom: 20 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6C2BD9")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
          />

          <button
            type="submit" disabled={isLoading} data-testid="button-login"
            style={{ width: "100%", height: 44, borderRadius: 8, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, background: isLoading ? "#4B1FA6" : "#6C2BD9", cursor: isLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 150ms" }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = "#4B1FA6"; }}
            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.background = "#6C2BD9"; }}
          >
            {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />Entrando...</>) : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
