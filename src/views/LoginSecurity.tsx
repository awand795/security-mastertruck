import React, { useState } from 'react';
import {
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useSecurityStore } from '../store/useSecurityStore';
import { securityApi } from '../api/client';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { CARD, FIELD, LABEL, BTN_PRIMARY, ERROR_BANNER } from '../styles/ui';

export const LoginSecurity: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useSecurityStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = userId.trim();
    if (!cleanId || !password.trim()) {
      setErrorMsg('Silakan masukkan User ID Petugas dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Panggil API DarkoPOS ke fixed URL http://52.77.133.95:9004/api/v1/users/login
      let res;
      try {
        res = await securityApi.loginDarkoPos({
          userid: cleanId,
          password: password,
          company: 'BENGKEL MASTER TRUK',
        });
      } catch (eComp: any) {
        if (eComp.response?.status === 401) {
          try {
            res = await securityApi.loginDarkoPos({
              userid: cleanId,
              password: password,
              company: '',
            });
          } catch {
            throw eComp;
          }
        } else {
          throw eComp;
        }
      }

      if (res && res.success && res.profile) {
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
        setErrorMsg(res?.message || 'User ID atau kata sandi tidak sesuai. Silakan periksa kembali dan coba lagi.');
        return;
      }
    } catch (err: any) {
      console.warn('DarkoPOS Login error:', err);

      const status = err.response?.status;
      if (status === 401) {
        setErrorMsg('User ID atau kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali dan coba lagi.');
      } else if (status === 403) {
        setErrorMsg('Akun Anda tidak memiliki izin akses ke portal keamanan gerbang.');
      } else if (status === 404) {
        setErrorMsg('Layanan autentikasi POS sedang tidak tersedia. Silakan hubungi tim administrator bengkel.');
      } else if (status && status >= 500) {
        setErrorMsg('Terjadi kendala pada server sistem POS. Silakan coba kembali beberapa saat lagi.');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setErrorMsg('Waktu koneksi ke server POS habis. Pastikan jaringan internet stabil dan coba kembali.');
      } else if (err.code === 'ERR_NETWORK') {
        setErrorMsg('Tidak dapat terhubung ke server autentikasi POS (52.77.133.95:9004). Pastikan koneksi internet stabil atau hubungi tim sistem.');
      } else {
        setErrorMsg('Gagal masuk ke sistem. Silakan periksa kembali data akun Anda atau coba beberapa saat lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-surface p-4 font-sans text-ink antialiased sm:p-6">
      {/* Toggle tema di halaman login */}
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+12px)] z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center rounded-2xl border border-border-dark bg-surface-dark px-4 py-2.5 shadow-lg">
            <img src="/master-truck-logo.png" alt="Master Truck Logo" className="h-9 w-auto object-contain" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent-subtle px-2.5 py-0.5 text-[10px] font-bold text-accent">
            Pos Security Gerbang
          </span>
        </div>

        {/* Kartu form */}
        <div className={`${CARD} p-5 sm:p-7`}>
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-subtle px-3 py-1 text-xs font-bold text-accent">
              <ShieldCheck className="h-4 w-4" />
              <span>Portal Keamanan Gerbang</span>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Masuk Pos Gerbang</h2>
            <p className="mt-1 text-sm font-medium text-ink-muted">
              Masuk dengan User ID petugas Master Truck.
            </p>
          </div>

          {errorMsg && (
            <div className={`${ERROR_BANNER} mb-4`}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-userid" className={LABEL}>
                User ID Petugas
              </label>
              <div className="relative group">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-subtle transition-colors group-focus-within:text-accent">
                  <User className="h-5 w-5" />
                </span>
                <input
                  id="login-userid"
                  type="text"
                  required
                  autoComplete="username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Contoh: security01"
                  className={`${FIELD} pl-11`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className={LABEL}>
                Kata Sandi
              </label>
              <div className="relative group">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-subtle transition-colors group-focus-within:text-accent">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${FIELD} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-subtle transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={`${BTN_PRIMARY} mt-1 py-4`}>
              <span>{isLoading ? 'Memverifikasi ke DarkoPOS...' : 'Masuk Sekarang'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 border-t border-border pt-4 text-center">
            <span className="text-[11px] text-ink-muted">
              Akses internal gerbang bengkel Master Truck • Terhubung ke DarkoPOS
            </span>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-ink-subtle">
          Bengkel KIM 3 Medan • Master Truck Workshop Network
        </p>
      </div>
    </main>
  );
};
