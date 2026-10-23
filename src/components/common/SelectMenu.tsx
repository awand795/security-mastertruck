import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectMenuOption {
  value: string;
  label: string;
  /** Judul kelompok; opsi dengan group yang sama ditampilkan berurutan. */
  group?: string;
  /** Baris bantu di bawah label (opsional). */
  hint?: string;
}

interface SelectMenuProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  buttonClassName?: string;
  'aria-labelledby'?: string;
}

interface PanelRect {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;
const MAX_PANEL_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 120;

/**
 * SelectMenu — dropdown kustom untuk form (portal, selalu membuka ke bawah
 * dengan fallback ke atas, tinggi panel dibatasi agar tetap di viewport).
 * Diadaptasi dari SelectMenu milik Web Fleet Customer (Bengkel-Kim3).
 */
export const SelectMenu: React.FC<SelectMenuProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Cari…',
  emptyMessage = 'Data tidak ditemukan',
  className = '',
  buttonClassName = '',
  'aria-labelledby': ariaLabelledBy,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  // Kelompokkan opsi berurutan agar judul grup tidak muncul berulang.
  const grouped = useMemo(() => {
    const out: { group: string; items: { option: SelectMenuOption; index: number }[] }[] = [];
    filtered.forEach((option, index) => {
      const group = option.group || '';
      const last = out[out.length - 1];
      if (last && last.group === group) {
        last.items.push({ option, index });
      } else {
        out.push({ group, items: [{ option, index }] });
      }
    });
    return out;
  }, [filtered]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;

    // Utamakan buka ke bawah. Hanya balik ke atas jika ruang bawah sempit.
    const openUp = spaceBelow < MIN_PANEL_HEIGHT / 2 && spaceAbove > spaceBelow;

    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, available));

    const width = Math.min(Math.max(rect.width, 180), viewportW - VIEWPORT_MARGIN * 2);
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, viewportW - width - VIEWPORT_MARGIN)
    );

    if (openUp) {
      setPanelRect({
        left,
        width,
        bottom: viewportH - rect.top + GAP,
        maxHeight,
      });
      return;
    }

    const top = Math.min(rect.bottom + GAP, viewportH - VIEWPORT_MARGIN - maxHeight);
    setPanelRect({ left, width, top: Math.max(VIEWPORT_MARGIN, top), maxHeight });
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (next: string) => {
      onChange(next);
      close(true);
    },
    [onChange, close]
  );

  // Posisi panel: ikut bergeser saat body di-scroll atau window di-resize.
  useEffect(() => {
    if (!open) {
      setPanelRect(null);
      return;
    }
    updatePosition();
    const onMove = () => updatePosition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, updatePosition]);

  // Klik di luar & Escape tidak boleh menutup halaman induk.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((o) => o.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, filtered]);

  const openPanel = () => {
    if (disabled) return;
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
      if (spaceBelow < MIN_PANEL_HEIGHT) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }
    updatePosition();
    setOpen(true);
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    const fromSearchInput = e.target === searchRef.current;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setActiveIndex((i) =>
        e.key === 'ArrowDown'
          ? Math.min(filtered.length - 1, i + 1)
          : Math.max(0, i - 1)
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) commit(opt.value);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setActiveIndex(e.key === 'Home' ? 0 : filtered.length - 1);
      return;
    }
    if (e.key === 'Tab') {
      close();
      return;
    }
    if (fromSearchInput) return;
    if (searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setQuery((q) => q + e.key);
      searchRef.current?.focus();
    } else if (searchable && e.key === 'Backspace') {
      setQuery((q) => q.slice(0, -1));
      searchRef.current?.focus();
    }
  };

  const panel = panelRect
    ? createPortal(
        <div
          ref={panelRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={ariaLabelledBy}
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'fixed',
            left: panelRect.left,
            top: panelRect.top,
            bottom: panelRect.bottom,
            width: panelRect.width,
            maxHeight: panelRect.maxHeight,
            zIndex: 100,
          }}
          className="flex flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl ring-1 ring-black/5 focus:outline-hidden"
        >
          {searchable && (
            <div className="shrink-0 border-b border-[#E2E8F0] p-2">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] py-1.5 pr-2.5 pl-8 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#12388F] focus:bg-white focus:ring-2 focus:ring-[#12388F]/30 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-4 text-center text-xs text-[#94A3B8]">{emptyMessage}</p>
            )}

            {grouped.map((section) => (
              <div
                key={section.group || '__default'}
                role="group"
                aria-label={section.group || undefined}
              >
                {section.group && (
                  <p
                    aria-hidden="true"
                    className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]"
                  >
                    {section.group}
                  </p>
                )}
                {section.items.map(({ option, index }) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-option-index={index}
                      onClick={() => commit(option.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                        isActive ? 'bg-[#EEF2F9] text-[#12388F]' : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                      } ${isSelected ? 'font-bold' : ''}`}
                    >
                      <span className="truncate">{option.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {option.hint && (
                          <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {option.hint}
                          </span>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (disabled) return;
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-left text-sm font-medium transition focus:border-[#12388F] focus:ring-2 focus:ring-[#12388F]/15 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'ring-2 ring-[#12388F]/15' : ''
        } ${selected ? 'text-[#0F172A]' : 'text-[#94A3B8]'} ${buttonClassName}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {panel}
    </div>
  );
};

export default SelectMenu;
