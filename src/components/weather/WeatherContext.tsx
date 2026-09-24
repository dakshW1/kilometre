'use client';

import { createContext, useContext } from 'react';
import type { WeatherReport } from '@/lib/weather';

export const WeatherContext = createContext<WeatherReport | null>(null);
export const useWeatherReport = () => useContext(WeatherContext);
