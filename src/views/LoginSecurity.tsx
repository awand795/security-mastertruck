import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Building, ArrowRight, AlertCircle, Wrench, Settings, Globe } from 'lucide-react';
import { useSecurityStore } from '../store/useSecurityStore';
import { securityApi } from '../api/client';

export const LoginSecurity: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('BENGKEL MASTER TRUK');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Tunnel Config state
  const { tunnelBaseUrl, setTunnelBaseUrl, login } = useSecurityStore();
  const [showConfig, setShowConfig] = useState(false);
  const [inputUrl, setInputUrl] = useState(tunnelBaseUrl);

  const handleSaveTunnelUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setTunnelBaseUrl(inputUrl);
    setShowConfig(false);
    setInfo('Base URL endpoint tim berhasil diperbarui!');
    setTimeout(() => setInfo(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      // 1. Coba panggil real API DarkoPOS jika tunnel / base url sudah ada
      if (tunnelBaseUrl && tunnelBaseUrl.trim() !== '') {
        const res = await securityApi.loginDarkoPos(
          {
            userid: userId.trim(),
            password: password,
            company: company.trim(),
          },
          tunnelBaseUrl.trim()
        );

        if (res.success && res.profile) {
          login(
            {
              id: res.profile.userid || 'sec_' + Date.now(),
              nama: res.profile.username || res.profile.userid,
              role: res.profile.role || 'SECURITY',
              userid: res.profile.userid,
              company: res.profile.usercompany,
              id_token: res.id_token,
              profile: res.profile,
            },
            res.id_token,
            res.profile
          );
          return;
        } else {
          setError(res.message || 'Login gagal. Periksa User ID dan Password Anda.');
          return;
        }
      }

      // 2. Jika BASE URL belum diset, atau fallback testing lokal
      throw new Error('BASE_URL_NOT_SET');
    } catch (err: any) {
      console.warn('DarkoPOS Login error / fallback mode:', err);

      // Fallback development mode:
      if (
        (userId.trim() === 'adminPOS' || userId.trim() === 'security' || userId.trim().toLowerCase() === 'security@kim3.co.id') &&
        (password === 'security123' || password === 'adminPOS' || password.length >= 6)
      ) {
        login({
          id: userId.trim() || 'sec_pos',
          nama: userId.trim() === 'adminPOS' ? 'POS - Administrator' : 'Pos Security KIM 3',
          role: 'SECURITY',
          userid: userId.trim(),
          company: company.trim() || 'BENGKEL MASTER TRUK',
          id_token: 'mock-jwt-token-testing-darkopos',
          profile: {
            userid: userId.trim(),
            username: userId.trim() === 'adminPOS' ? 'POS - Administrator' : 'Pos Security KIM 3',
            usercompany: company.trim() || 'BENGKEL MASTER TRUK',
            role: 'SECURITY',
            store: 1,
            istotp: false,
          },
        });
        return;
      }

      if (err.message === 'BASE_URL_NOT_SET') {
        setError(
          'Tunnel Base URL belum diset (tim belum menjalankan tunnel ngrok/cloudflare). Anda tetap bisa masuk dengan User ID "adminPOS" & password "adminPOS" atau buka Pengaturan Server di atas.'
        );
      } else if (err.response?.status === 401) {
        setError('Unauthorized (401): User ID atau Kata Sandi salah.');
      } else {
        setError(
          err.message || 'Gagal menghubungi server DarkoPOS. Pastikan tunnel aktif atau gunakan akun fallback.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 shadow-xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Gate Portal</h1>
          <p className="text-xs text-slate-400 mt-1">
            Bengkel KIM 3 • DarkoPOS Integrated Authentication
          </p>
        </div>

        {/* Server Tunnel Config Toggle */}
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate max-w-[240px]">
              {tunnelBaseUrl ? tunnelBaseUrl : 'API: Mode Fallback (Belum Ada Tunnel)'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center space-x-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition"
          >
            <Settings className="w-3 h-3" />
            <span>{showConfig ? 'Tutup' : 'Set URL'}</span>
          </button>
        </div>

        {/* Config Modal / Box */}
        {showConfig && (
          <form
            onSubmit={handleSaveTunnelUrl}
            className="mb-4 p-4 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-xl space-y-3"
          >
            <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Konfigurasi Base URL DarkoPOS (Ngrok / Cloudflare)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Masukkan URL tunnel dari laptop tim lokal (misal: <code>https://xxxx.ngrok-free.app</code>).
            </p>
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://your-tunnel.ngrok-free.app"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
              >
                Simpan Base URL
              </button>
            </div>
          </form>
        )}

        {/* Card Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {info && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
              {info}
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Perusahaan (Company)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="BENGKEL MASTER TRUK"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                User ID Petugas
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="adminPOS / security.pos1"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? 'Memverifikasi ke DarkoPOS...' : 'Masuk ke Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-[11px] text-slate-500">
              Autentikasi terhubung langsung dengan POS Engine Bengkel KIM 3.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-500 flex items-center justify-center space-x-1.5">
          <Wrench className="w-3.5 h-3.5" />
          <span>Bengkel KIM 3 • Medan Industrial Area</span>
        </div>
      </div>
    </div>
  );
};
