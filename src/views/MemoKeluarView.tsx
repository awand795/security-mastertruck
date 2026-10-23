import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Eye, 
  Image as ImageIcon 
} from 'lucide-react';
import { securityApi } from '../api/client';
import { MemoKeluarItem, MsFoto } from '../types';

export const MemoKeluarView: React.FC = () => {
  const [memoList, setMemoList] = useState<MemoKeluarItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoKeluarItem | null>(null);
  const [memoPhotos, setMemoPhotos] = useState<MsFoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

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
    fetchMemos(searchTerm);
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#16A34A]/10 text-[#16A34A]">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">Arsip Memo Keluar & Gate Pass</h2>
          </div>
          <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
            Daftar kendaraan armada yang telah menyelesaikan seluruh tahapan dan di-check out oleh pos gerbang.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari plat atau tiket..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F]"
          />
        </div>
      </div>

      {/* Memo List Table */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">Memuat riwayat memo keluar...</div>
        ) : memoList.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            Belum ada kendaraan yang di-check out hari ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] font-bold">
                  <th className="p-3.5 pl-5">No. Tiket</th>
                  <th className="p-3.5">Plat Nomor</th>
                  <th className="p-3.5">Driver</th>
                  <th className="p-3.5">Tipe Kunjungan</th>
                  <th className="p-3.5">Waktu Masuk</th>
                  <th className="p-3.5">Waktu Keluar</th>
                  <th className="p-3.5">Petugas Gerbang</th>
                  <th className="p-3.5 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {memoList.map((memo) => (
                  <tr key={memo.id} className="hover:bg-[#F8FAFC] transition">
                    <td className="p-3.5 pl-5 font-mono font-bold text-[#12388F]">{memo.nomor_tiket}</td>
                    <td className="p-3.5 font-mono font-bold text-[#0F172A] text-sm tracking-wide">{memo.no_polisi}</td>
                    <td className="p-3.5 text-[#0F172A] font-semibold">{memo.nama_pengemudi}</td>
                    <td className="p-3.5 text-[#64748B]">{memo.tipe_kunjungan}</td>
                    <td className="p-3.5 text-[#64748B]">{memo.waktu_masuk}</td>
                    <td className="p-3.5 text-[#16A34A] font-bold">{memo.waktu_check_out}</td>
                    <td className="p-3.5 text-[#64748B]">{memo.petugas_security_keluar || 'Security'}</td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(memo)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F1F5F9] text-[#12388F] border border-[#CBD5E1] text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail & Cetak</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Print Modal */}
      {selectedMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative max-w-2xl w-full bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-bold text-[#0F172A] text-base">Detail Memo Keluar & Gate Pass</h3>
                <p className="text-xs text-[#64748B]">No. Tiket: {selectedMemo.nomor_tiket}</p>
              </div>
              <button
                onClick={() => setSelectedMemo(null)}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs">
                <div>
                  <span className="text-[#64748B] block font-medium">No. Polisi</span>
                  <span className="text-base font-bold font-mono text-[#0F172A] tracking-wider">{selectedMemo.no_polisi}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Pengemudi</span>
                  <span className="font-bold text-[#0F172A]">{selectedMemo.nama_pengemudi}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Jenis Masuk</span>
                  <span className="font-bold text-[#0F172A]">{selectedMemo.jenis_kedatangan}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Waktu Masuk</span>
                  <span className="font-semibold text-[#475569]">{selectedMemo.waktu_masuk}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Waktu Keluar</span>
                  <span className="font-bold text-[#16A34A]">{selectedMemo.waktu_check_out}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Petugas Keluar</span>
                  <span className="font-semibold text-[#0F172A]">{selectedMemo.petugas_security_keluar}</span>
                </div>
              </div>

              {selectedMemo.catatan_keluar && (
                <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs">
                  <span className="text-[#64748B] block mb-0.5 font-medium">Catatan Pemeriksaan Gerbang:</span>
                  <span className="text-[#0F172A] font-semibold">{selectedMemo.catatan_keluar}</span>
                </div>
              )}

              {/* Photo Evidence */}
              <div>
                <h4 className="text-xs font-bold text-[#0F172A] mb-2 flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#12388F]" />
                  <span>Dokumentasi Foto Master ({memoPhotos.length} Foto)</span>
                </h4>
                {isLoadingPhotos ? (
                  <div className="p-6 text-center text-xs text-[#64748B]">Memuat foto...</div>
                ) : memoPhotos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-center text-xs text-[#64748B]">
                    Tidak ada foto terlampir.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {memoPhotos.map((f, idx) => (
                      <div key={idx} className="rounded-xl border border-[#CBD5E1] bg-white overflow-hidden shadow-2xs">
                        <img
                          src={f.foto_data}
                          alt={f.sudut_pandang}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-2 text-[10px] text-center border-t border-[#E2E8F0] font-bold text-[#0F172A]">
                          {f.sudut_pandang} ({f.jenis_event})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedMemo(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#12388F] hover:bg-[#0D2A6B] text-white text-xs font-bold flex items-center space-x-2 transition shadow-md shadow-[#12388F]/25 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Gate Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
