import type { Platform } from './geo';

export interface Profile {
  id: string;
  name: string;
  language: 'en' | 'hi' | 'kn';
  platforms: Platform[];
  vehicle: 'petrol' | 'ev' | 'ecycle';
  fuel_cost_per_km: number;
  monthly_emi: number;
  monthly_phone_data: number;
  daily_target: number;
  home_zone: string | null;
  onboarded: boolean;
}

export const defaultProfile = (id: string, name = ''): Profile => ({
  id,
  name,
  language: 'en',
  platforms: ['swiggy', 'zepto', 'rapido'],
  vehicle: 'petrol',
  fuel_cost_per_km: 2.5,
  monthly_emi: 3200,
  monthly_phone_data: 400,
  daily_target: 1500,
  home_zone: 'btm',
  onboarded: false,
});
