export interface KunjunganMasuk {
  id: number;
  nomor_tiket: string;
  booking_id?: number | null;
  jenis_kedatangan: 'BOOKING' | 'WALK_IN';
  no_polisi: string;
  nama_pengemudi: string;
  no_telepon_pengemudi: string;
  tipe_kunjungan: string;
  keluhan: string;
  waktu_masuk: string;
  waktu_check_out?: string | null;
  petugas_security_masuk: string;
  petugas_security_keluar?: string | null;
  catatan_masuk?: string | null;
  catatan_keluar?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MsFoto {
  id?: number;
  kunjungan_id: number;
  jenis_event: 'MASUK' | 'KELUAR';
  sudut_pandang: string; // 'Tampak Depan', 'Tampak Belakang', 'Tampak Samping Kanan', 'Tampak Samping Kiri', or custom
  foto_data: string; // base64 data url or path
  created_at?: string;
}

export interface BookingConfirmedItem {
  booking_id: number;
  nomor_booking?: string;
  no_booking?: string;
  nomor_polisi: string;
  no_polisi?: string;
  tanggal_booking: string;
  jam_booking: string;
  nama_driver?: string;
  no_telepon_driver?: string;
  status_booking: string;
  status?: string;
  is_confirmed?: boolean;
  can_checkin?: boolean;
  catatan?: string;
  keluhan?: string;
  jenis_layanan?: string;
  armada_nama?: string;
  customer_name?: string;
  customer_nama?: string;
  customer_telepon?: string;
}

export interface CheckinCandidate {
  source: 'BOOKING' | 'MEMBER_UNIT';
  booking_id?: number | null;
  no_booking?: string | null;
  no_polisi: string;
  no_polisi_clean: string;
  customer_name?: string | null;
  customer_telepon?: string | null;
  jenis_layanan?: string | null;
  keluhan?: string | null;
  catatan?: string | null;
  tanggal_booking?: string | null;
  jam_booking?: string | null;
  status_booking?: string | null;
  is_confirmed: boolean;
  can_checkin: boolean;
  is_within_window: boolean;
  is_stale_unconfirmed: boolean;
  unit_id?: number | null;
  member_id?: number | null;
  nama_perusahaan?: string | null;
  nama_pengguna_fleet?: string | null;
  nama_pic?: string | null;
  unit_telepon?: string | null;
  jenis_armada?: string | null;
  merk?: string | null;
  model?: string | null;
  tahun?: number | null;
  status_aktif?: boolean | null;
  has_active_booking: boolean;
}

export interface CheckinResponse {
  success: boolean;
  message: string;
  id?: number | null;
  insertId?: number | null;
  nomor_tiket?: string | null;
  booking_id?: number | null;
  jenis_kedatangan?: string | null;
  no_polisi?: string | null;
  nama_pengemudi?: string | null;
  waktu_masuk?: string | number | null;
}

export interface ActiveInsideVehicle {
  id: number;
  nomor_tiket: string;
  booking_id?: number | null;
  jenis_kedatangan: string;
  no_polisi: string;
  nama_pengemudi: string;
  no_telepon_pengemudi: string;
  tipe_kunjungan: string;
  keluhan: string;
  waktu_masuk: string;
  petugas_security_masuk: string;
  catatan_masuk?: string;
}

export interface MemoKeluarItem {
  id: number;
  nomor_tiket: string;
  no_polisi: string;
  nama_pengemudi: string;
  jenis_kedatangan: string;
  tipe_kunjungan: string;
  keluhan: string;
  waktu_masuk: string;
  waktu_check_out: string;
  petugas_security_masuk: string;
  petugas_security_keluar: string;
  catatan_keluar?: string;
}

export interface DarkoPosProfile {
  userid: string;
  username: string;
  usercompany?: string;
  userlogintime?: string;
  useripaddr2?: string;
  role?: string;
  resetpsw?: number;
  store?: number;
  permission?: string;
  istotp?: boolean;
  sessionid?: string;
}

export interface DarkoPosLoginResponse {
  reqId?: string;
  success: boolean;
  message: string;
  profile?: DarkoPosProfile;
  id_token?: string;
}

export interface SecurityUser {
  id: string;
  nama: string;
  role: string;
  email?: string;
  userid?: string;
  company?: string;
  id_token?: string;
  profile?: DarkoPosProfile;
}
