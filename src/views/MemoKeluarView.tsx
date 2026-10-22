import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Calendar, 
  Clock, 
  CheckCircle, 
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Arsip Memo Keluar & Gate Pass</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Daftar kendaraan yang telah menyelesaikan seluruh tahapan dan di-check out oleh pos gerbang.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari plat atau tiket..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Memo List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Memuat riwayat memo keluar...</div>
        ) : memoList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Belum ada kendaraan yang di-check out.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
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
              <tbody className="divide-y divide-slate-800/60">
                {memoList.map((memo) => (
                  <tr key={memo.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 pl-5 font-mono font-bold text-indigo-400">{memo.nomor_tiket}</td>
                    <td className="p-3.5 font-mono font-bold text-white text-sm tracking-wide">{memo.no_polisi}</td>
                    <td className="p-3.5 text-slate-300 font-medium">{memo.nama_pengemudi}</td>
                    <td className="p-3.5 text-slate-400">{memo.tipe_kunjungan}</td>
                    <td className="p-3.5 text-slate-400">{memo.waktu_masuk}</td>
                    <td className="p-3.5 text-emerald-400 font-semibold">{memo.waktu_check_out}</td>
                    <td className="p-3.5 text-slate-400">{memo.petugas_security_keluar || 'Security'}</td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(memo)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Detail Memo Keluar & Gate Pass</h3>
                <p className="text-xs text-slate-400">Tiket: {selectedMemo.nomor_tiket}</p>
              </div>
              <button
                onClick={() => setSelectedMemo(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">No. Polisi</span>
                  <span className="text-base font-bold font-mono text-white tracking-wider">{selectedMemo.no_polisi}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pengemudi</span>
                  <span className="font-semibold text-slate-200">{selectedMemo.nama_pengemudi}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jenis Masuk</span>
                  <span className="font-semibold text-slate-200">{selectedMemo.jenis_kedatangan}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Waktu Masuk</span>
                  <span className="font-semibold text-slate-300">{selectedMemo.waktu_masuk}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Waktu Keluar</span>
                  <span className="font-semibold text-emerald-400">{selectedMemo.waktu_check_out}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Petugas Keluar</span>
                  <span className="font-semibold text-slate-300">{selectedMemo.petugas_security_keluar}</span>
                </div>
              </div>

              {selectedMemo.catatan_keluar && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-500 block mb-0.5">Catatan Pemeriksaan Gerbang:</span>
                  <span className="text-slate-300">{selectedMemo.catatan_keluar}</span>
                </div>
              )}

              {/* Photo Evidence */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dokumentasi Foto Master ({memoPhotos.length} Foto)</span>
                </h4>
                {isLoadingPhotos ? (
                  <div className="p-6 text-center text-xs text-slate-500">Memuat foto...</div>
                ) : memoPhotos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                    Tidak ada foto terlampir.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {memoPhotos.map((f, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                        <img
                          src={f.foto_data}
                          alt={f.sudut_pandang}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-2 text-[10px] text-center border-t border-slate-800 font-medium text-slate-300">
                          {f.sudut_pandang} ({f.jenis_event})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedMemo(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-2 transition shadow-lg shadow-indigo-600/30"
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
