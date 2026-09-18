/**
 * AuthContext — Secure authentication state management.
 * 
 * SECURITY NOTES:
 * - Authentication is handled via HttpOnly cookies managed by the backend.
 * - NO tokens, passwords, or session IDs are stored in localStorage/sessionStorage.
 * - The frontend NEVER makes security decisions — the backend is authoritative.
 * - This context only caches the current user profile for UI display purposes.
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authApi, type AuthUser, type ApiError } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requireMFA: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; requireMFA?: boolean; error?: string }>;
  verifyMFA: (token: string) => Promise<{ success: boolean; error?: string }>;
  recoverMFA: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requireMFA, setRequireMFA] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: check if there's an existing valid session via the backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.getSession();
        if (!cancelled && data.user) {
          setUser(data.user);
        }
      } catch {
        // No valid session — user needs to log in
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await authApi.login(username, password);

      if (data.requireMFA) {
        setRequireMFA(true);
        setIsLoading(false);
        return { success: true, requireMFA: true };
      }

      if (data.user) {
        setUser(data.user);
        setRequireMFA(false);
      }
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      const apiErr = err as ApiError;
      const message = apiErr.message || 'Authentication failed';
      setError(message);
      setIsLoading(false);
      return { success: false, error: message };
    }
  }, []);

  const verifyMFA = useCallback(async (token: string) => {
    setError(null);
    try {
      const data = await authApi.verifyMFA(token);
      if (data.user) {
        setUser(data.user);
        setRequireMFA(false);
      }
      return { success: true };
    } catch (err) {
      const message = (err as ApiError).message || 'MFA verification failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const recoverMFA = useCallback(async (code: string) => {
    setError(null);
    try {
      const data = await authApi.recoveryMFA(code);
      if (data.user) {
        setUser(data.user);
        setRequireMFA(false);
      }
      return { success: true };
    } catch (err) {
      const message = (err as ApiError).message || 'Recovery code invalid';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if logout API fails, clear local state
    }
    setUser(null);
    setRequireMFA(false);
    setError(null);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch { }
    setUser(null);
    setRequireMFA(false);
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await authApi.getSession();
      if (data.user) setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback((permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  }, [user]);

  const hasAnyPermission = useCallback((...permissions: string[]) => {
    return permissions.some(p => user?.permissions?.includes(p) ?? false);
  }, [user]);

  const hasRole = useCallback((...roles: string[]) => {
    return roles.includes(user?.role ?? '');
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      requireMFA,
      error,
      login,
      verifyMFA,
      recoverMFA,
      logout,
      logoutAll,
      refreshSession,
      hasPermission,
      hasAnyPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
