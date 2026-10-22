import React from 'react';
import { Package, Truck, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Panel brand sisi kiri halaman login (hanya dirender pada layar >= lg).
 * Komponen presentasional murni: profil singkat perusahaan, tanpa props/state.
 * Dirancang pas setinggi viewport (induk lg:h-dvh) tanpa scroll halaman;
 * seluruh animasi dekoratif mati otomatis pada prefers-reduced-motion.
 */

const LOGO_SRC = '/master-truck-logo.png';

// Foto opsional untuk latar panel: isi mis. '/panel-gudang.jpg' (taruh file di folder public/)
const PANEL_PHOTO: string | null = null;

const merek = ['Federal Oil', 'Furukawa Battery', 'Indotube', 'RKN', 'Ichidai', 'Philips'];

const faktaProfil: { label: string; nilai: React.ReactNode; Icon: LucideIcon }[] = [
  { label: 'Bidang Usaha', nilai: 'Bengkel perawatan & perbaikan armada niaga', Icon: Package },
  { label: 'Wilayah', nilai: 'KIM III, Kota Medan, Sumatera Utara & sekitarnya', Icon: Truck },
  {
    label: 'Kantor',
    nilai: (
      <>
        Jl. Pulau Bunaken Komplek Warehouse KIM III No. 3A, Mabar, Kec. Medan Labuhan, Kota Medan, Sumatera Utara 20242
      </>
    ),
    Icon: MapPin,
  },
];

// Delay stagger reveal per baris fakta (ms)
const faktaDelay = [240, 310, 380];

export const LoginBrandPanel: React.FC = () => {
  return (
    <section className="hidden lg:flex lg:w-5/12 xl:w-1/2 h-full min-h-0 bg-workshop-pattern lg-p-title relative overflow-hidden border-r border-border-dark px-10 xl:px-14 py-8 flex-col justify-center items-center">

      {/* Foto latar opsional (hanya render jika PANEL_PHOTO diisi) */}
      {PANEL_PHOTO && (
        <>
          <img src={PANEL_PHOTO} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-[#E8EFF9]/70 to-[#DCE6F5]/90" />
        </>
      )}

      {/* Dekorasi: cahaya aurora biru muda yang drift pelan */}
      <div aria-hidden="true" className="login-aurora-a absolute -left-24 top-1/4 w-[22rem] h-[22rem] pointer-events-none z-0" />
      <div aria-hidden="true" className="login-aurora-b absolute -right-20 -bottom-24 w-[26rem] h-[26rem] pointer-events-none z-0" />

      {/* Dekorasi: roda/ban otomotif berputar sangat pelan di pojok kanan atas */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        fill="none"
        className="login-wheel absolute -right-24 -top-24 w-[20rem] pointer-events-none select-none opacity-[0.08] text-white z-0"
      >
        {/* Ban luar */}
        <circle cx="200" cy="200" r="190" stroke="currentColor" strokeWidth="1.5" />
        {/* Telapak ban (dashed) */}
        <circle cx="200" cy="200" r="165" stroke="currentColor" strokeWidth="14" strokeDasharray="4 10" opacity="0.6" />
        {/* Pinggul velg */}
        <circle cx="200" cy="200" r="135" stroke="currentColor" strokeWidth="1.5" />
        {/* Hub */}
        <circle cx="200" cy="200" r="50" stroke="currentColor" strokeWidth="2" />
        <circle cx="200" cy="200" r="14" fill="currentColor" opacity="0.6" />
        {/* 6 jari-jari, sudut kelipatan 60° */}
        <line x1="224.352" y1="183.72" x2="267.5" y2="158.98" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="224.352" y1="216.28" x2="267.5" y2="241.02" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="200" y1="229.352" x2="200" y2="281.54" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="175.648" y1="216.28" x2="132.5" y2="241.02" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="175.648" y1="183.72" x2="132.5" y2="158.98" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
        <line x1="200" y1="170.648" x2="200" y2="118.46" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      </svg>

      {/* Garis cahaya tipis di tepi kanan panel */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px lg-edge-light" />

      {/* Satu grup konten, terpusat vertikal & horizontal */}
      <div className="relative z-10 w-full max-w-md xl:max-w-lg flex flex-col">

        {/* Header Identitas Brand: Logo + Headline Bersebelahan */}
        <div className="mb-6 flex items-center gap-4 xl:gap-5 login-reveal" style={{ animationDelay: '0ms' }}>
          {/* Logo Chip */}
          <div className="bg-[#0A0D14] p-2.5 px-3.5 rounded-2xl shrink-0 inline-flex items-center border border-white/10 shadow-xl shadow-black/40">
            <img
              src={LOGO_SRC}
              alt="Master Truck One Stop Services"
              className="h-14 xl:h-16 w-auto object-contain"
            />
          </div>

          {/* Kategori Kuning + Judul Master Truck */}
          <div className="min-w-0">
            <p className="mb-1 text-[11px] xl:text-xs uppercase tracking-[0.15em] text-[#F2C14E] lg-text-bright font-semibold flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[#F2C14E] shrink-0" />
              <span>Bengkel Perawatan &amp; Perbaikan Truk</span>
            </p>
            <h1 className="text-2xl xl:text-3xl font-bold tracking-tight leading-tight login-title-sheen tracking-[-0.02em]">
              Master Truck
            </h1>
            <p className="text-xs text-[#94A3B8] font-medium tracking-wide mt-0.5">
              One Stop Services • KIM 3 Medan
            </p>
          </div>
        </div>

        <div className="login-accent-line mb-5" aria-hidden="true" />

        <p className="mb-4 text-sm xl:text-[15px] leading-relaxed text-[#E2E8F0] auth-text-dark lg-p-text login-reveal" style={{ animationDelay: '120ms' }}>
          Master Truck adalah bengkel spesialis perawatan dan perbaikan armada truk serta kendaraan niaga yang berbasis di Medan. Melayani servis berkala, overhaul mesin, kelistrikan, dan suku cadang untuk kawasan industri dan sekitarnya.
        </p>

        {/* Fakta ringkas dengan ikon */}
        <dl className="mb-5 lg-p-dl">
          {faktaProfil.map(({ label, nilai, Icon }, index) => (
            <div
              key={label}
              className="group grid grid-cols-[1.75rem_6.75rem_1fr] items-start gap-3 py-2.5 login-reveal"
              style={{ animationDelay: `${faktaDelay[index]}ms` }}
            >
              <div aria-hidden="true" className="auth-icon-box lg-icon-box w-7 h-7 rounded-md flex items-center justify-center transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <dt className="text-xs uppercase tracking-wider text-[#CBD5E1] auth-label-dark lg-p-muted pt-1 whitespace-nowrap">{label}</dt>
              <dd className="text-[13px] text-[#F1F5F9] auth-title-dark lg-p-title font-semibold leading-snug pt-1 [text-wrap:pretty]">{nilai}</dd>
            </div>
          ))}
        </dl>

        {/* Merek suku cadang & pelumas resmi */}
        <div className="[@media(max-height:560px)]:hidden">
          <p className="mb-2 text-xs font-medium text-[#CBD5E1] auth-label-dark lg-p-muted">Suku Cadang &amp; Pelumas Resmi</p>
          <div className="flex flex-wrap gap-1.5">
            {merek.map((nama, index) => (
              <span
                key={nama}
                className="login-pop auth-chip lg-chip rounded-full px-2.5 py-1 text-xs"
                style={{ animationDelay: `${450 + index * 60}ms` }}
              >
                {nama}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
