import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/tenant-theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const { 
    tenant, 
    logoLoginUrl, 
    slogan, 
    fontFamily, 
    loginBgColor,
    primaryColor,
    textColor,
    welcomeText,
    footerText,
    showSlogan,
    showSystemName,
    loginGradient,
    useLoginGradient,
  } = useTenant();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Credenciais inválidas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const systemName = tenant?.name || "CRM Pro";
  const hasLogo = !!logoLoginUrl && logoLoginUrl !== "/branding/logo.png";
  // Show system name only if explicitly enabled via checkbox
  // If no logo and no system name, we still need something visible
  const shouldShowSystemName = showSystemName !== false;

  const loginBackgroundStyle = useLoginGradient && loginGradient 
    ? { background: loginGradient, fontFamily }
    : { backgroundColor: loginBgColor, fontFamily };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={loginBackgroundStyle}
      data-testid="login-container"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center pb-2">
          {hasLogo && (
            <div className="flex justify-center mb-2">
              <img 
                src={logoLoginUrl} 
                alt={systemName} 
                className="h-20 w-auto max-w-[240px] object-contain"
                data-testid="img-login-logo"
              />
            </div>
          )}
          
          {shouldShowSystemName && (
            <CardTitle 
              className="text-2xl font-bold"
              style={{ fontFamily, color: textColor }}
              data-testid="text-system-name"
            >
              {systemName}
            </CardTitle>
          )}
          
          {showSlogan && slogan && (
            <CardDescription 
              style={{ fontFamily }}
              className="text-base"
              data-testid="text-slogan"
            >
              {slogan}
            </CardDescription>
          )}
          
          {welcomeText && (
            <p 
              className="text-sm text-muted-foreground"
              style={{ fontFamily }}
              data-testid="text-welcome"
            >
              {welcomeText}
            </p>
          )}
          
          {!showSlogan && !slogan && !welcomeText && (
            <CardDescription style={{ fontFamily }}>
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          )}
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                data-testid="input-email"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                data-testid="input-password"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              style={{ 
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              }}
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {footerText && (
        <p 
          className="mt-6 text-sm text-white/60 text-center max-w-md"
          style={{ fontFamily }}
          data-testid="text-footer"
        >
          {footerText}
        </p>
      )}
    </div>
  );
}
