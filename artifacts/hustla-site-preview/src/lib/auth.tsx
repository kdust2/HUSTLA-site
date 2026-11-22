import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiUser } from '@/lib/api';

type Auth = {
  user: ApiUser | null;
  loading: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<ApiUser>;
  signUp: (input: { name: string; email: string; password: string; adminCode?: string }) => Promise<ApiUser>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ user: ApiUser | null }>('/auth/me')
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: ApiUser }>('/auth/signin', { body: { email, password } });
    setUser(data.user);
    return data.user;
  }, []);
  const signUp = useCallback(async (input: { name: string; email: string; password: string; adminCode?: string }) => {
    const data = await api<{ user: ApiUser }>('/auth/signup', { body: input });
    setUser(data.user);
    return data.user;
  }, []);
  const signOut = useCallback(async () => {
    try { await api('/auth/signout', { method: 'POST', body: {} }); } catch { /* cookie may already be gone */ }
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, isSignedIn: !!user, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
