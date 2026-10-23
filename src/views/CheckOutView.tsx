import React, { useState, useEffect } from 'react';
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

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

const FIELD_CLASS =
  'w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition placeholder:text-xs placeholder:text-[#94A3B8] focus:border-[#D97706] focus:outline-none focus:ring-2 focus:ring-[#D97706]/15';

const LABEL_CLASS = 'mb-1 block text-xs font-semibold text-[#0F172A]';

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
  const currentUser = useSecurityStore((state) => state.user);

  const [plateInput, setPlateInput] = useState('');
  const [activeVehicles, setActiveVehicles] = useState<ActiveInsideVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveInsideVehicle | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Exit details
  const [catatanKeluar, setCatatanKeluar] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // Status & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [successMemo, setSuccessMemo] = useState<{
    id: number;
    nomor_memo: string;
    nomor_tiket: string;
    no_polisi: string;
    nama_pengemudi: string;
    pic_tujuan: string;
    waktu_masuk: string;
    waktu_keluar: string;
    petugas_keluar: string;
    durasi: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const data = await securityApi.getActiveInside(normalizePlate(plateInput));
        setActiveVehicles(data);
      } catch (err) {
        console.error('Error fetching inside vehicles:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [plateInput]);

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
        waktu_keluar: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        petugas_keluar: currentUser?.nama || 'Pos Security KIM 3',
        durasi: formatDuration(selectedVehicle.waktu_masuk) || '-',
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
      <div className="mx-auto max-w-md py-4">
        <div className="rounded-2xl border border-[#D5DDE8] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
            <FileCheck className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A]">Kendaraan Keluar</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
            Memo keluar sudah diterbitkan. Kendaraan boleh meninggalkan bengkel.
          </p>

          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Nomor Polisi
            </p>
            <p className="font-mono text-2xl font-bold tracking-[0.12em] text-[#0F172A]">
              {formatPlate(successMemo.no_polisi)}
            </p>
          </div>

          <dl className="mt-3 space-y-2.5 rounded-xl border border-[#E2E8F0] p-4 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Hash className="h-3.5 w-3.5" /> No. Memo Keluar
              </dt>
              <dd className="font-mono font-bold text-[#15803D]">{successMemo.nomor_memo}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <FileCheck className="h-3.5 w-3.5" /> No. Tiket Masuk
              </dt>
              <dd className="font-mono text-[#64748B]">{successMemo.nomor_tiket}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <User className="h-3.5 w-3.5" /> PIC / Tujuan
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successMemo.pic_tujuan}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Truck className="h-3.5 w-3.5" /> Pengemudi
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successMemo.nama_pengemudi}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Clock className="h-3.5 w-3.5" /> Check In
              </dt>
              <dd className="font-semibold text-[#0F172A]">{successMemo.waktu_masuk}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <LogOut className="h-3.5 w-3.5" /> Check Out
              </dt>
              <dd className="font-bold text-[#15803D]">{successMemo.waktu_keluar}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Timer className="h-3.5 w-3.5" /> Durasi
              </dt>
              <dd className="font-semibold text-[#0F172A]">{successMemo.durasi}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <BadgeCheck className="h-3.5 w-3.5" /> Oleh
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successMemo.petugas_keluar}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleReset}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#15803D] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#166534]"
            >
              <LogOut className="h-4 w-4" />
              Check Out Berikutnya
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC]"
            >
              <Printer className="h-4 w-4 text-[#15803D]" />
              Cetak Memo Keluar (Thermal 80mm)
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 px-0.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D97706] text-white shadow-sm shadow-[#D97706]/20">
          <LogOut className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight tracking-tight text-[#0F172A]">Check Out</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
            Kendaraan keluar
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-[#DC2626]/25 bg-[#FEF2F2] px-3.5 py-3 text-xs text-[#B91C1C]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitCheckOut} className="space-y-4">
        <section className="rounded-2xl border border-[#D5DDE8] bg-white p-4 shadow-sm sm:p-5">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkout-plate" className="text-xs font-semibold text-[#0F172A]">
                Nomor Polisi <span className="text-[#DC2626]">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B45309]">
                <Truck className="h-3 w-3" />
                {activeVehicles.length} unit di dalam
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B45309]" />
              <input
                id="checkout-plate"
                type="text"
                required
                autoComplete="off"
                value={plateInput}
                onChange={(e) => {
                  const next = formatPlate(e.target.value);
                  setPlateInput(next);
                  setShowSuggestions(true);
                  if (
                    selectedVehicle &&
                    normalizePlate(selectedVehicle.no_polisi) !== normalizePlate(next)
                  ) {
                    setSelectedVehicle(null);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                autoFocus
                placeholder="Cari plat unit..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-10 pr-10 font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#0F172A] transition placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#94A3B8] focus:border-[#D97706] focus:outline-none focus:ring-2 focus:ring-[#D97706]/15"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#B45309]" />
                ) : plateInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlateInput('');
                      setSelectedVehicle(null);
                      setShowSuggestions(true);
                    }}
                    title="Hapus"
                    className="cursor-pointer rounded-full p-1 text-[#64748B] transition hover:bg-[#E2E8F0]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Autocomplete Dropdown */}
              {showSuggestions && activeVehicles.length > 0 && !selectedVehicle && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#CBD5E1] bg-white shadow-xl">
                  <div className="sticky top-0 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Pilih unit di dalam bengkel
                  </div>
                  {activeVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVehicle(v)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-[#F1F5F9] px-3 py-2.5 text-left transition last:border-0 hover:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#0F172A]">
                            {formatPlate(v.no_polisi)}
                          </span>
                          <span className="text-[10px] text-[#64748B]">{v.nomor_tiket}</span>
                        </div>
                        <p className="truncate text-[11px] text-[#64748B]">
                          {v.nama_pengemudi} • masuk {v.waktu_masuk}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#CBD5E1] bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#475569]">
                        {v.jenis_kedatangan}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status singkat */}
            {plateInput.trim().length >= 2 && (
              <div className="mt-2.5">
                {isVehicleInside && selectedVehicle ? (
                  <div className="flex items-start gap-2 rounded-lg border border-[#16A34A]/25 bg-[#F0FDF4] px-3 py-2.5 text-xs text-[#15803D]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">
                      <strong className="font-semibold">Unit ditemukan</strong> — siap dikonfirmasi
                      keluar.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-[#DC2626]/25 bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#B91C1C]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-relaxed">
                      Plat tidak ada di dalam bengkel. Cek kembali atau pilih dari daftar.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Info unit terpilih */}
            {isVehicleInside && selectedVehicle && (
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <User className="h-3 w-3" /> PIC / TUJUAN
                  </span>
                  <p className="mt-0.5 truncate font-bold text-[#0F172A]">
                    {selectedVehicle.pic_tujuan || '-'}
                  </p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <Truck className="h-3 w-3" /> PENGEMUDI
                  </span>
                  <p className="mt-0.5 truncate font-bold text-[#0F172A]">
                    {selectedVehicle.nama_pengemudi}
                  </p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <Truck className="h-3 w-3" /> TUJUAN
                  </span>
                  <p className="mt-0.5 truncate font-bold text-[#0F172A]">
                    {selectedVehicle.tipe_kunjungan}
                  </p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <Clock className="h-3 w-3" /> WAKTU MASUK
                  </span>
                  <p className="mt-0.5 font-bold text-[#0F172A]">{selectedVehicle.waktu_masuk}</p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <Timer className="h-3 w-3" /> DURASI
                  </span>
                  <p className="mt-0.5 font-bold text-[#0F172A]">{duration || '-'}</p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <BadgeCheck className="h-3 w-3" /> OLEH
                  </span>
                  <p className="mt-0.5 truncate font-bold text-[#0F172A]">
                    {selectedVehicle.petugas_security_masuk || 'Security'}
                  </p>
                </div>
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8]">
                    <Hash className="h-3 w-3" /> NO. MEMO (OTOMATIS)
                  </span>
                  <p className="mt-0.5 truncate font-mono font-bold text-[#15803D]">
                    {selectedVehicle.nomor_tiket}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-dashed border-[#D5DDE8] pt-5">
            <label htmlFor="checkout-notes" className={LABEL_CLASS}>
              Keterangan Tambahan <span className="text-[#94A3B8]">(opsional)</span>
            </label>
            <input
              id="checkout-notes"
              type="text"
              value={catatanKeluar}
              onChange={(e) => setCatatanKeluar(e.target.value)}
              placeholder="Catatan tambahan / barang bawaan..."
              className={FIELD_CLASS}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#D5DDE8] bg-white p-4 shadow-sm sm:p-5">
          <MultiCameraSection photos={photos} onChange={setPhotos} eventTitle="Kendaraan" />
        </section>

        <div className="rounded-2xl border border-[#D5DDE8] bg-white p-3 shadow-sm sm:p-4">
          <button
            type="submit"
            disabled={!isVehicleInside || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition ${
              isVehicleInside && !isSubmitting
                ? 'cursor-pointer bg-[#15803D] text-white shadow-md shadow-[#15803D]/20 hover:bg-[#166534]'
                : 'cursor-not-allowed border border-[#CBD5E1] bg-[#E2E8F0] text-[#94A3B8]'
            }`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {isSubmitting ? 'Memproses...' : 'Konfirmasi Keluar'}
          </button>
        </div>
      </form>
    </div>
  );
};
