'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type AuthUser } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  hasUsers: boolean | null; // for first-run UX on /login → /signup redirect
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [{ user: u }, status] = await Promise.all([
        api.auth.me().catch(() => ({ user: null })),
        api.auth.bootstrapStatus().catch(() => ({ hasUsers: true })),
      ]);
      setUser(u);
      setHasUsers(status.hasUsers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // The api client dispatches `jp:unauthorized` on any 401 response — wipe
  // state and let AuthGate redirect.
  useEffect(() => {
    const onUnauth = () => setUser(null);
    window.addEventListener('jp:unauthorized', onUnauth);
    return () => window.removeEventListener('jp:unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setUser(res.user);
    setHasUsers(true);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const res = await api.auth.signup({ email, password });
    setUser(res.user);
    setHasUsers(true);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, hasUsers, login, signup, logout, refresh }),
    [user, loading, hasUsers, login, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
