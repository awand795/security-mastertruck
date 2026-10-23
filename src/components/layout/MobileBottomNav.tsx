import React from 'react';
import { LogIn, LogOut, FileText, ArrowRightCircle } from 'lucide-react';
import { useSecurityStore } from '../../store/useSecurityStore';

export type SecurityTab = 'check-in' | 'check-out' | 'memo-keluar';

interface MobileBottomNavProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    {
      id: 'check-in' as SecurityTab,
      label: 'Check In',
      sublabel: 'Masuk Gerbang',
      icon: LogIn,
    },
    {
      id: 'check-out' as SecurityTab,
      label: 'Check Out',
      sublabel: 'Pemeriksaan Keluar',
      icon: LogOut,
    },
    {
      id: 'memo-keluar' as SecurityTab,
      label: 'Memo Keluar',
      sublabel: 'Arsip Gate Pass',
      icon: FileText,
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama Pos Gerbang"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#CBD5E1] font-sans shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-3 h-16 max-w-xl mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`group relative flex flex-col items-center justify-center py-1 transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#12388F] font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A] font-medium'
              }`}
            >
              {/* Active Top Bar Indicator */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-3 h-0.5 bg-[#12388F] rounded-full"
                />
              )}

              <div
                className={`flex items-center justify-center w-9 h-7 rounded-lg transition-transform ${
                  isActive ? 'scale-105 bg-[#12388F]/10' : 'group-active:scale-95'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-[#12388F]' : 'text-[#64748B]'
                  }`}
                />
              </div>

              <span className="text-[11px] leading-tight mt-0.5 tracking-tight truncate max-w-[85px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
