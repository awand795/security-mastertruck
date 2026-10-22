import React from 'react';
import { LogIn, LogOut, FileText, ShieldCheck } from 'lucide-react';
import { SecurityTab } from './MobileBottomNav';

interface SidebarProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onChangeTab }) => {
  const menuItems = [
    {
      id: 'check-in' as SecurityTab,
      label: 'Check In',
      sublabel: 'Pemeriksaan Masuk Gerbang',
      icon: LogIn,
    },
    {
      id: 'check-out' as SecurityTab,
      label: 'Check Out',
      sublabel: 'Pemeriksaan Kendaraan Keluar',
      icon: LogOut,
    },
    {
      id: 'memo-keluar' as SecurityTab,
      label: 'Memo Keluar',
      sublabel: 'Arsip Tiket & Gate Pass',
      icon: FileText,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] hidden md:flex flex-col justify-between shrink-0 min-h-[calc(100vh-64px)] py-5 px-4 font-sans overflow-y-auto">
      <div>
        <div className="px-3 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            Menu Operasional Gerbang
          </span>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#12388F] text-white font-bold shadow-md shadow-[#12388F]/20'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] font-semibold'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="text-sm block leading-tight">{item.label}</span>
                  <span
                    className={`text-[10px] block mt-0.5 truncate ${
                      isActive ? 'text-white/80' : 'text-[#64748B]'
                    }`}
                  >
                    {item.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Box Info Bawah */}
      <div className="pt-4 border-t border-[#E2E8F0] px-2 text-center">
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <ShieldCheck className="w-5 h-5 text-[#12388F] mx-auto mb-1" />
          <span className="text-xs font-bold text-[#0F172A] block">Pos Gerbang KIM 3</span>
          <span className="text-[10px] text-[#64748B] block mt-0.5">Sistem Validasi Terintegrasi</span>
        </div>
      </div>
    </aside>
  );
};
