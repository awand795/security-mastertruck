import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'kim3-gate-theme';

export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const resolveTheme = (mode: ThemeMode): 'light' | 'dark' =>
  mode === 'system' ? getSystemTheme() : mode;

/** Terapkan tema ke <html> (class dark, color-scheme, meta theme-color). */
export const applyTheme = (mode?: ThemeMode): 'light' | 'dark' => {
  const activeMode = mode ?? useThemeStore.getState().mode;
  const resolved = resolveTheme(activeMode);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? '#070F1E' : '#EEF2F7');
    }
  }

  return resolved;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'light' as ThemeMode,
      setMode: (mode: ThemeMode) => {
        set({ mode });
        applyTheme(mode);
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      migrate: (persisted: any, version: number) =>
        version < 1 ? { ...persisted, mode: 'light' } : persisted,
    }
  )
);
