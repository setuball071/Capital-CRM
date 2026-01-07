import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/components/tenant-theme-provider";
import { Loader2, Upload, Palette, Type, Image, Save, Eye } from "lucide-react";
import type { Tenant, TenantTheme } from "@shared/schema";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Open Sans", label: "Open Sans" },
];

export default function AdminBrandingPage() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  
  const [formData, setFormData] = useState({
    name: "",
    slogan: "",
    fontFamily: "Inter",
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
    loginBgColor: "#1e293b",
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLoginFile, setLogoLoginFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Load tenant data
  const { data: tenantData, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/current"],
    enabled: !!tenant,
  });

  useEffect(() => {
    if (tenantData) {
      const theme = tenantData.themeJson as TenantTheme | null;
      setFormData({
        name: tenantData.name || "",
        slogan: (tenantData as any).slogan || "",
        fontFamily: (tenantData as any).fontFamily || "Inter",
        primaryColor: theme?.primaryColor || "#3b82f6",
        secondaryColor: theme?.secondaryColor || "#10b981",
        loginBgColor: theme?.loginBgColor || "#1e293b",
      });
    }
  }, [tenantData]);

  // Save branding mutation
  const saveBrandingMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const themeJson: TenantTheme = {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        loginBgColor: data.loginBgColor,
      };
      
      return apiRequest("PUT", `/api/tenant/branding`, {
        name: data.name,
        slogan: data.slogan,
        fontFamily: data.fontFamily,
        themeJson,
      });
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configurações de marca salvas!" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive"
      });
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: "sidebar" | "login" | "favicon" }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      
      const response = await fetch("/api/tenant/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao fazer upload");
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      const typeLabels = {
        sidebar: "Logo do menu",
        login: "Logo do login",
        favicon: "Favicon",
      };
      toast({ title: "Sucesso", description: `${typeLabels[variables.type]} atualizado!` });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      
      // Clear file input
      if (variables.type === "sidebar") setLogoFile(null);
      if (variables.type === "login") setLogoLoginFile(null);
      if (variables.type === "favicon") setFaviconFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro no upload", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSave = () => {
    saveBrandingMutation.mutate(formData);
  };

  const handleLogoUpload = (type: "sidebar" | "login" | "favicon") => {
    const file = type === "sidebar" ? logoFile : type === "login" ? logoLoginFile : faviconFile;
    if (file) {
      uploadLogoMutation.mutate({ file, type });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Identidade Visual</h1>
        <p className="text-muted-foreground">
          Personalize a aparência do ambiente para sua marca
        </p>
      </div>

      <div className="grid gap-6">
        {/* Logos Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logotipos
            </CardTitle>
            <CardDescription>
              Configure os logos exibidos em diferentes partes do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Menu Lateral */}
            <div className="space-y-2">
              <Label>Logo do Menu Lateral</Label>
              <div className="flex items-center gap-4">
                {tenantData?.logoUrl && (
                  <div className="h-12 w-32 bg-muted rounded flex items-center justify-center p-2">
                    <img 
                      src={tenantData.logoUrl} 
                      alt="Logo atual" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    data-testid="input-logo-sidebar"
                  />
                  <Button
                    onClick={() => handleLogoUpload("sidebar")}
                    disabled={!logoFile || uploadLogoMutation.isPending}
                    size="sm"
                    data-testid="button-upload-logo-sidebar"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Logo Tela de Login */}
            <div className="space-y-2">
              <Label>Logo da Tela de Login</Label>
              <div className="flex items-center gap-4">
                {(tenantData as any)?.logoLoginUrl && (
                  <div className="h-12 w-32 bg-muted rounded flex items-center justify-center p-2">
                    <img 
                      src={(tenantData as any).logoLoginUrl} 
                      alt="Logo login atual" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoLoginFile(e.target.files?.[0] || null)}
                    data-testid="input-logo-login"
                  />
                  <Button
                    onClick={() => handleLogoUpload("login")}
                    disabled={!logoLoginFile || uploadLogoMutation.isPending}
                    size="sm"
                    data-testid="button-upload-logo-login"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div className="space-y-2">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                {tenantData?.faviconUrl && (
                  <div className="h-12 w-12 bg-muted rounded flex items-center justify-center p-2">
                    <img 
                      src={tenantData.faviconUrl} 
                      alt="Favicon atual" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input
                    type="file"
                    accept="image/*,.ico"
                    onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                    data-testid="input-favicon"
                  />
                  <Button
                    onClick={() => handleLogoUpload("favicon")}
                    disabled={!faviconFile || uploadLogoMutation.isPending}
                    size="sm"
                    data-testid="button-upload-favicon"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Paleta de Cores
            </CardTitle>
            <CardDescription>
              Defina as cores principais do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                    data-testid="input-primary-color"
                  />
                  <Input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#3b82f6"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Botões e menus</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#10b981"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Destaques</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginBgColor">Cor de Fundo do Login</Label>
                <div className="flex gap-2">
                  <Input
                    id="loginBgColor"
                    type="color"
                    value={formData.loginBgColor}
                    onChange={(e) => setFormData({ ...formData, loginBgColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                    data-testid="input-login-bg-color"
                  />
                  <Input
                    type="text"
                    value={formData.loginBgColor}
                    onChange={(e) => setFormData({ ...formData, loginBgColor: e.target.value })}
                    className="flex-1"
                    placeholder="#1e293b"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Fundo da tela de login</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Tipografia e Textos
            </CardTitle>
            <CardDescription>
              Configure fontes e textos personalizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">Fonte Principal</Label>
                <Select
                  value={formData.fontFamily}
                  onValueChange={(value) => setFormData({ ...formData, fontFamily: value })}
                >
                  <SelectTrigger data-testid="select-font-family">
                    <SelectValue placeholder="Selecione a fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome do Sistema</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Gold Card Digital"
                  data-testid="input-system-name"
                />
                <p className="text-xs text-muted-foreground">Exibido na tela de login</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slogan">Slogan / Subtítulo</Label>
              <Input
                id="slogan"
                value={formData.slogan}
                onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                placeholder="Ex: Soluções financeiras inteligentes"
                data-testid="input-slogan"
              />
              <p className="text-xs text-muted-foreground">Exibido abaixo do nome na tela de login</p>
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização
            </CardTitle>
            <CardDescription>
              Veja como ficará a tela de login com suas configurações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="rounded-lg p-8 flex flex-col items-center justify-center min-h-[200px]"
              style={{ backgroundColor: formData.loginBgColor }}
            >
              {(tenantData as any)?.logoLoginUrl || tenantData?.logoUrl ? (
                <img 
                  src={(tenantData as any)?.logoLoginUrl || tenantData?.logoUrl} 
                  alt="Preview" 
                  className="h-16 mb-4 object-contain"
                />
              ) : (
                <div 
                  className="h-16 w-32 rounded flex items-center justify-center mb-4 text-white font-bold"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  LOGO
                </div>
              )}
              <h2 
                className="text-2xl font-bold text-white mb-2"
                style={{ fontFamily: formData.fontFamily }}
              >
                {formData.name || "Nome do Sistema"}
              </h2>
              {formData.slogan && (
                <p 
                  className="text-white/80"
                  style={{ fontFamily: formData.fontFamily }}
                >
                  {formData.slogan}
                </p>
              )}
              <Button 
                className="mt-6"
                style={{ 
                  backgroundColor: formData.primaryColor,
                  color: "white"
                }}
              >
                Entrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={saveBrandingMutation.isPending}
            size="lg"
            data-testid="button-save-branding"
          >
            {saveBrandingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar e Aplicar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
