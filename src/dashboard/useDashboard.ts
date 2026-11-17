import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../state';
import { getBridgeUrl, getMode } from '../tuya/mode';
import { Alert, fetchAlerts, fetchFuel, fetchPower, fetchSea, fetchWeather, Fuel, Power, Sea, Weather } from './sources';

export type Dashboard = {
  weather: Weather | null;
  sea: Sea | null;
  alerts: Alert[];
  fuel: Fuel[];
  power: Power | null;
  /** lo que gastan las luces: sólo lo sabe el puente */
  energy: { watts: number; kwh: number; euros: number } | null;
};

const EMPTY: Dashboard = { weather: null, sea: null, alerts: [], fuel: [], power: null, energy: null };
const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

/** El resumen del inicio: del puente de casa si está (lo guarda y sabe el consumo), si no directamente. */
export function useDashboard(): Dashboard & { reload: () => Promise<void> } {
  const { data } = useApp();
  const [d, setD] = useState<Dashboard>(EMPTY);
  const hub = getMode() === 'bridge' ? getBridgeUrl() : data.hub ? `http://${data.hub}:8787` : undefined;

  const load = useCallback(async () => {
    if (hub) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(`${hub}/dashboard`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
        if (r.ok) return setD({ ...EMPTY, ...(await r.json()) });
      } catch {}
    }
    const [weather, sea, alerts, fuel, power] = await Promise.all([
      safe(fetchWeather(), null),
      safe(fetchSea(), null),
      safe(fetchAlerts(), []),
      safe(fetchFuel(), []),
      safe(fetchPower(), null),
    ]);
    setD({ weather, sea, alerts, fuel, power, energy: null });
  }, [hub]);

  useFocusEffect(useCallback(() => void load(), [load]));
  // la tablet de la pared se queda en el inicio: se pone al día sola cada cinco minutos (el puente decide qué pide)
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);
  return { ...d, reload: load };
}
