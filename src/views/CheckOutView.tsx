import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  Search,
  User,
  CheckCircle2,
  AlertTriangle,
  Printer,
  FileCheck,
  Truck,
  X,
  Loader2,
  Clock,
  Hash,
  Timer,
  BadgeCheck,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { ActiveInsideVehicle } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { MemoKeluarPrintModal } from '../components/security/MemoKeluarPrintModal';
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

export const CheckOutView: React.FC = () => {
  const queryClient = useQueryClient();
  const currentUser = useSecurityStore((state) => state.user);
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);
  const canAutoFocus = !window.matchMedia?.('(pointer: coarse)').matches;

  const [plateInput, setPlateInput] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveInsideVehicle | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Exit details
  const [catatanKeluar, setCatatanKeluar] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // Status & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [successMemo, setSuccessMemo] = useState<any | null>(null);

  const normalizedPlate = normalizePlate(plateInput);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: activeVehicles = [],
    isLoading: isSearching,
  } = useQuery({
    queryKey: ['active-inside', normalizedPlate, kodeCabang],
    queryFn: () => securityApi.getActiveInside(normalizedPlate, kodeCabang),
    refetchInterval: 4000, // Auto-polling 4 detik agar sinkron saat ada armada baru masuk/keluar
  });

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

  // Keyboard-wedge barcode/QR scanner listener global
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika user sedang mengetik di textarea catatan
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 250) {
        scanBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (scanBuffer.trim().length >= 3) {
          const query = scanBuffer.trim().toUpperCase();
          const found = activeVehicles.find(
            (v) =>
              v.nomor_tiket.trim().toUpperCase() === query ||
              normalizePlate(v.no_polisi) === normalizePlate(query)
          );
          if (found) {
            e.preventDefault();
            setSelectedVehicle(found);
            setPlateInput(formatPlate(found.no_polisi));
            setShowSuggestions(false);
          }
          scanBuffer = '';
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVehicles]);

  // Auto-sync jika plat atau nomor tiket input sama persis dengan armada yang aktif di bengkel
  useEffect(() => {
    if (!plateInput || plateInput.trim().length < 3) return;
    const cleanPlate = normalizePlate(plateInput);
    const rawInput = plateInput.trim().toUpperCase();

    const exact = activeVehicles.find(
      (v) =>
        normalizePlate(v.no_polisi) === cleanPlate ||
        v.nomor_tiket.trim().toUpperCase() === rawInput
    );
    if (exact && (!selectedVehicle || selectedVehicle.id !== exact.id)) {
      setSelectedVehicle(exact);
      if (exact.nomor_tiket.trim().toUpperCase() === rawInput) {
        setPlateInput(formatPlate(exact.no_polisi));
      }
    }
  }, [plateInput, activeVehicles, selectedVehicle]);

  const handlePlateInputChange = (raw: string) => {
    const rawTrimmed = raw.trim().toUpperCase();
    // Cek jika input adalah nomor tiket (mis. TG-...)
    const matchedByTicket = activeVehicles.find(
      (v) => v.nomor_tiket.trim().toUpperCase() === rawTrimmed
    );

    if (matchedByTicket) {
      setSelectedVehicle(matchedByTicket);
      setPlateInput(formatPlate(matchedByTicket.no_polisi));
      setShowSuggestions(false);
      return;
    }

    const formatted = formatPlate(raw);
    setPlateInput(formatted);
    const clean = normalizePlate(raw);

    if (clean.length < 2 && rawTrimmed.length < 2) {
      setShowSuggestions(false);
      setSelectedVehicle(null);
      return;
    }

    setShowSuggestions(true);
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
              sudut_pandang: p.label,
              foto_data: p.dataUrl,
            });
          } catch (errFoto) {
            console.error('Error saving exit foto:', errFoto);
          }
        }
      }

      setSuccessMemo({
        id: selectedVehicle.id,
        nomor_memo: checkOutRes?.nomor_memo || `MK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
        nomor_tiket: selectedVehicle.nomor_tiket,
        no_polisi: selectedVehicle.no_polisi,
        nama_pengemudi: selectedVehicle.nama_pengemudi,
        pic_tujuan: selectedVehicle.pic_tujuan || selectedVehicle.nama_pengemudi || '-',
        waktu_masuk: selectedVehicle.waktu_masuk,
        waktu_keluar: new Date().toISOString(),
        petugas_keluar: currentUser?.nama || 'Pos Security KIM 3',
        catatan_keluar: catatanKeluar,
        tipe_kunjungan: selectedVehicle.tipe_kunjungan,
        durasi_jam: selectedVehicle.durasi_jam,
        jumlah_foto_keluar: photos.filter((p) => Boolean(p.dataUrl)).length,
      });

      broadcastRealtimeEvent({
        type: 'VEHICLE_CHECKED_OUT',
        targetRoles: ['Customer Fleet', 'SA', 'ALL'],
        title: 'Kendaraan Check Out & Keluar Gerbang',
        message: `Unit ${formatPlate(selectedVehicle.no_polisi)} telah selesai pemeriksaan dan keluar gerbang security. No. Memo: ${checkOutRes?.nomor_memo || 'Memo Keluar'}.`,
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

      setIsPrintModalOpen(true);
    } catch (err: any) {
      console.error('Check out error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal memproses check out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsPrintModalOpen(false);
    setSuccessMemo(null);
    setSelectedVehicle(null);
    setPlateInput('');
    setCatatanKeluar('');
    setPhotos(INITIAL_PHOTOS);
  };

  const duration = selectedVehicle ? formatDuration(selectedVehicle.waktu_masuk) : null;

  if (successMemo) {
    return (
      <div className="mx-auto max-w-md py-2">
        <div className="rounded-2xl border border-border bg-surface-raised p-6 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-status-green-bg text-status-green">
            <FileCheck className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-ink">Kendaraan Keluar</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Memo keluar sudah diterbitkan. Kendaraan boleh meninggalkan bengkel.
          </p>

          <div className="mt-4 rounded-xl border border-border bg-surface-sunken px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              Nomor Polisi
            </p>
            <p className="font-mono text-2xl font-bold tracking-[0.12em] text-ink">
              {formatPlate(successMemo.no_polisi)}
            </p>
          </div>

          <dl className="mt-3 space-y-2.5 rounded-xl border border-border p-4 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Hash className="h-3.5 w-3.5" /> No. Memo Keluar
              </dt>
              <dd className="font-mono font-bold text-status-green">{successMemo.nomor_memo}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <FileCheck className="h-3.5 w-3.5" /> No. Tiket Masuk
              </dt>
              <dd className="font-mono text-ink-muted">{successMemo.nomor_tiket}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <User className="h-3.5 w-3.5" /> PIC / Tujuan
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successMemo.pic_tujuan}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Truck className="h-3.5 w-3.5" /> Pengemudi
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successMemo.nama_pengemudi}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Clock className="h-3.5 w-3.5" /> Check In
              </dt>
              <dd className="font-semibold text-ink">{successMemo.waktu_masuk}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <LogOut className="h-3.5 w-3.5" /> Check Out
              </dt>
              <dd className="font-bold text-status-green">{successMemo.waktu_keluar}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Timer className="h-3.5 w-3.5" /> Durasi
              </dt>
              <dd className="font-semibold text-ink">{successMemo.durasi}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <BadgeCheck className="h-3.5 w-3.5" /> Oleh
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successMemo.petugas_keluar}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleReset}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-status-green-fill px-4 py-3.5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-green/50 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Check Out Berikutnya
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-xs font-bold text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
            >
              <Printer className="h-4 w-4 text-status-green" />
              Cetak Gate Pass (Memo Keluar)
            </button>
          </div>

          <MemoKeluarPrintModal
            memo={successMemo}
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            onNext={handleReset}
          />
        </div>
      </div>
    );
  }

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
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkout-plate" className="text-sm font-bold text-ink">
                Nomor Polisi <span className="text-status-red">*</span>
              </label>
            </div>

            <div ref={searchContainerRef} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" />
              <input
                id="checkout-plate"
                type="text"
                required
                autoComplete="off"
                value={plateInput}
                onChange={(e) => handlePlateInputChange(e.target.value)}
                onFocus={() => {
                  if (normalizedPlate.length >= 2) setShowSuggestions(true);
                }}
                autoFocus={canAutoFocus}
                placeholder="BK 1234 ABC"
                className={FIELD_PLATE}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                ) : plateInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlateInput('');
                      setSelectedVehicle(null);
                      setShowSuggestions(false);
                    }}
                    title="Hapus"
                    aria-label="Hapus nomor polisi"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition hover:bg-surface-sunken hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Daftar kandidat kendaraan aktif saat mengetik (seperti di Check In) */}
              {showSuggestions && normalizedPlate.length >= 2 && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-2 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-2 shadow-pop">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-xs text-ink-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      Mencari kendaraan di bengkel...
                    </div>
                  ) : activeVehicles.length > 0 ? (
                    activeVehicles.map((vehicle) => {
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
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-ink-muted">
                      Kendaraan tidak ditemukan di dalam bengkel
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status singkat */}
            {normalizedPlate.length >= 2 && (
              <div className="mt-3">
                {isVehicleInside && selectedVehicle ? (
                  <div className="flex items-start gap-2 rounded-xl border border-status-green/30 bg-status-green-bg px-3.5 py-3 text-xs text-status-green">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">
                      <strong className="font-semibold">Unit ditemukan</strong> — siap dikonfirmasi
                      keluar.
                    </span>
                  </div>
                ) : !isSearching && activeVehicles.length === 0 ? (
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
                      <Hash className="h-3 w-3" /> NO. MEMO (OTOMATIS)
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
              ? 'Gate Pass / Memo Keluar diterbitkan setelah Check Out sukses.'
              : selectedVehicle
              ? 'Nomor polisi tidak cocok dengan unit terpilih.'
              : normalizedPlate.length < 2
              ? 'Ketik nomor polisi kendaraan yang akan keluar.'
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
    </div>
  );
};
