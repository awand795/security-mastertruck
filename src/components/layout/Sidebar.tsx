import React from 'react';
import { 
  LogIn, 
  LogOut, 
  FileText, 
  ShieldCheck 
} from 'lucide-react';
import { SecurityTab } from './MobileBottomNav';

interface SidebarProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

export interface NavItem {
  id: SecurityTab;
  label: string;
  icon: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onChangeTab }) => {
  const navigationItems: NavItem[] = [
    { id: 'check-in', label: 'Check In', icon: LogIn },
    { id: 'check-out', label: 'Check Out', icon: LogOut },
    { id: 'memo-keluar', label: 'Memo Keluar', icon: FileText },
  ];

  return (
    <aside className="w-56 lg:w-60 bg-white border-r border-[#E2E8F0] hidden lg:flex flex-col justify-between shrink-0 min-h-[calc(100vh-64px)] py-4 px-3 font-sans overflow-y-auto">
      <div>
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer relative overflow-hidden group ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#12388F] font-semibold pl-4 shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 inset-y-0 w-[3px] bg-[#12388F]" />
                )}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#12388F]'
                        : 'text-[#64748B] group-hover:text-[#0F172A]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Info */}
      <div className="space-y-2.5 pt-4 border-t border-[#E2E8F0] px-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#12388F]">
          <ShieldCheck className="w-4 h-4" />
          <span>Pos Security KIM 3</span>
        </div>
        <div className="text-[10px] text-[#94A3B8]">
          &copy; 2026 KIM3 Bengkel. All rights reserved.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
