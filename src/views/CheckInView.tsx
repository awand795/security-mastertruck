import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogIn,
  Search,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Info,
  Truck,
  X,
  Loader2,
  ChevronDown,
  Clock,
  Hash,
  BadgeCheck,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { CheckinCandidate, EmployeeItem } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { SelectMenu, SelectMenuOption } from '../components/common/SelectMenu';
import { CheckinTicketModal, SuccessTicketData } from '../components/security/CheckinTicketModal';
import { useSecurityStore } from '../store/useSecurityStore';
import { formatPlate, normalizePlate } from '../utils/plate';
import { broadcastRealtimeEvent } from '../utils/realtime';

const INITIAL_PHOTOS: PhotoSlot[] = [
  { id: 'depan', label: 'Tampak Depan' },
  { id: 'belakang', label: 'Tampak Belakang' },
  { id: 'kanan', label: 'Tampak Samping Kanan' },
  { id: 'kiri', label: 'Tampak Samping Kiri' },
];

const candidateKey = (candidate: CheckinCandidate) =>
  candidate.source === 'BOOKING'
    ? `BOOKING:${candidate.booking_id}`
    : `MEMBER_UNIT:${candidate.unit_id ?? candidate.no_polisi_clean}`;

const FIELD_CLASS =
  'w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] transition placeholder:text-xs placeholder:text-[#94A3B8] focus:border-[#12388F] focus:outline-none focus:ring-2 focus:ring-[#12388F]/15';

const ICON_FIELD_CLASS =
  'w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3 text-sm text-[#0F172A] transition placeholder:text-xs placeholder:text-[#94A3B8] focus:border-[#12388F] focus:outline-none focus:ring-2 focus:ring-[#12388F]/15';

const LABEL_CLASS = 'mb-1 block text-xs font-semibold text-[#0F172A]';

const StatusLine: React.FC<{
  tone: 'green' | 'amber' | 'red' | 'blue' | 'slate';
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ tone, icon: Icon, children }) => {
  const toneClass = {
    green: 'border-[#16A34A]/25 bg-[#F0FDF4] text-[#15803D]',
    amber: 'border-[#F59E0B]/30 bg-[#FFFBEB] text-[#B45309]',
    red: 'border-[#DC2626]/25 bg-[#FEF2F2] text-[#B91C1C]',
    blue: 'border-[#3B82F6]/25 bg-[#EFF6FF] text-[#1D4ED8]',
    slate: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]',
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${toneClass}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
};

