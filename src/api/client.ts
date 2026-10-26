import axios from 'axios';
import {
  BookingConfirmedItem,
  CheckinCandidate,
  CheckinResponse,
  ActiveInsideVehicle,
  EmployeeItem,
  MemoKeluarItem,
  MsFoto,
  UserStoreInfo,
} from '../types';

const API_BASE = '/api/data';
const API_KEY = 'KIM3-SECURE-TOKEN-2026-X998A7B6C';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  },
});

export const securityApi = {
  // 1. Get bookings (all statuses for checking confirmation)
  searchConfirmedBookings: async (query?: string): Promise<BookingConfirmedItem[]> => {
    const res = await apiClient.get('/kim3/security/booking-confirmed', {
      params: { q: query || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 1a. Unified live-search candidates (active bookings + registered member units)
  searchCheckinCandidates: async (query?: string): Promise<CheckinCandidate[]> => {
    const res = await apiClient.get('/kim3/security/checkin-candidates', {
      params: { q: query || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 1b. Lookup unit member from tbl_member_unit (/kim3/kendaraan-lookup)
  lookupUnitMember: async (nopol: string) => {
    try {
      const res = await apiClient.get('/kim3/kendaraan-lookup', {
        params: { nopol }
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  // 1c. Daftar karyawan aktif (sch_pos.tbl_employee) untuk dropdown PIC
  getEmployees: async (query?: string, kodeCabang?: string): Promise<EmployeeItem[]> => {
    const res = await apiClient.get('/kim3/security/employees', {
      params: { q: query || '', kode_cabang: kodeCabang || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 1d. Ambil informasi cabang pengguna (kode_cabang & nama_cabang)
  getUserStore: async (userId: string): Promise<UserStoreInfo | null> => {
    try {
      const res = await apiClient.get('/kim3/security/user-store', {
        params: { userid: userId }
      });
      const data = Array.isArray(res.data) ? res.data[0] : res.data;
      return data || null;
    } catch {
      return null;
    }
  },

  // 2. Check in vehicle (insert into sch_pos.kunjungan_masuk)
  postCheckIn: async (payload: {
    nomor_tiket?: string;
    booking_id?: number | null;
    jenis_kedatangan: 'BOOKING' | 'WALK_IN';
    no_polisi: string;
    nama_pengemudi: string;
    no_telepon_pengemudi: string;
    pic_tujuan?: string;
    kode_cabang?: string;
    tipe_kunjungan: string;
    keluhan: string;
    petugas_security: string;
    catatan_masuk?: string;
  }): Promise<CheckinResponse> => {
    const res = await apiClient.post('/kim3/security/check-in', payload);
    // API Builder membungkus result set POST dalam { data: ... }.
    const body = res.data;
    const unwrapped =
      body && typeof body === 'object' && !Array.isArray(body) && 'data' in body
        ? (body as { data: unknown }).data
        : body;
    const raw = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;
    return (raw || {
      success: false,
      message: 'Respons check-in tidak valid dari server.',
    }) as CheckinResponse;
  },

  // 3. Save photo to sch_pos.ms_foto
  postAddFoto: async (payload: {
    kunjungan_id: number;
    jenis_event: 'MASUK' | 'KELUAR';
    sudut_pandang: string;
    foto_data: string;
  }) => {
    const res = await apiClient.post('/kim3/security/add-foto', payload);
    return res.data;
  },

  // 4. Get active vehicles currently inside (waktu_check_out IS NULL)
  getActiveInside: async (query?: string, kodeCabang?: string): Promise<ActiveInsideVehicle[]> => {
    const res = await apiClient.get('/kim3/security/active-inside', {
      params: { q: query || '', kode_cabang: kodeCabang || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 5. Check out vehicle (set waktu_check_out = NOW() & terbitkan nomor_memo)
  postCheckOut: async (payload: {
    id: number;
    kunjungan_id?: number;
    petugas_security_keluar: string;
    catatan_keluar?: string;
  }): Promise<any> => {
    const res = await apiClient.post('/kim3/security/check-out', {
      kunjungan_id: payload.kunjungan_id ?? payload.id,
      id: payload.id,
      petugas_security: payload.petugas_security_keluar,
      petugas_security_keluar: payload.petugas_security_keluar,
      catatan_keluar: payload.catatan_keluar,
    });
    const body = res.data;
    const unwrapped =
      body && typeof body === 'object' && !Array.isArray(body) && 'data' in body
        ? (body as { data: unknown }).data
        : body;
    const raw = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;
    return raw;
  },

  // 6. Get memo keluar (checkout history)
  getMemoKeluar: async (query?: string, kodeCabang?: string): Promise<MemoKeluarItem[]> => {
    const res = await apiClient.get('/kim3/security/memo-keluar', {
      params: { q: query || '', kode_cabang: kodeCabang || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 7. Get photos for a visit
  getFotoKunjungan: async (kunjungan_id: number): Promise<MsFoto[]> => {
    const res = await apiClient.get('/kim3/security/foto-kunjungan', {
      params: { kunjungan_id }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 8. DarkoPOS Login (/api/v1/users/login)
  loginDarkoPos: async (payload: {
    userid: string;
    password: string;
    company?: string;
  }, customBaseUrl?: string) => {
    const apiKey = import.meta.env.VITE_DARKOPOS_API_KEY || 'TURNONTHEAPI98';
    const baseUrl = (customBaseUrl || import.meta.env.VITE_DARKOPOS_BASE_URL || 'https://staff-anyway-offering-epic.trycloudflare.com').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('BASE_URL_NOT_SET');
    }

    const response = await axios.post(
      `${baseUrl}/api/v1/users/login`,
      {
        userid: payload.userid,
        password: payload.password,
        company: payload.company || '',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        timeout: 10000,
      }
    );

    return response.data;
  },

  // 9. DarkoPOS Logout (/api/v1/users/logout)
  logoutDarkoPos: async (idToken?: string | null, sessionId?: string | null, customBaseUrl?: string) => {
    const baseUrl = (customBaseUrl || import.meta.env.VITE_DARKOPOS_BASE_URL || 'https://staff-anyway-offering-epic.trycloudflare.com').replace(/\/+$/, '');
    if (!baseUrl || !idToken) return;

    try {
      await axios.post(
        `${baseUrl}/api/v1/users/logout`,
        {
          sessionId: sessionId || '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `JWT ${idToken}`,
          },
          timeout: 6000,
        }
      );
    } catch (err) {
      console.warn('DarkoPOS API logout warning:', err);
    }
  },
};

