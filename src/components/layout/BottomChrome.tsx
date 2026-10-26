import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileBottomNav, SecurityTab } from './MobileBottomNav';
import { ACTION_DESKTOP, ACTION_SLOT } from '../../styles/ui';

/**
 * BottomChrome = satu kontainer fixed di bawah layar (hanya < xl) yang menampung
 * dua slot bertumpuk TANPA celah:
 *   [slot aksi halaman (opsional)]  -> diisi lewat <PageAction>
 *   [tab bar navigasi]              -> MobileBottomNav
 * Keduanya berbagi satu background glass + blur dan satu border-top,
 * sehingga konten area scroll tidak pernah tembus di antara tombol aksi dan tab bar.
 *
 * Tinggi chrome diukur dengan ResizeObserver lalu ditulis ke CSS variable
 * `--bottom-chrome-h` (dipakai App.tsx untuk padding bawah area scroll).
 */

/** Layar compact = mobile & tablet (< 1280px). */
export const useIsCompact = (): boolean => {
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(min-width: 1280px)').matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(min-width: 1280px)');
    const handleChange = () => setIsCompact(!media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isCompact;
};

interface BottomChromeState {
  /** DOM node slot aksi (diisi BottomChrome, dibaca PageAction). */
  slot: HTMLDivElement | null;
  setSlot: (node: HTMLDivElement | null) => void;
  /** true bila ada halaman yang menaruh aksi di slot (dipakai chrome untuk tampil/sembunyi). */
  hasAction: boolean;
  setHasAction: (value: boolean) => void;
}

const BottomChromeContext = createContext<BottomChromeState>({
  slot: null,
  setSlot: () => undefined,
  hasAction: false,
  setHasAction: () => undefined,
});

export const useBottomChrome = (): BottomChromeState => useContext(BottomChromeContext);

/** Membungkus seluruh aplikasi agar slot BottomChrome terbaca oleh halaman. */
export const BottomChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [hasAction, setHasAction] = useState(false);

  const value = React.useMemo(
    () => ({ slot, setSlot, hasAction, setHasAction }),
    [slot, hasAction]
  );

  return <BottomChromeContext.Provider value={value}>{children}</BottomChromeContext.Provider>;
};

interface BottomChromeProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

export const BottomChrome: React.FC<BottomChromeProps> = ({ activeTab, onChangeTab }) => {
  const isCompact = useIsCompact();
  const { slot, setSlot, hasAction, setHasAction } = useBottomChrome();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hideTabs, setHideTabs] = useState(false);

  // 1) Ukur tinggi chrome -> --bottom-chrome-h
  useEffect(() => {
    if (!isCompact) {
      document.documentElement.style.removeProperty('--bottom-chrome-h');
      return;
    }
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      document.documentElement.style.setProperty(
        '--bottom-chrome-h',
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--bottom-chrome-h');
    };
  }, [isCompact]);

  // 2) Keyboard virtual: sembunyikan tab bar, sisakan slot aksi.
  useEffect(() => {
    if (!isCompact) {
      setHideTabs(false);
      return;
    }
    const viewport = window.visualViewport;
    const isTouch = !!window.matchMedia?.('(pointer: coarse)').matches;

    const update = () => {
      const shrink = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const open = isTouch && shrink > 150;
      document.documentElement.style.setProperty(
        '--keyboard-offset',
        `${open ? Math.round(shrink) : 0}px`
      );
      setHideTabs(open);
    };

    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      setHideTabs(false);
    };
  }, [isCompact]);

  // Chrome kosong (tanpa aksi & tanpa tab bar) -> tanpa background/border
  // agar tingginya menyusut jadi ~0 dan padding scroll ikut mengecil.
  const bare = hideTabs && !hasAction;

  if (!isCompact) return null;

  return (
    <div
      ref={rootRef}
      style={{ bottom: 'var(--keyboard-offset, 0px)' }}
      className={`fixed inset-x-0 z-40 pb-[env(safe-area-inset-bottom,0px)] xl:hidden ${
        bare ? 'border-0' : 'glass-bar border-t'
      }`}
    >
      {/* Slot aksi halaman (diisi lewat <PageAction/>) */}
      <div ref={setSlot} />

      {/* Tab bar: hilang saat keyboard terbuka */}
      {!hideTabs && <MobileBottomNav activeTab={activeTab} onChangeTab={onChangeTab} />}
    </div>
  );
};

interface PageActionProps {
  children: React.ReactNode;
}

/**
 * Aksi utama satu layar.
 * - < xl : dirender ke slot BottomChrome (menempel di atas tab bar, tanpa celah)
 * - >= xl: menempel di bawah area scroll seperti sticky biasa
 */
export const PageAction: React.FC<PageActionProps> = ({ children }) => {
  const isCompact = useIsCompact();
  const { slot, setHasAction } = useBottomChrome();

  useEffect(() => {
    if (!isCompact) return;
    setHasAction(true);
    return () => setHasAction(false);
  }, [isCompact, setHasAction]);

  if (isCompact && slot) {
    return createPortal(<div className={ACTION_SLOT}>{children}</div>, slot);
  }

  // Fallback (desktop, atau 1 frame pertama sebelum slot terpasang)
  return <div className={ACTION_DESKTOP}>{children}</div>;
};

export default BottomChrome;
