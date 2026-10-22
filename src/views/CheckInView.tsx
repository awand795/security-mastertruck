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
  Printer,
  Info,
  Truck
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

  // Unified Plate Input
  const [plateInput, setPlateInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Lookup results
  const [matchedBookings, setMatchedBookings] = useState<BookingConfirmedItem[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingConfirmedItem | null>(null);
  const [matchedUnit, setMatchedUnit] = useState<any | null>(null);

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
    booking_id?: number | null;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time lookup plate whenever plateInput changes
  useEffect(() => {
    const cleanPlate = plateInput.trim().toUpperCase().replace(/\s+/g, '');
    if (cleanPlate.length < 3) {
      setMatchedBookings([]);
      setSelectedBooking(null);
      setMatchedUnit(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        // 1. Search booking
        const bookings = await securityApi.searchConfirmedBookings(cleanPlate);
        setMatchedBookings(bookings);

        // Auto-match if exact plate matches
        const exactBooking = bookings.find(
          (b) => b.nomor_polisi.replace(/\s+/g, '').toUpperCase() === cleanPlate
        );
        if (exactBooking) {
          setSelectedBooking(exactBooking);
          if (!namaPengemudi) setNamaPengemudi(exactBooking.nama_driver || '');
          if (!noTelpPengemudi) setNoTelpPengemudi(exactBooking.no_telepon_driver || '');
          if (!keluhan) setKeluhan(exactBooking.catatan || 'Service Berkala');
        } else {
          setSelectedBooking(null);
        }

        // 2. Search tbl_member_unit (armada terdaftar)
        const units = await securityApi.lookupUnitMember(cleanPlate);
        if (units.length > 0) {
          const exactUnit = units[0];
          setMatchedUnit(exactUnit);
          if (!namaPengemudi && exactUnit.nama_pengguna_fleet) {
            setNamaPengemudi(exactUnit.nama_pic || exactUnit.nama_pengguna_fleet);
          }
          if (!noTelpPengemudi && exactUnit.no_telepon) {
            setNoTelpPengemudi(exactUnit.no_telepon);
          }
        } else {
          setMatchedUnit(null);
        }
      } catch (err) {
        console.error('Error lookup plate:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [plateInput]);

  const handleSelectBooking = (item: BookingConfirmedItem) => {
    setSelectedBooking(item);
    setPlateInput(item.nomor_polisi);
    setNamaPengemudi(item.nama_driver || item.customer_name || '');
    setNoTelpPengemudi(item.no_telepon_driver || '');
    setKeluhan(item.catatan || item.keluhan || 'Service Berkala');
    setShowSuggestions(false);
  };

  // Status klasifikasi kedatangan
  const hasBooking = Boolean(selectedBooking);
  const isBookingConfirmed = Boolean(
    selectedBooking && 
    (selectedBooking.status_booking.toLowerCase().includes('confirm') || 
     selectedBooking.status_booking.toLowerCase().includes('approve') ||
     (selectedBooking as any).can_checkin === true)
  );
  const isBookingUnconfirmed = Boolean(hasBooking && !isBookingConfirmed);
  const isWalkInWithUnit = Boolean(!hasBooking && matchedUnit);
  const isWalkInPure = Boolean(!hasBooking && !matchedUnit);

  // Status apakah tombol check in bisa ditekan
  const canSubmit = () => {
    if (isBookingUnconfirmed) return false; // DILARANG jika ada booking tapi belum confirmed
    if (plateInput.trim().length < 3) return false;
    if (namaPengemudi.trim() === '') return false;
    return true;
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
    if (!canSubmit()) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const generatedTiket = generateTicketNumber();
      const jenisKedatangan: 'BOOKING' | 'WALK_IN' = hasBooking ? 'BOOKING' : 'WALK_IN';
      const payload = {
        nomor_tiket: generatedTiket,
        booking_id: selectedBooking ? selectedBooking.booking_id : null,
        jenis_kedatangan: jenisKedatangan,
        no_polisi: plateInput.trim().toUpperCase(),
        nama_pengemudi: namaPengemudi.trim(),
        no_telepon_pengemudi: noTelpPengemudi.trim(),
        tipe_kunjungan: tipeKunjungan,
        keluhan: keluhan.trim() || 'Pengecekan umum armada',
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
        booking_id: payload.booking_id,
      });
    } catch (err: any) {
      console.error('Check in error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan check-in. Periksa jaringan pos gerbang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessTicket(null);
    setPlateInput('');
    setNamaPengemudi('');
    setNoTelpPengemudi('');
    setKeluhan('');
    setCatatanMasuk('');
    setSelectedBooking(null);
    setMatchedUnit(null);
    setPhotos(INITIAL_PHOTOS);
  };

  if (successTicket) {
    return (
      <div className="max-w-xl mx-auto py-4">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 text-center shadow-lg relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-[#DCFCE7] border border-[#16A34A]/30 text-[#16A34A] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-[#0F172A] mb-1">Check In Berhasil Diproses!</h2>
          <p className="text-xs text-[#64748B] mb-6">
            Kendaraan telah dicatat masuk ke Bengkel KIM 3 dan data siap diterima oleh Service Advisor (SA).
          </p>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Nomor Tiket Gerbang</span>
              <span className="text-sm font-mono font-bold text-[#12388F]">{successTicket.nomor_tiket}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Plat Nomor Polisi</span>
              <span className="text-sm font-bold text-[#0F172A] tracking-wider font-mono">{successTicket.no_polisi}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Jenis Kedatangan</span>
              <span className="text-xs font-bold text-[#12388F]">
                {successTicket.jenis === 'BOOKING' ? `BOOKING (ID #${successTicket.booking_id})` : 'WALK-IN'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
              <span className="text-xs text-[#64748B]">Pengemudi / Driver</span>
              <span className="text-xs font-semibold text-[#0F172A]">{successTicket.nama_driver}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#64748B]">Waktu Kedatangan</span>
              <span className="text-xs font-bold text-[#16A34A]">{successTicket.waktu_masuk}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#12388F]" />
              <span>Cetak Tiket Masuk</span>
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-3 px-4 rounded-xl bg-[#12388F] hover:bg-[#0D2A6B] text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-md shadow-[#12388F]/25 cursor-pointer"
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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Banner Header */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 sm:p-6 shadow-xs flex items-center space-x-3.5">
        <div className="p-3 rounded-xl bg-[#12388F]/10 text-[#12388F]">
          <LogIn className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Pemeriksaan Kendaraan Masuk (Check In)</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Sistem otomatis mendeteksi apakah kendaraan memiliki jadwal Booking, unit Member terdaftar, atau Walk-In.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 flex items-start space-x-3 text-xs text-[#DC2626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Check-In Form */}
      <form onSubmit={handleSubmitCheckIn} className="space-y-5">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          
          {/* Input Nomor Polisi Universal */}
          <div className="relative">
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nomor Polisi Kendaraan Masuk
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
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Ketik plat nomor... Contoh: BK 9393 ER"
                className="w-full pl-10 pr-24 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-base font-mono font-bold tracking-wider text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F] focus:ring-2 focus:ring-[#12388F]/20 uppercase transition"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#64748B]">
                  Memeriksa data...
                </div>
              )}
            </div>

            {/* Suggestions list if multiple bookings match query */}
            {showSuggestions && matchedBookings.length > 0 && !selectedBooking && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2.5 text-[11px] font-bold text-[#64748B] border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  Pilih dari Antrean Booking:
                </div>
                {matchedBookings.map((b) => (
                  <button
                    key={b.booking_id}
                    type="button"
                    onClick={() => handleSelectBooking(b)}
                    className="w-full text-left p-3 hover:bg-[#F1F5F9] border-b border-[#F1F5F9] flex items-center justify-between transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#0F172A] text-sm">{b.nomor_polisi}</span>
                        <span className="text-xs text-[#64748B]">• {b.customer_name || 'Pelanggan'}</span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        Jadwal: {b.tanggal_booking} ({b.jam_booking}) • Layanan: {b.jenis_layanan}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.status_booking.toLowerCase().includes('confirm')
                          ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#16A34A]/30'
                          : 'bg-[#FEF3C7] text-[#D97706] border border-[#D97706]/30'
                      }`}
                    >
                      {b.status_booking}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Status Peringatan Cerdas (Satu Halaman): Booking vs Walk-in Member vs Walk-in Baru */}
            {plateInput.trim().length >= 3 && (
              <div className="mt-3">
                {isBookingConfirmed && selectedBooking && (
                  <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#16A34A]/30 flex items-start space-x-2.5 text-xs text-[#16A34A]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">Booking Terkonfirmasi (Booking ID #{selectedBooking.booking_id})</span>
                      <span>Jadwal: {selectedBooking.tanggal_booking} ({selectedBooking.jam_booking}) • Pelanggan: {selectedBooking.customer_name}. Siap check in.</span>
                    </div>
                  </div>
                )}

                {isBookingUnconfirmed && selectedBooking && (
                  <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#D97706]/40 flex items-start space-x-2.5 text-xs text-[#D97706]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">Booking Belum Dikonfirmasi ({selectedBooking.status_booking})</span>
                      <span>Status booking untuk plat ini belum confirmed. <strong>Silakan konfirmasi ke customer / Admin Bengkel terlebih dahulu sebelum mengizinkan kendaraan masuk.</strong> Tombol check in dinonaktifkan.</span>
                    </div>
                  </div>
                )}

                {isWalkInWithUnit && matchedUnit && (
                  <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#3B82F6]/30 flex items-start space-x-2.5 text-xs text-[#1E40AF]">
                    <Truck className="w-4 h-4 shrink-0 mt-0.5 text-[#3B82F6]" />
                    <div>
                      <span className="font-bold text-sm block">Kedatangan Walk-In (Armada Terdaftar di Member Unit)</span>
                      <span>Unit armada terdaftar milik <strong>{matchedUnit.nama_pengguna_fleet || matchedUnit.nama_perusahaan || 'Member'}</strong> ({matchedUnit.merk} {matchedUnit.model}). Data otomatis diisi ke form.</span>
                    </div>
                  </div>
                )}

                {isWalkInPure && (
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center space-x-2.5 text-xs text-[#64748B]">
                    <Info className="w-4 h-4 shrink-0 text-[#12388F]" />
                    <div>
                      <span className="font-bold text-[#0F172A]">Kedatangan Walk-In Biasa:</span> Tidak ditemukan riwayat booking aktif atau data member unit. Silakan lengkapi nama driver dan keluhan.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields: Driver & Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Nama Pengemudi / Driver <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={namaPengemudi}
                  onChange={(e) => setNamaPengemudi(e.target.value)}
                  placeholder="Nama lengkap pengemudi"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#12388F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                No. Telepon / WhatsApp Driver
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={noTelpPengemudi}
                  onChange={(e) => setNoTelpPengemudi(e.target.value)}
                  placeholder="0812xxxxxxx"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#12388F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Tipe Kunjungan
              </label>
              <select
                value={tipeKunjungan}
                onChange={(e) => setTipeKunjungan(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#12388F]"
              >
                <option value="Service Berkala">Service Berkala</option>
                <option value="Perbaikan Ringan">Perbaikan Ringan</option>
                <option value="Perbaikan Berat / Overhaul">Perbaikan Berat / Overhaul</option>
                <option value="Inspeksi / Pengecekan">Inspeksi / Pengecekan</option>
                <option value="Beli Sparepart">Beli Sparepart</option>
                <option value="Tamu / Lainnya">Tamu / Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Keluhan Driver / Rencana Servis
              </label>
              <input
                type="text"
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="Contoh: Ganti Oli Mesin & Filter"
                className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:border-[#12388F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
              Catatan Khusus Security Masuk (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatanMasuk}
              onChange={(e) => setCatatanMasuk(e.target.value)}
              placeholder="Catatan barang bawaan armada, kondisi fisik bodi atau petunjuk pos..."
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#12388F] resize-none"
            />
          </div>

          {/* Multi Camera Section */}
          <div className="pt-4 border-t border-[#E2E8F0]">
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
            disabled={!canSubmit() || isSubmitting}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center space-x-2 transition ${
              canSubmit() && !isSubmitting
                ? 'bg-[#12388F] hover:bg-[#0D2A6B] text-white shadow-lg shadow-[#12388F]/25 cursor-pointer'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed border border-[#CBD5E1]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Memproses Check In...'
                : isBookingUnconfirmed
                ? 'Booking Belum Confirmed (Silakan Konfirmasi ke Customer)'
                : 'Terbitkan Tiket & Check In'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
