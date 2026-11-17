import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Data } from '../types';
import type { HomeWidgetProps } from './HomeWidget';
import { tripsFor } from '../places';
import { getWeather } from './weather';

// Lo que necesita el widget, leído sin abrir la app: los modos guardados, el puente de casa y el tiempo.
export const WIDGET = 'Casa';
const PORT = 8787;

async function saved(): Promise<Partial<Data>> {
  try {
    return JSON.parse((await AsyncStorage.getItem('marsianapp-v1')) ?? '{}');
  } catch {
    return {};
  }
}

async function hubFetch(hub: string, path: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`http://${hub}:${PORT}${path}`, { ...init, signal: ctrl.signal });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function widgetData(width: number, opts: { forceWeather?: boolean; active?: string[] } = {}): Promise<HomeWidgetProps> {
  const d = await saved();
  const modes = (d.scenes ?? []).map((s) => ({ id: s.id, name: s.name, icon: s.icon }));
  const [weather, fromHub, places] = await Promise.all([
    getWeather(opts.forceWeather),
    d.hub && !opts.active ? hubFetch(d.hub, '/modes') : Promise.resolve(null),
    tripsFor((d.places ?? []).slice(0, 4), d.hub ? `http://${d.hub}:${PORT}` : undefined).then((t) => (d.places ?? []).slice(0, 4).map((place) => ({ place, trip: t[place.id] ?? null }))),
  ]);
  return { weather, modes, places, active: opts.active ?? fromHub?.active ?? [], hub: !!(d.hub && (fromHub || opts.active)), width };
}

/** Pone o quita un modo a través del puente de casa, sin abrir la app. */
export async function toggleModeOnHub(id: string): Promise<boolean> {
  const d = await saved();
  return !!(d.hub && (await hubFetch(d.hub, `/mode/${encodeURIComponent(id)}`, { method: 'POST' })));
}
