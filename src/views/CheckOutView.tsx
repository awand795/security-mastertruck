import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  Search, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Printer,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { securityApi } from '../api/client';
import { ActiveInsideVehicle } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { useSecurityStore } from '../store/useSecurityStore';

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

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
  const [successMemo, setSuccessMemo] = useState<{
    id: number;
    nomor_tiket: string;
    no_polisi: string;
    nama_pengemudi: string;
    waktu_masuk: string;
    waktu_keluar: string;
    petugas_keluar: string;
  } | null>(null);

  // Fetch active vehicles letter-by-letter
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const data = await securityApi.getActiveInside(plateInput.trim());
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
    setPlateInput(v.no_polisi);
    setShowSuggestions(false);
  };

  // Determine if plate matches an active inside vehicle
  const isVehicleInside = Boolean(
    selectedVehicle && 
    selectedVehicle.no_polisi.toLowerCase() === plateInput.trim().toLowerCase()
  );

  const handleSubmitCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVehicleInside || !selectedVehicle) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await securityApi.postCheckOut({
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
        nomor_tiket: selectedVehicle.nomor_tiket,
        no_polisi: selectedVehicle.no_polisi,
        nama_pengemudi: selectedVehicle.nama_pengemudi,
        waktu_masuk: selectedVehicle.waktu_masuk,
        waktu_keluar: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        petugas_keluar: currentUser?.nama || 'Pos Security KIM 3',
      });
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
    setPlateInput('');
    setCatatanKeluar('');
    setPhotos(INITIAL_PHOTOS);
  };

  if (successMemo) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Gate Pass / Memo Keluar Diterbitkan</h2>
          <p className="text-xs text-slate-400 mb-6">
            Kendaraan {successMemo.no_polisi} telah diizinkan keluar dan tercatat resmi di sistem keamanan bengkel.
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Nomor Gate Pass / Tiket</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{successMemo.nomor_tiket}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Plat Kendaraan</span>
              <span className="text-sm font-bold text-white tracking-wider font-mono">{successMemo.no_polisi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Pengemudi</span>
              <span className="text-xs font-semibold text-slate-200">{successMemo.nama_pengemudi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Waktu Masuk</span>
              <span className="text-xs text-slate-300">{successMemo.waktu_masuk}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Waktu Keluar Gerbang</span>
              <span className="text-xs font-semibold text-emerald-400">{successMemo.waktu_keluar}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Memo Keluar</span>
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-600/30"
            >
              <LogOut className="w-4 h-4" />
              <span>Check Out Berikutnya</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pemeriksaan Kendaraan Keluar (Check Out)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validasi fisik unit yang berada di dalam area bengkel sebelum meninggalkan gerbang pos.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Check-Out Form */}
      <form onSubmit={handleSubmitCheckOut} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Plat Nomor Polisi Autocomplete against Active Inside */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Nomor Polisi Unit Keluar <span className="text-amber-400">(Unit di Dalam Bengkel)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={plateInput}
                onChange={(e) => {
                  setPlateInput(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                  if (selectedVehicle && selectedVehicle.no_polisi !== e.target.value.toUpperCase()) {
                    setSelectedVehicle(null);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Ketik plat nomor... Contoh: BK 9393 ER"
                className="w-full pl-10 pr-24 py-3 bg-slate-950 border border-slate-800 rounded-xl text-base font-mono font-bold tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 uppercase transition"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-slate-500">
                  Mencari...
                </div>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && activeVehicles.length > 0 && !selectedVehicle && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800 bg-slate-950/60">
                  Armada yang Sedang di Dalam Bengkel:
                </div>
                {activeVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVehicle(v)}
                    className="w-full text-left p-3 hover:bg-slate-800/80 border-b border-slate-800/50 flex items-center justify-between transition"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm">{v.no_polisi}</span>
                        <span className="text-xs text-slate-400">• Tiket: {v.nomor_tiket}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Driver: {v.nama_pengemudi} • Masuk: {v.waktu_masuk}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                      {v.jenis_kedatangan}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Validation Feedback */}
            {plateInput.trim().length >= 2 && (
              <div className="mt-2.5">
                {isVehicleInside && selectedVehicle ? (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center space-x-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <div>
                      <span className="font-semibold">Unit Ditemukan di Dalam:</span> Tiket {selectedVehicle.nomor_tiket} • Driver: {selectedVehicle.nama_pengemudi}. Siap diproses keluar.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 flex items-center space-x-2.5 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <div>
                      <span className="font-semibold">Kendaraan Tidak Ada di Dalam Bengkel:</span> Plat nomor tidak terdaftar pada antrean aktif masuk atau sudah pernah di-check out. Tombol check out dinonaktifkan.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details of selected vehicle */}
          {selectedVehicle && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block">Nama Pengemudi</span>
                <span className="text-slate-200 font-semibold">{selectedVehicle.nama_pengemudi}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tipe Kunjungan</span>
                <span className="text-slate-200 font-semibold">{selectedVehicle.tipe_kunjungan}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Waktu Masuk Awal</span>
                <span className="text-slate-200 font-semibold">{selectedVehicle.waktu_masuk}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Catatan Pemeriksaan Keluar (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatanKeluar}
              onChange={(e) => setCatatanKeluar(e.target.value)}
              placeholder="Kelengkapan surat kendaraan, kondisi fisik saat meninggalkan bengkel..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Multi Camera Section for Exit */}
          <div className="pt-4 border-t border-slate-800">
            <MultiCameraSection
              photos={photos}
              onChange={setPhotos}
              eventTitle="Kepulangan Keluar"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="submit"
            disabled={!isVehicleInside || isSubmitting}
            className={`px-8 py-3.5 rounded-xl font-semibold text-sm flex items-center space-x-2 transition ${
              isVehicleInside && !isSubmitting
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xl shadow-amber-600/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Memproses Check Out...'
                : isVehicleInside
                ? 'Validasi & Check Out Kendaraan'
                : 'Plat Tidak Ada di Kunjungan Masuk (Disabled)'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
