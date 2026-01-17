import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/components/tenant-theme-provider";
import { useAuth } from "@/lib/auth";
import { Loader2, Upload, Palette, Type, Image, Save, Eye, RotateCcw, Monitor, Tablet, Smartphone, AlertCircle } from "lucide-react";
import type { Tenant, TenantTheme } from "@shared/schema";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "custom", label: "Fonte Externa (Google Fonts)" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: "400", label: "Normal (400)" },
  { value: "500", label: "Médio (500)" },
  { value: "600", label: "Semi-bold (600)" },
  { value: "700", label: "Bold (700)" },
];

const FONT_SIZE_OPTIONS = [
  { value: "14px", label: "14px - Pequeno" },
  { value: "16px", label: "16px - Normal" },
  { value: "18px", label: "18px - Grande" },
];

const DEFAULT_THEME: TenantTheme = {
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
  loginBgColor: "#1e293b",
  textColor: "#1f2937",
  borderColor: "#e5e7eb",
  successColor: "#22c55e",
  errorColor: "#ef4444",
  warningColor: "#f59e0b",
  fontSize: "16px",
  fontWeight: "400",
  fontColor: "#1f2937",
  showSlogan: true,
  showSystemName: true,
  sidebarBgColor: "#ffffff",
  sidebarFontColor: "#1f2937",
};

