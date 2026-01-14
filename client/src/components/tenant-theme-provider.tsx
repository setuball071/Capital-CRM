import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface TenantTheme {
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  surface?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  card?: string;
  cardForeground?: string;
  sidebar?: string;
  sidebarForeground?: string;
  radius?: string;
}

interface TenantBranding {
  id: number;
  key: string;
  name: string;
  logoUrl: string | null;
  logoLoginUrl: string | null;
  faviconUrl: string | null;
  logoHeight: number | null;
  slogan: string | null;
  fontFamily: string | null;
  theme: TenantTheme | null;
}

interface TenantApiResponse {
  id?: number;
  key?: string;
  name?: string;
  logoUrl?: string | null;
  logoLoginUrl?: string | null;
  faviconUrl?: string | null;
  logoHeight?: number | null;
  slogan?: string | null;
  fontFamily?: string | null;
  theme?: TenantTheme | null;
  tenant?: null;
  development?: boolean;
  message?: string;
}

interface TenantContextValue {
  tenant: TenantBranding | null;
  isLoading: boolean;
  logoUrl: string;
  logoLoginUrl: string;
  faviconUrl: string;
  logoHeight: number;
  slogan: string;
  fontFamily: string;
  loginBgColor: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  welcomeText: string;
  footerText: string;
  showSlogan: boolean;
  showSystemName: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);


function hexToHsl(hex: string): string | null {
  if (!hex || !hex.startsWith("#")) return null;
  
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
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function parseColor(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("#")) {
    return hexToHsl(value);
  }
  if (/^\d+\s+\d+%?\s+\d+%?$/.test(value.trim())) {
    return value;
  }
  return null;
}

function applyThemeVariables(theme: TenantTheme) {
  const root = document.documentElement;
  
  const mappings: Record<string, keyof TenantTheme> = {
    "--primary": "primary",
    "--primary-foreground": "primaryForeground",
    "--accent": "accent",
    "--accent-foreground": "accentForeground",
    "--background": "background",
    "--foreground": "foreground",
    "--muted": "muted",
    "--muted-foreground": "mutedForeground",
    "--border": "border",
    "--card": "card",
    "--card-foreground": "cardForeground",
    "--sidebar": "sidebar",
    "--sidebar-foreground": "sidebarForeground",
  };
  
  Object.entries(mappings).forEach(([cssVar, themeKey]) => {
    const value = parseColor(theme[themeKey]);
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
  
  if (theme.radius) {
    root.style.setProperty("--radius", theme.radius);
  }
  
  if (theme.surface) {
    const surfaceHsl = parseColor(theme.surface);
    if (surfaceHsl) {
      root.style.setProperty("--card", surfaceHsl);
      root.style.setProperty("--popover", surfaceHsl);
    }
  }
}

function updateFavicon(url: string) {
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

export function TenantThemeProvider({ children }: { children: React.ReactNode }) {
  const [appliedTheme, setAppliedTheme] = useState(false);
  
  const { data: rawData, isLoading } = useQuery<TenantApiResponse>({
    queryKey: ["/api/tenant", window.location.host],
    queryFn: async () => {
      // Add cache-busting headers to ensure fresh response after login/logout
      const res = await fetch("/api/tenant", { 
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      if (!res.ok) {
        return null as unknown as TenantApiResponse;
      }
      return res.json();
    },
    retry: 1,
    staleTime: 0, // Always refetch to ensure correct tenant per domain
    refetchOnMount: "always",
  });
  
  const tenant: TenantBranding | null = rawData?.id ? {
    id: rawData.id,
    key: rawData.key || "",
    name: rawData.name || "",
    logoUrl: rawData.logoUrl || null,
    logoLoginUrl: rawData.logoLoginUrl || null,
    faviconUrl: rawData.faviconUrl || null,
    logoHeight: rawData.logoHeight || null,
    slogan: rawData.slogan || null,
    fontFamily: rawData.fontFamily || null,
    theme: rawData.theme || null,
  } : null;
  
  const logoUrl = tenant?.logoUrl || "/branding/logo.png";
  const logoLoginUrl = tenant?.logoLoginUrl || tenant?.logoUrl || "/branding/logo.png";
  const faviconUrl = tenant?.faviconUrl || "/branding/favicon.png";
  const logoHeight = tenant?.logoHeight || 64;
  const slogan = tenant?.slogan || "";
  const fontFamily = tenant?.fontFamily || "Inter";
  
  const themeData = tenant?.theme as any;
  const loginBgColor = themeData?.loginBgColor || "#1e293b";
  const primaryColor = themeData?.primaryColor || "#3b82f6";
  const secondaryColor = themeData?.secondaryColor || "#10b981";
  const textColor = themeData?.textColor || "#1f2937";
  const welcomeText = themeData?.welcomeText || "";
  const footerText = themeData?.footerText || "";
  const showSlogan = themeData?.showSlogan !== false;
  const showSystemName = themeData?.showSystemName !== false;
  
  useEffect(() => {
    if (isLoading) return;
    
    if (tenant?.theme) {
      applyThemeVariables(tenant.theme);
    }
    setAppliedTheme(true);
  }, [tenant, isLoading]);
  
  useEffect(() => {
    if (faviconUrl) {
      updateFavicon(faviconUrl);
    }
  }, [faviconUrl]);
  
  useEffect(() => {
    // Update document title based on tenant data
    // Use name, or fall back to key, or default to "Sistema"
    if (rawData?.id) {
      const title = rawData.name || rawData.key || "Sistema";
      document.title = title;
    }
  }, [rawData?.id, rawData?.name, rawData?.key]);
  
  return (
    <TenantContext.Provider value={{ 
      tenant: tenant || null, 
      isLoading, 
      logoUrl, 
      logoLoginUrl,
      faviconUrl,
      logoHeight,
      slogan,
      fontFamily,
      loginBgColor,
      primaryColor,
      secondaryColor,
      textColor,
      welcomeText,
      footerText,
      showSlogan,
      showSystemName,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantThemeProvider");
  }
  return context;
}
