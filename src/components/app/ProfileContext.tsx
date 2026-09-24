'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Profile } from '@/lib/profile';

type Ctx = { profile: Profile; email: string; dbReady: boolean };
const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside the app layout');
  return ctx;
}
