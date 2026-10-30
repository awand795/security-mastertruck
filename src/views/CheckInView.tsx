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
  Keyboard,
  Scan,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { CheckinCandidate, EmployeeItem } from '../types';
import { MultiCameraSection, PhotoSlot } from '../components/security/MultiCameraSection';
import { PlateOcrScannerModal } from '../components/security/PlateOcrScannerModal';
import { SelectMenu, SelectMenuOption } from '../components/common/SelectMenu';
import { type SuccessTicketData } from '../components/security/CheckinTicketModal';
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
  const canAutoFocus = !window.matchMedia?.('(pointer: coarse)').matches;

  // Mode Input: 'manual' vs 'camera'
  const [inputMode, setInputMode] = useState<'manual' | 'camera'>('manual');
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  // Plate Input & Candidate State
  const [plateInput, setPlateInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [candidates, setCandidates] = useState<CheckinCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState<CheckinCandidate | null>(null);
  const selectedCandidateRef = useRef<CheckinCandidate | null>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  // Driver and visit details
  const [namaPengemudi, setNamaPengemudi] = useState('');
  const [noTelpPengemudi, setNoTelpPengemudi] = useState('');
  const [tipeKunjungan, setTipeKunjungan] = useState('Service');
  const [customTipeKunjungan, setCustomTipeKunjungan] = useState('');
  const [keluhan, setKeluhan] = useState('');
  const [catatanMasuk, setCatatanMasuk] = useState('');

  // PIC / Tujuan
  const [selectedPicId, setSelectedPicId] = useState('');
  const [employeeList, setEmployeeList] = useState<EmployeeItem[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  // Photos
  const [photos, setPhotos] = useState<PhotoSlot[]>(INITIAL_PHOTOS);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<SuccessTicketData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unconfirmedModalCandidate, setUnconfirmedModalCandidate] = useState<CheckinCandidate | null>(null);

  // Tutup suggestions jika klik di luar dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const applyCandidate = (candidate: CheckinCandidate, forceFill = false) => {
    const driverName =
      candidate.source === 'BOOKING'
        ? candidate.customer_name || ''
        : candidate.nama_pengguna_fleet || candidate.nama_pic || candidate.customer_name || '';
    const driverPhone =
      candidate.source === 'BOOKING'
        ? candidate.customer_telepon || ''
        : candidate.unit_telepon || candidate.customer_telepon || '';
    const complaint =
      candidate.source === 'BOOKING'
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

  // Eksekusi pencarian plat nomor saat tombol Cari diklik atau Enter ditekan
  const executePlateSearch = async (overridePlate?: string) => {
    const rawTarget = overridePlate !== undefined ? overridePlate : plateInput;
    const cleanTarget = normalizePlate(rawTarget);
    setErrorMsg(null);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await securityApi.searchCheckinCandidates(cleanTarget);
      setCandidates(results);
      setShowSuggestions(true);

      // 1. Cek apakah ada kecocokan exact nopol pada booking/member
      const exactMatches = results.filter((item) => item.no_polisi_clean === cleanTarget);

      if (exactMatches.length === 1) {
        // Tepat 1 kandidat cocok persis -> pilih langsung
        chooseCandidate(exactMatches[0], true);
        setShowSuggestions(false);
      } else if (exactMatches.length > 1) {
        // Ada booking + member -> biarkan user memilih dari dropdown suggestions
        setShowSuggestions(true);
      } else if (results.length === 0 && cleanTarget.length >= 3) {
        // 2. Jika tidak ada di searchCheckinCandidates, cek langsung ke tabel member unit
        const memberUnits = await securityApi.lookupUnitMember(cleanTarget);
        if (memberUnits.length > 0) {
          const m = memberUnits[0];
          const memberCandidate: CheckinCandidate = {
            source: 'MEMBER_UNIT',
            no_polisi: m.no_polisi || cleanTarget,
            no_polisi_clean: cleanTarget,
            customer_name: m.nama_perusahaan || m.customer_name || 'Member',
            nama_perusahaan: m.nama_perusahaan,
            nama_pengguna_fleet: m.nama_pengguna_fleet || m.nama_supir,
            unit_telepon: m.no_telepon_supir,
            merk: m.merk,
            model: m.model,
            jenis_armada: m.jenis_armada,
            has_active_booking: false,
            status_aktif: true,
            is_confirmed: true,
            can_checkin: true,
            is_within_window: true,
            is_stale_unconfirmed: false,
          };
          setCandidates([memberCandidate]);
          chooseCandidate(memberCandidate, true);
          setShowSuggestions(false);
        } else {
          // 3. Walk-in umum biasa (tidak ada booking dan bukan member)
          selectedCandidateRef.current = null;
          setSelectedCandidate(null);
          setShowSuggestions(false);
        }
      }
    } catch (err: any) {
      console.error('Error searching candidates:', err);
      setErrorMsg('Gagal mencari data plat. Periksa koneksi jaringan.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handler saat plat terdeteksi otomatis lewat OCR Scanner Kamera
  const handleOcrPlateDetected = (detectedPlate: string) => {
    const formatted = formatPlate(detectedPlate);
    setPlateInput(formatted);
    setInputMode('manual');
    // Eksekusi verifikasi otomatis menggunakan logika sistem
    executePlateSearch(detectedPlate);
  };

  // Ubah input plat (tidak langsung tembak API tiap ketik huruf)
  const handlePlateInputChange = (value: string) => {
    const formatted = formatPlate(value);
    setPlateInput(formatted);
    setErrorMsg(null);
    setHasSearched(false);

    const currentClean = normalizePlate(formatted);
    const selectedClean = selectedCandidateRef.current?.no_polisi_clean;

    if (selectedClean && selectedClean !== currentClean) {
      selectedCandidateRef.current = null;
      setSelectedCandidate(null);
      setNamaPengemudi('');
      setNoTelpPengemudi('');
      setKeluhan('');
      setTipeKunjungan('Service');
      setCustomTipeKunjungan('');
    }
  };

  // Daftar karyawan untuk dropdown PIC
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

  // Klasifikasi Status Kedatangan
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
    !hasActiveBookingForPlate
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

  const selectedEmployee = selectedPicId
    ? employeeList.find(
        (emp) =>
          (emp.employeeid && emp.employeeid === selectedPicId) ||
          String(emp.id) === selectedPicId
      ) || null
    : null;
  const effectivePicId = selectedEmployee?.employeeid || (selectedEmployee ? String(selectedEmployee.id) : '');
  const picValue = selectedEmployee?.employeename || '';

  const picOptions: SelectMenuOption[] = employeeList.map((emp) => ({
    value: emp.employeeid || String(emp.id),
    label: emp.employeename,
    hint: emp.positionname || (emp.isserviceadvisor ? 'Service Advisor' : 'Karyawan'),
  }));

  const canSubmit = () => {
    if (cleanPlate.length < 3) return false;
    if (namaPengemudi.trim() === '') return false;
    if (!selectedPicId || effectivePicId.trim() === '') return false;
    if (tipeKunjungan === 'Lainnya' && customTipeKunjungan.trim() === '') return false;
    if (selectedBooking) return isBookingConfirmed;
    if (selectedUnit) return !selectedUnit.has_active_booking;
    if (hasActiveBookingForPlate && !selectedBooking) return false;
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
        kode_cabang: kodeCabang || (currentUser?.store_id ? String(currentUser.store_id) : undefined),
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
        no_booking: selectedCandidate?.no_booking || undefined,
        nama_perusahaan: selectedCandidate?.nama_perusahaan || undefined,
        tujuan: effectiveTipeKunjungan,
        keperluan: payload.keluhan,
        kontak: payload.no_telepon_pengemudi || '-',
        pic: picValue || '-',
        oleh: payload.petugas_security,
        fotoCount: photos.filter((p) => Boolean(p.dataUrl)).length || 4,
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
    setCandidates([]);
    setHasSearched(false);
    setPhotos(INITIAL_PHOTOS);
  };

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
        {/* Kartu 1: Nomor Polisi, Tab Pilihan (Manual vs Scan Kamera), & Pencarian */}
        <section className="space-y-2.5">
          <div className={CARD}>
            {/* Segmented Tab: Input Manual vs Scan Kamera Plat */}
            <div className="mb-3 flex rounded-xl border border-border bg-surface-sunken p-1">
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  inputMode === 'manual'
                    ? 'bg-surface-raised text-accent shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('camera');
                  setIsOcrModalOpen(true);
                }}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  inputMode === 'camera'
                    ? 'bg-surface-raised text-accent shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Scan className="h-3.5 w-3.5" />
                Scan Kamera Plat (Otomatis)
              </button>
            </div>

            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="checkin-plate" className="text-sm font-bold text-ink">
                Nomor Polisi <span className="text-status-red">*</span>
              </label>
              <span className="text-[10px] font-semibold text-ink-subtle">
                Klik ikon Cari untuk cek Booking / Member
              </span>
            </div>

            <div ref={suggestionsBoxRef} className="relative">
              <div className="relative flex items-center">
                <input
                  id="checkin-plate"
                  type="text"
                  required
                  autoComplete="off"
                  value={plateInput}
                  onChange={(e) => handlePlateInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executePlateSearch();
                    }
                  }}
                  autoFocus={canAutoFocus}
                  placeholder="Contoh: BK 1234 ABC"
                  className={`${FIELD_PLATE} pr-24`}
                />

                {/* Tombol Aksi di Sisi Kanan Input Form */}
                <div className="absolute right-2 flex items-center gap-1.5">
                  {plateInput && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePlateInputChange('');
                        selectedCandidateRef.current = null;
                        setSelectedCandidate(null);
                        setCandidates([]);
                        setHasSearched(false);
                      }}
                      title="Hapus nomor polisi"
                      aria-label="Hapus nomor polisi"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-subtle transition hover:bg-surface-sunken hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Tombol Cari Plat */}
                  <button
                    type="button"
                    onClick={() => executePlateSearch()}
                    disabled={isSearching}
                    title="Cek kecocokan nomor polisi di database"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-on shadow-xs transition hover:bg-accent-hover active:scale-95 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Cari</span>
                  </button>
                </div>
              </div>

              {/* Popover Hasil Pencarian / Suggestions */}
              {showSuggestions && candidates.length > 0 && (
                <div className="animate-popover-in absolute left-0 right-0 z-20 mt-2 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-2 shadow-pop">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-ink-muted">
                    <span>Hasil Pencarian ({candidates.length})</span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-ink-subtle hover:text-ink cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
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
                                item.source === 'BOOKING' ? CHIP_TONE.green : CHIP_TONE.blue
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
                              : 'Member Terdaftar'
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

            {/* Status Garis Klasifikasi Kedatangan */}
            {cleanPlate.length >= 3 && (
              <div className="mt-2.5 space-y-2">
                {isBookingConfirmed && selectedBooking && (
                  <StatusLine tone="green" icon={CheckCircle2}>
                    <strong className="font-semibold">Booking Terkonfirmasi</strong> •{' '}
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
                      ? 'Booking lewat H-1 dan belum dikonfirmasi admin. Hubungi admin bengkel.'
                      : 'Booking belum dikonfirmasi admin. Hubungi admin bengkel terlebih dahulu.'}
                  </StatusLine>
                )}
                {!selectedCandidate && hasActiveBookingForPlate && (
                  <StatusLine tone="amber" icon={AlertTriangle}>
                    Ada booking aktif untuk nopol ini — klik &quot;Cari&quot; dan pilih data booking di atas.
                  </StatusLine>
                )}
                {isWalkInWithUnit && selectedUnit && (
                  <StatusLine tone="blue" icon={Truck}>
                    <strong className="font-semibold">Armada Member Terdaftar</strong>{' '}
                    • {selectedUnit.nama_perusahaan || selectedUnit.nama_pengguna_fleet || 'Member'}
                    {memberVehicle ? ` • ${memberVehicle}` : ''}
                    {selectedUnit.status_aktif === false ? ' (unit nonaktif)' : ''}
                  </StatusLine>
                )}
                {isWalkInPure && hasSearched && !hasActiveBookingForPlate && (
                  <StatusLine tone="slate" icon={Truck}>
                    <strong className="font-semibold">Walk-In Umum</strong> • Kendaraan tidak memiliki reservasi booking dan belum terdaftar sebagai armada member.
                  </StatusLine>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Kartu 2: Data Kunjungan */}
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
                placeholder="Keperluan kunjungan / keluhan kendaraan"
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

        {/* Kartu 3: Foto Multi-Angle Kendaraan (Tanpa tombol Upload File) */}
        <section className={CARD}>
          <MultiCameraSection photos={photos} onChange={setPhotos} eventTitle="Kendaraan" />
        </section>

        {/* Aksi Utama */}
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

      {/* MODAL OCR SCANNER KAMERA OTOMATIS */}
      <PlateOcrScannerModal
        isOpen={isOcrModalOpen}
        onClose={() => {
          setIsOcrModalOpen(false);
          setInputMode('manual');
        }}
        onDetected={handleOcrPlateDetected}
      />

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
      {/* Modal Pop-up Sukses Check In Ringkas */}
      {successTicket &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 text-center shadow-2xl animate-scale-in">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-status-green/15 rounded-full blur-2xl pointer-events-none" />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-green-bg text-status-green shadow-sm ring-4 ring-status-green/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-ink">Check In Berhasil!</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Armada telah resmi tercatat masuk di pos gerbang.
              </p>
              <div className="my-4 rounded-2xl border border-border bg-surface-sunken p-3 text-center shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  Nomor Polisi
                </p>
                <p className="font-mono text-2xl font-black tracking-widest text-ink">
                  {formatPlate(successTicket.no_polisi)}
                </p>
              </div>
              <dl className="mb-5 space-y-2 rounded-xl border border-border/80 bg-surface-base p-3 text-left text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Pengemudi</dt>
                  <dd className="font-semibold text-ink truncate max-w-[55%]">{successTicket.nama_driver || '-'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Jam Masuk</dt>
                  <dd className="font-mono font-bold text-status-green">{successTicket.waktu_masuk}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Keperluan</dt>
                  <dd className="font-semibold text-accent truncate max-w-[55%]">{successTicket.tujuan}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-on shadow-lg shadow-accent/25 hover:bg-accent-hover active:scale-[0.98] transition cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Check In Berikutnya
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
