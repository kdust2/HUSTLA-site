import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';

export type Mode = 'worker' | 'publisher';
const KEY = 'hustla-mode';

// Some pages only make sense in one mode, so the page itself decides which mode you are in.
function modeForRoute(path: string): Mode | null {
  if (path.startsWith('/explore')) return 'worker';
  if (path.startsWith('/new-campaign') || path.startsWith('/campaigns')) return 'publisher';
  return null;
}

type ModeCtx = { mode: Mode; setMode: (mode: Mode) => void };
const Ctx = createContext<ModeCtx | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [stored, setStored] = useState<Mode>(() => {
    if (window.location.hash === '#publisher') return 'publisher';
    try { return window.localStorage.getItem(KEY) === 'publisher' ? 'publisher' : 'worker'; } catch { return 'worker'; }
  });
  const forced = modeForRoute(location);

  // Visiting a mode-specific page makes that the remembered mode (so the dashboard matches afterwards).
  useEffect(() => { if (forced) setStored(forced); }, [forced]);
  useEffect(() => { try { window.localStorage.setItem(KEY, stored); } catch { /* storage can be unavailable */ } }, [stored]);

  const mode = forced ?? stored;
  const setMode = useCallback((next: Mode) => {
    setStored(next);
    // On a page that belongs to the other mode, switching sends you to the dashboard in the new mode.
    const here = modeForRoute(location);
    if (here && here !== next) setLocation('/dashboard');
  }, [location, setLocation]);

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function useMode(): ModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMode must be used inside ModeProvider');
  return ctx;
}
