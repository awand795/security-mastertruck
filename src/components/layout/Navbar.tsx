import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut as ExitIcon, X, ShieldCheck, ChevronRight } from 'lucide-react';
import { useSecurityStore } from '../../store/useSecurityStore';
import { ThemeToggle, ThemeSegmented } from './ThemeToggle';
import { SecurityTab } from './MobileBottomNav';

interface NavbarProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

const TAB_TITLES: Record<SecurityTab, { title: string; subtitle: string; crumb: string }> = {
  'check-in': {
    title: 'Pemeriksaan Masuk',
    subtitle: 'Check In Armada Gerbang',
    crumb: 'Check In',
  },
  'check-out': {
    title: 'Pemeriksaan Keluar',
    subtitle: 'Validasi Fisik & Check Out',
    crumb: 'Check Out',
  },
  'active-inside': {
    title: 'Kendaraan di Dalam Bengkel',
    subtitle: 'Live Monitoring Armada Aktif',
    crumb: 'Kendaraan di Dalam',
  },
  'today-exit': {
    title: 'Kendaraan Keluar Hari Ini',
    subtitle: 'Riwayat Armada Keluar Hari Ini',
    crumb: 'Keluar Hari Ini',
  },
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab }) => {
  const { user, profile, logout, kodeCabang, namaCabang } = useSecurityStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const currentInfo = TAB_TITLES[activeTab] || {
    title: 'Pos Security KIM 3',
    subtitle: 'Gate Control Management',
    crumb: 'Pos Gerbang',
  };

  return (
    <>
      <header className="glass-bar safe-top sticky top-0 z-40 shrink-0 border-b font-sans">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
          {/* Kiri */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile & tablet: logo + nama pos dalam satu baris */}
            <div className="flex min-w-0 items-center gap-2.5 xl:hidden">
              <span className="flex shrink-0 items-center rounded-lg border border-border-dark bg-surface-dark px-2 py-1 shadow-sm">
                <img
                  src="/master-truck-logo.png"
                  alt="Master Truck Logo"
                  className="h-6 w-auto object-contain"
                />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold tracking-tight text-ink">
                  Pos Gerbang
                </span>
                <span className="truncate text-[10px] font-semibold text-accent">
                  {kodeCabang && namaCabang ? `${kodeCabang} • ${namaCabang}` : (namaCabang || user?.company || 'BENGKEL MASTER TRUK')}
                </span>
              </div>
            </div>

            {/* Desktop: breadcrumb + judul halaman (logo sudah ada di sidebar) */}
            <div className="hidden min-w-0 xl:block">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1.5 text-[11px] font-medium leading-none text-ink-subtle"
              >
                <span>Pos Gerbang</span>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <span className="text-accent">{currentInfo.crumb}</span>
              </nav>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="truncate text-base font-bold leading-tight tracking-tight text-ink">
                  {currentInfo.title}
                </h1>
                <span className="hidden shrink-0 items-center rounded-full border border-accent/20 bg-accent-subtle px-2 py-0.5 text-[10px] font-bold text-accent lg:inline-flex">
                  {kodeCabang && namaCabang ? `Cabang: ${kodeCabang} - ${namaCabang}` : `Cabang: ${namaCabang || user?.company || 'BENGKEL MASTER TRUK'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Kanan: toggle tema + avatar profil */}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="Buka profil petugas"
              className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-raised px-1.5 transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-on">
                {user?.nama?.charAt(0)?.toUpperCase() || 'S'}
              </span>
              <span className="hidden max-w-[140px] flex-col items-start leading-tight md:flex">
                <span className="truncate text-xs font-bold text-ink">
                  {user?.nama || 'Petugas Security'}
                </span>
                <span className="truncate text-[10px] text-ink-subtle">
                  {profile?.userid || 'Pos Security'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Profil: bottom sheet di mobile, kartu terpusat di desktop */}
      {profileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
            <div
              className="app-backdrop-in absolute inset-0 bg-overlay backdrop-blur-sm"
              onClick={() => setProfileOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Profil petugas security"
              className="app-modal-in relative w-full rounded-t-3xl border border-border bg-surface-raised px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-pop sm:mx-4 sm:mb-0 sm:max-w-sm sm:rounded-2xl sm:pb-5 sm:pt-5"
            >
              {/* Handle sheet (hanya mobile) */}
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Tutup profil"
                className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center border-b border-border pb-4 text-center">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-on shadow-card">
                  {user?.nama?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <h3 className="text-base font-bold text-ink">{user?.nama || 'Petugas Security'}</h3>
                <p className="text-xs text-ink-muted">Pos Gerbang Bengkel Master Truck KIM 3</p>
              </div>

              <dl className="space-y-2 border-b border-border py-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">User ID / Akun</dt>
                  <dd className="font-mono font-bold text-ink">
                    {profile?.userid || user?.userid || 'adminPOS'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Perusahaan</dt>
                  <dd className="truncate font-semibold text-ink">
                    {profile?.usercompany || 'BENGKEL MASTER TRUK'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Cabang / Pos</dt>
                  <dd className="truncate font-bold text-accent">
                    {kodeCabang && namaCabang ? `${kodeCabang} - ${namaCabang}` : (namaCabang || user?.company || 'BENGKEL MASTER TRUK')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Role / Otoritas</dt>
                  <dd className="font-bold text-accent">{profile?.role || user?.role || 'SECURITY'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Status Token</dt>
                  <dd className="inline-flex items-center gap-1.5 font-semibold text-status-green">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Tersambung (DarkoPOS)
                  </dd>
                </div>
              </dl>

              <div className="py-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                  Tema Tampilan
                </p>
                <ThemeSegmented />
              </div>

              <button
                type="button"
                onClick={logout}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-status-red-fill px-4 py-3.5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red/50 active:scale-[0.98]"
              >
                <ExitIcon className="h-4 w-4" />
                Keluar dari Akun
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
