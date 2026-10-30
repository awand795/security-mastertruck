import React from 'react';
import { LogIn, LogOut, Truck, CalendarCheck } from 'lucide-react';

export type SecurityTab = 'check-in' | 'check-out' | 'active-inside' | 'today-exit';

interface MobileBottomNavProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

/**
 * Tab bar aplikasi mobile (4 tabs: Check In, Check Out, Di Dalam, Keluar Hari Ini)
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const tabs = [
    { id: 'check-in' as SecurityTab, label: 'Check In', icon: LogIn },
    { id: 'check-out' as SecurityTab, label: 'Check Out', icon: LogOut },
    { id: 'active-inside' as SecurityTab, label: 'Di Dalam', icon: Truck },
    { id: 'today-exit' as SecurityTab, label: 'Keluar Hari Ini', icon: CalendarCheck },
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
      <div className="relative grid h-16 w-full grid-cols-4 [@media(max-height:700px)]:h-14">
        {/* Capsule tab aktif */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[calc(100%-20px)] w-1/4 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <span className="flex h-full items-center justify-center">
            <span className="block h-8 w-12 rounded-full bg-accent-subtle" />
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
              className={`relative z-10 flex h-full cursor-pointer flex-col items-center justify-center gap-1 px-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                isActive ? 'text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span
                className={`relative flex items-center justify-center transition-transform duration-200 motion-reduce:transition-none ${
                  isActive ? '-translate-y-0.5' : ''
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.4 : 2}
                  aria-hidden="true"
                />
              </span>
              <span
                className={`truncate max-w-[90%] text-[10px] leading-none ${
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
