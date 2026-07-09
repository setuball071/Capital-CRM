import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, Camera, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ROLE_LABELS, type UserRole } from "@shared/schema";
import { AvatarCropper } from "@/components/avatar-cropper";

function getInitials(name: string) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function ProfilePage() {
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Use uma imagem de até 8MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveAvatar = async (blob: Blob) => {
    const fd = new FormData();
    fd.append("file", blob, "avatar.jpg");
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || "Erro ao enviar foto");
    }
    await checkAuth();
    setCropSrc(null);
    toast({ title: "Foto atualizada com sucesso" });
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao remover foto");
      await checkAuth();
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { 
        currentPassword, 
        newPassword 
      });

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const roleLabel = ROLE_LABELS[user.role as UserRole] || user.role;

  return (
    <div className="container max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Meu Perfil</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription>
              Suas informações de conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Foto de perfil */}
            <div className="flex items-center gap-4 pb-2">
              <Avatar className="h-20 w-20">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />}
                <AvatarFallback className="text-lg font-semibold text-white" style={{ background: "linear-gradient(90deg,#A855F7 0%,#E91E63 100%)" }}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickFile} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={avatarBusy} data-testid="button-change-avatar">
                    <Camera className="h-4 w-4 mr-1.5" />Alterar foto
                  </Button>
                  {user.avatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={avatarBusy} className="text-destructive hover:text-destructive">
                      {avatarBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">JPG, PNG ou WebP. Recorte com zoom antes de salvar.</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="text-sm font-medium" data-testid="text-user-name">
                {user.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="text-sm font-medium" data-testid="text-user-email">
                {user.email}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <div className="text-sm font-medium" data-testid="text-user-role">
                {roleLabel}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alterar Senha</CardTitle>
            <CardDescription>
              Altere sua senha de acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha Atual</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading}
                  data-testid="input-current-password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Digite a nova senha (mínimo 6 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  data-testid="input-new-password"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Digite novamente a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  data-testid="input-confirm-password"
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-change-password"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Alterar Senha"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {cropSrc && (
        <AvatarCropper imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onSave={saveAvatar} />
      )}
    </div>
  );
}
