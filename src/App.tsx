import React, { useState } from 'react';
import { 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  FileText, 
  LogOut as ExitIcon,
  Wrench,
  Camera
} from 'lucide-react';
import { useSecurityStore } from './store/useSecurityStore';
import { LoginSecurity } from './views/LoginSecurity';
import { CheckInView } from './views/CheckInView';
import { CheckOutView } from './views/CheckOutView';
import { MemoKeluarView } from './views/MemoKeluarView';

type Tab = 'check-in' | 'check-out' | 'memo-keluar';

export const App: React.FC = () => {
  const { isAuthenticated, user, logout } = useSecurityStore();
  const [activeTab, setActiveTab] = useState<Tab>('check-in');

  if (!isAuthenticated) {
    return <LoginSecurity />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base tracking-tight">Pos Gerbang Security</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                  Bengkel KIM 3
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Pemeriksaan Masuk, Keluar & Verifikasi Kamera</p>
            </div>
          </div>

          {/* Navigation 3 Menus */}
          <nav className="hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('check-in')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'check-in'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Check In</span>
            </button>
            <button
              onClick={() => setActiveTab('check-out')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'check-out'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Check Out</span>
            </button>
            <button
              onClick={() => setActiveTab('memo-keluar')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'memo-keluar'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Memo Keluar</span>
            </button>
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <span className="text-xs font-semibold text-slate-200 block">{user?.nama || 'Petugas Security'}</span>
              <span className="text-[11px] text-slate-400">Pos Gerbang Utama</span>
            </div>
            <button
              onClick={logout}
              title="Keluar Akun"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition"
            >
              <ExitIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Subnav for 3 Menus */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-800 bg-slate-950 px-2 py-1.5">
          <button
            onClick={() => setActiveTab('check-in')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'check-in' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Check In</span>
          </button>
          <button
            onClick={() => setActiveTab('check-out')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'check-out' ? 'bg-amber-600 text-white' : 'text-slate-400'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Check Out</span>
          </button>
          <button
            onClick={() => setActiveTab('memo-keluar')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'memo-keluar' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Memo Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'check-in' && <CheckInView />}
        {activeTab === 'check-out' && <CheckOutView />}
        {activeTab === 'memo-keluar' && <MemoKeluarView />}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-900/40 py-3 text-center text-xs text-slate-500">
        Bengkel KIM 3 • Dedicated Security Gate Application v1.0
      </footer>
    </div>
  );
};

export default App;
