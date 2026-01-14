import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiRequest, queryClient } from "./queryClient";
import type { User, ModuleName } from "@shared/schema";
import { MODULE_SUB_ITEMS, parsePermissionKey, getSubItemPermissionKey } from "@shared/schema";

// Mapa de permissões por módulo (suporta chaves de módulo e sub-itens)
export type PermissionsMap = Record<string, { canView: boolean; canEdit: boolean; canDelegate: boolean }>;

interface AuthContextType {
  user: User | null;
  permissions: PermissionsMap;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasModuleAccess: (module: ModuleName, accessType?: "view" | "edit" | "delegate") => boolean;
  hasSubItemAccess: (module: ModuleName, subItem: string, accessType?: "view" | "edit" | "delegate") => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setPermissions(data.permissions || {});
      } else {
        setUser(null);
        setPermissions({});
      }
    } catch (error) {
      setUser(null);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await response.json();
    setUser(data.user);
    // Após login, recarregar permissões
    await checkAuth();
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
    setPermissions({});
    // Invalidate tenant cache to force refetch with new session state
    queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
  };

  // Helper para verificar permissão dada a chave e tipo de acesso
  const checkPermission = (permKey: string, accessType: "view" | "edit" | "delegate"): boolean => {
    const perm = permissions[permKey];
    if (!perm) return false;
    
    switch (accessType) {
      case "view":
        return perm.canView || perm.canEdit || perm.canDelegate;
      case "edit":
        return perm.canEdit || perm.canDelegate;
      case "delegate":
        return perm.canDelegate;
      default:
        return false;
    }
  };

  // Função helper para verificar acesso a módulos
  // REFACTORED: Agora usa exclusivamente isMaster flag + permissões de perfil
  // Não há mais herança baseada em role
  // Retorna true se pelo menos um sub-item do módulo tiver a permissão solicitada
  const hasModuleAccess = (module: ModuleName, accessType: "view" | "edit" | "delegate" = "view"): boolean => {
    // isMaster sempre tem acesso total a todos os módulos
    if (user?.isMaster) {
      return true;
    }
    
    // Primeiro, verifica permissão legacy no nível do módulo
    if (checkPermission(module, accessType)) {
      return true;
    }
    
    // Verifica se algum sub-item tem a permissão
    const subItems = MODULE_SUB_ITEMS[module];
    if (subItems) {
      for (const item of subItems) {
        const subItemKey = getSubItemPermissionKey(module, item.key);
        if (checkPermission(subItemKey, accessType)) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Nova função para verificar acesso a sub-itens específicos
  // Retrocompatível: se não houver permissão de sub-item, usa a permissão do módulo pai
  const hasSubItemAccess = (module: ModuleName, subItem: string, accessType: "view" | "edit" | "delegate" = "view"): boolean => {
    // isMaster sempre tem acesso total
    if (user?.isMaster) {
      return true;
    }
    
    // Primeiro, verifica permissão específica do sub-item
    const subItemKey = getSubItemPermissionKey(module, subItem);
    if (permissions[subItemKey]) {
      return checkPermission(subItemKey, accessType);
    }
    
    // Fallback: usa permissão do módulo pai (retrocompatibilidade)
    return checkPermission(module, accessType);
  };

  return (
    <AuthContext.Provider value={{ user, permissions, isLoading, login, logout, checkAuth, hasModuleAccess, hasSubItemAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
