import React, { useState, useEffect } from 'react';
import { 
  LogIn, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Sparkles,
  Printer
} from 'lucide-react';
import { securityApi } from '../api/client';
import { BookingConfirmedItem } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { useSecurityStore } from '../store/useSecurityStore';

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

export const CheckInView: React.FC = () => {
  const currentUser = useSecurityStore((state) => state.user);

  // Form states
  const [jenisKedatangan, setJenisKedatangan] = useState<'BOOKING' | 'WALK_IN'>('BOOKING');
  const [plateInput, setPlateInput] = useState('');
  const [confirmedBookings, setConfirmedBookings] = useState<BookingConfirmedItem[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingConfirmedItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Driver and visit details
  const [namaPengemudi, setNamaPengemudi] = useState('');
  const [noTelpPengemudi, setNoTelpPengemudi] = useState('');
  const [tipeKunjungan, setTipeKunjungan] = useState('Service Berkala');
  const [keluhan, setKeluhan] = useState('');
  const [catatanMasuk, setCatatanMasuk] = useState('');

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{
    nomor_tiket: string;
    no_polisi: string;
    waktu_masuk: string;
    nama_driver: string;
    jenis: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search bookings on plate input change
  useEffect(() => {
    if (jenisKedatangan !== 'BOOKING') return;

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const data = await securityApi.searchConfirmedBookings(plateInput.trim());
        setConfirmedBookings(data);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [plateInput, jenisKedatangan]);

  // Handle selecting a booking suggestion
  const handleSelectBooking = (item: BookingConfirmedItem) => {
    setSelectedBooking(item);
    setPlateInput(item.nomor_polisi);
    setNamaPengemudi(item.nama_driver || '');
    setNoTelpPengemudi(item.no_telepon_driver || '');
    setKeluhan(item.catatan || 'Service Berkala');
    setShowSuggestions(false);
  };

  // Switch between BOOKING and WALK_IN
  const handleModeChange = (mode: 'BOOKING' | 'WALK_IN') => {
    setJenisKedatangan(mode);
    setSelectedBooking(null);
    setPlateInput('');
    setNamaPengemudi('');
    setNoTelpPengemudi('');
    setKeluhan('');
    setCatatanMasuk('');
    setPhotos(INITIAL_PHOTOS);
  };

  // Determine if booking is confirmed or unconfirmed
  const isBookingValid = Boolean(
    selectedBooking && 
    selectedBooking.nomor_polisi.toLowerCase() === plateInput.trim().toLowerCase() &&
    (selectedBooking.status_booking.toLowerCase() === 'confirmed' || selectedBooking.status_booking.toLowerCase() === 'approved')
  );

  const isFormValid = () => {
    if (jenisKedatangan === 'BOOKING') {
      return isBookingValid && namaPengemudi.trim() !== '';
    }
    // Walk-in validation
    return plateInput.trim().length >= 3 && namaPengemudi.trim() !== '';
  };

  const generateTicketNumber = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const randomHex = Math.floor(Math.random() * 9000 + 1000);
    return `TG-${yy}${mm}${dd}-${randomHex}`;
  };

  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const generatedTiket = generateTicketNumber();
      const payload = {
        nomor_tiket: generatedTiket,
        booking_id: selectedBooking ? selectedBooking.booking_id : null,
        jenis_kedatangan: jenisKedatangan,
        no_polisi: plateInput.trim().toUpperCase(),
        nama_pengemudi: namaPengemudi.trim(),
        no_telepon_pengemudi: noTelpPengemudi.trim(),
        tipe_kunjungan: tipeKunjungan,
        keluhan: keluhan.trim() || 'Pengecekan umum',
        petugas_security_masuk: currentUser?.nama || 'Pos Security KIM 3',
        catatan_masuk: catatanMasuk.trim() || undefined,
      };

      const result = await securityApi.postCheckIn(payload);
      const newKunjunganId = result?.id || result?.insertId || Date.now();

      // Upload captured photos
      const photosToUpload = photos.filter((p) => Boolean(p.dataUrl));
      for (const p of photosToUpload) {
        if (p.dataUrl) {
          try {
            await securityApi.postAddFoto({
              kunjungan_id: Number(newKunjunganId),
              jenis_event: 'MASUK',
              sudut_pandang: p.label,
              foto_data: p.dataUrl,
            });
          } catch (errFoto) {
            console.error('Error saving foto:', errFoto);
          }
        }
      }

      setSuccessTicket({
        nomor_tiket: generatedTiket,
        no_polisi: payload.no_polisi,
        waktu_masuk: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        nama_driver: payload.nama_pengemudi,
        jenis: payload.jenis_kedatangan,
      });
    } catch (err: any) {
      console.error('Check in error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan check-in. Periksa jaringan koneksi pos gerbang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessTicket(null);
    handleModeChange(jenisKedatangan);
  };

  if (successTicket) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Check In Berhasil Diproses!</h2>
          <p className="text-xs text-slate-400 mb-6">
            Kendaraan telah dicatat masuk ke Bengkel KIM 3 dan data siap diterima oleh Service Advisor (SA).
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Nomor Tiket Gerbang</span>
              <span className="text-sm font-mono font-bold text-indigo-400">{successTicket.nomor_tiket}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Plat Nomor Polisi</span>
              <span className="text-sm font-bold text-white tracking-wider font-mono">{successTicket.no_polisi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Pengemudi / Driver</span>
              <span className="text-xs font-semibold text-slate-200">{successTicket.nama_driver}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Waktu Kedatangan</span>
              <span className="text-xs font-semibold text-emerald-400">{successTicket.waktu_masuk}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Tiket Masuk</span>
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/30"
            >
              <LogIn className="w-4 h-4" />
              <span>Input Check In Baru</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner / Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <LogIn className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Pemeriksaan Kendaraan Masuk (Check In)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Catat kedatangan armada berdasarkan jadwal booking ataupun kedatangan langsung (walk-in).
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => handleModeChange('BOOKING')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                jenisKedatangan === 'BOOKING'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Booking Jadwal
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('WALK_IN')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                jenisKedatangan === 'WALK_IN'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Walk-In / Darurat
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Check-In Form */}
      <form onSubmit={handleSubmitCheckIn} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Plat Nomor Polisi (Autocomplete with Live Search) */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Nomor Polisi Kendaraan {jenisKedatangan === 'BOOKING' && <span className="text-indigo-400">(Live Booking Search)</span>}
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
                  if (selectedBooking && selectedBooking.nomor_polisi !== e.target.value.toUpperCase()) {
                    setSelectedBooking(null);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Contoh: BK 9393 ER"
                className="w-full pl-10 pr-24 py-3 bg-slate-950 border border-slate-800 rounded-xl text-base font-mono font-bold tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase transition"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-slate-500">
                  Mencari...
                </div>
              )}
            </div>

            {/* Autocomplete Dropdown for Booking */}
            {jenisKedatangan === 'BOOKING' && showSuggestions && confirmedBookings.length > 0 && !selectedBooking && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800 bg-slate-950/60">
                  Booking Terjadwal Sesuai Pencarian:
                </div>
                {confirmedBookings.map((b) => {
                  const isConfirmed = b.status_booking.toLowerCase() === 'confirmed' || b.status_booking.toLowerCase() === 'approved';
                  return (
                    <button
                      key={b.booking_id}
                      type="button"
                      onClick={() => handleSelectBooking(b)}
                      className="w-full text-left p-3 hover:bg-slate-800/80 border-b border-slate-800/50 flex items-center justify-between transition"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-white text-sm">{b.nomor_polisi}</span>
                          <span className="text-xs text-slate-400">• {b.customer_name || b.armada_nama || 'Pelanggan'}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Driver: {b.nama_driver} ({b.no_telepon_driver})
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isConfirmed
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {b.status_booking}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {b.tanggal_booking} {b.jam_booking}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Validation Feedback for Booking Mode */}
            {jenisKedatangan === 'BOOKING' && plateInput.trim().length >= 3 && (
              <div className="mt-2.5">
                {selectedBooking ? (
                  isBookingValid ? (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center space-x-2.5 text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <div>
                        <span className="font-semibold">Booking Terkonfirmasi:</span> Unit dijadwalkan pada {selectedBooking.tanggal_booking} ({selectedBooking.jam_booking}). Data siap di-check-in.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center space-x-2.5 text-xs text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <div>
                        <span className="font-semibold">Booking Belum Dikonfirmasi:</span> Status saat ini adalah <strong className="uppercase">{selectedBooking.status_booking}</strong>. Silakan hubungi Admin Bengkel untuk konfirmasi terlebih dahulu sebelum kendaraan diizinkan masuk.
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Belum memilih dari jadwal booking confirmed.</span>
                    <button
                      type="button"
                      onClick={() => handleModeChange('WALK_IN')}
                      className="text-amber-400 hover:underline font-medium"
                    >
                      Ubah ke Walk-In?
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields: Driver & Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nama Pengemudi / Driver
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={namaPengemudi}
                  onChange={(e) => setNamaPengemudi(e.target.value)}
                  placeholder="Nama pengemudi"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                No. Telepon / WhatsApp Driver
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={noTelpPengemudi}
                  onChange={(e) => setNoTelpPengemudi(e.target.value)}
                  placeholder="0812xxxxxxx"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tipe Kunjungan
              </label>
              <select
                value={tipeKunjungan}
                onChange={(e) => setTipeKunjungan(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Service Berkala">Service Berkala</option>
                <option value="Perbaikan Ringan">Perbaikan Ringan</option>
                <option value="Perbaikan Berat / Overhaul">Perbaikan Berat / Overhaul</option>
                <option value="Inspeksi / Pengecekan">Inspeksi / Pengecekan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Keluhan Driver / Rencana Perbaikan
              </label>
              <input
                type="text"
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="Contoh: Ganti Oli Mesin & Filter"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Catatan Khusus Security Masuk (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatanMasuk}
              onChange={(e) => setCatatanMasuk(e.target.value)}
              placeholder="Catatan barang bawaan, kondisi bodi atau petunjuk khusus pos..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Multi Camera Section */}
          <div className="pt-4 border-t border-slate-800">
            <MultiCameraSection
              photos={photos}
              onChange={setPhotos}
              eventTitle="Kedatangan Masuk"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            className={`px-8 py-3.5 rounded-xl font-semibold text-sm flex items-center space-x-2 transition ${
              isFormValid() && !isSubmitting
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Memproses Check In...'
                : jenisKedatangan === 'BOOKING' && !isBookingValid
                ? 'Pilih Booking Confirmed Dahulu'
                : 'Terbitkan Tiket & Check In'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