export const CheckInView: React.FC = () => {
  const queryClient = useQueryClient();
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
  const [tipeKunjungan, setTipeKunjungan] = useState('Service');
  const [customTipeKunjungan, setCustomTipeKunjungan] = useState('');
  const [keluhan, setKeluhan] = useState('');
  const [catatanMasuk, setCatatanMasuk] = useState('');

  // PIC / Tujuan — diambil dari daftar karyawan (sch_pos.tbl_employee)
  const [selectedPicId, setSelectedPicId] = useState('');
  const [employeeList, setEmployeeList] = useState<EmployeeItem[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<SuccessTicketData | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unconfirmedModalCandidate, setUnconfirmedModalCandidate] = useState<CheckinCandidate | null>(null);

  const applyCandidate = (candidate: CheckinCandidate, forceFill = false) => {
    const driverName = candidate.source === 'BOOKING'
      ? candidate.customer_name || ''
      : candidate.nama_pengguna_fleet || candidate.nama_pic || candidate.customer_name || '';
    const driverPhone = candidate.source === 'BOOKING'
      ? candidate.customer_telepon || ''
      : candidate.unit_telepon || candidate.customer_telepon || '';
    const complaint = candidate.source === 'BOOKING'
      ? candidate.catatan || candidate.keluhan || ''
      : '';

    setNamaPengemudi((prev) => (forceFill ? driverName : prev || driverName));
    setNoTelpPengemudi((prev) => (forceFill ? driverPhone : prev || driverPhone));
    if (complaint) {
      setKeluhan((prev) => (forceFill ? complaint : prev || complaint));
    }

    if (candidate.source === 'BOOKING') {
      const layanan = (candidate.jenis_layanan || '').toLowerCase();
      if (layanan.includes('part') || layanan.includes('sparepart') || layanan.includes('beli')) {
        setTipeKunjungan('Beli Part');
        setCustomTipeKunjungan('');
      } else if (layanan.includes('kunjungan') || layanan.includes('tamu')) {
        setTipeKunjungan('Kunjungan');
        setCustomTipeKunjungan('');
      } else if (layanan.includes('service') || layanan.includes('servis')) {
        setTipeKunjungan('Service');
        setCustomTipeKunjungan('');
      } else if (layanan) {
        setTipeKunjungan('Lainnya');
        setCustomTipeKunjungan(candidate.jenis_layanan || '');
      } else {
        setTipeKunjungan('Service');
        setCustomTipeKunjungan('');
      }
    }
  };

  const chooseCandidate = (candidate: CheckinCandidate | null, forceFill = false) => {
    selectedCandidateRef.current = candidate;
    setSelectedCandidate(candidate);
    if (!candidate) {
      setShowSuggestions(true);
      return;
    }
    setPlateInput(formatPlate(candidate.no_polisi));
    applyCandidate(candidate, forceFill);
    setShowSuggestions(false);

    // Jika kandidat merupakan BOOKING yang belum dikonfirmasi, munculkan modal alert peringatan
    if (candidate.source === 'BOOKING' && !candidate.is_confirmed) {
      setUnconfirmedModalCandidate(candidate);
    }
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
    const next = formatPlate(value);
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
      setTipeKunjungan('Service');
      setCustomTipeKunjungan('');
    }
  };

  // Daftar karyawan untuk dropdown PIC (sekali ambil, pencarian di sisi client)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsLoadingEmployees(true);
        const found = await securityApi.getEmployees('');
        if (active) setEmployeeList(found);
      } catch (err) {
        console.error('Error fetching employees:', err);
        if (active) setEmployeeList([]);
      } finally {
        if (active) setIsLoadingEmployees(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
  const isBookingStaleUnconfirmed = Boolean(selectedBooking?.is_stale_unconfirmed);
  const isWalkInWithUnit = Boolean(!selectedBooking && selectedUnit);
  const isWalkInPure = Boolean(
    !selectedBooking &&
    !selectedUnit &&
    !hasActiveBookingForPlate &&
    candidates.length === 0
  );
  const bookingVehicle =
    [selectedBooking?.merk, selectedBooking?.model].filter(Boolean).join(' ') ||
    selectedBooking?.jenis_armada ||
    selectedBooking?.jenis_layanan ||
    '';
  const memberVehicle =
    [selectedUnit?.merk, selectedUnit?.model].filter(Boolean).join(' ') ||
    selectedUnit?.jenis_armada ||
    '';

  // Nilai PIC dari pilihan dropdown karyawan
  const selectedEmployee =
    employeeList.find((emp) => String(emp.id) === selectedPicId) || null;
  const picValue = selectedEmployee?.employeename || '';

  // Opsi PIC: nama karyawan, posisi tampil sebagai label di samping nama
  const picOptions: SelectMenuOption[] = employeeList.map((emp) => ({
    value: String(emp.id),
    label: emp.employeename,
    hint: emp.positionname || 'Karyawan',
  }));


  // Status apakah tombol check in bisa ditekan
  const canSubmit = () => {
    if (cleanPlate.length < 3) return false;
    if (namaPengemudi.trim() === '') return false;
    if (picValue.trim() === '') return false;
    if (tipeKunjungan === 'Lainnya' && customTipeKunjungan.trim() === '') return false;
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
      const effectiveTipeKunjungan = tipeKunjungan === 'Lainnya'
        ? (customTipeKunjungan.trim() || 'Lainnya')
        : tipeKunjungan;

      const payload = {
        nomor_tiket: generatedTiket,
        booking_id: bookingId,
        jenis_kedatangan: jenisKedatangan,
        no_polisi: cleanPlate,
        nama_pengemudi: namaPengemudi.trim(),
        no_telepon_pengemudi: noTelpPengemudi.trim(),
        pic_tujuan: picValue || undefined,
        tipe_kunjungan: effectiveTipeKunjungan,
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
        tujuan: effectiveTipeKunjungan,
        keperluan: payload.keluhan,
        kontak: payload.no_telepon_pengemudi || '-',
        pic: picValue || '-',
        oleh: payload.petugas_security,
      });

      broadcastRealtimeEvent({
        type: 'VEHICLE_CHECKED_IN',
        targetRoles: ['Customer Fleet', 'SA', 'ALL'],
        title: 'Kendaraan Masuk di Gerbang',
        message: `Unit ${formatPlate(result?.no_polisi || cleanPlate)} (${payload.nama_pengemudi}) telah resmi check in di Pos Security. No. Tiket: ${result?.nomor_tiket || generatedTiket}.`,
        linkTab: 'fleet-service',
        urgency: 'info',
        meta: {
          no_polisi: result?.no_polisi || cleanPlate,
          nomor_tiket: result?.nomor_tiket || generatedTiket,
          booking_id: result?.booking_id ?? bookingId,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['active-inside'] });
      queryClient.invalidateQueries({ queryKey: ['memo-keluar'] });

      setIsTicketModalOpen(true);
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
    setTipeKunjungan('Service');
    setCustomTipeKunjungan('');
    setKeluhan('');
    setCatatanMasuk('');
    setSelectedPicId('');
    setCandidates([]);
    selectedCandidateRef.current = null;
    setSelectedCandidate(null);
    setShowSuggestions(false);
    setPhotos(INITIAL_PHOTOS);
  };

  if (successTicket) {
    return (
      <div className="mx-auto max-w-md py-4">
        <div className="rounded-2xl border border-[#D5DDE8] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A]">Check In Berhasil</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
            Kendaraan tercatat masuk di pos gerbang.
          </p>

          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Nomor Polisi
            </p>
            <p className="font-mono text-2xl font-bold tracking-[0.12em] text-[#0F172A]">
              {formatPlate(successTicket.no_polisi)}
            </p>
          </div>

          <dl className="mt-3 space-y-2.5 rounded-xl border border-[#E2E8F0] p-4 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Hash className="h-3.5 w-3.5" /> No. Tiket
              </dt>
              <dd className="font-mono font-bold text-[#12388F]">{successTicket.nomor_tiket}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <User className="h-3.5 w-3.5" /> PIC / Tujuan
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successTicket.pic}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Truck className="h-3.5 w-3.5" /> Nama Pengemudi
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successTicket.nama_driver}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Truck className="h-3.5 w-3.5" /> Tujuan
              </dt>
              <dd className="font-bold text-[#12388F]">{successTicket.tujuan}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1.5 text-[#64748B]">
                <Info className="h-3.5 w-3.5" /> Keperluan
              </dt>
              <dd className="max-w-[60%] text-right font-semibold text-[#0F172A]">
                {successTicket.keperluan}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Phone className="h-3.5 w-3.5" /> Kontak PIC
              </dt>
              <dd className="font-semibold text-[#0F172A]">{successTicket.kontak}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <Clock className="h-3.5 w-3.5" /> Waktu Check In
              </dt>
              <dd className="font-bold text-[#15803D]">{successTicket.waktu_masuk}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[#64748B]">
                <BadgeCheck className="h-3.5 w-3.5" /> Oleh
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-[#0F172A]">
                {successTicket.oleh}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#12388F] px-4 py-3 text-xs font-bold text-white shadow-md shadow-[#12388F]/25 transition hover:bg-[#0D2A6B]"
            >
              <Printer className="h-4 w-4" />
              Buka & Cetak Karcis Tiket
            </button>
            <button
              onClick={handleReset}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC]"
            >
              <LogIn className="h-4 w-4 text-[#12388F]" />
              Check In Berikutnya
            </button>
          </div>
        </div>

        {/* Modal Cetak Karcis Tiket via Iframe (Anti Blank) */}
        <CheckinTicketModal
          ticket={successTicket}
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          onNextCheckin={() => {
            setIsTicketModalOpen(false);
            handleReset();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 px-0.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#12388F] text-white shadow-sm shadow-[#12388F]/20">
          <LogIn className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight tracking-tight text-[#0F172A]">Check In</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
            Kendaraan masuk
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-[#DC2626]/25 bg-[#FEF2F2] px-3.5 py-3 text-xs text-[#B91C1C]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitCheckIn} className="space-y-4">
        <section className="rounded-2xl border border-[#D5DDE8] bg-white p-4 shadow-sm sm:p-5">
          {/* Nomor Polisi */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkin-plate" className="text-xs font-semibold text-[#0F172A]">
                Nomor Polisi <span className="text-[#DC2626]">*</span>
              </label>
              <span className="text-[10px] font-semibold text-[#64748B]">Otomatis cek booking</span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#12388F]" />
              <input
                id="checkin-plate"
                type="text"
                required
                autoComplete="off"
                value={plateInput}
                onChange={(e) => handlePlateInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                autoFocus
                placeholder="BK 1234 ABC"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-10 pr-10 font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#0F172A] transition placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#94A3B8] focus:border-[#12388F] focus:outline-none focus:ring-2 focus:ring-[#12388F]/15"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#12388F]" />
                ) : plateInput ? (
                  <button
                    type="button"
                    onClick={() => handlePlateInputChange('')}
                    title="Hapus"
                    className="cursor-pointer rounded-full p-1 text-[#64748B] transition hover:bg-[#E2E8F0]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Daftar kandidat: booking aktif + unit member terdaftar */}
              {showSuggestions && candidates.length > 0 && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#CBD5E1] bg-white shadow-xl">
                  {candidates.map((item) => {
                    const disabled = item.source === 'MEMBER_UNIT' && item.has_active_booking;
                    const selected = Boolean(
                      selectedCandidate &&
                      candidateKey(selectedCandidate) === candidateKey(item)
                    );
                    const vehicleLabel =
                      [item.merk, item.model].filter(Boolean).join(' ') ||
                      item.jenis_armada ||
                      'Unit';

                    return (
                      <button
                        key={candidateKey(item)}
                        type="button"
                        disabled={disabled}
                        onClick={() => chooseCandidate(item, true)}
                        className={`flex w-full items-center justify-between gap-3 border-b border-[#F1F5F9] px-3 py-2.5 text-left transition last:border-0 ${
                          disabled
                            ? 'cursor-not-allowed bg-[#F8FAFC] opacity-60'
                            : 'cursor-pointer hover:bg-[#F8FAFC]'
                        } ${selected ? 'bg-[#EEF2F9]' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-[#0F172A]">
                              {formatPlate(item.no_polisi)}
                            </span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                                item.source === 'BOOKING'
                                  ? 'border-[#6366F1]/25 bg-[#E0E7FF] text-[#3730A3]'
                                  : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]'
                              }`}
                            >
                              {item.source === 'BOOKING' ? 'Booking' : 'Member'}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                            {item.source === 'BOOKING'
                              ? `${item.tanggal_booking || '-'} ${item.jam_booking || ''} • ${
                                  item.customer_name || 'Pelanggan'
                                }`
                              : `${item.nama_perusahaan || item.customer_name || 'Member'} • ${vehicleLabel}`}
                          </p>
                          {disabled && (
                            <p className="mt-0.5 text-[10px] font-medium text-[#B45309]">
                              Ada booking aktif — pilih data booking.
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                            item.source === 'MEMBER_UNIT'
                              ? item.status_aktif === false
                                ? 'border-[#DC2626]/25 bg-[#FEE2E2] text-[#B91C1C]'
                                : 'border-[#3B82F6]/25 bg-[#EFF6FF] text-[#1D4ED8]'
                              : item.is_confirmed
                              ? 'border-[#16A34A]/25 bg-[#DCFCE7] text-[#15803D]'
                              : 'border-[#F59E0B]/30 bg-[#FEF3C7] text-[#B45309]'
                          }`}
                        >
                          {item.source === 'MEMBER_UNIT'
                            ? item.status_aktif === false
                              ? 'Nonaktif'
                              : 'Walk-In'
                            : item.is_confirmed
                            ? 'Confirmed'
                            : item.is_stale_unconfirmed
                            ? 'Lewat H-1'
                            : 'Belum Confirm'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status singkat */}
            {cleanPlate.length >= 3 && (
              <div className="mt-2.5">
                {isBookingConfirmed && selectedBooking && (
                  <StatusLine tone="green" icon={CheckCircle2}>
                    <strong className="font-semibold">Booking terkonfirmasi</strong> •{' '}
                    {selectedBooking.customer_name || 'Pelanggan'}
                    {bookingVehicle ? ` • ${bookingVehicle}` : ''} •{' '}
                    {selectedBooking.tanggal_booking || '-'} {selectedBooking.jam_booking || ''}
                  </StatusLine>
                )}
                {isBookingUnconfirmed && selectedBooking && (
                  <StatusLine
                    tone={isBookingStaleUnconfirmed ? 'red' : 'amber'}
                    icon={AlertTriangle}
                  >
                    {isBookingStaleUnconfirmed
                      ? 'Booking lewat H-1 dan belum dikonfirmasi. Hubungi admin bengkel.'
                      : 'Booking belum dikonfirmasi. Hubungi admin bengkel dulu.'}
                  </StatusLine>
                )}
                {!selectedCandidate && hasActiveBookingForPlate && (
                  <StatusLine tone="amber" icon={AlertTriangle}>
                    Ada booking aktif — pilih data booking di daftar atas.
                  </StatusLine>
                )}
                {isWalkInWithUnit && selectedUnit && (
                  <StatusLine tone="blue" icon={Truck}>
                    <strong className="font-semibold">
                      Walk-in member
                    </strong>{' '}
                    • {selectedUnit.nama_perusahaan || selectedUnit.nama_pengguna_fleet || 'Member'}
                    {memberVehicle ? ` • ${memberVehicle}` : ''}
                    {selectedUnit.status_aktif === false ? ' (unit nonaktif)' : ''}
                  </StatusLine>
                )}

              </div>
            )}
          </div>

          <div className="my-4 border-t border-[#E2E8F0]" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="checkin-type" className={LABEL_CLASS}>
                Tujuan Kedatangan <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <select
                  id="checkin-type"
                  value={tipeKunjungan}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTipeKunjungan(val);
                    if (val !== 'Lainnya') {
                      setCustomTipeKunjungan('');
                    }
                  }}
                  className={`${FIELD_CLASS} appearance-none pr-8`}
                >
                  <option value="Service">Service</option>
                  <option value="Kunjungan">Kunjungan</option>
                  <option value="Beli Part">Beli Part</option>
                  <option value="Lainnya">Lainnya (Isi Sendiri)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              </div>

              {tipeKunjungan === 'Lainnya' && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="text"
                    required
                    value={customTipeKunjungan}
                    onChange={(e) => setCustomTipeKunjungan(e.target.value)}
                    placeholder="Tuliskan tujuan kedatangan..."
                    maxLength={30}
                    className={FIELD_CLASS}
                    autoFocus
                  />
                  <p className="mt-1 text-[10px] text-[#64748B]">
                    Tujuan kedatangan kustom akan dicatat ke database dan tiket masuk.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="checkin-driver" className={LABEL_CLASS}>
                Nama Pengemudi <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  id="checkin-driver"
                  type="text"
                  required
                  value={namaPengemudi}
                  onChange={(e) => setNamaPengemudi(e.target.value)}
                  placeholder="Nama pengemudi"
                  className={ICON_FIELD_CLASS}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkin-pic" className={LABEL_CLASS}>
                PIC / Tujuan <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <SelectMenu
                  id="checkin-pic"
                  value={selectedPicId}
                  onChange={setSelectedPicId}
                  options={picOptions}
                  searchable
                  disabled={isLoadingEmployees}
                  placeholder={
                    isLoadingEmployees ? 'Memuat daftar karyawan...' : 'Pilih PIC / tujuan...'
                  }
                  searchPlaceholder="Cari nama atau posisi..."
                  emptyMessage="Karyawan tidak ditemukan"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkin-complaint" className={LABEL_CLASS}>
                Keperluan Kunjungan
              </label>
              <input
                id="checkin-complaint"
                type="text"
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="Keperluan kunjungan / keluhan kendaraan"
                className={FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkin-phone" className={LABEL_CLASS}>
                Kontak Pengemudi
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  id="checkin-phone"
                  type="tel"
                  value={noTelpPengemudi}
                  onChange={(e) => setNoTelpPengemudi(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className={ICON_FIELD_CLASS}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="checkin-notes" className={LABEL_CLASS}>
              Keterangan Tambahan <span className="font-normal text-[#94A3B8]">(opsional)</span>
            </label>
            <textarea
              id="checkin-notes"
              rows={2}
              value={catatanMasuk}
              onChange={(e) => setCatatanMasuk(e.target.value)}
              placeholder="Keterangan tambahan / barang bawaan..."
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[#D5DDE8] bg-white p-4 shadow-sm sm:p-5">
          <MultiCameraSection photos={photos} onChange={setPhotos} eventTitle="Kendaraan" />
        </section>

        <div className="rounded-2xl border border-[#D5DDE8] bg-white p-3 shadow-sm sm:p-4">
          <button
            type="submit"
            disabled={!canSubmit() || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition ${
              canSubmit() && !isSubmitting
                ? 'cursor-pointer bg-[#12388F] text-white shadow-md shadow-[#12388F]/20 hover:bg-[#0D2A6B]'
                : 'cursor-not-allowed border border-[#CBD5E1] bg-[#E2E8F0] text-[#94A3B8]'
            }`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isSubmitting ? 'Memproses...' : 'Submit Check In'}
          </button>
        </div>
      </form>

      {/* MODAL POPUP: Alert Booking Belum Dikonfirmasi */}
      {unconfirmedModalCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setUnconfirmedModalCandidate(null);
            }}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Alert */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4.5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                    <ShieldAlert className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Booking Belum Dikonfirmasi</h3>
                    <p className="text-xs text-amber-100">Pemberitahuan Petugas Security</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnconfirmedModalCandidate(null)}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Isi Konten Modal */}
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold text-sm text-amber-950 mb-1">
                    Kendaraan Belum Diizinkan Masuk Gerbang
                  </p>
                  Silakan arahkan pengemudi atau customer untuk melakukan <strong>konfirmasi booking service</strong> terlebih dahulu ke <strong>Admin Bengkel / Service Advisor</strong> sebelum melanjutkan proses check-in.
                </div>

                {/* Detail Ringkas Booking */}
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Nomor Polisi:</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {formatPlate(unconfirmedModalCandidate.no_polisi)}
                    </span>
                  </div>
                  {unconfirmedModalCandidate.no_booking && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500">No. Booking:</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {unconfirmedModalCandidate.no_booking}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Nama Customer:</span>
                    <span className="font-semibold text-slate-800">
                      {unconfirmedModalCandidate.customer_name || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Jadwal Rencana:</span>
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-amber-600" />
                      {unconfirmedModalCandidate.tanggal_booking || '-'} {unconfirmedModalCandidate.jam_booking || ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Status Saat Ini:</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                      {unconfirmedModalCandidate.status_booking || 'Menunggu Konfirmasi'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setUnconfirmedModalCandidate(null)}
                    className="w-full rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition cursor-pointer"
                  >
                    Saya Mengerti, Beritahu Pengemudi
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
