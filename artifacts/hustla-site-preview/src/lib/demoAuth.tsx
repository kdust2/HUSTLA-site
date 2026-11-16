import { createContext, useContext, useState, type ReactNode } from 'react';

type DemoUser = { name: string; email: string };
type DemoAuth = {
  user: DemoUser | null;
  isSignedIn: boolean;
  signIn: (name: string, email: string) => void;
  signOut: () => void;
};

const KEY = 'hustla-demo-user';
const Ctx = createContext<DemoAuth | null>(null);

function load(): DemoUser | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(load);
  const signIn = (name: string, email: string) => {
    const next = { name: name.trim() || 'Demo User', email: email.trim() };
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage can be unavailable */ }
    setUser(next);
  };
  const signOut = () => {
    try { window.localStorage.removeItem(KEY); } catch { /* storage can be unavailable */ }
    setUser(null);
  };
  return <Ctx.Provider value={{ user, isSignedIn: !!user, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useDemoAuth(): DemoAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDemoAuth must be used inside DemoAuthProvider');
  return ctx;
}
