// Los datos del inicio, de fuentes gratis y sin clave. Sólo fetch: lo usan el puente de casa (que los guarda un rato
// para no preguntar de más) y la app cuando no hay puente.
import { HOME } from '../home';
import { sky, Sky } from './sky';

const LAT = HOME.lat;
const LON = HOME.lon;
const TZ = encodeURIComponent(HOME.timeZone);

export type Day = { date: string; sky: Sky; max: number; min: number; rain: number };
export type Weather = { temp: number; sky: Sky; word: string; max: number; min: number; rain: number; uv: number; wind: number; gusts: number; windDir: number; sunrise: string; sunset: string; week: Day[] };
export type Sea = { water: number | null; waves: number | null; period: number | null };
export type Alert = { level: 'yellow' | 'orange' | 'red'; event: string; area: string; from: string; to: string };
export type Fuel = { kind: string; price: number; brand: string; place: string };
export type Power = { now: number | null; hours: { h: number; price: number }[]; cheapest: { h: number; price: number } | null };

const hhmm = (iso: string) => iso.slice(11, 16);

export async function fetchWeather(): Promise<Weather> {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=${TZ}&forecast_days=8` +
      '&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
  );
  const j = await r.json();
  const d = j.daily;
  const week: Day[] = d.time.map((date: string, i: number) => ({
    date,
    sky: sky(d.weather_code[i]).sky,
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i]),
    rain: d.precipitation_probability_max[i] ?? 0,
  }));
  const now = sky(j.current.weather_code, j.current.is_day === 1);
  return {
    temp: Math.round(j.current.temperature_2m),
    ...now,
    max: week[0].max,
    min: week[0].min,
    rain: week[0].rain,
    uv: Math.round(d.uv_index_max[0] ?? 0),
    wind: Math.round(j.current.wind_speed_10m),
    gusts: Math.round(j.current.wind_gusts_10m),
    windDir: Math.round(j.current.wind_direction_10m),
    sunrise: hhmm(d.sunrise[0]),
    sunset: hhmm(d.sunset[0]),
    week: week.slice(1, 8),
  };
}

/** El mar frente a casa (HOME.sea). */
export async function fetchSea(): Promise<Sea> {
  if (!HOME.sea) return { water: null, waves: null, period: null };
  const r = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${HOME.sea.lat}&longitude=${HOME.sea.lon}&current=wave_height,wave_period,sea_surface_temperature&timezone=${TZ}`);
  const c = (await r.json()).current ?? {};
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return { water: n(c.sea_surface_temperature), waves: n(c.wave_height), period: n(c.wave_period) };
}

/** Avisos de Meteoalarm que tocan tu zona (HOME.alerts) y siguen vigentes. */
export async function fetchAlerts(): Promise<Alert[]> {
  const r = await fetch(`https://feeds.meteoalarm.org/api/v1/warnings/${HOME.alerts.feed}`);
  const j = await r.json();
  const out: Alert[] = [];
  for (const w of j.warnings ?? []) {
    const info = (w.alert?.info ?? []).find((i: { language?: string }) => i.language?.startsWith('es')) ?? w.alert?.info?.[0];
    if (!info) continue;
    const area = (info.area ?? []).map((a: { areaDesc: string }) => a.areaDesc).find((a: string) => HOME.alerts.area.test(a));
    if (!area || (info.expires && new Date(info.expires) < new Date())) continue;
    const lvl = String((info.parameter ?? []).find((p: { valueName: string }) => p.valueName === 'awareness_level')?.value ?? '');
    // «nivel verde» es que no hay aviso; y sólo lo de hoy y mañana
    if (/green|^1;/i.test(lvl) || (info.onset && new Date(info.onset).getTime() - Date.now() > 36 * 3_600_000)) continue;
    const level = /red|4;/i.test(lvl) ? 'red' : /orange|3;/i.test(lvl) ? 'orange' : 'yellow';
    const event = String(info.event ?? 'Aviso').replace(/^Aviso de /i, '').replace(/ de nivel \w+$/i, '');
    if (!out.some((o) => o.event === event && o.level === level)) out.push({ level, event, area, from: info.onset ?? '', to: info.expires ?? '' });
  }
  return out;
}

/** La gasolinera más barata de tu municipio para gasolina 95 y para diésel (Ministerio, sólo España; cada media hora). */
export async function fetchFuel(): Promise<Fuel[]> {
  if (!HOME.fuelTown) return [];
  const r = await fetch(`https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroMunicipio/${HOME.fuelTown.id}`);
  const list: Record<string, string>[] = (await r.json()).ListaEESSPrecio ?? [];
  const price = (s: string | undefined) => (s ? parseFloat(s.replace(',', '.')) : NaN);
  const best = (field: string, kind: string): Fuel | null => {
    const ok = list.filter((s) => price(s[field]) > 0).sort((a, b) => price(a[field]) - price(b[field]));
    const s = ok[0];
    return s ? { kind, price: price(s[field]), brand: s['Rótulo'], place: s['Localidad'].toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') } : null;
  };
  return [best('Precio Gasolina 95 E5', 'Gasolina 95'), best('Precio Gasoleo A', 'Diésel')].filter(Boolean) as Fuel[];
}

/** El precio de la luz (PVPC) de hoy hora a hora, en €/kWh, de Red Eléctrica. */
export async function fetchPower(): Promise<Power> {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: HOME.timeZone });
  const r = await fetch(`https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${day}T00:00&end_date=${day}T23:59&time_trunc=hour`);
  const j = await r.json();
  const pvpc = (j.included ?? []).find((x: { type: string }) => x.type === 'PVPC');
  const hours = (pvpc?.attributes?.values ?? []).map((v: { value: number; datetime: string }) => ({ h: Number(v.datetime.slice(11, 13)), price: Math.round(v.value) / 1000 }));
  const nowH = Number(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', hour12: false, timeZone: HOME.timeZone }));
  const rest = hours.filter((x: { h: number }) => x.h >= nowH);
  const cheapest = rest.length ? rest.reduce((a: { price: number }, b: { price: number }) => (b.price < a.price ? b : a)) : null;
  return { now: hours.find((x: { h: number }) => x.h === nowH)?.price ?? null, hours, cheapest };
}
