import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, authToken, type LoginPayload } from '@/services/auth';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const result = await loginRequest(payload);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      authToken.clear();
      setUser(null);
    };
    window.addEventListener('fleet:auth-expired', handleExpired);
    return () => window.removeEventListener('fleet:auth-expired', handleExpired);
  }, []);

  useEffect(() => {
    if (!authToken.get()) return;
    setIsLoading(true);
    getCurrentUser()
      .then(setUser)
      .catch(() => authToken.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isLoading, login, logout }), [user, isLoading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}