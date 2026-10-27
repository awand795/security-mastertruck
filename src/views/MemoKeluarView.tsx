import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Printer,
  Eye,
  Image as ImageIcon,
  ClipboardList,
  User,
  Clock,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Hash,
  Truck,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { useSecurityStore } from '../store/useSecurityStore';
import { MemoKeluarItem, MsFoto } from '../types';
import { formatPlate, normalizePlate } from '../utils/plate';
import { formatPhotoUrl } from '../utils/image';
import { MemoKeluarPrintModal, MemoKeluarPrintData } from '../components/security/MemoKeluarPrintModal';
import { CHIP_BASE, CHIP_TONE } from '../styles/ui';

const InfoField: React.FC<{
  label: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}> = ({ label, children, icon: Icon }) => (
  <div>
    <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </dt>
    <dd className="mt-1 text-xs font-semibold text-ink">{children}</dd>
  </div>
);

export const MemoKeluarView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemo, setSelectedMemo] = useState<MemoKeluarItem | null>(null);
  const [memoPhotos, setMemoPhotos] = useState<MsFoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);

  const term = searchTerm.trim();
  const queryParam = /^[A-Za-z]{1,2}[\s-]*\d/.test(term) ? normalizePlate(term) : term;
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);

  const {
    data: memoList = [],
    isLoading,
    refetch: fetchMemos,
  } = useQuery({
    queryKey: ['memo-keluar', queryParam, kodeCabang],
    queryFn: () => securityApi.getMemoKeluar(queryParam, kodeCabang),
    refetchInterval: 4000, // Auto-polling 4 detik agar sinkron dengan aktivitas gerbang
  });

  const handleOpenDetail = async (memo: MemoKeluarItem) => {
    setSelectedMemo(memo);
    try {
      setIsLoadingPhotos(true);
      const photos = await securityApi.getFotoKunjungan(memo.id);
      setMemoPhotos(photos);
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedMemo(null);
    setMemoPhotos([]);
  };

  const formatTipe = (memo: MemoKeluarItem) => {
    if (memo.jenis_kedatangan === 'BOOKING') return 'Booking';
    if (memo.jenis_kedatangan) return 'Walk-In';
    return memo.tipe_kunjungan || 'Walk-In';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 md:max-w-4xl xl:max-w-5xl">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-card">
        <div className="absolute inset-y-0 left-0 w-1 bg-accent" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-status-green-fill text-white shadow-card">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-status-green">
                Pos Gerbang • KIM 3
              </p>
              <h2 className="mt-0.5 text-base font-bold text-ink sm:text-lg">
                Arsip Memo Keluar &amp; Gate Pass
              </h2>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-ink-muted sm:text-xs">
                Riwayat armada yang telah menyelesaikan seluruh tahapan dan di-check out oleh pos
                gerbang.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <span className={`${CHIP_BASE} ${CHIP_TONE.green} self-start`}>
              <ClipboardList className="h-3.5 w-3.5" />
              {memoList.length} memo ditampilkan
            </span>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari plat atau no. memo..."
                aria-label="Cari memo keluar"
                className="w-full rounded-xl border border-border-strong bg-surface-raised py-3 pl-10 pr-10 text-base text-ink transition placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Hapus pencarian"
                  aria-label="Hapus pencarian"
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition hover:bg-surface-sunken hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Memo List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-card">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 p-4">
                <div className="h-9 w-9 rounded-lg bg-surface-sunken" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-surface-sunken" />
                  <div className="h-2.5 w-44 rounded bg-surface-sunken" />
                </div>
                <div className="h-8 w-24 rounded-lg bg-surface-sunken" />
              </div>
            ))}
          </div>
        ) : memoList.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-sunken text-ink-subtle">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-ink">
              {searchTerm ? 'Tidak ada memo yang cocok' : 'Belum ada memo keluar'}
            </h3>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-ink-muted">
              {searchTerm
                ? 'Coba gunakan potongan plat nomor atau no. memo yang lain.'
                : 'Memo keluar akan muncul di sini setelah kendaraan di-check out oleh pos gerbang.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: kartu bertumpuk | Tablet (>= 768px): kartu 2 kolom */}
            <div className="grid grid-cols-1 gap-3 bg-surface p-3 md:grid-cols-2 xl:hidden">
              {memoList.map((memo) => (
                <div
                  key={memo.id}
                  className="h-full rounded-2xl border border-border bg-surface-raised p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-bold tracking-[0.1em] text-ink">
                        {formatPlate(memo.no_polisi)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-status-green">
                        {memo.nomor_memo || memo.nomor_tiket}
                      </p>
                      {memo.nomor_memo && (
                        <p className="font-mono text-[10px] text-ink-muted">
                          Tiket: {memo.nomor_tiket}
                        </p>
                      )}
                    </div>
                    <span
                      className={`${CHIP_BASE} max-w-[45%] truncate ${
                        formatTipe(memo) === 'Booking' ? CHIP_TONE.blue : CHIP_TONE.neutral
                      }`}
                      title={memo.tipe_kunjungan}
                    >
                      {memo.tipe_kunjungan || formatTipe(memo)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <User className="h-3.5 w-3.5 text-ink-subtle" />
                      <span className="truncate">{memo.pic_tujuan || memo.nama_pengemudi}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <ShieldCheck className="h-3.5 w-3.5 text-ink-subtle" />
                      <span className="truncate">
                        {memo.petugas_security_keluar || 'Security'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <Clock className="h-3.5 w-3.5 text-ink-subtle" />
                      <span>Masuk {memo.waktu_masuk}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-status-green">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>Keluar {memo.waktu_check_out}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(memo)}
                    className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-raised px-3 py-3 text-xs font-bold text-accent transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Detail &amp; Cetak</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop (>= xl): tabel */}
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle">
                    <th className="p-3.5 pl-5">No. Memo</th>
                    <th className="p-3.5">No. Polisi</th>
                    <th className="p-3.5">PIC / Tujuan</th>
                    <th className="p-3.5">Tujuan</th>
                    <th className="p-3.5">Masuk</th>
                    <th className="p-3.5">Keluar</th>
                    <th className="p-3.5">Petugas</th>
                    <th className="p-3.5 pr-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {memoList.map((memo) => (
                    <tr key={memo.id} className="transition hover:bg-accent-subtle">
                      <td className="p-3.5 pl-5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-status-green">
                            {memo.nomor_memo || memo.nomor_tiket}
                          </span>
                          {memo.nomor_memo && (
                            <span className="font-mono text-[10px] text-ink-muted">
                              Tiket: {memo.nomor_tiket}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex rounded-lg border border-border bg-surface-sunken px-2 py-1 font-mono text-sm font-bold tracking-wide text-ink">
                          {formatPlate(memo.no_polisi)}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-ink">{memo.nama_pengemudi}</td>
                      <td className="p-3.5">
                        <span
                          className={`${CHIP_BASE} ${
                            formatTipe(memo) === 'Booking' ? CHIP_TONE.blue : CHIP_TONE.neutral
                          }`}
                        >
                          {memo.tipe_kunjungan || formatTipe(memo)}
                        </span>
                      </td>
                      <td className="p-3.5 text-ink-muted">{memo.waktu_masuk}</td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 font-bold text-status-green">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {memo.waktu_check_out}
                        </span>
                      </td>
                      <td className="p-3.5 text-ink-muted">
                        {memo.petugas_security_keluar || 'Security'}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(memo)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-xs font-bold text-accent transition hover:border-accent/30 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail & Print Modal */}
      {selectedMemo &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detail memo keluar"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-0 backdrop-blur-sm animate-in fade-in duration-150 sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseDetail();
            }}
          >
            <div
              className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-border bg-surface-raised shadow-pop animate-in zoom-in-95 duration-150 sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Pinned */}
              <div className="safe-top flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface-sunken p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-green-bg text-status-green">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink sm:text-base">
                      Detail Memo Keluar &amp; Gate Pass
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] font-semibold text-status-green">
                      {selectedMemo.nomor_memo || selectedMemo.nomor_tiket}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseDetail}
                  title="Tutup"
                  aria-label="Tutup detail memo"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body Scrollable */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="rounded-xl border border-status-green/30 bg-status-green-bg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-status-green">
                        Kendaraan Keluar
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.12em] text-ink">
                        {formatPlate(selectedMemo.no_polisi)}
                      </p>
                    </div>
                    <span className={`${CHIP_BASE} ${CHIP_TONE.green}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Selesai &amp; Keluar
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-surface-sunken p-4 sm:grid-cols-3">
                  <InfoField label="PIC / Tujuan" icon={User}>
                    {selectedMemo.pic_tujuan || selectedMemo.nama_pengemudi}
                  </InfoField>
                  <InfoField label="Pengemudi" icon={Truck}>
                    {selectedMemo.nama_pengemudi}
                  </InfoField>
                  <InfoField label="Jenis Masuk" icon={Truck}>
                    {selectedMemo.jenis_kedatangan}
                  </InfoField>
                  <InfoField label="Tujuan" icon={ClipboardList}>
                    {selectedMemo.tipe_kunjungan}
                  </InfoField>
                  <InfoField label="Waktu Masuk" icon={Clock}>
                    {selectedMemo.waktu_masuk}
                  </InfoField>
                  <InfoField label="Waktu Keluar" icon={Clock}>
                    <span className="text-status-green">{selectedMemo.waktu_check_out}</span>
                  </InfoField>
                  <InfoField label="Petugas Keluar" icon={ShieldCheck}>
                    {selectedMemo.petugas_security_keluar}
                  </InfoField>
                  <InfoField label="No. Memo Keluar" icon={Hash}>
                    <span className="font-mono font-bold text-status-green">
                      {selectedMemo.nomor_memo || selectedMemo.nomor_tiket}
                    </span>
                  </InfoField>
                  <InfoField label="No. Tiket Masuk" icon={FileText}>
                    <span className="font-mono text-ink-muted">{selectedMemo.nomor_tiket}</span>
                  </InfoField>
                </dl>

                {selectedMemo.catatan_keluar && (
                  <div className="rounded-xl border border-border bg-surface-raised p-3.5 text-xs">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
                      Catatan Pemeriksaan Gerbang
                    </span>
                    <span className="font-semibold leading-relaxed text-ink">
                      {selectedMemo.catatan_keluar}
                    </span>
                  </div>
                )}

                {/* Photo Evidence */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <ImageIcon className="h-3.5 w-3.5 text-accent" />
                      Dokumentasi Foto ({memoPhotos.length})
                    </h4>
                  </div>
                  {isLoadingPhotos ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-sunken p-6 text-xs text-ink-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      Memuat foto...
                    </div>
                  ) : memoPhotos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-5 text-center text-xs text-ink-muted">
                      Tidak ada foto terlampir.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {memoPhotos.map((f, idx) => {
                        const imgUrl = formatPhotoUrl(f.foto_data);
                        return (
                          <div
                            key={idx}
                            onClick={() => imgUrl && setZoomPhoto({ url: imgUrl, title: f.sudut_pandang })}
                            className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-raised shadow-card transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            <div className="relative aspect-video w-full overflow-hidden bg-black">
                              <img
                                src={imgUrl}
                                alt={f.sudut_pandang}
                                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                                onError={(e) => {
                                  // Fallback jika decode gagal
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="border-t border-border p-2 text-center">
                              <p className="truncate text-[10px] font-bold text-ink">
                                {f.sudut_pandang}
                              </p>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-subtle">
                                {f.jenis_event}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Pinned */}
              <div className="safe-bottom flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface-sunken p-4 sm:p-5">
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="cursor-pointer rounded-xl px-4 py-3 text-xs font-semibold text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-accent-on shadow-card transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Memo Keluar &amp; Gate Pass</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Zoom Foto */}
      {zoomPhoto &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setZoomPhoto(null)}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          >
            <div
              className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-black p-2 shadow-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-2">
                <span className="text-xs font-bold text-white">{zoomPhoto.title}</span>
                <button
                  type="button"
                  onClick={() => setZoomPhoto(null)}
                  aria-label="Tutup pratinjau foto"
                  className="rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <img
                src={zoomPhoto.url}
                alt={zoomPhoto.title}
                className="max-h-[75vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>,
          document.body
        )}

      {selectedMemo && (
        <MemoKeluarPrintModal
          memo={{
            id: selectedMemo.id,
            nomor_memo: selectedMemo.nomor_memo || selectedMemo.nomor_tiket,
            nomor_tiket: selectedMemo.nomor_tiket,
            no_polisi: selectedMemo.no_polisi,
            nama_pengemudi: selectedMemo.nama_pengemudi,
            pic_tujuan: selectedMemo.pic_tujuan || selectedMemo.nama_pengemudi || '-',
            waktu_masuk: selectedMemo.waktu_masuk,
            waktu_keluar: selectedMemo.waktu_check_out,
            petugas_keluar: selectedMemo.petugas_security_keluar || 'Security',
            durasi_jam: selectedMemo.durasi_jam,
            catatan_keluar: selectedMemo.catatan_keluar,
            tipe_kunjungan: selectedMemo.tipe_kunjungan,
            jumlah_foto_keluar: isLoadingPhotos
              ? undefined
              : memoPhotos.filter((p) => p.jenis_event === 'KELUAR').length,
          }}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          isReprint={true}
        />
      )}
    </div>
  );
};
