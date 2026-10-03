// Theme: a preference (system / light / dark) and the resolved theme actually shown.
// The preference is cached in localStorage so index.html can apply it before first paint.
// Phase 2 also saves it to the settings table so it follows you across devices.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemePref } from '../domain/types';

const STORAGE_KEY = 'cadence.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

interface ThemeContextValue {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Storage can be blocked (private mode). Fall back to the system setting.
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const m = media();
    const onChange = () => setSystemDark(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      pref,
      resolved,
      setPref: (p) => {
        setPrefState(p);
        try {
          localStorage.setItem(STORAGE_KEY, p);
        } catch {
          // Ignore: the choice still applies for this session.
        }
      },
    }),
    [pref, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
