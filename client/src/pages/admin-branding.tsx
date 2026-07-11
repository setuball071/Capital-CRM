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
import { Loader2, Upload, Palette, Type, Image, Save, Eye, RotateCcw, Monitor, Tablet, Smartphone, AlertCircle, Sun, Moon } from "lucide-react";
import type { Tenant, TenantTheme } from "@shared/schema";
import { GradientEditor, GradientConfig, generateGradientCSS, parseGradientCSS, DEFAULT_GRADIENT_CONFIG } from "@/components/gradient-editor";
import { LogoCropperDialog } from "@/components/logo-cropper-dialog";

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

// Padrão do sistema = paleta Capital Go (roxo #6C2BD9, fonte Inter)
const DEFAULT_THEME: TenantTheme = {
  primaryColor: "#6C2BD9",
  secondaryColor: "#8B5CF6",
  loginBgColor: "#1e1b4b",
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

// ===== Fase 6 — presets, geração de paleta e contraste =====

const COLOR_PRESETS = [
  { nome: "Capital Go", cor: "#6C2BD9" },
  { nome: "Azul", cor: "#1E88E5" },
  { nome: "Verde", cor: "#059669" },
  { nome: "Grafite", cor: "#334155" },
];

// Converte HEX -> HSL (h em graus, s/l em %)
function hexParaHsl(hex: string): { h: number; s: number; l: number } | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Converte HSL -> HEX
function hslParaHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Deriva secundária/fundo de login/fundo dark a partir da cor primária (manipulação HSL simples)
function gerarPaletaDaPrimaria(primary: string): {
  secondaryColor: string;
  loginBgColor: string;
  darkSidebarBg: string;
  darkLoginBg: string;
} | null {
  const hsl = hexParaHsl(primary);
  if (!hsl) return null;
  return {
    // Secundária: mesma família, mais clara (hover/destaques)
    secondaryColor: hslParaHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 75)),
    // Fundo do login: tom bem escuro da mesma cor
    loginBgColor: hslParaHex(hsl.h, Math.min(hsl.s, 60), 16),
    // Fundos do tema escuro: quase preto puxando pra cor primária
    darkSidebarBg: hslParaHex(hsl.h, Math.min(hsl.s, 40), 10),
    darkLoginBg: hslParaHex(hsl.h, Math.min(hsl.s, 50), 12),
  };
}

