import AsyncStorage from '@react-native-async-storage/async-storage';
import { sky, Sky } from '../dashboard/sky';
import { HOME } from '../home';

export { sky } from '../dashboard/sky';
export type { Sky } from '../dashboard/sky';

// El tiempo en casa (home.ts), de Open-Meteo: gratis y sin clave.
const PLACE = HOME;
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
  '&current=temperature_2m,weather_code,is_day' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  `&timezone=${encodeURIComponent(HOME.timeZone)}&forecast_days=8`;
const CACHE = 'marsianapp-weather';
// el widget se actualiza cada media hora como mucho; el tiempo no cambia más rápido
const FRESH_MS = 25 * 60 * 1000;

export type Day = { date: string; sky: Sky; max: number; min: number; rain: number };
export type Weather = { place: string; at: number; now: { temp: number; sky: Sky; word: string }; today: Day; week: Day[] };

/** El tiempo guardado si es reciente; si no, lo pide (y si no hay red, el último que hubo). */
export async function getWeather(force = false): Promise<Weather | null> {
  let cached: Weather | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    cached = raw ? (JSON.parse(raw) as Weather) : null;
  } catch {}
  if (cached && !force && Date.now() - cached.at < FRESH_MS) return cached;
  try {
    const r = await fetch(URL);
    const j = await r.json();
    const d = j.daily;
    const days: Day[] = d.time.map((date: string, i: number) => ({
      date,
      sky: sky(d.weather_code[i]).sky,
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rain: d.precipitation_probability_max[i] ?? 0,
    }));
    const now = sky(j.current.weather_code, j.current.is_day === 1);
    const w: Weather = { place: PLACE.name, at: Date.now(), now: { temp: Math.round(j.current.temperature_2m), ...now }, today: days[0], week: days.slice(1, 8) };
    await AsyncStorage.setItem(CACHE, JSON.stringify(w)).catch(() => {});
    return w;
  } catch {
    return cached;
  }
}
