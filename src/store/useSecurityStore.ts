import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SecurityUser, DarkoPosProfile } from '../types';
import { securityApi } from '../api/client';

interface SecurityStore {
  user: SecurityUser | null;
  idToken: string | null;
  profile: DarkoPosProfile | null;
  isAuthenticated: boolean;
  kodeCabang: string;
  namaCabang: string;
  loginAt: number | null;
  login: (user: SecurityUser, token?: string, profile?: DarkoPosProfile) => void;
  logout: () => void;
  setBranch: (kodeCabang: string, namaCabang: string) => void;
  refreshBranch: () => Promise<void>;
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set, get) => ({
      user: null,
      idToken: null,
      profile: null,
      isAuthenticated: false,
      kodeCabang: '',
      namaCabang: '',
      loginAt: null,
      login: (user, token, profile) => {
        // Ambil data cabang real dari user / profile DarkoPOS
        const resolvedStoreCode =
          user.kode_cabang ||
          profile?.store_code ||
          (profile?.store ? String(profile.store) : '') ||
          '';
        const resolvedStoreName =
          user.nama_cabang ||
          profile?.store_name ||
          profile?.usercompany ||
          user.company ||
          'BENGKEL MASTER TRUK';

        set({
          user: {
            ...user,
            kode_cabang: resolvedStoreCode,
            nama_cabang: resolvedStoreName,
          },
          idToken: token || user.id_token || null,
          profile: profile || user.profile || null,
          isAuthenticated: true,
          kodeCabang: resolvedStoreCode,
          namaCabang: resolvedStoreName,
          loginAt: Date.now(),
        });

        // Sinkronkan data cabang pengguna dari backend bila tersedia
        get().refreshBranch();
      },
      refreshBranch: async () => {
        const { user } = get();
        const uid = user?.userid || user?.id;
        if (!uid) return;
        try {
          const storeInfo = await securityApi.getUserStore(uid);
          if (storeInfo && (storeInfo.kode_cabang || storeInfo.nama_cabang)) {
            set((state) => ({
              kodeCabang: storeInfo.kode_cabang || state.kodeCabang,
              namaCabang: storeInfo.nama_cabang || state.namaCabang,
              user: state.user
                ? {
                    ...state.user,
                    kode_cabang: storeInfo.kode_cabang || state.user.kode_cabang,
                    nama_cabang: storeInfo.nama_cabang || state.user.nama_cabang,
                    store_id: storeInfo.store_id || state.user.store_id,
                  }
                : null,
            }));
          }
        } catch (err) {
          console.warn('Gagal memuat cabang pengguna:', err);
        }
      },
      setBranch: (kodeCabang: string, namaCabang: string) => {
        set((state) => ({
          kodeCabang,
          namaCabang,
          user: state.user
            ? { ...state.user, kode_cabang: kodeCabang, nama_cabang: namaCabang }
            : null,
        }));
      },
      logout: () => {
        const { idToken, profile } = get();
        if (idToken) {
          securityApi.logoutDarkoPos(idToken, profile?.sessionid);
        }
        set({
          user: null,
          idToken: null,
          profile: null,
          isAuthenticated: false,
          kodeCabang: '',
          namaCabang: '',
          loginAt: null,
        });
      },
    }),
    {
      name: 'bengkel-kim3-security-auth',
      merge: (persistedState: any, currentState) => {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const loginAt = persistedState?.loginAt || 0;
        const isExpired = !loginAt || (Date.now() - loginAt > ONE_DAY_MS);

        if (isExpired && persistedState?.isAuthenticated) {
          // Token expired setelah 1 hari -> wajib login ulang
          return {
            ...currentState,
            user: null,
            idToken: null,
            profile: null,
            isAuthenticated: false,
            loginAt: null,
          };
        }

        return {
          ...currentState,
          ...persistedState,
          kodeCabang: persistedState?.kodeCabang || currentState.kodeCabang || '',
          namaCabang: persistedState?.namaCabang || currentState.namaCabang || '',
        };
      },
    }
  )
);
