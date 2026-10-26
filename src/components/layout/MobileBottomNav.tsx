import React from 'react';
import { LogIn, LogOut, FileText } from 'lucide-react';

export type SecurityTab = 'check-in' | 'check-out' | 'memo-keluar';

interface MobileBottomNavProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

/**
 * Tab bar standar aplikasi mobile (edge-to-edge, tinggi 64px).
 * Dirender DI DALAM BottomChrome sehingga tidak memakai `fixed` sendiri:
 * background glass, border-top, dan safe-area diatur oleh kontainer induk.
 *
 * Tab aktif: ikon dalam capsule tint lembut (bg-accent-subtle) yang bergeser
 * mulus mengikuti tab terpilih; label ikut berwarna accent.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const tabs = [
    { id: 'check-in' as SecurityTab, label: 'Check In', icon: LogIn },
    { id: 'check-out' as SecurityTab, label: 'Check Out', icon: LogOut },
    { id: 'memo-keluar' as SecurityTab, label: 'Memo Keluar', icon: FileText },
  ];

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );

  return (
    <nav
      aria-label="Navigasi utama pos gerbang"
      className="w-full select-none"
    >
      <div className="relative grid h-16 w-full grid-cols-3 [@media(max-height:700px)]:h-14">
        {/* Capsule tab aktif: bergeser mulus seiring tab terpilih */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[calc(100%-20px)] w-1/3 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <span className="flex h-full items-center justify-center">
            <span className="block h-8 w-14 rounded-full bg-accent-subtle" />
          </span>
        </span>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                navigator.vibrate?.(8);
                onChangeTab(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative z-10 flex h-full cursor-pointer flex-col items-center justify-center gap-1 px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                isActive ? 'text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span
                className={`relative flex items-center justify-center transition-transform duration-200 motion-reduce:transition-none ${
                  isActive ? '-translate-y-0.5' : ''
                }`}
              >
                <Icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={isActive ? 2.4 : 2}
                  aria-hidden="true"
                />
              </span>
              <span
                className={`text-[11px] leading-none ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
