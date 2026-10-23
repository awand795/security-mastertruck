import React from 'react';
import { 
  LogIn, 
  LogOut, 
  FileText, 
  HelpCircle,
  Phone,
  MessageCircle,
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
  const waNumber = '6281234567890';
  const waMessage = 'Halo Admin Bengkel KIM 3, saya petugas Pos Security butuh bantuan teknis gerbang';
  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
  const waDisplay = '0812-3456-7890';

  const navigationItems: NavItem[] = [
    { id: 'check-in', label: 'Pemeriksaan Masuk (Check In)', icon: LogIn },
    { id: 'check-out', label: 'Pemeriksaan Keluar (Check Out)', icon: LogOut },
    { id: 'memo-keluar', label: 'Memo Keluar & Gate Pass', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] hidden md:flex flex-col justify-between shrink-0 min-h-[calc(100vh-64px)] py-5 px-4 font-sans overflow-y-auto">
      <div>
        <div className="px-3 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            Menu Operasional
          </span>
        </div>

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
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#12388F]'
                        : 'text-[#475569] group-hover:text-[#0F172A]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Assistance Card & Copyright (Sama Persis Tema Web Fleet) */}
      <div className="space-y-4 pt-6">
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] space-y-2.5 shadow-2xs">
          <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-[#12388F]" />
            <span>Butuh Bantuan Pos?</span>
          </div>
          <p className="text-[11px] text-[#475569] leading-relaxed">
            Hubungi Service Advisor atau Admin Bengkel jika ada kendala sistem gerbang.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-[#0F172A]">
            <Phone className="w-3.5 h-3.5 text-[#12388F]" />
            <span>{waDisplay}</span>
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" />
            <span>Chat WhatsApp CS</span>
          </a>
        </div>

        <div className="text-center text-[10px] text-[#94A3B8] pt-1 border-t border-[#E2E8F0]">
          &copy; 2026 KIM3 Bengkel. All rights reserved.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
