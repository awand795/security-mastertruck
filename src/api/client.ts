import axios from 'axios';
import { BookingConfirmedItem, ActiveInsideVehicle, MemoKeluarItem, MsFoto } from '../types';

const API_BASE = '/api';
const API_KEY = 'KIM3-SECURE-TOKEN-2026-X998A7B6C';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
  },
});

export const securityApi = {
  // 1. Get confirmed bookings (matching search query or all today)
  searchConfirmedBookings: async (query?: string): Promise<BookingConfirmedItem[]> => {
    const res = await apiClient.get('/kim3/security/booking-confirmed', {
      params: { q: query || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 2. Check in vehicle (insert into sch_pos.kunjungan_masuk)
  postCheckIn: async (payload: {
    nomor_tiket: string;
    booking_id?: number | null;
    jenis_kedatangan: 'BOOKING' | 'WALK_IN';
    no_polisi: string;
    nama_pengemudi: string;
    no_telepon_pengemudi: string;
    tipe_kunjungan: string;
    keluhan: string;
    petugas_security_masuk: string;
    catatan_masuk?: string;
  }) => {
    const res = await apiClient.post('/kim3/security/check-in', payload);
    return res.data;
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
  getActiveInside: async (query?: string): Promise<ActiveInsideVehicle[]> => {
    const res = await apiClient.get('/kim3/security/active-inside', {
      params: { q: query || '' }
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // 5. Check out vehicle (set waktu_check_out = NOW())
  postCheckOut: async (payload: {
    id: number;
    petugas_security_keluar: string;
    catatan_keluar?: string;
  }) => {
    const res = await apiClient.post('/kim3/security/check-out', payload);
    return res.data;
  },

  // 6. Get memo keluar (checkout history)
  getMemoKeluar: async (query?: string): Promise<MemoKeluarItem[]> => {
    const res = await apiClient.get('/kim3/security/memo-keluar', {
      params: { q: query || '' }
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
    const baseUrl = (customBaseUrl || import.meta.env.VITE_DARKOPOS_BASE_URL || '').replace(/\/+$/, '');

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
};