export default function AdminBrandingPage() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  
  const [formData, setFormData] = useState({
    name: "",
    slogan: "",
    fontFamily: "Inter",
    customFontUrl: "",
    logoHeight: 64,
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
    loginBgColor: "#1e293b",
    textColor: "#1f2937",
    borderColor: "#e5e7eb",
    successColor: "#22c55e",
    errorColor: "#ef4444",
    warningColor: "#f59e0b",
    fontSize: "16px",
    fontWeight: "400",
    fontColor: "#1f2937",
    welcomeText: "",
    footerText: "",
    showSlogan: true,
    showSystemName: true,
    sidebarBgColor: "#ffffff",
    sidebarFontColor: "#1f2937",
    sidebarGradient: "",
    loginGradient: "",
    primaryGradient: "",
    useSidebarGradient: false,
    useLoginGradient: false,
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLoginFile, setLogoLoginFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const { data: tenantData, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/current"],
    enabled: !!tenant,
  });

  useEffect(() => {
    if (tenantData) {
      const theme = tenantData.themeJson as TenantTheme | null;
      const storedFontFamily = (tenantData as any).fontFamily || "Inter";
      const hasValidCustomFont = storedFontFamily === "custom" && theme?.customFontUrl;
      const effectiveFontFamily = hasValidCustomFont ? "custom" : 
        (storedFontFamily === "custom" ? "Inter" : storedFontFamily);
      
      setFormData({
        name: tenantData.name || "",
        slogan: (tenantData as any).slogan || "",
        fontFamily: effectiveFontFamily,
        customFontUrl: theme?.customFontUrl || "",
        logoHeight: (tenantData as any).logoHeight || 64,
        primaryColor: theme?.primaryColor || "#3b82f6",
        secondaryColor: theme?.secondaryColor || "#10b981",
        loginBgColor: theme?.loginBgColor || "#1e293b",
        textColor: theme?.textColor || "#1f2937",
        borderColor: theme?.borderColor || "#e5e7eb",
        successColor: theme?.successColor || "#22c55e",
        errorColor: theme?.errorColor || "#ef4444",
        warningColor: theme?.warningColor || "#f59e0b",
        fontSize: theme?.fontSize || "16px",
        fontWeight: theme?.fontWeight || "400",
        fontColor: theme?.fontColor || "#1f2937",
        welcomeText: theme?.welcomeText || "",
        footerText: theme?.footerText || "",
        showSlogan: theme?.showSlogan !== false,
        showSystemName: theme?.showSystemName !== false,
        sidebarBgColor: theme?.sidebarBgColor || "#ffffff",
        sidebarFontColor: theme?.sidebarFontColor || "#1f2937",
        sidebarGradient: theme?.sidebarGradient || "",
        loginGradient: theme?.loginGradient || "",
        primaryGradient: theme?.primaryGradient || "",
        useSidebarGradient: theme?.useSidebarGradient === true,
        useLoginGradient: theme?.useLoginGradient === true,
      });
    }
  }, [tenantData]);

  const saveBrandingMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const themeJson: TenantTheme = {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        loginBgColor: data.loginBgColor,
        textColor: data.textColor,
        borderColor: data.borderColor,
        successColor: data.successColor,
        errorColor: data.errorColor,
        warningColor: data.warningColor,
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
        fontColor: data.fontColor,
        customFontUrl: data.customFontUrl,
        welcomeText: data.welcomeText,
        footerText: data.footerText,
        showSlogan: data.showSlogan,
        showSystemName: data.showSystemName,
        sidebarBgColor: data.sidebarBgColor,
        sidebarFontColor: data.sidebarFontColor,
        sidebarGradient: data.sidebarGradient,
        loginGradient: data.loginGradient,
        primaryGradient: data.primaryGradient,
        useSidebarGradient: data.useSidebarGradient,
        useLoginGradient: data.useLoginGradient,
        lastEditedBy: user?.name || "Desconhecido",
        lastEditedAt: new Date().toISOString(),
      };
      
      return apiRequest("PUT", `/api/tenant/branding`, {
        name: data.name,
        slogan: data.slogan,
        fontFamily: data.fontFamily,
        logoHeight: data.logoHeight,
        themeJson,
      });
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configurações de marca salvas e aplicadas!" });
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
    if (formData.fontFamily === "custom" && !formData.customFontUrl.trim()) {
      toast({ 
        title: "URL da fonte obrigatória", 
        description: "Informe a URL do Google Fonts ou selecione outra fonte.",
        variant: "destructive"
      });
      return;
    }
    saveBrandingMutation.mutate(formData);
  };

  const handleRestoreDefaults = () => {
    setFormData({
      name: tenant?.name || "Sistema",
      slogan: "",
      fontFamily: "Inter",
      customFontUrl: "",
      logoHeight: 64,
      primaryColor: DEFAULT_THEME.primaryColor || "#3b82f6",
      secondaryColor: DEFAULT_THEME.secondaryColor || "#10b981",
      loginBgColor: DEFAULT_THEME.loginBgColor || "#1e293b",
      textColor: DEFAULT_THEME.textColor || "#1f2937",
      borderColor: DEFAULT_THEME.borderColor || "#e5e7eb",
      successColor: DEFAULT_THEME.successColor || "#22c55e",
      errorColor: DEFAULT_THEME.errorColor || "#ef4444",
      warningColor: DEFAULT_THEME.warningColor || "#f59e0b",
      fontSize: DEFAULT_THEME.fontSize || "16px",
      fontWeight: DEFAULT_THEME.fontWeight || "400",
      fontColor: DEFAULT_THEME.fontColor || "#1f2937",
      showSlogan: true,
      showSystemName: true,
      welcomeText: "",
      footerText: "",
      sidebarBgColor: DEFAULT_THEME.sidebarBgColor || "#ffffff",
      sidebarFontColor: DEFAULT_THEME.sidebarFontColor || "#1f2937",
      sidebarGradient: "",
      loginGradient: "",
      primaryGradient: "",
      useSidebarGradient: false,
      useLoginGradient: false,
    });
    toast({ title: "Padrões restaurados", description: "Clique em Salvar para aplicar." });
  };

  const handleLogoUpload = (type: "sidebar" | "login" | "favicon") => {
    const file = type === "sidebar" ? logoFile : type === "login" ? logoLoginFile : faviconFile;
    if (file) {
      uploadLogoMutation.mutate({ file, type });
    }
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case "mobile": return "max-w-[320px]";
      case "tablet": return "max-w-[768px]";
      default: return "w-full";
    }
  };

  const theme = tenantData?.themeJson as TenantTheme | null;
  const lastEditInfo = theme?.lastEditedBy && theme?.lastEditedAt 
    ? `Última alteração feita por ${theme.lastEditedBy} em ${new Date(theme.lastEditedAt).toLocaleString('pt-BR')}`
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Edição da Identidade Visual: {tenant?.name || "Tenant"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          Personalize a aparência do ambiente para sua marca
        </p>
        {lastEditInfo && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {lastEditInfo}
          </p>
        )}
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
              Configure os logos exibidos em diferentes partes do sistema.
              <span className="block text-xs mt-1">Formatos permitidos: PNG, SVG - Tamanho máximo: 2MB</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Logo do Menu Lateral</Label>
              <div className="flex items-center gap-4">
                {(logoFile || tenantData?.logoUrl) && (
                  <div className="h-12 w-32 bg-muted rounded flex items-center justify-center p-2 relative">
                    <img 
                      src={logoFile ? URL.createObjectURL(logoFile) : tenantData?.logoUrl || ""} 
                      alt="Logo atual" 
                      className="max-h-full max-w-full object-contain" 
                      data-testid="img-logo-sidebar"
                    />
                    {logoFile && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-xs text-white px-1 rounded">Novo</span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input type="file" accept="image/png,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} data-testid="input-logo-sidebar" />
                  <Button onClick={() => handleLogoUpload("sidebar")} disabled={!logoFile || uploadLogoMutation.isPending} size="sm" data-testid="button-upload-logo-sidebar">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {logoFile && <p className="text-xs text-muted-foreground">Clique no botão de upload para salvar o novo logo</p>}
            </div>

            <div className="space-y-2">
              <Label>Logo da Tela de Login</Label>
              <div className="flex items-center gap-4">
                {(logoLoginFile || (tenantData as any)?.logoLoginUrl) && (
                  <div className="h-12 w-32 bg-muted rounded flex items-center justify-center p-2 relative">
                    <img 
                      src={logoLoginFile ? URL.createObjectURL(logoLoginFile) : (tenantData as any)?.logoLoginUrl || ""} 
                      alt="Logo login atual" 
                      className="max-h-full max-w-full object-contain"
                      data-testid="img-logo-login"
                    />
                    {logoLoginFile && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-xs text-white px-1 rounded">Novo</span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input type="file" accept="image/png,image/svg+xml" onChange={(e) => setLogoLoginFile(e.target.files?.[0] || null)} data-testid="input-logo-login" />
                  <Button onClick={() => handleLogoUpload("login")} disabled={!logoLoginFile || uploadLogoMutation.isPending} size="sm" data-testid="button-upload-logo-login">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {logoLoginFile && <p className="text-xs text-muted-foreground">Clique no botão de upload para salvar o novo logo</p>}
            </div>

            <div className="space-y-2">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                {(faviconFile || tenantData?.faviconUrl) && (
                  <div className="h-12 w-12 bg-muted rounded flex items-center justify-center p-2 relative">
                    <img 
                      src={faviconFile ? URL.createObjectURL(faviconFile) : tenantData?.faviconUrl || ""} 
                      alt="Favicon atual" 
                      className="max-h-full max-w-full object-contain"
                      data-testid="img-favicon"
                    />
                    {faviconFile && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-xs text-white px-1 rounded">Novo</span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input type="file" accept="image/png,image/svg+xml,.ico" onChange={(e) => setFaviconFile(e.target.files?.[0] || null)} data-testid="input-favicon" />
                  <Button onClick={() => handleLogoUpload("favicon")} disabled={!faviconFile || uploadLogoMutation.isPending} size="sm" data-testid="button-upload-favicon">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {faviconFile && <p className="text-xs text-muted-foreground">Clique no botão de upload para salvar o novo favicon</p>}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="logoHeight">Altura do Logo no Menu (px)</Label>
              <div className="flex items-center gap-4">
                <Input 
                  id="logoHeight"
                  type="range"
                  min={32}
                  max={120}
                  value={formData.logoHeight}
                  onChange={(e) => setFormData({ ...formData, logoHeight: parseInt(e.target.value) })}
                  className="flex-1"
                  data-testid="input-logo-height"
                />
                <Input 
                  type="number"
                  min={32}
                  max={120}
                  value={formData.logoHeight}
                  onChange={(e) => setFormData({ ...formData, logoHeight: parseInt(e.target.value) || 64 })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">px</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Define a altura máxima do logo no menu lateral (32-120px). Recomendado: 64-80px para logos com proporção horizontal.
              </p>
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
              Defina as cores principais do sistema. Todos os campos permitem seletor visual ou input manual (HEX/RGB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input id="primaryColor" type="color" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-primary-color" />
                  <Input type="text" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="flex-1" placeholder="#3b82f6" />
                </div>
                <p className="text-xs text-muted-foreground">Botões e menus</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input id="secondaryColor" type="color" value={formData.secondaryColor} onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-secondary-color" />
                  <Input type="text" value={formData.secondaryColor} onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })} className="flex-1" placeholder="#10b981" />
                </div>
                <p className="text-xs text-muted-foreground">Destaques</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginBgColor">Cor de Fundo do Login</Label>
                <div className="flex gap-2">
                  <Input id="loginBgColor" type="color" value={formData.loginBgColor} onChange={(e) => setFormData({ ...formData, loginBgColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-login-bg-color" />
                  <Input type="text" value={formData.loginBgColor} onChange={(e) => setFormData({ ...formData, loginBgColor: e.target.value })} className="flex-1" placeholder="#1e293b" />
                </div>
                <p className="text-xs text-muted-foreground">Fundo da tela de login</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="textColor">Cor de Texto Principal</Label>
                <div className="flex gap-2">
                  <Input id="textColor" type="color" value={formData.textColor} onChange={(e) => setFormData({ ...formData, textColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-text-color" />
                  <Input type="text" value={formData.textColor} onChange={(e) => setFormData({ ...formData, textColor: e.target.value })} className="flex-1" placeholder="#1f2937" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="borderColor">Cor de Bordas/Divisórias</Label>
                <div className="flex gap-2">
                  <Input id="borderColor" type="color" value={formData.borderColor} onChange={(e) => setFormData({ ...formData, borderColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-border-color" />
                  <Input type="text" value={formData.borderColor} onChange={(e) => setFormData({ ...formData, borderColor: e.target.value })} className="flex-1" placeholder="#e5e7eb" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontColor">Cor da Fonte</Label>
                <div className="flex gap-2">
                  <Input id="fontColor" type="color" value={formData.fontColor} onChange={(e) => setFormData({ ...formData, fontColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-font-color" />
                  <Input type="text" value={formData.fontColor} onChange={(e) => setFormData({ ...formData, fontColor: e.target.value })} className="flex-1" placeholder="#1f2937" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="successColor">Cor de Sucesso</Label>
                <div className="flex gap-2">
                  <Input id="successColor" type="color" value={formData.successColor} onChange={(e) => setFormData({ ...formData, successColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-success-color" />
                  <Input type="text" value={formData.successColor} onChange={(e) => setFormData({ ...formData, successColor: e.target.value })} className="flex-1" placeholder="#22c55e" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="errorColor">Cor de Erro</Label>
                <div className="flex gap-2">
                  <Input id="errorColor" type="color" value={formData.errorColor} onChange={(e) => setFormData({ ...formData, errorColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-error-color" />
                  <Input type="text" value={formData.errorColor} onChange={(e) => setFormData({ ...formData, errorColor: e.target.value })} className="flex-1" placeholder="#ef4444" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warningColor">Cor de Alerta</Label>
                <div className="flex gap-2">
                  <Input id="warningColor" type="color" value={formData.warningColor} onChange={(e) => setFormData({ ...formData, warningColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-warning-color" />
                  <Input type="text" value={formData.warningColor} onChange={(e) => setFormData({ ...formData, warningColor: e.target.value })} className="flex-1" placeholder="#f59e0b" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">Menu Lateral (Sidebar)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sidebarBgColor">Cor do Fundo do Menu Lateral</Label>
                  <div className="flex gap-2">
                    <Input id="sidebarBgColor" type="color" value={formData.sidebarBgColor} onChange={(e) => setFormData({ ...formData, sidebarBgColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-sidebar-bg-color" disabled={formData.useSidebarGradient} />
                    <Input type="text" value={formData.sidebarBgColor} onChange={(e) => setFormData({ ...formData, sidebarBgColor: e.target.value })} className="flex-1" placeholder="#ffffff" disabled={formData.useSidebarGradient} />
                  </div>
                  <p className="text-xs text-muted-foreground">Cor de fundo do menu de navegação</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sidebarFontColor">Cor da Fonte do Menu Lateral</Label>
                  <div className="flex gap-2">
                    <Input id="sidebarFontColor" type="color" value={formData.sidebarFontColor} onChange={(e) => setFormData({ ...formData, sidebarFontColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-sidebar-font-color" />
                    <Input type="text" value={formData.sidebarFontColor} onChange={(e) => setFormData({ ...formData, sidebarFontColor: e.target.value })} className="flex-1" placeholder="#1f2937" />
                  </div>
                  <p className="text-xs text-muted-foreground">Cor do texto e ícones no menu</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id="useSidebarGradient" 
                    checked={formData.useSidebarGradient} 
                    onCheckedChange={(checked) => setFormData({ ...formData, useSidebarGradient: checked === true })}
                    data-testid="checkbox-use-sidebar-gradient"
                  />
                  <Label htmlFor="useSidebarGradient" className="font-medium cursor-pointer">
                    Usar gradiente no menu lateral
                  </Label>
                </div>
                {formData.useSidebarGradient && (
                  <div className="space-y-2">
                    <Label htmlFor="sidebarGradient">Gradiente CSS do Menu</Label>
                    <Input 
                      id="sidebarGradient" 
                      type="text" 
                      value={formData.sidebarGradient} 
                      onChange={(e) => setFormData({ ...formData, sidebarGradient: e.target.value })} 
                      placeholder="linear-gradient(135deg, #FF6B00 0%, #FF1493 50%, #9C27B0 100%)"
                      data-testid="input-sidebar-gradient"
                    />
                    <p className="text-xs text-muted-foreground">
                      Exemplo: linear-gradient(135deg, #FF6B00 0%, #FF1493 50%, #9C27B0 100%)
                    </p>
                    {formData.sidebarGradient && (
                      <div 
                        className="h-12 rounded-md border"
                        style={{ background: formData.sidebarGradient }}
                        data-testid="preview-sidebar-gradient"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">Tela de Login</h4>
              <div className="flex items-center gap-3 mb-4">
                <Checkbox 
                  id="useLoginGradient" 
                  checked={formData.useLoginGradient} 
                  onCheckedChange={(checked) => setFormData({ ...formData, useLoginGradient: checked === true })}
                  data-testid="checkbox-use-login-gradient"
                />
                <Label htmlFor="useLoginGradient" className="font-medium cursor-pointer">
                  Usar gradiente na tela de login
                </Label>
              </div>
              {formData.useLoginGradient && (
                <div className="space-y-2">
                  <Label htmlFor="loginGradient">Gradiente CSS do Login</Label>
                  <Input 
                    id="loginGradient" 
                    type="text" 
                    value={formData.loginGradient} 
                    onChange={(e) => setFormData({ ...formData, loginGradient: e.target.value })} 
                    placeholder="linear-gradient(135deg, #FF6B00 0%, #FF1493 50%, #9C27B0 100%)"
                    data-testid="input-login-gradient"
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, substitui a "Cor de Fundo do Login" por este gradiente
                  </p>
                  {formData.loginGradient && (
                    <div 
                      className="h-12 rounded-md border"
                      style={{ background: formData.loginGradient }}
                      data-testid="preview-login-gradient"
                    />
                  )}
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">Fonte Principal</Label>
                <Select value={formData.fontFamily} onValueChange={(value) => setFormData({ ...formData, fontFamily: value })}>
                  <SelectTrigger data-testid="select-font-family">
                    <SelectValue placeholder="Selecione a fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value !== "custom" ? font.value : undefined }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontSize">Tamanho da Fonte</Label>
                <Select value={formData.fontSize} onValueChange={(value) => setFormData({ ...formData, fontSize: value })}>
                  <SelectTrigger data-testid="select-font-size">
                    <SelectValue placeholder="Selecione o tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontWeight">Peso da Fonte</Label>
                <Select value={formData.fontWeight} onValueChange={(value) => setFormData({ ...formData, fontWeight: value })}>
                  <SelectTrigger data-testid="select-font-weight">
                    <SelectValue placeholder="Selecione o peso" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_WEIGHT_OPTIONS.map((weight) => (
                      <SelectItem key={weight.value} value={weight.value}>{weight.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.fontFamily === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customFontUrl">URL da Fonte Externa (Google Fonts)</Label>
                <Input id="customFontUrl" value={formData.customFontUrl} onChange={(e) => setFormData({ ...formData, customFontUrl: e.target.value })} placeholder="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" data-testid="input-custom-font-url" />
                <p className="text-xs text-muted-foreground">Cole o link do Google Fonts para usar uma fonte personalizada</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Sistema</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Gold Card Digital" data-testid="input-system-name" />
                <p className="text-xs text-muted-foreground">Exibido na tela de login</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slogan">Slogan / Subtítulo</Label>
                <Input id="slogan" value={formData.slogan} onChange={(e) => setFormData({ ...formData, slogan: e.target.value })} placeholder="Ex: Soluções financeiras inteligentes" data-testid="input-slogan" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="showSlogan" checked={formData.showSlogan} onCheckedChange={(checked) => setFormData({ ...formData, showSlogan: !!checked })} data-testid="checkbox-show-slogan" />
              <Label htmlFor="showSlogan" className="text-sm font-normal cursor-pointer">Exibir slogan na tela de login</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="showSystemName" checked={formData.showSystemName} onCheckedChange={(checked) => setFormData({ ...formData, showSystemName: !!checked })} data-testid="checkbox-show-system-name" />
              <Label htmlFor="showSystemName" className="text-sm font-normal cursor-pointer">Exibir nome do sistema na tela de login</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Desmarque esta opção se a logo já contém o nome do sistema para evitar texto duplicado.
            </p>

            <div className="space-y-2">
              <Label htmlFor="welcomeText">Texto de Boas-vindas (opcional)</Label>
              <Input id="welcomeText" value={formData.welcomeText} onChange={(e) => setFormData({ ...formData, welcomeText: e.target.value })} placeholder="Bem-vindo ao nosso sistema!" data-testid="input-welcome-text" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Texto do Rodapé (opcional)</Label>
              <Input id="footerText" value={formData.footerText} onChange={(e) => setFormData({ ...formData, footerText: e.target.value })} placeholder="© 2025 Empresa. Todos os direitos reservados." data-testid="input-footer-text" />
              <p className="text-xs text-muted-foreground">Política de privacidade, mensagens, etc.</p>
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Pré-visualização
              </div>
              <Tabs value={previewDevice} onValueChange={(v) => setPreviewDevice(v as any)}>
                <TabsList>
                  <TabsTrigger value="desktop" className="gap-1"><Monitor className="h-4 w-4" /> Desktop</TabsTrigger>
                  <TabsTrigger value="tablet" className="gap-1"><Tablet className="h-4 w-4" /> Tablet</TabsTrigger>
                  <TabsTrigger value="mobile" className="gap-1"><Smartphone className="h-4 w-4" /> Mobile</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardTitle>
            <CardDescription>
              Veja como ficará a tela de login com suas configurações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className={`${getPreviewWidth()} w-full transition-all duration-300`}>
                <div className="rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px]" style={{ backgroundColor: formData.loginBgColor }}>
                  {(tenantData as any)?.logoLoginUrl || tenantData?.logoUrl ? (
                    <img src={(tenantData as any)?.logoLoginUrl || tenantData?.logoUrl} alt="Preview" className="h-16 mb-4 object-contain" />
                  ) : (
                    <div className="h-16 w-32 rounded flex items-center justify-center mb-4 text-white font-bold" style={{ backgroundColor: formData.primaryColor }}>LOGO</div>
                  )}
                  {formData.showSystemName && (
                    <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: formData.fontFamily !== "custom" ? formData.fontFamily : undefined, fontSize: formData.fontSize, fontWeight: formData.fontWeight as any }}>
                      {formData.name || "Nome do Sistema"}
                    </h2>
                  )}
                  {formData.showSlogan && formData.slogan && (
                    <p className="text-white/80" style={{ fontFamily: formData.fontFamily !== "custom" ? formData.fontFamily : undefined }}>{formData.slogan}</p>
                  )}
                  {formData.welcomeText && (
                    <p className="text-white/70 text-sm mt-2">{formData.welcomeText}</p>
                  )}
                  <div className="mt-6 w-full max-w-xs space-y-3">
                    <div className="bg-white/10 rounded px-3 py-2 text-white/50 text-sm">email@exemplo.com</div>
                    <div className="bg-white/10 rounded px-3 py-2 text-white/50 text-sm">********</div>
                  </div>
                  <Button className="mt-4" style={{ backgroundColor: formData.primaryColor, color: "white" }}>Entrar</Button>
                  {formData.footerText && (
                    <p className="text-white/50 text-xs mt-6">{formData.footerText}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleRestoreDefaults} data-testid="button-restore-defaults">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão do sistema
          </Button>
          <Button onClick={handleSave} disabled={saveBrandingMutation.isPending} size="lg" data-testid="button-save-branding">
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
