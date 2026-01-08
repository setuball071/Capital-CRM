import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import type { User, ModuleName } from "@shared/schema";

// Mapa de permissões por módulo
export type PermissionsMap = Record<string, { canView: boolean; canEdit: boolean; canDelegate: boolean }>;

interface AuthContextType {
  user: User | null;
  permissions: PermissionsMap;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasModuleAccess: (module: ModuleName, accessType?: "view" | "edit" | "delegate") => boolean;
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
  };

  // Função helper para verificar acesso a módulos
  // REFACTORED: Agora usa exclusivamente isMaster flag + permissões de perfil
  // Não há mais herança baseada em role
  const hasModuleAccess = (module: ModuleName, accessType: "view" | "edit" | "delegate" = "view"): boolean => {
    // isMaster sempre tem acesso total a todos os módulos
    if (user?.isMaster) {
      return true;
    }
    
    // Para todos os outros usuários, verificar permissões baseadas no perfil
    const perm = permissions[module];
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

  return (
    <AuthContext.Provider value={{ user, permissions, isLoading, login, logout, checkAuth, hasModuleAccess }}>
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
