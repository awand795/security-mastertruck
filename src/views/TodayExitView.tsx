import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Search,
  Image as ImageIcon,
  User,
  Clock,
  ArrowRight,
  X,
  Loader2,
  Truck,
  Hash,
  Timer,
  BadgeCheck,
  Sparkles,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { useSecurityStore } from '../store/useSecurityStore';
import { MemoKeluarItem, MsFoto } from '../types';
import { formatPlate, normalizePlate } from '../utils/plate';
import { formatPhotoUrl } from '../utils/image';
import { CARD, FIELD_PLATE, CHIP_BASE, CHIP_TONE } from '../styles/ui';

/**
 * Validasi apakah timestamp terjadi pada hari ini (WIB/lokal)
 */
const isCheckOutToday = (dateStr?: string | null): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

export const TodayExitView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState<MemoKeluarItem | null>(null);
  const [photosList, setPhotosList] = useState<MsFoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  const term = searchTerm.trim();
  const queryParam = /^[A-Za-z]{1,2}[\s-]*\d/.test(term) ? normalizePlate(term) : term;
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);

  // Ambil riwayat check-out dari API
  const {
    data: allExits = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['today-exits', queryParam, kodeCabang],
    queryFn: () => securityApi.getMemoKeluar(queryParam, kodeCabang),
    refetchInterval: 5000, // Refresh berkala agar update otomatis
  });

  // Filter HANYA yang keluar hari ini saja
  const todayExits = allExits
    .filter((item) => isCheckOutToday(item.waktu_check_out))
    .sort((a, b) => {
      const timeA = new Date((a.waktu_check_out || '').replace(' ', 'T')).getTime() || 0;
      const timeB = new Date((b.waktu_check_out || '').replace(' ', 'T')).getTime() || 0;
      return timeB - timeA;
    });

  const handleOpenPhotos = async (item: MemoKeluarItem) => {
    setSelectedItemForPhotos(item);
    setIsLoadingPhotos(true);
    try {
      const photos = await securityApi.getFotoKunjungan(item.id);
      setPhotosList(photos);
    } catch (err) {
      console.error('Gagal memuat foto:', err);
      setPhotosList([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header Halaman */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-0.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-on shadow-card">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight text-ink">Kendaraan Keluar Hari Ini</h2>
            <p className="text-xs font-semibold text-ink-subtle">{todayFormatted}</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent self-start sm:self-auto">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{todayExits.length} Unit Keluar Hari Ini</span>
        </div>
      </div>

      {/* Input Pencarian Nopol / Pengemudi */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nomor polisi atau nama pengemudi..."
          className={`${FIELD_PLATE} pl-10 text-sm`}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Konten Daftar Unit */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <p className="text-sm font-semibold">Memuat riwayat kendaraan keluar hari ini...</p>
        </div>
      ) : todayExits.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center py-14 text-center`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle mb-3">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Belum Ada Kendaraan Keluar Hari Ini</h3>
          <p className="mt-1 max-w-sm text-xs text-ink-muted">
            {searchTerm
              ? `Tidak ditemukan unit keluar dengan kata kunci "${searchTerm}".`
              : 'Belum ada catatan kendaraan yang check-out dari pos gerbang untuk hari ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {todayExits.map((item) => {
            const formatTimeOnly = (t?: string | null) => {
              if (!t) return '-';
              const d = new Date(t.replace(' ', 'T'));
              if (Number.isNaN(d.getTime())) return t;
              return (
                d.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Jakarta',
                }) + ' WIB'
              );
            };

            const durationText =
              item.durasi_jam !== undefined && item.durasi_jam !== null
                ? item.durasi_jam >= 1
                  ? `${Math.floor(item.durasi_jam)} jam ${Math.round((item.durasi_jam % 1) * 60)} mnt`
                  : `${Math.round(item.durasi_jam * 60)} menit`
                : '-';

            return (
              <div
                key={item.id}
                className={`${CARD} relative flex flex-col justify-between p-4 transition-all hover:border-accent/40 hover:shadow-card`}
              >
                <div>
                  {/* Header Kartu: Nopol & Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
                    <div>
                      <span className="font-mono text-base font-black tracking-wider text-ink">
                        {formatPlate(item.no_polisi)}
                      </span>
                      <p className="text-xs font-semibold text-ink-muted flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" />
                        {item.nama_pengemudi || 'Driver'}
                      </p>
                    </div>
                    <span className={`${CHIP_BASE} ${CHIP_TONE.green}`}>
                      Keluar Hari Ini
                    </span>
                  </div>

                  {/* Rincian Waktu & Durasi */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border bg-surface-sunken p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1">
                        <Clock className="h-3 w-3 text-status-green" /> Masuk
                      </span>
                      <p className="font-bold text-ink mt-0.5">{formatTimeOnly(item.waktu_masuk)}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-sunken p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1">
                        <Clock className="h-3 w-3 text-accent" /> Keluar
                      </span>
                      <p className="font-bold text-accent mt-0.5">{formatTimeOnly(item.waktu_check_out)}</p>
                    </div>
                  </div>

                  {/* Info Tambahan */}
                  <div className="mt-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5 text-accent" /> Durasi Servis:
                      </span>
                      <span className="font-bold text-ink">{durationText}</span>
                    </div>

                    {item.tipe_kunjungan && (
                      <div className="flex items-center justify-between text-ink-muted">
                        <span>Tujuan:</span>
                        <span className="font-semibold text-ink">{item.tipe_kunjungan}</span>
                      </div>
                    )}

                    {item.petugas_security_keluar && (
                      <div className="flex items-center justify-between text-ink-muted text-[11px]">
                        <span>Security:</span>
                        <span className="truncate max-w-[55%] text-right font-medium">
                          {item.petugas_security_keluar}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tombol Lihat Foto */}
                <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenPhotos(item)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-surface-sunken hover:border-accent active:scale-95"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-accent" />
                    <span>Lihat Foto</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL LIHAT FOTO KUNJUNGAN */}
      {selectedItemForPhotos &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Foto Dokumentasi Kunjungan"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedItemForPhotos(null)}
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-pop animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface-raised">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-bold text-ink sm:text-base">
                    Foto Unit: {formatPlate(selectedItemForPhotos.no_polisi)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemForPhotos(null)}
                  className="rounded-lg p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Konten Foto */}
              <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">
                {isLoadingPhotos ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-ink-muted">
                    <Loader2 className="h-7 w-7 animate-spin text-accent mb-2" />
                    <p className="text-xs font-semibold">Memuat foto dokumentasi...</p>
                  </div>
                ) : photosList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-ink-muted">
                    Tidak ada foto dokumentasi tersimpan untuk kendaraan ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    {photosList.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        className="group relative overflow-hidden rounded-xl border border-border bg-black"
                      >
                        <div className="absolute top-2 left-2 z-10 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                          {photo.sudut_pandang} • {photo.jenis_event}
                        </div>
                        <img
                          src={formatPhotoUrl(photo.foto_data)}
                          alt={photo.sudut_pandang}
                          onClick={() => setZoomPhotoUrl(formatPhotoUrl(photo.foto_data))}
                          className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-105 cursor-zoom-in"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ZOOM FULLSCREEN FOTO */}
      {zoomPhotoUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4"
            onClick={() => setZoomPhotoUrl(null)}
          >
            <button
              type="button"
              onClick={() => setZoomPhotoUrl(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={zoomPhotoUrl}
              alt="Zoomed photo"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default TodayExitView;
