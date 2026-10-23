import React, { useState, useEffect } from 'react';
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
import { MemoKeluarItem, MsFoto } from '../types';
import { formatPlate, normalizePlate } from '../utils/plate';
import { MemoKeluarPrintModal, MemoKeluarPrintData } from '../components/security/MemoKeluarPrintModal';

const InfoField: React.FC<{
  label: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}> = ({ label, children, icon: Icon }) => (
  <div>
    <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </dt>
    <dd className="mt-1 text-xs font-semibold text-[#0F172A]">{children}</dd>
  </div>
);

export const MemoKeluarView: React.FC = () => {
  const [memoList, setMemoList] = useState<MemoKeluarItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoKeluarItem | null>(null);
  const [memoPhotos, setMemoPhotos] = useState<MsFoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const fetchMemos = async (q?: string) => {
    try {
      setIsLoading(true);
      const data = await securityApi.getMemoKeluar(q);
      setMemoList(data);
    } catch (err) {
      console.error('Error fetching memo keluar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const term = searchTerm.trim();
    const looksLikePlate = /^[A-Za-z]{1,2}[\s-]*\d/.test(term);
    fetchMemos(looksLikePlate ? normalizePlate(term) : term);
  }, [searchTerm]);

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
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D5DDE8] bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#16A34A] to-[#14532D]" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#14532D] text-white shadow-lg shadow-[#16A34A]/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#15803D]">
                Pos Gerbang • KIM 3
              </p>
              <h2 className="mt-0.5 text-base font-bold text-[#0F172A] sm:text-lg">
                Arsip Memo Keluar & Gate Pass
              </h2>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[#64748B] sm:text-xs">
                Riwayat armada yang telah menyelesaikan seluruh tahapan dan di-check out oleh pos
                gerbang.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[#16A34A]/25 bg-[#F0FDF4] px-3 py-1.5 text-[11px] font-bold text-[#15803D]">
              <ClipboardList className="h-3.5 w-3.5" />
              {memoList.length} memo ditampilkan
            </span>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari plat atau no. memo..."
                className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-2.5 pl-10 pr-10 text-xs text-[#0F172A] transition placeholder:text-[#94A3B8] focus:border-[#12388F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12388F]/15"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-[#64748B] transition hover:bg-[#E2E8F0] hover:text-[#0F172A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Memo List */}
      <div className="overflow-hidden rounded-2xl border border-[#D5DDE8] bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-[#F1F5F9]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 p-4">
                <div className="h-9 w-9 rounded-lg bg-[#E2E8F0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-[#E2E8F0]" />
                  <div className="h-2.5 w-44 rounded bg-[#F1F5F9]" />
                </div>
                <div className="h-8 w-24 rounded-lg bg-[#F1F5F9]" />
              </div>
            ))}
          </div>
        ) : memoList.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#94A3B8]">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              {searchTerm ? 'Tidak ada memo yang cocok' : 'Belum ada memo keluar'}
            </h3>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-[#64748B]">
              {searchTerm
                ? 'Coba gunakan potongan plat nomor atau no. memo yang lain.'
                : 'Memo keluar akan muncul di sini setelah kendaraan di-check out oleh pos gerbang.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-[#F1F5F9] lg:hidden">
              {memoList.map((memo) => (
                <div key={memo.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-bold tracking-[0.08em] text-[#0F172A]">
                        {formatPlate(memo.no_polisi)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-[#15803D]">
                        {memo.nomor_memo || memo.nomor_tiket}
                      </p>
                      {memo.nomor_memo && (
                        <p className="font-mono text-[10px] text-[#64748B]">
                          Tiket: {memo.nomor_tiket}
                        </p>
                      )}
                    </div>
                    <span
                      className={`max-w-[45%] shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        formatTipe(memo) === 'Booking'
                          ? 'border-[#6366F1]/25 bg-[#E0E7FF] text-[#3730A3]'
                          : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]'
                      }`}
                      title={memo.tipe_kunjungan}
                    >
                      {memo.tipe_kunjungan || formatTipe(memo)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#475569]">
                      <User className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span className="truncate">
                        {memo.pic_tujuan || memo.nama_pengemudi}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#475569]">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span className="truncate">
                        {memo.petugas_security_keluar || 'Security'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#475569]">
                      <Clock className="h-3.5 w-3.5 text-[#94A3B8]" />
                      <span>Masuk {memo.waktu_masuk}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-[#15803D]">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>Keluar {memo.waktu_check_out}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(memo)}
                    className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-xs font-bold text-[#12388F] transition hover:bg-[#F8FAFC]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Detail & Cetak</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748B]">
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
                <tbody className="divide-y divide-[#F1F5F9]">
                  {memoList.map((memo) => (
                    <tr key={memo.id} className="transition hover:bg-[#F8FAFC]">
                      <td className="p-3.5 pl-5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-[#15803D]">
                            {memo.nomor_memo || memo.nomor_tiket}
                          </span>
                          {memo.nomor_memo && (
                            <span className="font-mono text-[10px] text-[#64748B]">
                              Tiket: {memo.nomor_tiket}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-sm font-bold tracking-wide text-[#0F172A]">
                          {formatPlate(memo.no_polisi)}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-[#0F172A]">{memo.nama_pengemudi}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            formatTipe(memo) === 'Booking'
                              ? 'border-[#6366F1]/25 bg-[#E0E7FF] text-[#3730A3]'
                              : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]'
                          }`}
                        >
                          {memo.tipe_kunjungan || formatTipe(memo)}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#64748B]">{memo.waktu_masuk}</td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 font-bold text-[#15803D]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {memo.waktu_check_out}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#64748B]">
                        {memo.petugas_security_keluar || 'Security'}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(memo)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#12388F] transition hover:border-[#12388F]/30 hover:bg-[#F8FAFC]"
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
      {selectedMemo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detail memo keluar"
          className="app-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="app-modal-in flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#D5DDE8] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFC] to-white p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A34A]/10 text-[#15803D]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] sm:text-base">
                    Detail Memo Keluar & Gate Pass
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#64748B]">
                    {selectedMemo.nomor_tiket}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                title="Tutup"
                className="cursor-pointer rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-xl border border-[#16A34A]/20 bg-gradient-to-r from-[#F0FDF4] to-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#15803D]">
                      Kendaraan Keluar
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-[0.12em] text-[#0F172A]">
                      {formatPlate(selectedMemo.no_polisi)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#16A34A]/25 bg-[#DCFCE7] px-3 py-1 text-[10px] font-bold text-[#15803D]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Selesai & Keluar
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-3">
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
                  <span className="text-[#15803D]">{selectedMemo.waktu_check_out}</span>
                </InfoField>
                <InfoField label="Petugas Keluar" icon={ShieldCheck}>
                  {selectedMemo.petugas_security_keluar}
                </InfoField>
                <InfoField label="No. Memo Keluar" icon={Hash}>
                  <span className="font-mono font-bold text-[#15803D]">
                    {selectedMemo.nomor_memo || selectedMemo.nomor_tiket}
                  </span>
                </InfoField>
                <InfoField label="No. Tiket Masuk" icon={FileText}>
                  <span className="font-mono text-[#64748B]">{selectedMemo.nomor_tiket}</span>
                </InfoField>
              </dl>

              {selectedMemo.catatan_keluar && (
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 text-xs">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                    Catatan Pemeriksaan Gerbang
                  </span>
                  <span className="font-semibold leading-relaxed text-[#0F172A]">
                    {selectedMemo.catatan_keluar}
                  </span>
                </div>
              )}

              {/* Photo Evidence */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                    <ImageIcon className="h-3.5 w-3.5 text-[#12388F]" />
                    Dokumentasi Foto ({memoPhotos.length})
                  </h4>
                </div>
                {isLoadingPhotos ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-xs text-[#64748B]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#12388F]" />
                    Memuat foto...
                  </div>
                ) : memoPhotos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-xs text-[#64748B]">
                    Tidak ada foto terlampir.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {memoPhotos.map((f, idx) => (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm"
                      >
                        <img
                          src={f.foto_data}
                          alt={f.sudut_pandang}
                          className="aspect-video w-full object-cover"
                        />
                        <div className="border-t border-[#E2E8F0] p-2 text-center">
                          <p className="truncate text-[10px] font-bold text-[#0F172A]">
                            {f.sudut_pandang}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            {f.jenis_event}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#64748B] transition hover:bg-[#E2E8F0] hover:text-[#0F172A]"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#12388F] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#12388F]/25 transition hover:bg-[#0D2A6B]"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Memo Keluar (Thermal 80mm)</span>
              </button>
            </div>
          </div>
        </div>
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
            durasi: '-',
            catatan_keluar: selectedMemo.catatan_keluar,
          }}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
