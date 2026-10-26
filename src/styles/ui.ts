/**
 * Konvensi UI bersama seluruh halaman Pos Security Gerbang.
 * Semua warna merujuk token di src/styles/tokens.css sehingga otomatis ikut
 * tema terang/gelap. Nilai kelas ditulis literal agar terdeteksi scanner Tailwind.
 */

/** Kartu / section */
export const CARD =
  'rounded-2xl border border-border bg-surface-raised p-3.5 shadow-card sm:p-4';

/** Label form */
export const LABEL = 'mb-1 block text-xs font-semibold text-ink-muted';

/** Input teks, textarea, select (font 16px anti auto-zoom iOS) */
export const FIELD =
  'w-full rounded-xl border border-border-strong bg-surface-raised px-3.5 py-2.5 text-base text-ink transition placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60';

/** Input dengan ikon kiri (beri pl-11 pada pemakainya) */
export const FIELD_ICON = `${FIELD} pl-11`;

/** Input nomor polisi: mono, tebal, tracking lebar */
export const FIELD_PLATE =
  'w-full rounded-xl border border-border-strong bg-surface-raised py-2.5 pl-11 pr-11 font-mono text-2xl font-bold uppercase tracking-[0.08em] text-ink transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

/** Tombol aksi utama (satu per layar). Disabled tetap terbaca sebagai tombol:
 *  warna sama dengan keadaan aktif, hanya diredupkan (opacity ~45%). */
export const BTN_PRIMARY =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-on shadow-card transition hover:bg-accent-hover active:bg-accent-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-accent disabled:shadow-none disabled:active:scale-100';

/** Tombol sekunder (netral, outline) */
export const BTN_SECONDARY =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-xs font-bold text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]';

/** Banner notifikasi (error/sukses) */
const ALERT_BASE =
  'flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs leading-relaxed';

export const ERROR_BANNER = `${ALERT_BASE} border-status-red/30 bg-status-red-bg text-status-red`;

export const SUCCESS_BANNER = `${ALERT_BASE} border-status-green/30 bg-status-green-bg text-status-green`;

/** Chip status (badge) */
export const CHIP_BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold';

export const CHIP_TONE = {
  green: 'border-status-green/30 bg-status-green-bg text-status-green',
  amber: 'border-status-amber/40 bg-status-amber-bg text-status-amber',
  red: 'border-status-red/30 bg-status-red-bg text-status-red',
  blue: 'border-status-blue/30 bg-status-blue-bg text-status-blue',
  neutral: 'border-border-strong bg-status-neutral-bg text-status-neutral',
} as const;

/** Nomor polisi sebagai elemen paling menonjol */
export const PLATE_TEXT = 'font-mono font-bold tracking-[0.1em] text-ink';

/** Subjudul kecil dalam kartu (mis. "NOMOR POLISI") */
export const CAPTION =
  'text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle';

/** Slot aksi halaman di dalam BottomChrome (mobile/tablet):
 *  berbagi background glass dengan tab bar sehingga tidak ada celah. */
export const ACTION_SLOT = 'px-4 pb-2.5 pt-3';

/** Aksi halaman di desktop: kartu aksi di bawah form */
export const ACTION_DESKTOP =
  'w-full rounded-2xl border border-border bg-surface-raised p-3.5 shadow-card sm:p-4 mt-4';