// Luminância relativa (WCAG 2.1)
function luminanciaRelativa(hex: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = canal(parseInt(hex.slice(1, 3), 16));
  const g = canal(parseInt(hex.slice(3, 5), 16));
  const b = canal(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razão de contraste WCAG entre duas cores (1 a 21)
function razaoContraste(hex1: string, hex2: string): number | null {
  const l1 = luminanciaRelativa(hex1);
  const l2 = luminanciaRelativa(hex2);
  if (l1 === null || l2 === null) return null;
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

export default function AdminBrandingPage() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Toggle local claro/escuro do preview (não altera o tema real do app)
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  // Dono do SaaS (isMaster) pode escolher qual ambiente editar; null = tenant da sessão
  const [editTenantId, setEditTenantId] = useState<number | null>(null);

  // Sufixo de query usado pelos endpoints de branding quando o dono edita outro ambiente
  const tenantIdQS = editTenantId ? `?tenantId=${editTenantId}` : "";

  // Lista de ambientes (só para o dono do SaaS)
  const { data: allTenants } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: user?.isMaster === true,
  });

  const [formData, setFormData] = useState({
    name: "",
    slogan: "",
    fontFamily: "Inter",
    customFontUrl: "",
    logoHeight: 64,
    primaryColor: "#6C2BD9",
    secondaryColor: "#8B5CF6",
    loginBgColor: "#1e1b4b",
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
    useSidebarGradient: false,
    useLoginGradient: false,
    // Overrides opcionais aplicados só no tema escuro
    darkSidebarBg: "",
    darkSidebarText: "",
    darkLoginBg: "",
    sidebarGradientConfig: { ...DEFAULT_GRADIENT_CONFIG } as GradientConfig,
    loginGradientConfig: { ...DEFAULT_GRADIENT_CONFIG } as GradientConfig,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoLoginFile, setLogoLoginFile] = useState<File | null>(null);
  // Estado do cropper: qual logo está sendo editada e o arquivo cru antes do ajuste
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState<"sidebar" | "sidebar-dark" | "login" | "favicon" | null>(null);
  const [cropperRawFile, setCropperRawFile] = useState<File | null>(null);

  // Abre o editor de crop com o arquivo selecionado pelo input
  const openCropper = (target: "sidebar" | "sidebar-dark" | "login" | "favicon", file: File | null) => {
    if (!file) return;
    setCropperRawFile(file);
    setCropperTarget(target);
    setCropperOpen(true);
  };

  // Recebe o arquivo já recortado e coloca no state correspondente
  const handleCropperConfirm = (file: File) => {
    if (cropperTarget === "sidebar") setLogoFile(file);
    else if (cropperTarget === "sidebar-dark") setLogoDarkFile(file);
    else if (cropperTarget === "login") setLogoLoginFile(file);
    else if (cropperTarget === "favicon") setFaviconFile(file);
    setCropperOpen(false);
    setCropperTarget(null);
    setCropperRawFile(null);
  };
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const { data: tenantData, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/current", editTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenant/current${tenantIdQS}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar tenant");
      return res.json();
    },
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
        primaryColor: theme?.primaryColor || "#6C2BD9",
        secondaryColor: theme?.secondaryColor || "#8B5CF6",
        loginBgColor: theme?.loginBgColor || "#1e1b4b",
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
        darkSidebarBg: theme?.darkSidebarBg || "",
        darkSidebarText: theme?.darkSidebarText || "",
        darkLoginBg: theme?.darkLoginBg || "",
        useSidebarGradient: theme?.useSidebarGradient === true,
        useLoginGradient: theme?.useLoginGradient === true,
        sidebarGradientConfig: theme?.sidebarGradientConfig || 
          (theme?.sidebarGradient ? parseGradientCSS(theme.sidebarGradient) : null) || 
          { ...DEFAULT_GRADIENT_CONFIG },
        loginGradientConfig: theme?.loginGradientConfig ||
          (theme?.loginGradient ? parseGradientCSS(theme.loginGradient) : null) ||
          { ...DEFAULT_GRADIENT_CONFIG },
      });
      // Ao trocar de ambiente (dono do SaaS), descarta uploads pendentes do anterior
      setLogoFile(null);
      setLogoDarkFile(null);
      setLogoLoginFile(null);
      setFaviconFile(null);
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
        darkSidebarBg: data.darkSidebarBg,
        darkSidebarText: data.darkSidebarText,
        darkLoginBg: data.darkLoginBg,
        useSidebarGradient: data.useSidebarGradient,
        useLoginGradient: data.useLoginGradient,
        sidebarGradientConfig: data.sidebarGradientConfig,
        loginGradientConfig: data.loginGradientConfig,
        sidebarGradient: data.useSidebarGradient ? generateGradientCSS(data.sidebarGradientConfig) : "",
        loginGradient: data.useLoginGradient ? generateGradientCSS(data.loginGradientConfig) : "",
        lastEditedBy: user?.name || "Desconhecido",
        lastEditedAt: new Date().toISOString(),
      };
      
      return apiRequest("PUT", `/api/tenant/branding${tenantIdQS}`, {
        name: data.name,
        slogan: data.slogan,
        fontFamily: data.fontFamily,
        logoHeight: data.logoHeight,
        themeJson,
      });
    },
    onSuccess: () => {
      // Toast fica por conta do handleSave (fluxo "Salvar tudo" — um único aviso)
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
    mutationFn: async ({ file, type }: { file: File; type: "sidebar" | "sidebar-dark" | "login" | "favicon" }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch(`/api/tenant/logo${tenantIdQS}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });

      if (variables.type === "sidebar") setLogoFile(null);
      if (variables.type === "sidebar-dark") setLogoDarkFile(null);
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

  const [isSavingAll, setIsSavingAll] = useState(false);

  // "Salvar tudo": envia uploads pendentes de logos + salva o themeJson numa ação só
  const handleSave = async () => {
    if (formData.fontFamily === "custom" && !formData.customFontUrl.trim()) {
      toast({
        title: "URL da fonte obrigatória",
        description: "Informe a URL do Google Fonts ou selecione outra fonte.",
        variant: "destructive"
      });
      return;
    }
    setIsSavingAll(true);
    try {
      // Uploads pendentes primeiro (sequenciais), depois o tema — um único toast no final
      const pendentes: Array<{ file: File; type: "sidebar" | "sidebar-dark" | "login" | "favicon" }> = [];
      if (logoFile) pendentes.push({ file: logoFile, type: "sidebar" });
      if (logoDarkFile) pendentes.push({ file: logoDarkFile, type: "sidebar-dark" });
      if (logoLoginFile) pendentes.push({ file: logoLoginFile, type: "login" });
      if (faviconFile) pendentes.push({ file: faviconFile, type: "favicon" });
      for (const p of pendentes) {
        await uploadLogoMutation.mutateAsync(p);
      }
      await saveBrandingMutation.mutateAsync(formData);
      toast({ title: "Sucesso", description: "Identidade visual salva e aplicada!" });
    } catch {
      // Erros já são tratados nos onError das mutations
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleRestoreDefaults = () => {
    setFormData({
      name: tenant?.name || "Sistema",
      slogan: "",
      fontFamily: "Inter",
      customFontUrl: "",
      logoHeight: 64,
      primaryColor: DEFAULT_THEME.primaryColor || "#6C2BD9",
      secondaryColor: DEFAULT_THEME.secondaryColor || "#8B5CF6",
      loginBgColor: DEFAULT_THEME.loginBgColor || "#1e1b4b",
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
      darkSidebarBg: "",
      darkSidebarText: "",
      darkLoginBg: "",
      useSidebarGradient: false,
      useLoginGradient: false,
      sidebarGradientConfig: { ...DEFAULT_GRADIENT_CONFIG },
      loginGradientConfig: { ...DEFAULT_GRADIENT_CONFIG },
    });
    toast({ title: "Padrão Capital Go restaurado", description: "Clique em Salvar para aplicar." });
  };

  const handleLogoUpload = async (type: "sidebar" | "sidebar-dark" | "login" | "favicon") => {
    const file =
      type === "sidebar" ? logoFile :
      type === "sidebar-dark" ? logoDarkFile :
      type === "login" ? logoLoginFile : faviconFile;
    if (!file) return;
    try {
      await uploadLogoMutation.mutateAsync({ file, type });
      const typeLabels = {
        sidebar: "Logo do menu",
        "sidebar-dark": "Logo fundo escuro",
        login: "Logo do login",
        favicon: "Favicon",
      };
      toast({ title: "Sucesso", description: `${typeLabels[type]} atualizado!` });
    } catch {
      // Erro já tratado no onError da mutation
    }
  };

  // Aplica um preset ou gera a paleta derivada da cor primária atual
  const aplicarPaleta = (primary: string) => {
    const paleta = gerarPaletaDaPrimaria(primary);
    if (!paleta) {
      toast({ title: "Cor inválida", description: "Informe uma cor primária em HEX (ex: #6C2BD9).", variant: "destructive" });
      return;
    }
    setFormData({ ...formData, primaryColor: primary, ...paleta });
  };

  // Avisos de contraste WCAG (razão mínima 4.5:1 para texto normal)
  const avisosContraste: string[] = [];
  const cSidebar = razaoContraste(formData.sidebarFontColor, formData.sidebarBgColor);
  if (cSidebar !== null && cSidebar < 4.5 && !formData.useSidebarGradient) {
    avisosContraste.push(`Fonte × fundo do menu lateral: contraste ${cSidebar.toFixed(1)}:1 (mínimo recomendado 4.5:1)`);
  }
  const cBotao = razaoContraste("#ffffff", formData.primaryColor);
  if (cBotao !== null && cBotao < 4.5) {
    avisosContraste.push(`Texto branco × cor primária (botões): contraste ${cBotao.toFixed(1)}:1 (mínimo recomendado 4.5:1)`);
  }
  const cTexto = razaoContraste(formData.textColor, "#ffffff");
  if (cTexto !== null && cTexto < 4.5) {
    avisosContraste.push(`Texto principal × fundo claro: contraste ${cTexto.toFixed(1)}:1 (mínimo recomendado 4.5:1)`);
  }

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case "mobile": return "max-w-[320px]";
      case "tablet": return "max-w-[768px]";
      default: return "w-full";
    }
  };

  // Preview real: reflete arquivos de logo ainda não enviados (URL.createObjectURL)
  const previewLogoUrl = logoFile ? URL.createObjectURL(logoFile) : tenantData?.logoUrl || "";
  const previewLogoDarkUrl = logoDarkFile ? URL.createObjectURL(logoDarkFile) : (tenantData as any)?.logoUrlDark || "";
  const previewLogoLoginUrl = logoLoginFile ? URL.createObjectURL(logoLoginFile) : (tenantData as any)?.logoLoginUrl || tenantData?.logoUrl || "";
  const isPreviewDark = previewMode === "dark";
  const previewSidebarLogo = isPreviewDark && previewLogoDarkUrl ? previewLogoDarkUrl : previewLogoUrl;
  const previewSidebarBg = isPreviewDark
    ? (formData.darkSidebarBg || "#0f172a")
    : (formData.useSidebarGradient
        ? generateGradientCSS(formData.sidebarGradientConfig)
        : formData.sidebarBgColor || "#1e3a5f");
  const previewSidebarText = isPreviewDark
    ? (formData.darkSidebarText || "#e2e8f0")
    : (formData.sidebarFontColor || "#ffffff");
  const previewLoginBg = isPreviewDark && formData.darkLoginBg
    ? formData.darkLoginBg
    : (formData.useLoginGradient
        ? generateGradientCSS(formData.loginGradientConfig)
        : formData.loginBgColor);

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
            Edição da Identidade Visual: {tenantData?.name || tenant?.name || "Tenant"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          Personalize a aparência do ambiente para sua marca
        </p>
        {/* Dono do SaaS: escolher qual ambiente editar */}
        {user?.isMaster && allTenants && allTenants.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Editar marca do ambiente:</Label>
            <Select
              value={editTenantId ? String(editTenantId) : String(tenant?.id || "")}
              onValueChange={(v) => setEditTenantId(parseInt(v))}
            >
              <SelectTrigger className="w-64" data-testid="select-edit-tenant">
                <SelectValue placeholder="Selecione o ambiente" />
              </SelectTrigger>
              <SelectContent>
                {allTenants.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} {(t as any).interno ? "(interno)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      // SVG vai direto (vetor, sem necessidade de crop). Demais formatos passam pelo cropper.
                      if (f.type === "image/svg+xml") setLogoFile(f);
                      else openCropper("sidebar", f);
                      e.target.value = ""; // permite re-selecionar o mesmo arquivo
                    }}
                    data-testid="input-logo-sidebar"
                  />
                  <Button onClick={() => handleLogoUpload("sidebar")} disabled={!logoFile || uploadLogoMutation.isPending} size="sm" data-testid="button-upload-logo-sidebar">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {logoFile && <p className="text-xs text-muted-foreground">Clique no botão de upload para salvar o novo logo</p>}
            </div>

            <div className="space-y-2">
              <Label>Logo Fundo Escuro (Tema Escuro)</Label>
              <div className="flex items-center gap-4">
                {(logoDarkFile || (tenantData as any)?.logoUrlDark) && (
                  <div className="h-12 w-32 bg-zinc-900 rounded flex items-center justify-center p-2 relative">
                    <img
                      src={logoDarkFile ? URL.createObjectURL(logoDarkFile) : (tenantData as any)?.logoUrlDark || ""}
                      alt="Logo tema escuro atual"
                      className="max-h-full max-w-full object-contain"
                      data-testid="img-logo-sidebar-dark"
                    />
                    {logoDarkFile && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-xs text-white px-1 rounded">Novo</span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      if (f.type === "image/svg+xml") setLogoDarkFile(f);
                      else openCropper("sidebar-dark", f);
                      e.target.value = "";
                    }}
                    data-testid="input-logo-sidebar-dark"
                  />
                  <Button onClick={() => handleLogoUpload("sidebar-dark")} disabled={!logoDarkFile || uploadLogoMutation.isPending} size="sm" data-testid="button-upload-logo-sidebar-dark">
                    {uploadLogoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Versão da logo para o tema escuro (fundo escuro do menu). Se não enviada, a logo padrão é usada.
              </p>
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
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      if (f.type === "image/svg+xml") setLogoLoginFile(f);
                      else openCropper("login", f);
                      e.target.value = "";
                    }}
                    data-testid="input-logo-login"
                  />
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
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.ico"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      // SVG/ICO vão direto; PNG/JPG passam pelo cropper quadrado
                      if (f.type === "image/svg+xml" || f.name.endsWith(".ico")) setFaviconFile(f);
                      else openCropper("favicon", f);
                      e.target.value = "";
                    }}
                    data-testid="input-favicon"
                  />
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
            {/* Presets prontos + geração de paleta a partir da primária */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">Presets:</span>
              {COLOR_PRESETS.map((preset) => (
                <Button
                  key={preset.nome}
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarPaleta(preset.cor)}
                  data-testid={`button-preset-${preset.nome.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <span className="h-3 w-3 rounded-full mr-2 inline-block border" style={{ backgroundColor: preset.cor }} />
                  {preset.nome}
                </Button>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => aplicarPaleta(formData.primaryColor)}
                data-testid="button-gerar-paleta"
              >
                <Palette className="h-4 w-4 mr-2" />
                Gerar paleta da cor primária
              </Button>
            </div>

            {/* Aviso simples de contraste WCAG */}
            {avisosContraste.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1">
                <p className="text-sm font-medium flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  Aviso de contraste (WCAG)
                </p>
                {avisosContraste.map((aviso, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{aviso}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input id="primaryColor" type="color" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-primary-color" />
                  <Input type="text" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} className="flex-1" placeholder="#6C2BD9" />
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
                  <GradientEditor
                    value={formData.sidebarGradientConfig}
                    onChange={(config) => setFormData({ ...formData, sidebarGradientConfig: config })}
                    testIdPrefix="sidebar-gradient"
                  />
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-1">Tema Escuro (opcional)</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Cores aplicadas somente quando o usuário está no modo escuro. Deixe em branco para usar o padrão do sistema.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="darkSidebarBg">Fundo do Menu (dark)</Label>
                  <div className="flex gap-2">
                    <Input id="darkSidebarBg" type="color" value={formData.darkSidebarBg || "#0f172a"} onChange={(e) => setFormData({ ...formData, darkSidebarBg: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-dark-sidebar-bg" />
                    <Input type="text" value={formData.darkSidebarBg} onChange={(e) => setFormData({ ...formData, darkSidebarBg: e.target.value })} className="flex-1" placeholder="vazio = padrão" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="darkSidebarText">Fonte do Menu (dark)</Label>
                  <div className="flex gap-2">
                    <Input id="darkSidebarText" type="color" value={formData.darkSidebarText || "#e2e8f0"} onChange={(e) => setFormData({ ...formData, darkSidebarText: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-dark-sidebar-text" />
                    <Input type="text" value={formData.darkSidebarText} onChange={(e) => setFormData({ ...formData, darkSidebarText: e.target.value })} className="flex-1" placeholder="vazio = padrão" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="darkLoginBg">Fundo do Login (dark)</Label>
                  <div className="flex gap-2">
                    <Input id="darkLoginBg" type="color" value={formData.darkLoginBg || "#0f172a"} onChange={(e) => setFormData({ ...formData, darkLoginBg: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-dark-login-bg" />
                    <Input type="text" value={formData.darkLoginBg} onChange={(e) => setFormData({ ...formData, darkLoginBg: e.target.value })} className="flex-1" placeholder="vazio = padrão" />
                  </div>
                </div>
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
                <GradientEditor
                  value={formData.loginGradientConfig}
                  onChange={(config) => setFormData({ ...formData, loginGradientConfig: config })}
                  testIdPrefix="login-gradient"
                />
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
              <div className="flex items-center gap-2">
                {/* Toggle claro/escuro do preview */}
                <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as any)}>
                  <TabsList>
                    <TabsTrigger value="light" className="gap-1"><Sun className="h-4 w-4" /> Claro</TabsTrigger>
                    <TabsTrigger value="dark" className="gap-1"><Moon className="h-4 w-4" /> Escuro</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={previewDevice} onValueChange={(v) => setPreviewDevice(v as any)}>
                  <TabsList>
                    <TabsTrigger value="desktop" className="gap-1"><Monitor className="h-4 w-4" /> Desktop</TabsTrigger>
                    <TabsTrigger value="tablet" className="gap-1"><Tablet className="h-4 w-4" /> Tablet</TabsTrigger>
                    <TabsTrigger value="mobile" className="gap-1"><Smartphone className="h-4 w-4" /> Mobile</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardTitle>
            <CardDescription>
              Veja como ficará a tela de login com suas configurações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className={`${getPreviewWidth()} w-full transition-all duration-300`}>
                <div className="flex rounded-lg overflow-hidden min-h-[300px]">
                  {/* Sidebar Preview — reflete logo pendente e o modo claro/escuro escolhido */}
                  <div
                    className="w-16 flex flex-col items-center py-4 border-r border-white/10"
                    style={{
                      background: previewSidebarBg,
                      color: previewSidebarText,
                    }}
                    data-testid="preview-sidebar"
                  >
                    {previewSidebarLogo ? (
                      <img src={previewSidebarLogo} alt="Logo" className="h-8 w-8 object-contain mb-4" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-white/20 mb-4" />
                    )}
                    <div className="space-y-3">
                      <div className="w-6 h-6 rounded bg-current opacity-30" />
                      <div className="w-6 h-6 rounded bg-current opacity-30" />
                      <div className="w-6 h-6 rounded bg-current opacity-30" />
                    </div>
                  </div>
                  {/* Login Preview */}
                  <div
                    className="flex-1 p-8 flex flex-col items-center justify-center"
                    style={{ background: previewLoginBg }}
                  >
                  {previewLogoLoginUrl ? (
                    <img src={previewLogoLoginUrl} alt="Preview" className="h-16 mb-4 object-contain" />
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
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleRestoreDefaults} data-testid="button-restore-defaults">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão do sistema
          </Button>
          <Button onClick={handleSave} disabled={isSavingAll} size="lg" data-testid="button-save-branding">
            {isSavingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar tudo
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor de logo estilo WhatsApp — abre quando um arquivo de imagem (não-SVG) é selecionado */}
      <LogoCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        file={cropperRawFile}
        // Logo do menu lateral e da tela de login: aspecto retangular largo (4:1)
        // Favicon: quadrado (1:1)
        aspectRatio={cropperTarget === "favicon" ? 1 : 4}
        outputWidth={cropperTarget === "favicon" ? 256 : 1024}
        outputHeight={cropperTarget === "favicon" ? 256 : undefined}
        title={
          cropperTarget === "sidebar" ? "Ajustar Logo do Menu Lateral" :
          cropperTarget === "sidebar-dark" ? "Ajustar Logo do Tema Escuro" :
          cropperTarget === "login" ? "Ajustar Logo da Tela de Login" :
          cropperTarget === "favicon" ? "Ajustar Favicon" :
          "Ajustar imagem"
        }
        onConfirm={handleCropperConfirm}
      />
    </div>
  );
}
