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
  nomor_booking: string;
  nomor_polisi: string;
  tanggal_booking: string;
  jam_booking: string;
  nama_driver: string;
  no_telepon_driver: string;
  status_booking: string;
  catatan?: string;
  armada_nama?: string;
  customer_name?: string;
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
