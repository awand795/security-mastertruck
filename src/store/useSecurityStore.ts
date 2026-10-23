import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SecurityUser, DarkoPosProfile } from '../types';
import { securityApi } from '../api/client';

interface SecurityStore {
  user: SecurityUser | null;
  idToken: string | null;
  profile: DarkoPosProfile | null;
  isAuthenticated: boolean;
  tunnelBaseUrl: string;
  login: (user: SecurityUser, token?: string, profile?: DarkoPosProfile) => void;
  logout: () => void;
  setTunnelBaseUrl: (url: string) => void;
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set, get) => ({
      user: null,
      idToken: null,
      profile: null,
      isAuthenticated: false,
      tunnelBaseUrl: localStorage.getItem('DARKOPOS_TUNNEL_URL') || import.meta.env.VITE_DARKOPOS_BASE_URL || 'https://staff-anyway-offering-epic.trycloudflare.com',
      login: (user, token, profile) =>
        set({
          user,
          idToken: token || user.id_token || null,
          profile: profile || user.profile || null,
          isAuthenticated: true,
        }),
      logout: () => {
        const { idToken, profile, tunnelBaseUrl } = get();
        if (idToken) {
          securityApi.logoutDarkoPos(idToken, profile?.sessionid, tunnelBaseUrl);
        }
        set({
          user: null,
          idToken: null,
          profile: null,
          isAuthenticated: false,
        });
      },
      setTunnelBaseUrl: (url: string) => {
        localStorage.setItem('DARKOPOS_TUNNEL_URL', url.trim());
        set({ tunnelBaseUrl: url.trim() });
      },
    }),
    {
      name: 'bengkel-kim3-security-auth',
    }
  )
);
