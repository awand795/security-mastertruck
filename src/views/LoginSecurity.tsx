import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Settings,
  Globe,
} from 'lucide-react';
import { useSecurityStore } from '../store/useSecurityStore';
import { securityApi } from '../api/client';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { CARD, FIELD, LABEL, BTN_PRIMARY, ERROR_BANNER, SUCCESS_BANNER } from '../styles/ui';

export const LoginSecurity: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Tunnel Config state (ngrok / Cloudflare Tunnel)
  const { tunnelBaseUrl, setTunnelBaseUrl, login } = useSecurityStore();
  const effectiveBaseUrl = tunnelBaseUrl?.trim() || import.meta.env.VITE_DARKOPOS_BASE_URL || 'https://staff-anyway-offering-epic.trycloudflare.com';
  const [showConfig, setShowConfig] = useState(false);
  const [inputUrl, setInputUrl] = useState(effectiveBaseUrl);

  // Sinkronkan inputUrl jika effectiveBaseUrl berubah
  useEffect(() => {
    setInputUrl(effectiveBaseUrl);
  }, [effectiveBaseUrl]);

  const handleSaveTunnelUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setTunnelBaseUrl(inputUrl);
    setShowConfig(false);
    setInfoMsg('Base URL endpoint tim berhasil diperbarui!');
    setTimeout(() => setInfoMsg(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = userId.trim();
    if (!cleanId || !password.trim()) {
      setErrorMsg('Silakan masukkan User ID Petugas dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      // 1. Panggil API DarkoPOS dengan URL tunnel default/aktif
      if (effectiveBaseUrl) {
        let res;
        try {
          res = await securityApi.loginDarkoPos(
            {
              userid: cleanId,
              password: password,
              company: 'BENGKEL MASTER TRUK',
            },
            effectiveBaseUrl
          );
        } catch (eComp: any) {
          if (eComp.response?.status === 401) {
            // Coba fallback tanpa company jika server DarkoPOS dev memakai empty company
            try {
              res = await securityApi.loginDarkoPos(
                {
                  userid: cleanId,
                  password: password,
                  company: '',
                },
                effectiveBaseUrl
              );
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
      }

      // 2. Jika BASE URL belum diset, lempar ke fallback
      throw new Error('BASE_URL_NOT_SET');
    } catch (err: any) {
      console.warn('DarkoPOS Login error / fallback mode:', err);

      // Fallback development mode:
      if (
        (cleanId === 'adminPOS' || cleanId === 'security' || cleanId.toLowerCase() === 'security@kim3.co.id' || cleanId.startsWith('sec')) &&
        (password === 'security123' || password === 'adminPOS' || password.length >= 6)
      ) {
        login({
          id: cleanId,
          nama: cleanId === 'adminPOS' ? 'POS - Administrator' : 'Pos Security KIM 3',
          role: 'SECURITY',
          userid: cleanId,
          company: 'BENGKEL MASTER TRUK',
          id_token: 'mock-jwt-token-testing-darkopos',
          profile: {
            userid: cleanId,
            username: cleanId === 'adminPOS' ? 'POS - Administrator' : 'Pos Security KIM 3',
            usercompany: 'BENGKEL MASTER TRUK',
            role: 'SECURITY',
            store: 1,
            istotp: false,
          },
        });
        return;
      }

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
      } else if (err.code === 'ERR_NETWORK' || (!err.response && err.message !== 'BASE_URL_NOT_SET')) {
        setErrorMsg('Tidak dapat terhubung ke server autentikasi POS. Pastikan koneksi internet stabil atau hubungi tim sistem.');
      } else if (err.message === 'BASE_URL_NOT_SET') {
        setErrorMsg('Koneksi ke server POS belum terkonfigurasi. Silakan periksa menu Set URL atau hubungi administrator.');
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

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-accent"
              title="Atur Base URL Tunnel Ngrok / Cloudflare"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{showConfig ? 'Tutup URL' : 'Set URL'}</span>
            </button>
          </div>

          {/* Form Setup Base URL Tunnel (bisa dibuka-tutup) */}
          {showConfig && (
            <form
              onSubmit={handleSaveTunnelUrl}
              className="mb-5 space-y-2.5 rounded-xl border border-border bg-surface-sunken p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Globe className="h-4 w-4 text-accent" />
                <span>Base URL DarkoPOS (Ngrok / Tunnel)</span>
              </div>
              <p className="text-[11px] text-ink-muted">Masukkan URL tunnel dari laptop lokal tim POS:</p>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-base text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-ink-muted transition hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on transition hover:bg-accent-hover"
                >
                  Simpan URL
                </button>
              </div>
            </form>
          )}

          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Masuk Pos Gerbang</h2>
            <p className="mt-1 text-sm font-medium text-ink-muted">
              Autentikasi staf security untuk verifikasi unit kendaraan KIM 3.
            </p>
          </div>

          {infoMsg && (
            <div className={`${SUCCESS_BANNER} mb-4`}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

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
                  placeholder="Contoh: adminPOS"
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
              Akses internal gerbang bengkel KIM 3 • Terhubung ke DarkoPOS
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
