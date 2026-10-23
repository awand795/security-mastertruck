import React, { useState, useEffect, useRef } from 'react';
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
import { CheckinCandidate } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { useSecurityStore } from '../store/useSecurityStore';

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

const normalizePlate = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '');

const candidateKey = (candidate: CheckinCandidate) =>
  candidate.source === 'BOOKING'
    ? `BOOKING:${candidate.booking_id}`
    : `MEMBER_UNIT:${candidate.unit_id ?? candidate.no_polisi_clean}`;

export const CheckInView: React.FC = () => {
  const currentUser = useSecurityStore((state) => state.user);

  // Unified Plate Input
  const [plateInput, setPlateInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Lookup results: booking aktif + unit member dalam satu daftar
  const [candidates, setCandidates] = useState<CheckinCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CheckinCandidate | null>(null);
  const selectedCandidateRef = useRef<CheckinCandidate | null>(null);

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

  const applyCandidate = (candidate: CheckinCandidate, forceFill = false) => {
    const driverName = candidate.source === 'BOOKING'
      ? candidate.customer_name || ''
      : candidate.nama_pengguna_fleet || candidate.nama_pic || candidate.customer_name || '';
    const driverPhone = candidate.source === 'BOOKING'
      ? candidate.customer_telepon || ''
      : candidate.unit_telepon || candidate.customer_telepon || '';
    const complaint = candidate.source === 'BOOKING'
      ? candidate.catatan || candidate.keluhan || 'Service Berkala'
      : '';

    setNamaPengemudi((prev) => (forceFill ? driverName : prev || driverName));
    setNoTelpPengemudi((prev) => (forceFill ? driverPhone : prev || driverPhone));
    if (complaint) {
      setKeluhan((prev) => (forceFill ? complaint : prev || complaint));
    }
  };

  const chooseCandidate = (candidate: CheckinCandidate | null, forceFill = false) => {
    selectedCandidateRef.current = candidate;
    setSelectedCandidate(candidate);
    if (!candidate) {
      setShowSuggestions(true);
      return;
    }
    setPlateInput(candidate.no_polisi);
    applyCandidate(candidate, forceFill);
    setShowSuggestions(false);
  };

  // Real-time lookup: booking aktif + unit member terdaftar dalam satu daftar
  useEffect(() => {
    const lookupPlate = normalizePlate(plateInput);
    if (lookupPlate.length < 3) {
      setCandidates([]);
      selectedCandidateRef.current = null;
      setSelectedCandidate(null);
      setShowSuggestions(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const found = await securityApi.searchCheckinCandidates(lookupPlate);
        if (!active) return;

        setCandidates(found);

        // Jangan reset pilihan yang masih valid (mis. setelah klik suggestion).
        const previous = selectedCandidateRef.current;
        const previousStillValid = Boolean(
          previous &&
          previous.no_polisi_clean === lookupPlate &&
          found.some((item) => candidateKey(item) === candidateKey(previous))
        );
        if (previousStillValid) return;

        const exact = found.filter(
          (item) =>
            item.no_polisi_clean === lookupPlate &&
            !(item.source === 'MEMBER_UNIT' && item.has_active_booking)
        );

        if (exact.length === 1) {
          chooseCandidate(exact[0], false);
        } else {
          selectedCandidateRef.current = null;
          setSelectedCandidate(null);
          setShowSuggestions(found.length > 0);
        }
      } catch (err) {
        console.error('Error lookup plate:', err);
        if (active) {
          setCandidates([]);
          selectedCandidateRef.current = null;
          setSelectedCandidate(null);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [plateInput]);

  const handlePlateInputChange = (value: string) => {
    const next = value.toUpperCase();
    setPlateInput(next);
    setErrorMsg(null);
    setShowSuggestions(true);
    const current = selectedCandidateRef.current;
    if (current && current.no_polisi_clean !== normalizePlate(next)) {
      selectedCandidateRef.current = null;
      setSelectedCandidate(null);
      setNamaPengemudi('');
      setNoTelpPengemudi('');
      setKeluhan('');
    }
  };

  // Status klasifikasi kedatangan
  const cleanPlate = normalizePlate(plateInput);
  const selectedBooking = selectedCandidate?.source === 'BOOKING' ? selectedCandidate : null;
  const selectedUnit = selectedCandidate?.source === 'MEMBER_UNIT' ? selectedCandidate : null;
  const bookingCandidates = candidates.filter((item) => item.source === 'BOOKING');
  const exactBookingCandidates = bookingCandidates.filter(
    (item) => item.no_polisi_clean === cleanPlate
  );
  const hasActiveBookingForPlate = exactBookingCandidates.length > 0;
  const isBookingConfirmed = Boolean(
    selectedBooking &&
    selectedBooking.is_confirmed &&
    selectedBooking.is_within_window &&
    selectedBooking.can_checkin
  );
  const isBookingUnconfirmed = Boolean(selectedBooking && !selectedBooking.is_confirmed);
  const isBookingBlocked = Boolean(selectedBooking && !isBookingConfirmed);
  const isBookingStaleUnconfirmed = Boolean(selectedBooking?.is_stale_unconfirmed);
  const isWalkInWithUnit = Boolean(!selectedBooking && selectedUnit);
  const isWalkInPure = Boolean(
    !selectedBooking &&
    !selectedUnit &&
    !hasActiveBookingForPlate &&
    candidates.length === 0
  );

  // Status apakah tombol check in bisa ditekan
  const canSubmit = () => {
    if (cleanPlate.length < 3) return false;
    if (namaPengemudi.trim() === '') return false;
    if (selectedBooking) return isBookingConfirmed;
    if (selectedUnit) return !selectedUnit.has_active_booking;
    if (hasActiveBookingForPlate) return false; // wajib pilih booking aktif
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
      const bookingId = selectedBooking?.booking_id ?? null;
      const jenisKedatangan: 'BOOKING' | 'WALK_IN' = selectedBooking ? 'BOOKING' : 'WALK_IN';
      const payload = {
        nomor_tiket: generatedTiket,
        booking_id: bookingId,
        jenis_kedatangan: jenisKedatangan,
        no_polisi: cleanPlate,
        nama_pengemudi: namaPengemudi.trim(),
        no_telepon_pengemudi: noTelpPengemudi.trim(),
        tipe_kunjungan: tipeKunjungan,
        keluhan: keluhan.trim() || 'Pengecekan umum armada',
        petugas_security: currentUser?.nama || 'Pos Security KIM 3',
        catatan_masuk: catatanMasuk.trim() || undefined,
      };

      const result = await securityApi.postCheckIn(payload);

      if (result && result.success === false) {
        setErrorMsg(result.message || 'Check-in ditolak oleh server.');
        return;
      }

      const newKunjunganId = Number(result?.id ?? result?.insertId ?? 0);
      if (!newKunjunganId) {
        throw new Error(result?.message || 'Server tidak mengembalikan ID kunjungan.');
      }

      // Upload captured photos
      const photosToUpload = photos.filter((p) => Boolean(p.dataUrl));
      for (const p of photosToUpload) {
        if (p.dataUrl) {
          try {
            await securityApi.postAddFoto({
              kunjungan_id: newKunjunganId,
              jenis_event: 'MASUK',
              sudut_pandang: p.label,
              foto_data: p.dataUrl,
            });
          } catch (errFoto) {
            console.error('Error saving foto:', errFoto);
          }
        }
      }

      const localTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB';
      const responseTime = result?.waktu_masuk ? new Date(result.waktu_masuk) : null;
      const formattedTime = responseTime && !Number.isNaN(responseTime.getTime())
        ? responseTime.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
          }) + ' WIB'
        : localTime;

      setSuccessTicket({
        nomor_tiket: result?.nomor_tiket || generatedTiket,
        no_polisi: result?.no_polisi || cleanPlate,
        waktu_masuk: formattedTime,
        nama_driver: result?.nama_pengemudi || payload.nama_pengemudi,
        jenis: result?.jenis_kedatangan === 'BOOKING' || bookingId !== null ? 'BOOKING' : 'WALK_IN',
        booking_id: result?.booking_id ?? bookingId,
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
    setCandidates([]);
    selectedCandidateRef.current = null;
    setSelectedCandidate(null);
    setShowSuggestions(false);
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
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-[#12388F]/10 text-[#12388F]">
          <LogIn className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">Pemeriksaan Kendaraan Masuk (Check In)</h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
            Sistem otomatis mendeteksi apakah kendaraan memiliki jadwal Booking, unit Member terdaftar, atau Walk-In.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 flex items-start space-x-2.5 text-xs text-[#DC2626]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Check-In Form */}
      <form onSubmit={handleSubmitCheckIn} className="space-y-4">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          
          {/* Input Nomor Polisi Universal */}
          <div className="relative">
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Nomor Polisi Kendaraan Masuk
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={plateInput}
                onChange={(e) => handlePlateInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Contoh: BK 1234 ABC"
                className="w-full pl-9 pr-24 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm font-mono font-semibold tracking-wider text-[#0F172A] placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F] focus:ring-1 focus:ring-[#12388F]/20 uppercase transition"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#64748B]">
                  Memeriksa...
                </div>
              )}
            </div>

            {/* Daftar kandidat: booking aktif + unit member terdaftar */}
            {showSuggestions && candidates.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                <div className="p-2.5 text-[11px] font-bold text-[#64748B] border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  Pilih data kendaraan (Booking / Member Unit):
                </div>
                {candidates.map((item) => {
                  const disabled = item.source === 'MEMBER_UNIT' && item.has_active_booking;
                  const selected = Boolean(
                    selectedCandidate &&
                    candidateKey(selectedCandidate) === candidateKey(item)
                  );
                  const vehicleLabel = [item.merk, item.model].filter(Boolean).join(' ') ||
                    item.jenis_armada ||
                    'Unit';

                  return (
                    <button
                      key={candidateKey(item)}
                      type="button"
                      disabled={disabled}
                      onClick={() => chooseCandidate(item, true)}
                      className={`w-full text-left p-3 border-b border-[#F1F5F9] flex items-center justify-between transition ${
                        disabled
                          ? 'bg-[#F8FAFC] opacity-60 cursor-not-allowed'
                          : 'hover:bg-[#F1F5F9] cursor-pointer'
                      } ${selected ? 'bg-[#EFF6FF]' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-mono font-bold text-[#0F172A] text-sm">
                            {item.no_polisi}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.source === 'BOOKING'
                                ? 'bg-[#E0E7FF] text-[#3730A3] border-[#6366F1]/30'
                                : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                            }`}
                          >
                            {item.source === 'BOOKING' ? 'Booking' : 'Member Unit'}
                          </span>
                          {item.source === 'MEMBER_UNIT' && item.status_aktif === false && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/30">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5 truncate">
                          {item.source === 'BOOKING' ? (
                            <>
                              Jadwal: {item.tanggal_booking || '-'} ({item.jam_booking || '-'}) •{' '}
                              {item.customer_name || 'Pelanggan'}
                            </>
                          ) : (
                            <>
                              {item.nama_perusahaan || item.customer_name || 'Member'} • {vehicleLabel}
                            </>
                          )}
                        </div>
                        {disabled && (
                          <div className="text-[10px] text-[#D97706] mt-1">
                            Ada booking aktif untuk plat ini — pilih data booking.
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {item.source === 'BOOKING' ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.is_confirmed
                                ? 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]/30'
                                : item.is_stale_unconfirmed
                                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]/30'
                                : 'bg-[#FEF3C7] text-[#D97706] border-[#D97706]/30'
                            }`}
                          >
                            {item.is_confirmed
                              ? 'Confirmed'
                              : item.is_stale_unconfirmed
                              ? 'Lewat H-1'
                              : 'Belum Confirmed'}
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.status_aktif === false
                                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]/30'
                                : 'bg-[#EFF6FF] text-[#1E40AF] border-[#3B82F6]/30'
                            }`}
                          >
                            {item.status_aktif === false ? 'Nonaktif' : 'Walk-In'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status Peringatan Cerdas (Satu Halaman): Booking vs Walk-in Member vs Walk-in Baru */}
            {cleanPlate.length >= 3 && (
              <div className="mt-3 space-y-2">
                {isBookingConfirmed && selectedBooking && (
                  <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#16A34A]/30 flex items-start space-x-2.5 text-xs text-[#16A34A]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">
                        Booking Terkonfirmasi (Booking ID #{selectedBooking.booking_id})
                      </span>
                      <span>
                        Jadwal: {selectedBooking.tanggal_booking || '-'} ({selectedBooking.jam_booking || '-'}) • Pelanggan:{' '}
                        {selectedBooking.customer_name || 'Pelanggan'}. Siap check in.
                      </span>
                    </div>
                  </div>
                )}

                {isBookingUnconfirmed && selectedBooking && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                      isBookingStaleUnconfirmed
                        ? 'bg-[#FEE2E2] border-[#DC2626]/40 text-[#DC2626]'
                        : 'bg-[#FEF3C7] border-[#D97706]/40 text-[#D97706]'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">
                        {isBookingStaleUnconfirmed
                          ? 'Booking Lewat Batas H-1 & Belum Dikonfirmasi'
                          : 'Booking Belum Dikonfirmasi'}
                        {selectedBooking.status_booking ? ` (${selectedBooking.status_booking})` : ''}
                      </span>
                      <span>
                        {isBookingStaleUnconfirmed
                          ? 'Jadwal booking sudah melewati batas H-1 dan statusnya masih belum confirmed. '
                          : 'Status booking untuk plat ini belum confirmed. '}
                        <strong>
                          Silakan konfirmasi ke Admin Bengkel terlebih dahulu sebelum mengizinkan kendaraan masuk.
                        </strong>{' '}
                        Tombol check in dinonaktifkan.
                      </span>
                    </div>
                  </div>
                )}

                {!selectedCandidate && hasActiveBookingForPlate && (
                  <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#D97706]/40 flex items-start space-x-2.5 text-xs text-[#D97706]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">Booking Aktif Ditemukan</span>
                      <span>
                        Plat ini memiliki booking aktif. Silakan pilih data booking pada daftar di atas untuk melanjutkan.
                        Check-in walk-in tidak diizinkan selama booking masih aktif.
                      </span>
                    </div>
                  </div>
                )}

                {isWalkInWithUnit && selectedUnit && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                      selectedUnit.status_aktif === false
                        ? 'bg-[#FEF3C7] border-[#D97706]/40 text-[#D97706]'
                        : 'bg-[#EFF6FF] border-[#3B82F6]/30 text-[#1E40AF]'
                    }`}
                  >
                    <Truck
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        selectedUnit.status_aktif === false ? 'text-[#D97706]' : 'text-[#3B82F6]'
                      }`}
                    />
                    <div>
                      <span className="font-bold text-sm block">
                        {selectedUnit.status_aktif === false
                          ? 'Walk-In Unit Member (Nonaktif)'
                          : 'Kedatangan Walk-In (Armada Terdaftar di Member Unit)'}
                      </span>
                      <span>
                        Unit armada terdaftar milik{' '}
                        <strong>
                          {selectedUnit.nama_pengguna_fleet ||
                            selectedUnit.nama_perusahaan ||
                            'Member'}
                        </strong>{' '}
                        (
                        {[selectedUnit.merk, selectedUnit.model].filter(Boolean).join(' ') ||
                          selectedUnit.jenis_armada ||
                          'Unit'}
                        ).{' '}
                        {selectedUnit.status_aktif === false
                          ? 'Status unit nonaktif, tetapi kedatangan walk-in tetap diizinkan. Verifikasi fisik kendaraan.'
                          : 'Data otomatis diisi ke form.'}
                      </span>
                    </div>
                  </div>
                )}

                {!selectedCandidate && !hasActiveBookingForPlate && candidates.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center space-x-2.5 text-xs text-[#64748B]">
                    <Info className="w-4 h-4 shrink-0 text-[#12388F]" />
                    <div>
                      <span className="font-bold text-[#0F172A]">Pilih Data yang Cocok:</span>{' '}
                      Klik salah satu hasil di atas, atau lanjutkan sebagai walk-in jika plat yang diketik tidak ada di daftar.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Nama Pengemudi / Driver <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={namaPengemudi}
                  onChange={(e) => setNamaPengemudi(e.target.value)}
                  placeholder="Nama supir"
                  className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-xs placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                No. Telepon / WhatsApp Driver
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={noTelpPengemudi}
                  onChange={(e) => setNoTelpPengemudi(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-xs placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Tipe Kunjungan
              </label>
              <select
                value={tipeKunjungan}
                onChange={(e) => setTipeKunjungan(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#12388F]"
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
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Keluhan Driver / Rencana Servis
              </label>
              <input
                type="text"
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="Ganti oli, rem, dll."
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-xs placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Catatan Khusus Security Masuk (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatanMasuk}
              onChange={(e) => setCatatanMasuk(e.target.value)}
              placeholder="Catatan fisik / barang bawaan (opsional)"
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder:text-xs placeholder:text-[#94A3B8] focus:outline-none focus:border-[#12388F] resize-none"
            />
          </div>

          {/* Multi Camera Section */}
          <div className="pt-3.5 border-t border-[#E2E8F0]">
            <MultiCameraSection
              photos={photos}
              onChange={setPhotos}
              eventTitle="Kedatangan Masuk"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="submit"
            disabled={!canSubmit() || isSubmitting}
            className={`px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition ${
              canSubmit() && !isSubmitting
                ? 'bg-[#12388F] hover:bg-[#0D2A6B] text-white shadow-lg shadow-[#12388F]/25 cursor-pointer'
                : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed border border-[#CBD5E1]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Memproses Check In...'
                : selectedBooking && isBookingUnconfirmed
                ? isBookingStaleUnconfirmed
                  ? 'Booking Lewat H-1 & Belum Confirmed'
                  : 'Booking Belum Confirmed (Silakan Konfirmasi ke Admin)'
                : !selectedCandidate && hasActiveBookingForPlate
                ? 'Pilih Data Booking Terlebih Dahulu'
                : 'Terbitkan Tiket & Check In'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
