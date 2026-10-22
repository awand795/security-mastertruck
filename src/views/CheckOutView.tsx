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
      <div className="max-w-xl mx-auto py-4">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 text-center shadow-lg relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-[#DCFCE7] border border-[#16A34A]/30 text-[#16A34A] flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-[#0F172A] mb-1">Gate Pass / Memo Keluar Diterbitkan</h2>
          <p className="text-xs text-[#64748B] mb-6">
            Kendaraan {successMemo.no_polisi} telah diizinkan keluar dan tercatat resmi di sistem keamanan bengkel.
          </p>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Nomor Gate Pass / Tiket</span>
              <span className="text-sm font-mono font-bold text-[#16A34A]">{successMemo.nomor_tiket}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Plat Kendaraan</span>
              <span className="text-sm font-bold text-[#0F172A] tracking-wider font-mono">{successMemo.no_polisi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Pengemudi</span>
              <span className="text-xs font-semibold text-[#0F172A]">{successMemo.nama_pengemudi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Waktu Masuk</span>
              <span className="text-xs text-[#475569]">{successMemo.waktu_masuk}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#64748B]">Waktu Keluar Gerbang</span>
              <span className="text-xs font-bold text-[#16A34A]">{successMemo.waktu_keluar}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#12388F]" />
              <span>Cetak Memo Keluar</span>
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-md shadow-[#16A34A]/25 cursor-pointer"
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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 sm:p-6 shadow-xs flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-[#FEF3C7] text-[#D97706] border border-[#D97706]/20">
          <LogOut className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Pemeriksaan Kendaraan Keluar (Check Out)</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Validasi fisik unit armada yang sedang berada di dalam area bengkel sebelum meninggalkan gerbang pos.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 flex items-start space-x-3 text-xs text-[#DC2626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Check-Out Form */}
      <form onSubmit={handleSubmitCheckOut} className="space-y-5">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          {/* Plat Nomor Polisi Autocomplete against Active Inside */}
          <div className="relative">
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nomor Polisi Unit Keluar <span className="text-[#D97706] font-semibold">(Hanya Unit yang di Dalam Bengkel)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
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
                className="w-full pl-10 pr-24 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-base font-mono font-bold tracking-wider text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 uppercase transition"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#64748B]">
                  Mencari...
                </div>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && activeVehicles.length > 0 && !selectedVehicle && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2.5 text-[11px] font-bold text-[#64748B] border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  Armada yang Sedang di Dalam Bengkel:
                </div>
                {activeVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVehicle(v)}
                    className="w-full text-left p-3 hover:bg-[#F1F5F9] border-b border-[#F1F5F9] flex items-center justify-between transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#0F172A] text-sm">{v.no_polisi}</span>
                        <span className="text-xs text-[#64748B]">• Tiket: {v.nomor_tiket}</span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        Driver: {v.nama_pengemudi} • Masuk: {v.waktu_masuk}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#12388F]/10 text-[#12388F] border border-[#12388F]/20">
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
                  <div className="p-3 rounded-xl bg-[#DCFCE7] border border-[#16A34A]/30 flex items-center space-x-2.5 text-xs text-[#16A34A]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold">Unit Ditemukan di Dalam:</span> Tiket {selectedVehicle.nomor_tiket} • Driver: {selectedVehicle.nama_pengemudi}. Siap divalidasi keluar.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 flex items-center space-x-2.5 text-xs text-[#DC2626]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold">Kendaraan Tidak Ada di Dalam Bengkel:</span> Plat nomor tidak terdaftar pada antrean aktif masuk atau sudah pernah di-check out. Tombol check out dinonaktifkan.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details of selected vehicle */}
          {selectedVehicle && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
              <div>
                <span className="text-[#64748B] block font-medium">Nama Pengemudi</span>
                <span className="text-[#0F172A] font-bold">{selectedVehicle.nama_pengemudi}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Tipe Kunjungan</span>
                <span className="text-[#0F172A] font-bold">{selectedVehicle.tipe_kunjungan}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Waktu Masuk Awal</span>
                <span className="text-[#0F172A] font-bold">{selectedVehicle.waktu_masuk}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
              Catatan Pemeriksaan Keluar (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatanKeluar}
              onChange={(e) => setCatatanKeluar(e.target.value)}
              placeholder="Kelengkapan surat kendaraan, kondisi fisik saat meninggalkan bengkel..."
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#D97706] resize-none"
            />
          </div>

          {/* Multi Camera Section for Exit */}
          <div className="pt-4 border-t border-[#E2E8F0]">
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
            className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center space-x-2 transition ${
              isVehicleInside && !isSubmitting
                ? 'bg-[#D97706] hover:bg-[#B45309] text-white shadow-lg shadow-[#D97706]/25 cursor-pointer'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed border border-[#CBD5E1]'
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
