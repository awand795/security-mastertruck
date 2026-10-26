import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PageAction } from '../components/layout/BottomChrome';
import {
  CARD,
  FIELD,
  FIELD_PLATE,
  LABEL,
  ERROR_BANNER,
  CHIP_BASE,
  CHIP_TONE,
} from '../styles/ui';

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

const FIELD_CLASS = FIELD;

const ICON_FIELD_CLASS = `${FIELD} pl-9`;

const LABEL_CLASS = LABEL;

const StatusLine: React.FC<{
  tone: 'green' | 'amber' | 'red' | 'blue' | 'slate';
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ tone, icon: Icon, children }) => {
  const toneClass = {
    green: 'border-status-green/30 bg-status-green-bg text-status-green',
    amber: 'border-status-amber/40 bg-status-amber-bg text-status-amber',
    red: 'border-status-red/30 bg-status-red-bg text-status-red',
    blue: 'border-status-blue/30 bg-status-blue-bg text-status-blue',
    slate: 'border-border-strong bg-status-neutral-bg text-status-neutral',
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${toneClass}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
};

export const CheckInView: React.FC = () => {
  const queryClient = useQueryClient();
  const currentUser = useSecurityStore((state) => state.user);
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);
  const namaCabang = useSecurityStore((state) => state.namaCabang);
  const canAutoFocus = !window.matchMedia?.('(pointer: coarse)').matches;

  // Unified Plate Input
  const [plateInput, setPlateInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Selected candidate state
  const [selectedCandidate, setSelectedCandidate] = useState<CheckinCandidate | null>(null);
  const selectedCandidateRef = useRef<CheckinCandidate | null>(null);

  const lookupPlate = normalizePlate(plateInput);

  // TanStack Query: polling setiap 3 detik agar sinkron otomatis saat booking di-confirm admin!
  const {
    data: candidates = [],
    isFetching: isSearching,
  } = useQuery<CheckinCandidate[]>({
    queryKey: ['checkin-candidates', lookupPlate],
    queryFn: () =>
      lookupPlate.length >= 3
        ? securityApi.searchCheckinCandidates(lookupPlate)
        : Promise.resolve([]),
    enabled: lookupPlate.length >= 3,
    refetchInterval: 3000,
  });

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

  // Sinkronisasi status booking kandidat terkini (misal admin baru konfirmasi di Web Fleet)
  useEffect(() => {
    if (lookupPlate.length < 3) {
      selectedCandidateRef.current = null;
      setSelectedCandidate(null);
      return;
    }

    // Jika sudah ada pilihan sebelumnya, selalu sinkronkan dengan status terbaru dari server
    const currentSelected = selectedCandidateRef.current;
    if (currentSelected && currentSelected.no_polisi_clean === lookupPlate) {
      const fresh = candidates.find((item) => candidateKey(item) === candidateKey(currentSelected));
      if (fresh) {
        selectedCandidateRef.current = fresh;
        setSelectedCandidate(fresh);
        // Jika statusnya sekarang terkonfirmasi, otomatis tutup alert unconfirmed
        if (fresh.is_confirmed) {
          setUnconfirmedModalCandidate(null);
        }
        return;
      }
    }

    // Auto-select jika ada exact match tunggal
    const exact = candidates.filter(
      (item) =>
        item.no_polisi_clean === lookupPlate &&
        !(item.source === 'MEMBER_UNIT' && item.has_active_booking)
    );

    if (exact.length === 1) {
      chooseCandidate(exact[0], false);
    } else if (exact.length === 0 && candidates.length === 1) {
      if (!(candidates[0].source === 'MEMBER_UNIT' && candidates[0].has_active_booking)) {
        chooseCandidate(candidates[0], false);
      }
    } else {
      selectedCandidateRef.current = null;
      setSelectedCandidate(null);
    }
  }, [candidates, lookupPlate]);

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

  // Daftar karyawan untuk dropdown PIC (difilter berdasarkan cabang aktif security)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsLoadingEmployees(true);
        const found = await securityApi.getEmployees('', kodeCabang);
        if (active) {
          setEmployeeList(found);
        }
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
  }, [kodeCabang]);

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

  // Nilai PIC dari pilihan dropdown karyawan (menggunakan employeeid untuk relasi di database)
  const selectedEmployee = selectedPicId
    ? employeeList.find(
        (emp) =>
          (emp.employeeid && emp.employeeid === selectedPicId) ||
          String(emp.id) === selectedPicId
      ) || null
    : null;
  const effectivePicId = selectedEmployee?.employeeid || (selectedEmployee ? String(selectedEmployee.id) : '');
  const picValue = selectedEmployee?.employeename || '';

  // Opsi PIC: employeeid/id sebagai value relasional, posisi tampil sebagai label di samping nama
  const picOptions: SelectMenuOption[] = employeeList.map((emp) => ({
    value: emp.employeeid || String(emp.id),
    label: emp.employeename,
    hint: emp.positionname || (emp.isserviceadvisor ? 'Service Advisor' : 'Karyawan'),
  }));

  // Status apakah tombol check in bisa ditekan
  const canSubmit = () => {
    if (cleanPlate.length < 3) return false;
    if (namaPengemudi.trim() === '') return false;
    if (!selectedPicId || effectivePicId.trim() === '') return false;
    if (tipeKunjungan === 'Lainnya' && customTipeKunjungan.trim() === '') return false;
    if (selectedBooking) return isBookingConfirmed;
    if (selectedUnit) return !selectedUnit.has_active_booking;
    if (hasActiveBookingForPlate) return false; // wajib pilih booking aktif
    return true;
  };

  const generateTicketFallback = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `TG-${yy}${mm}${dd}-0001`;
  };

  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const bookingId = selectedBooking?.booking_id ?? null;
      const isMemberUnit = Boolean(selectedUnit && !selectedBooking);
      const jenisKedatangan: 'BOOKING' | 'WALK_IN_MEMBER' | 'WALK_IN' = selectedBooking
        ? 'BOOKING'
        : isMemberUnit
        ? 'WALK_IN_MEMBER'
        : 'WALK_IN';
      const effectiveTipeKunjungan = tipeKunjungan === 'Lainnya'
        ? (customTipeKunjungan.trim() || 'Lainnya')
        : tipeKunjungan;

      const payload = {
        booking_id: bookingId,
        jenis_kedatangan: jenisKedatangan,
        no_polisi: cleanPlate,
        nama_pengemudi: namaPengemudi.trim(),
        no_telepon_pengemudi: noTelpPengemudi.trim(),
        pic_tujuan: effectivePicId || undefined,
        kode_cabang: kodeCabang || '011',
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

      const finalTicketNumber = result?.nomor_tiket || generateTicketFallback();

      setSuccessTicket({
        nomor_tiket: finalTicketNumber,
        no_polisi: result?.no_polisi || cleanPlate,
        waktu_masuk: formattedTime,
        nama_driver: result?.nama_pengemudi || payload.nama_pengemudi,
        jenis: (result?.jenis_kedatangan || jenisKedatangan) as any,
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
        message: `Unit ${formatPlate(result?.no_polisi || cleanPlate)} (${payload.nama_pengemudi}) telah resmi check in di Pos Security. No. Tiket: ${finalTicketNumber}.`,
        linkTab: 'fleet-service',
        urgency: 'info',
        meta: {
          no_polisi: result?.no_polisi || cleanPlate,
          nomor_tiket: finalTicketNumber,
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
    selectedCandidateRef.current = null;
    setSelectedCandidate(null);
    setShowSuggestions(false);
    setPhotos(INITIAL_PHOTOS);
  };

  if (successTicket) {
    return (
      <div className="mx-auto max-w-md py-2">
        <div className="rounded-2xl border border-border bg-surface-raised p-6 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-status-green-bg text-status-green">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-ink">Check In Berhasil</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Kendaraan tercatat masuk di pos gerbang.
          </p>

          <div className="mt-4 rounded-xl border border-border bg-surface-sunken px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              Nomor Polisi
            </p>
            <p className="font-mono text-2xl font-bold tracking-[0.12em] text-ink">
              {formatPlate(successTicket.no_polisi)}
            </p>
          </div>

          <dl className="mt-3 space-y-2.5 rounded-xl border border-border p-4 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Hash className="h-3.5 w-3.5" /> No. Tiket
              </dt>
              <dd className="font-mono font-bold text-accent">{successTicket.nomor_tiket}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <User className="h-3.5 w-3.5" /> PIC / Tujuan
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successTicket.pic}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Truck className="h-3.5 w-3.5" /> Nama Pengemudi
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successTicket.nama_driver}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Truck className="h-3.5 w-3.5" /> Tujuan
              </dt>
              <dd className="font-bold text-accent">{successTicket.tujuan}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1.5 text-ink-muted">
                <Info className="h-3.5 w-3.5" /> Keperluan
              </dt>
              <dd className="max-w-[60%] text-right font-semibold text-ink">
                {successTicket.keperluan}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Phone className="h-3.5 w-3.5" /> Kontak PIC
              </dt>
              <dd className="font-semibold text-ink">{successTicket.kontak}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <Clock className="h-3.5 w-3.5" /> Waktu Check In
              </dt>
              <dd className="font-bold text-status-green">{successTicket.waktu_masuk}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <BadgeCheck className="h-3.5 w-3.5" /> Oleh
              </dt>
              <dd className="max-w-[60%] truncate font-semibold text-ink">
                {successTicket.oleh}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-on shadow-card transition hover:bg-accent-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Printer className="h-4 w-4" />
              Buka & Cetak Karcis Tiket
            </button>
            <button
              onClick={handleReset}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-xs font-bold text-ink transition hover:bg-surface-sunken active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LogIn className="h-4 w-4 text-accent" />
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

  // Penjelasan singkat mengapa tombol Check In belum bisa ditekan (murni UI)
  const disabledReason = (() => {
    if (isSubmitting) return null;
    if (cleanPlate.length < 3) return 'Isi nomor polisi terlebih dahulu.';
    if (selectedBooking && !isBookingConfirmed)
      return isBookingStaleUnconfirmed
        ? 'Booking lewat H-1 dan belum dikonfirmasi admin.'
        : 'Booking belum dikonfirmasi admin bengkel (Menunggu Konfirmasi).';
    if (selectedUnit?.has_active_booking) return 'Unit punya booking aktif — pilih data booking.';
    if (hasActiveBookingForPlate && !selectedBooking)
      return 'Plat ini punya booking aktif — pilih data booking di daftar.';
    if (namaPengemudi.trim() === '') return 'Nama pengemudi wajib diisi.';
    if (!selectedPicId || effectivePicId.trim() === '') return 'Pilih PIC terlebih dahulu.';
    if (tipeKunjungan === 'Lainnya' && customTipeKunjungan.trim() === '')
      return 'Tuliskan tujuan kedatangan.';
    return null;
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-3 md:max-w-4xl">
      <div className="flex items-center gap-3 px-0.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-on shadow-card">
          <LogIn className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight tracking-tight text-ink">Check In</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Kendaraan masuk
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className={ERROR_BANNER}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      <form id="checkin-form" onSubmit={handleSubmitCheckIn} className="space-y-3">
        {/* Kartu 1: Nomor polisi & status booking */}
        <section className="space-y-2.5">
          <div className={CARD}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkin-plate" className="text-sm font-bold text-ink">
                Nomor Polisi <span className="text-status-red">*</span>
              </label>
              <span className="text-[10px] font-semibold text-ink-subtle">Otomatis cek booking</span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" />
              <input
                id="checkin-plate"
                type="text"
                required
                autoComplete="off"
                value={plateInput}
                onChange={(e) => handlePlateInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                autoFocus={canAutoFocus}
                placeholder="BK 1234 ABC"
                className={FIELD_PLATE}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                ) : plateInput ? (
                  <button
                    type="button"
                    onClick={() => handlePlateInputChange('')}
                    title="Hapus"
                    aria-label="Hapus nomor polisi"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition hover:bg-surface-sunken hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Daftar kandidat: booking aktif + unit member terdaftar */}
              {showSuggestions && candidates.length > 0 && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-2 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-2 shadow-pop">
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
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                          disabled
                            ? 'cursor-not-allowed border-border bg-surface-sunken opacity-60'
                            : 'cursor-pointer border-border hover:border-accent/40 hover:bg-surface-sunken'
                        } ${selected ? 'border-accent/50 bg-accent-subtle' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold tracking-[0.06em] text-ink">
                              {formatPlate(item.no_polisi)}
                            </span>
                            <span
                              className={`${CHIP_BASE} ${
                                item.source === 'BOOKING' ? CHIP_TONE.blue : CHIP_TONE.neutral
                              }`}
                            >
                              {item.source === 'BOOKING' ? 'Booking' : 'Member'}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-ink-muted">
                            {item.source === 'BOOKING'
                              ? `${item.tanggal_booking || '-'} ${item.jam_booking || ''} • ${
                                  item.customer_name || 'Pelanggan'
                                }`
                              : `${item.nama_perusahaan || item.customer_name || 'Member'} • ${vehicleLabel}`}
                          </p>
                          {disabled && (
                            <p className="mt-1 text-[10px] font-semibold text-status-amber">
                              Ada booking aktif — pilih data booking.
                            </p>
                          )}
                        </div>
                        <span
                          className={`${CHIP_BASE} ${
                            item.source === 'MEMBER_UNIT'
                              ? item.status_aktif === false
                                ? CHIP_TONE.red
                                : CHIP_TONE.blue
                              : item.is_confirmed
                              ? CHIP_TONE.green
                              : CHIP_TONE.amber
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
              <div className="space-y-2">
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
                    <strong className="font-semibold">Walk-in member</strong>{' '}
                    • {selectedUnit.nama_perusahaan || selectedUnit.nama_pengguna_fleet || 'Member'}
                    {memberVehicle ? ` • ${memberVehicle}` : ''}
                    {selectedUnit.status_aktif === false ? ' (unit nonaktif)' : ''}
                  </StatusLine>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Kartu 2: Data kunjungan */}
        <section className={CARD}>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
            Data Kunjungan
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="checkin-type" className={LABEL_CLASS}>
                Tujuan Kedatangan <span className="text-status-red">*</span>
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
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
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
                  <p className="mt-1 text-[10px] text-ink-muted">
                    Tujuan kedatangan kustom akan dicatat ke database dan tiket masuk.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="checkin-driver" className={LABEL_CLASS}>
                Nama Pengemudi <span className="text-status-red">*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
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
                PIC / Tujuan <span className="text-status-red">*</span>
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
                    isLoadingEmployees ? 'Memuat daftar karyawan...' : 'Pilih PIC...'
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
                placeholder="Keperluan kunjungan"
                className={FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="checkin-phone" className={LABEL_CLASS}>
                Kontak Pengemudi
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
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

          <div className="mt-2.5">
            <label htmlFor="checkin-notes" className={LABEL_CLASS}>
              Keterangan Tambahan <span className="font-normal text-ink-subtle">(opsional)</span>
            </label>
            <textarea
              id="checkin-notes"
              rows={2}
              value={catatanMasuk}
              onChange={(e) => setCatatanMasuk(e.target.value)}
              placeholder="Keterangan tambahan"
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
        </section>

        {/* Kartu 3: Foto 4 sudut */}
        <section className={CARD}>
          <MultiCameraSection photos={photos} onChange={setPhotos} eventTitle="Kendaraan" />
        </section>

        {/* Aksi utama: slot BottomChrome (mobile) / sticky bawah konten (desktop) */}
        <PageAction>
          {!canSubmit() && !isSubmitting && disabledReason && (
            <p className="pb-1.5 text-center text-[11px] font-medium leading-none text-ink-muted">
              {disabledReason}
            </p>
          )}
          <button
            type="submit"
            form="checkin-form"
            disabled={!canSubmit() || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              canSubmit() && !isSubmitting
                ? 'cursor-pointer bg-accent text-accent-on shadow-card hover:bg-accent-hover active:scale-[0.99] active:bg-accent-active'
                : isSubmitting
                ? 'cursor-progress bg-accent text-accent-on opacity-70'
                : 'cursor-not-allowed bg-accent text-accent-on opacity-45 shadow-none'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isSubmitting ? 'Memproses...' : 'Check In Sekarang'}
          </button>
        </PageAction>
      </form>

      {/* MODAL POPUP: Alert Booking Belum Dikonfirmasi */}
      {unconfirmedModalCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setUnconfirmedModalCandidate(null);
            }}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-status-amber/40 bg-surface-raised shadow-pop animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Alert */}
              <div className="flex items-center justify-between bg-status-amber-fill px-6 py-4 text-ink">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 backdrop-blur-md">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Booking Belum Dikonfirmasi</h3>
                    <p className="text-xs opacity-80">Pemberitahuan Petugas Security</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnconfirmedModalCandidate(null)}
                  aria-label="Tutup"
                  className="rounded-lg p-1.5 transition hover:bg-black/10 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Isi Konten Modal */}
              <div className="space-y-4 p-6">
                <div className="rounded-xl border border-status-amber/40 bg-status-amber-bg p-4 text-xs leading-relaxed text-status-amber">
                  <p className="mb-1 text-sm font-semibold text-ink">
                    Kendaraan Belum Diizinkan Masuk Gerbang
                  </p>
                  Silakan arahkan pengemudi atau customer untuk melakukan{' '}
                  <strong>konfirmasi booking service</strong> terlebih dahulu ke{' '}
                  <strong>Admin Bengkel / Service Advisor</strong> sebelum melanjutkan proses
                  check-in.
                </div>

                {/* Detail Ringkas Booking */}
                <div className="divide-y divide-border rounded-xl border border-border bg-surface-sunken p-3.5 text-xs">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-ink-muted">Nomor Polisi:</span>
                    <span className="font-mono text-sm font-bold text-ink">
                      {formatPlate(unconfirmedModalCandidate.no_polisi)}
                    </span>
                  </div>
                  {unconfirmedModalCandidate.no_booking && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-ink-muted">No. Booking:</span>
                      <span className="font-mono font-semibold text-ink">
                        {unconfirmedModalCandidate.no_booking}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-ink-muted">Nama Customer:</span>
                    <span className="font-semibold text-ink">
                      {unconfirmedModalCandidate.customer_name || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-ink-muted">Jadwal Rencana:</span>
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Calendar className="h-3 w-3 text-status-amber" />
                      {unconfirmedModalCandidate.tanggal_booking || '-'}{' '}
                      {unconfirmedModalCandidate.jam_booking || ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-ink-muted">Status Saat Ini:</span>
                    <span className={`${CHIP_BASE} ${CHIP_TONE.amber}`}>
                      {unconfirmedModalCandidate.status_booking || 'Menunggu Konfirmasi'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUnconfirmedModalCandidate(null)}
                    className="w-full cursor-pointer rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-on shadow-card transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
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
