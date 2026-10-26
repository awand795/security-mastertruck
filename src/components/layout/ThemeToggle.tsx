import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, ThemeMode } from '../../store/useThemeStore';

const MODE_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

const MODE_META: Record<ThemeMode, { label: string; Icon: React.ElementType }> = {
  system: { label: 'Tema otomatis', Icon: Monitor },
  light: { label: 'Mode terang', Icon: Sun },
  dark: { label: 'Mode gelap', Icon: Moon },
};

const nextMode = (current: ThemeMode): ThemeMode =>
  MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length];

interface ThemeToggleProps {
  /** Ukuran tombol ikon di header */
  className?: string;
}

/** Tombol ikon: berputar Otomatis -> Terang -> Gelap. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const meta = MODE_META[mode] || MODE_META.system;
  const Icon = meta.Icon;

  return (
    <button
      type="button"
      onClick={() => {
        navigator.vibrate?.(8);
        setMode(nextMode(mode));
      }}
      title={`${meta.label} (klik untuk ganti tema)`}
      aria-label={`${meta.label}, klik untuk mengganti tema`}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-raised text-ink-muted transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95 ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
    </button>
  );
};

interface ThemeSegmentedProps {
  /** Mode ringkas untuk sidebar: ikon saja, label dipindah ke tooltip/sr-only. */
  compact?: boolean;
}

const shortLabel = (mode: ThemeMode): string =>
  mode === 'system' ? 'Otomatis' : mode === 'light' ? 'Terang' : 'Gelap';

/** Pilihan tema 3 segmen (Terang / Gelap / Otomatis). */
export const ThemeSegmented: React.FC<ThemeSegmentedProps> = ({ compact = false }) => {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-sunken p-1"
    >
      {MODE_ORDER.map((item) => {
        const meta = MODE_META[item];
        const Icon = meta.Icon;
        const isActive = mode === item;

        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={shortLabel(item)}
            onClick={() => {
              navigator.vibrate?.(6);
              setMode(item);
            }}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95 ${
              compact ? 'min-h-9 px-1' : 'min-h-11 px-2'
            } ${
              isActive
                ? 'bg-surface-raised text-accent shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span className={compact ? 'sr-only' : ''}>{shortLabel(item)}</span>
          </button>
        );
      })}
    </div>
  );
};
