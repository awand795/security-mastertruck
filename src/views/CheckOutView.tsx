import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  Search,
  User,
  CheckCircle2,
  AlertTriangle,
  Truck,
  X,
  Loader2,
  Clock,
  Hash,
  Timer,
  BadgeCheck,
  Keyboard,
  Scan,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { ActiveInsideVehicle } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { PlateOcrScannerModal } from '../components/security/PlateOcrScannerModal';
import { useSecurityStore } from '../store/useSecurityStore';
import { formatPlate, normalizePlate } from '../utils/plate';
import { broadcastRealtimeEvent } from '../utils/realtime';
import { PageAction } from '../components/layout/BottomChrome';
import {
  CARD,
  FIELD,
  FIELD_PLATE,
  LABEL,
  ERROR_BANNER,
  CHIP_BASE,
  CHIP_TONE,
} from '../styles/ui';

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

const FIELD_CLASS = FIELD;
const LABEL_CLASS = LABEL;

const formatDuration = (waktuMasuk: string) => {
  const start = new Date(waktuMasuk.replace(' ', 'T'));
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  if (diffMs < 0) return null;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} hari ${hours % 24} jam`;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
};

interface CheckOutViewProps {
  initialPlate?: string;
  onClearInitialPlate?: () => void;
}

export const CheckOutView: React.FC<CheckOutViewProps> = ({ initialPlate, onClearInitialPlate }) => {
  const queryClient = useQueryClient();
  const currentUser = useSecurityStore((state) => state.user);
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);
  const canAutoFocus = !window.matchMedia?.('(pointer: coarse)').matches;

  // Mode Input: 'manual' vs 'camera'
  const [inputMode, setInputMode] = useState<'manual' | 'camera'>('manual');
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  // Plate search state (manual trigger via tombol Cari / Scan Kamera, bukan per ketik)
  const [plateInput, setPlateInput] = useState('');
  const [activeVehicles, setActiveVehicles] = useState<ActiveInsideVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveInsideVehicle | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Exit details
  const [catatanKeluar, setCatatanKeluar] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // Status & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMemo, setSuccessMemo] = useState<any | null>(null);

  const normalizedPlate = normalizePlate(plateInput);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Eksekusi pencarian kendaraan yang sedang aktif di dalam bengkel (sudah Check-In)
  const executeCheckoutSearch = async (overridePlate?: string) => {
    const rawTarget = overridePlate !== undefined ? overridePlate : plateInput;
    const cleanTarget = normalizePlate(rawTarget);
    const rawTrimmed = rawTarget.trim().toUpperCase();

    if (cleanTarget.length < 2 && rawTrimmed.length < 2) {
      setErrorMsg('Masukkan minimal 2 karakter nomor polisi untuk mencari.');
      return;
    }

    setErrorMsg(null);
    setIsSearching(true);
    setHasSearched(false);
    setShowSuggestions(false);
    setSelectedVehicle(null);
    setActiveVehicles([]);

    try {
      const results = await securityApi.getActiveInside(cleanTarget, kodeCabang);
      setActiveVehicles(results);

      // Cek apakah ada yang cocok persis berdasarkan nopol atau nomor tiket
      const exactMatches = results.filter(
        (v) =>
          normalizePlate(v.no_polisi) === cleanTarget ||
          v.nomor_tiket.trim().toUpperCase() === rawTrimmed
      );

      if (exactMatches.length === 1) {
        setSelectedVehicle(exactMatches[0]);
        setPlateInput(formatPlate(exactMatches[0].no_polisi));
        setShowSuggestions(false);
      } else if (results.length > 0) {
        setShowSuggestions(true);
      } else {
        setSelectedVehicle(null);
        setShowSuggestions(false);
      }
      setHasSearched(true);
    } catch (err) {
      console.error('Error searching active inside vehicles:', err);
      setErrorMsg('Gagal mencari data kendaraan di dalam bengkel.');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-select ketika dinavigasi dari tab "Di Dalam"
  useEffect(() => {
    if (initialPlate) {
      const formatted = formatPlate(initialPlate);
      setPlateInput(formatted);
      executeCheckoutSearch(initialPlate);
      if (onClearInitialPlate) onClearInitialPlate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlate]);

  // Handler saat plat terdeteksi otomatis lewat OCR Scanner Kamera
  const handleOcrPlateDetected = (detectedPlate: string) => {
    const formatted = formatPlate(detectedPlate);
    setPlateInput(formatted);
    setInputMode('manual');
    executeCheckoutSearch(detectedPlate);
  };

  // Tutup popup saran saat klik di luar kotak pencarian
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Input plat hanya memformat teks, tidak menembak API per ketikan
  const handlePlateInputChange = (raw: string) => {
    const formatted = formatPlate(raw);
    setPlateInput(formatted);
    setErrorMsg(null);
    setHasSearched(false);

    const clean = normalizePlate(formatted);
    if (selectedVehicle && normalizePlate(selectedVehicle.no_polisi) !== clean) {
      setSelectedVehicle(null);
    }
  };

  const handleSelectVehicle = (v: ActiveInsideVehicle) => {
    setSelectedVehicle(v);
    setPlateInput(formatPlate(v.no_polisi));
    setShowSuggestions(false);
  };

  const isVehicleInside = Boolean(
    selectedVehicle &&
    normalizePlate(selectedVehicle.no_polisi) === normalizePlate(plateInput)
  );

  const handleSubmitCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVehicleInside || !selectedVehicle) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const checkOutRes = await securityApi.postCheckOut({
        id: selectedVehicle.id,
        petugas_security_keluar: currentUser?.nama || 'Pos Security KIM 3',
        catatan_keluar: catatanKeluar.trim() || undefined,
      });

      // Upload captured exit photos
      const photosToUpload = photos.filter((p) => Boolean(p.dataUrl));
      for (const p of photosToUpload) {
        if (p.dataUrl) {
          try {
            await securityApi.postAddFoto({
              kunjungan_id: selectedVehicle.id,
              jenis_event: 'KELUAR',
              sudut_pandang: p.id.toUpperCase(),
              foto_data: p.dataUrl,
            });
          } catch (fotoErr) {
            console.error(`Failed to upload exit photo ${p.id}:`, fotoErr);
          }
        }
      }

      const nowStr = new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const durasiLabel = formatDuration(selectedVehicle.waktu_masuk) || '-';

      setSuccessMemo({
        nomor_memo: checkOutRes?.nomor_memo || `MK-${selectedVehicle.id}`,
        nomor_tiket: selectedVehicle.nomor_tiket,
        no_polisi: selectedVehicle.no_polisi,
        nama_pengemudi: selectedVehicle.nama_pengemudi,
        pic_tujuan: selectedVehicle.pic_tujuan || '-',
        tipe_kunjungan: selectedVehicle.tipe_kunjungan,
        waktu_masuk: selectedVehicle.waktu_masuk,
        waktu_keluar: checkOutRes?.waktu_keluar || nowStr,
        durasi: durasiLabel,
        petugas_masuk: selectedVehicle.petugas_security_masuk || 'Security',
        petugas_keluar: currentUser?.nama || 'Pos Security',
        catatan_keluar: catatanKeluar.trim() || '-',
      });

      broadcastRealtimeEvent({
        type: 'VEHICLE_CHECKED_OUT',
        targetRoles: ['Customer Fleet', 'SA', 'ALL'],
        title: 'Kendaraan Keluar dari Bengkel',
        message: `Unit ${formatPlate(selectedVehicle.no_polisi)} (${selectedVehicle.nama_pengemudi}) telah resmi check out dari Pos Security.`,
        linkTab: 'fleet-service',
        urgency: 'success',
        meta: {
          no_polisi: selectedVehicle.no_polisi,
          nomor_memo: checkOutRes?.nomor_memo,
          nomor_tiket: selectedVehicle.nomor_tiket,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['active-inside'] });
      queryClient.invalidateQueries({ queryKey: ['memo-keluar'] });
    } catch (err: any) {
      console.error('Check out error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal memproses check out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessMemo(null);
    setSelectedVehicle(null);
    setActiveVehicles([]);
    setPlateInput('');
    setHasSearched(false);
    setShowSuggestions(false);
    setCatatanKeluar('');
    setPhotos(INITIAL_PHOTOS);
  };

  const duration = selectedVehicle ? formatDuration(selectedVehicle.waktu_masuk) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-3 md:max-w-4xl">
      <div className="flex items-center gap-3 px-0.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-on shadow-card">
          <LogOut className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight tracking-tight text-ink">Check Out</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Validasi keluar kendaraan
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className={ERROR_BANNER}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      <form id="checkout-form" onSubmit={handleSubmitCheckOut} className="space-y-3">
        <section className={CARD}>
          <div>
            {/* Pilihan Mode Input: Ketik Manual vs Scan Kamera Plat (Otomatis) */}
            <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-surface-sunken p-1">
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  inputMode === 'manual'
                    ? 'bg-surface-raised text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('camera');
                  setIsOcrModalOpen(true);
                }}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  inputMode === 'camera'
                    ? 'bg-surface-raised text-accent shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Scan className="h-3.5 w-3.5" />
                Scan Kamera Plat (Otomatis)
              </button>
            </div>

            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkout-plate" className="text-sm font-bold text-ink">
                Nomor Polisi <span className="text-status-red">*</span>
              </label>
              <span className="text-[10px] font-semibold text-ink-subtle">
                Klik Cari untuk cek kendaraan yang sudah Check-In
              </span>
            </div>

            <div ref={searchContainerRef} className="relative">
              <div className="relative flex items-center">
                <input
                  id="checkout-plate"
                  type="text"
                  required
                  autoComplete="off"
                  value={plateInput}
                  onChange={(e) => handlePlateInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executeCheckoutSearch();
                    }
                  }}
                  autoFocus={canAutoFocus}
                  placeholder="Contoh: BK 1234 ABC"
                  className={`${FIELD_PLATE} pr-24`}
                />

                {/* Tombol Aksi di Sisi Kanan Input Form */}
                <div className="absolute right-2 flex items-center gap-1.5">
                  {plateInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlateInput('');
                        setSelectedVehicle(null);
                        setActiveVehicles([]);
                        setShowSuggestions(false);
                        setHasSearched(false);
                      }}
                      title="Hapus nomor polisi"
                      aria-label="Hapus nomor polisi"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-subtle transition hover:bg-surface-sunken hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Tombol Cari Plat */}
                  <button
                    type="button"
                    onClick={() => executeCheckoutSearch()}
                    disabled={isSearching}
                    title="Cari kendaraan aktif di dalam bengkel"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-on shadow-xs transition hover:bg-accent-hover active:scale-95 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Cari</span>
                  </button>
                </div>
              </div>

              {/* Daftar kandidat kendaraan aktif hasil pencarian */}
              {showSuggestions && activeVehicles.length > 0 && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-2 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-2 shadow-pop">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-ink-muted">
                    <span>Kendaraan Aktif di Dalam ({activeVehicles.length})</span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-ink-subtle hover:text-ink cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                  {activeVehicles.map((vehicle) => {
                    const parked = formatDuration(vehicle.waktu_masuk);
                    const isSelected = Boolean(
                      selectedVehicle && selectedVehicle.id === vehicle.id
                    );
                    return (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => {
                          navigator.vibrate?.(8);
                          handleSelectVehicle(vehicle);
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                          isSelected
                            ? 'border-accent/50 bg-accent-subtle'
                            : 'cursor-pointer border-border bg-surface-raised hover:border-accent/40 hover:bg-surface-sunken'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold tracking-[0.06em] text-ink">
                              {formatPlate(vehicle.no_polisi)}
                            </span>
                            {parked && (
                              <span className={`${CHIP_BASE} ${CHIP_TONE.green}`}>
                                <Clock className="h-3 w-3" />
                                Masuk {parked}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[11px] text-ink-muted">
                            {vehicle.nomor_tiket} • {vehicle.nama_pengemudi} •{' '}
                            {vehicle.tipe_kunjungan || vehicle.jenis_kedatangan}
                          </p>
                        </div>
                        <span className={`${CHIP_BASE} ${CHIP_TONE.blue}`}>
                          Di Bengkel
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status singkat — HANYA tampil setelah pencarian selesai (!isSearching && hasSearched) */}
            {normalizedPlate.length >= 2 && !isSearching && hasSearched && (
              <div className="mt-3">
                {isVehicleInside && selectedVehicle ? (
                  <div className="flex items-start gap-2 rounded-xl border border-status-green/30 bg-status-green-bg px-3.5 py-3 text-xs text-status-green">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">
                      <strong className="font-semibold">Unit ditemukan di dalam bengkel</strong> — siap dikonfirmasi keluar.
                    </span>
                  </div>
                ) : activeVehicles.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-status-red/30 bg-status-red-bg px-3.5 py-3 text-xs text-status-red">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">
                      Plat tidak ada di dalam bengkel (belum check-in atau sudah check-out).
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Info unit terpilih */}
            {isVehicleInside && selectedVehicle && (
              <div className="mt-3 rounded-xl border border-border bg-surface-sunken p-3.5">
                <p className="font-mono text-xl font-bold tracking-[0.1em] text-ink">
                  {formatPlate(selectedVehicle.no_polisi)}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <User className="h-3 w-3" /> PIC / TUJUAN
                    </dt>
                    <dd className="mt-0.5 truncate font-bold text-ink">
                      {selectedVehicle.pic_tujuan || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <Truck className="h-3 w-3" /> PENGEMUDI
                    </dt>
                    <dd className="mt-0.5 truncate font-bold text-ink">
                      {selectedVehicle.nama_pengemudi}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <Truck className="h-3 w-3" /> TUJUAN
                    </dt>
                    <dd className="mt-0.5 truncate font-bold text-ink">
                      {selectedVehicle.tipe_kunjungan}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <Clock className="h-3 w-3" /> WAKTU MASUK
                    </dt>
                    <dd className="mt-0.5 font-bold text-ink">{selectedVehicle.waktu_masuk}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <Timer className="h-3 w-3" /> DURASI
                    </dt>
                    <dd className="mt-0.5 font-bold text-ink">{duration || '-'}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <BadgeCheck className="h-3 w-3" /> OLEH
                    </dt>
                    <dd className="mt-0.5 truncate font-bold text-ink">
                      {selectedVehicle.petugas_security_masuk || 'Security'}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="flex items-center gap-1 text-[10px] font-semibold text-ink-subtle">
                      <Hash className="h-3 w-3" /> NO. TIKET MASUK
                    </dt>
                    <dd className="mt-0.5 truncate font-mono font-bold text-status-green">
                      {selectedVehicle.nomor_tiket}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <label htmlFor="checkout-notes" className={LABEL_CLASS}>
              Keterangan Tambahan <span className="font-normal text-ink-subtle">(opsional)</span>
            </label>
            <input
              id="checkout-notes"
              type="text"
              value={catatanKeluar}
              onChange={(e) => setCatatanKeluar(e.target.value)}
              placeholder="Catatan tambahan"
              className={FIELD_CLASS}
            />
          </div>
        </section>

        <section className={CARD}>
          <MultiCameraSection photos={photos} onChange={setPhotos} eventTitle="Kendaraan" />
        </section>

        {/* Aksi utama: slot BottomChrome (mobile) / sticky bawah konten (desktop) */}
        <PageAction>
          <p className="pb-1.5 text-center text-[11px] font-medium leading-none text-ink-muted">
            {isVehicleInside
              ? 'Siap diproses Check Out.'
              : selectedVehicle
              ? 'Nomor polisi tidak cocok dengan unit terpilih.'
              : normalizedPlate.length < 2
              ? 'Ketik atau scan nomor polisi lalu klik Cari.'
              : !hasSearched
              ? 'Klik tombol Cari untuk memeriksa kendaraan di dalam bengkel.'
              : 'Pilih unit yang sesuai dari daftar di atas.'}
          </p>
          <button
            type="submit"
            form="checkout-form"
            disabled={!isVehicleInside || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              isVehicleInside && !isSubmitting
                ? 'cursor-pointer bg-status-green-fill text-white shadow-card hover:brightness-110 active:scale-[0.99]'
                : isSubmitting
                ? 'cursor-progress bg-status-green-fill text-white opacity-70'
                : 'cursor-not-allowed bg-status-green-fill text-white opacity-45 shadow-none'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {isSubmitting ? 'Memproses...' : 'Konfirmasi Keluar'}
          </button>
        </PageAction>
      </form>

      {/* Modal Scanner OCR Plat Nomor Otomatis */}
      <PlateOcrScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => {
          setIsOcrModalOpen(false);
          setInputMode('manual');
        }}
        onDetected={handleOcrPlateDetected}
      />

      {/* Modal Pop-up Sukses Check Out Ringkas */}
      {successMemo &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 text-center shadow-2xl animate-scale-in">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-status-green/15 rounded-full blur-2xl pointer-events-none" />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-green-bg text-status-green shadow-sm ring-4 ring-status-green/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-ink">Check Out Berhasil!</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Kendaraan resmi keluar dan gate pass telah tercatat.
              </p>
              <div className="my-4 rounded-2xl border border-border bg-surface-sunken p-3 text-center shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  Nomor Polisi
                </p>
                <p className="font-mono text-2xl font-black tracking-widest text-ink">
                  {formatPlate(successMemo.no_polisi)}
                </p>
              </div>
              <dl className="mb-5 space-y-2 rounded-xl border border-border/80 bg-surface-base p-3 text-left text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Pengemudi</dt>
                  <dd className="font-semibold text-ink truncate max-w-[55%]">{successMemo.nama_pengemudi || '-'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Jam Keluar</dt>
                  <dd className="font-mono font-bold text-status-green">{successMemo.waktu_keluar}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" /> Total Durasi</dt>
                  <dd className="font-semibold text-ink">{successMemo.durasi || '-'}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-status-green-fill px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-status-green/25 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Check Out Berikutnya
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
