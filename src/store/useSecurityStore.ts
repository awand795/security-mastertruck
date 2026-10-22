import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SecurityUser } from '../types';

interface SecurityStore {
  user: SecurityUser | null;
  isAuthenticated: boolean;
  login: (user: SecurityUser) => void;
  logout: () => void;
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'bengkel-kim3-security-auth',
    }
  )
);
