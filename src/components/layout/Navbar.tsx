import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  LogOut as ExitIcon, 
  Building2, 
  X,
  Lock,
  ChevronDown
} from 'lucide-react';
import { useSecurityStore } from '../../store/useSecurityStore';
import { SecurityTab } from './MobileBottomNav';

interface NavbarProps {
  activeTab: SecurityTab;
  onChangeTab: (tab: SecurityTab) => void;
}

const TAB_TITLES: Record<SecurityTab, { title: string; subtitle: string }> = {
  'check-in': { title: 'Pemeriksaan Masuk', subtitle: 'Check In Armada Gerbang' },
  'check-out': { title: 'Pemeriksaan Keluar', subtitle: 'Validasi Fisik & Check Out' },
  'memo-keluar': { title: 'Memo Keluar & Gate Pass', subtitle: 'Arsip & Cetak Tiket Keluar' },
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  const { user, profile, logout } = useSecurityStore();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const currentInfo = TAB_TITLES[activeTab] || {
    title: 'Pos Security KIM 3',
    subtitle: 'Gate Control Management',
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] font-sans safe-top shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Sisi Kiri: Branding Master Truck & Judul Halaman */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-[#0A0D14] p-1.5 px-3 rounded-xl border border-black/10 flex items-center shadow-xs">
              <img src="/master-truck-logo.png" alt="Master Truck Logo" className="h-8 w-auto object-contain" />
            </div>

            <div className="hidden sm:block h-7 w-[1px] bg-[#E2E8F0]" />

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                  {currentInfo.title}
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#12388F]/10 text-[#12388F] border border-[#12388F]/20">
                  Pos Gerbang Utama
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] hidden sm:block">
                {currentInfo.subtitle} • Bengkel KIM 3
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Profil Petugas & Tombol Keluar */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center space-x-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-[#F1F5F9] border border-transparent hover:border-[#E2E8F0] transition cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#12388F] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user?.nama?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="hidden md:block">
                <span className="text-xs font-bold text-[#0F172A] block leading-tight">
                  {user?.nama || 'Petugas Security'}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {profile?.userid || 'Pos Security'} • {profile?.usercompany || 'Master Truck'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden md:block" />
            </button>

            <button
              type="button"
              onClick={logout}
              title="Keluar Akun"
              className="p-2 rounded-xl text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2]/60 border border-[#E2E8F0] hover:border-[#DC2626]/30 transition cursor-pointer"
            >
              <ExitIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Profile Detail Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-4 border-b border-[#E2E8F0] mb-4">
              <div className="w-16 h-16 rounded-full bg-[#12388F] text-white font-bold text-xl flex items-center justify-center mx-auto mb-2 shadow-md">
                {user?.nama?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <h3 className="font-bold text-[#0F172A] text-base">{user?.nama || 'Petugas Security'}</h3>
              <p className="text-xs text-[#64748B]">Pos Gerbang Bengkel Master Truck KIM 3</p>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">User ID / Akun:</span>
                <span className="font-mono font-bold text-[#0F172A]">{profile?.userid || user?.userid || 'adminPOS'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Perusahaan:</span>
                <span className="font-semibold text-[#0F172A]">{profile?.usercompany || 'BENGKEL MASTER TRUK'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Role / Otoritas:</span>
                <span className="font-bold text-[#12388F]">{profile?.role || user?.role || 'SECURITY'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B]">Status Token:</span>
                <span className="text-[#16A34A] font-semibold">Tersambung (DarkoPOS)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
            >
              <ExitIcon className="w-4 h-4" />
              <span>Keluar dari Akun Pos Gerbang</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
