import React from 'react';
import { LogIn, LogOut, FileText, ShieldCheck } from 'lucide-react';
import { SecurityTab } from './MobileBottomNav';
import { ThemeSegmented } from './ThemeToggle';
import { useSecurityStore } from '../../store/useSecurityStore';

interface SidebarProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

export interface NavItem {
  id: SecurityTab;
  label: string;
  icon: any;
}

/**
 * Sidebar desktop (>= 1280px): brand, navigasi dengan indikator aktif,
 * serta kartu petugas (profil, tema, keluar).
 */
export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onChangeTab }) => {
  const { user, profile, logout, kodeCabang, namaCabang } = useSecurityStore();

  const navigationItems: NavItem[] = [
    { id: 'check-in', label: 'Check In', icon: LogIn },
    { id: 'check-out', label: 'Check Out', icon: LogOut },
    { id: 'memo-keluar', label: 'Memo Keluar', icon: FileText },
  ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface-raised xl:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="flex shrink-0 items-center rounded-xl border border-border-dark bg-surface-dark px-2 py-1.5 shadow-sm">
          <img
            src="/master-truck-logo.png"
            alt="Master Truck Logo"
            className="h-7 w-auto object-contain"
          />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold tracking-tight text-ink">Pos Gerbang</p>
          <p className="truncate text-[11px] font-semibold text-accent">
            {kodeCabang ? `${kodeCabang} - ${namaCabang}` : '011 - CELENTANG'}
          </p>
        </div>
      </div>

      {/* Navigasi */}
      <nav aria-label="Navigasi pos gerbang" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                isActive
                  ? 'bg-accent-subtle font-semibold text-accent'
                  : 'font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              {/* Indikator pill vertikal di kiri (beranimasi saat aktif) */}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-all duration-300 ease-out motion-reduce:transition-none ${
                  isActive ? 'h-6 opacity-100' : 'h-3 opacity-0'
                }`}
              />
              <Icon
                className={`h-5 w-5 shrink-0 transition-colors ${
                  isActive ? 'text-accent' : 'text-ink-subtle'
                }`}
                strokeWidth={isActive ? 2.3 : 2}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Kartu petugas */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-sunken p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-on">
            {user?.nama?.charAt(0)?.toUpperCase() || 'S'}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-ink">
              {user?.nama || 'Petugas Security'}
            </p>
            <p className="truncate text-[11px] font-medium text-ink-muted">
              {profile?.role || user?.role || 'SECURITY'}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-status-green">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Tersambung
            </p>
          </div>
        </div>

        <div className="mt-3">
          <ThemeSegmented compact />
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-status-red-fill px-4 py-3 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red/50 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
