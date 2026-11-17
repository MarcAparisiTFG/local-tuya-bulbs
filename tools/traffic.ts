// El tráfico alrededor de casa, de TomTom: cuánto se tarda ahora a cada sitio (con atascos) y un mapa con las carreteras
// en verde, naranja o rojo. La clave se queda en el puente (../tomtom.json); sin ella, la ruta sin tráfico (OSRM).
import { readFileSync, writeFileSync } from 'node:fs';
import { mapHtml, ROUTE_COLORS } from '../src/mapPage';
import { HOME } from '../src/home';
import type { Place } from '../src/types';

// Lo gratis de TomTom son 2.500 peticiones al día: el tiempo se guarda media hora, y diez minutos en las horas
// punta (HOME.peakHours, laborables). Más a menudo, sólo si alguien lo pide.
const OFF_PEAK_MS = 30 * 60 * 1000;
const PEAK_MS = 10 * 60 * 1000;
// pedirlo a mano: como mucho una vez por minuto, aunque se pulse más
const MANUAL_MIN_MS = 60 * 1000;

function peak(now = new Date()): boolean {
  const t = new Date(now.toLocaleString('en-US', { timeZone: HOME.timeZone }));
  const day = t.getDay();
  const h = t.getHours() + t.getMinutes() / 60;
  return day >= 1 && day <= 5 && HOME.peakHours.some(([a, b]) => h >= a && h < b);
}

// cuántas peticiones a TomTom van hoy, para no pasarse del límite gratis
const usage = { day: '', routes: 0 };
function count() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) Object.assign(usage, { day: today, routes: 0 });
  usage.routes++;
}
export const usedToday = () => (usage.day === new Date().toISOString().slice(0, 10) ? usage.routes : 0);
let lastManual = 0;

/** `at`: cuándo se miró (ms) */
export type TripNow = { minutes: number; km: number; delay: number; traffic: boolean; at?: number };

const key = (): string | null => {
  try {
    return JSON.parse(readFileSync(new URL('../tomtom.json', import.meta.url), 'utf8')).key || null;
  } catch {
    return null;
  }
};
export const hasTraffic = () => !!key();

const cache = new Map<string, { at: number; trip: TripNow }>();

async function route(p: Place): Promise<TripNow | null> {
  const k = key();
  if (k && usedToday() < 2300) {
    count();
    const r = await fetch(
      `https://api.tomtom.com/routing/1/calculateRoute/${HOME.lat},${HOME.lon}:${p.lat},${p.lon}/json?key=${k}&traffic=true&travelMode=car&routeType=fastest`,
    );
    if (r.ok) {
      const s = (await r.json()).routes?.[0]?.summary;
      if (s) return { minutes: Math.max(1, Math.round(s.travelTimeInSeconds / 60)), km: Math.round(s.lengthInMeters / 100) / 10, delay: Math.round((s.trafficDelayInSeconds ?? 0) / 60), traffic: true };
    }
  }
  const r = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${HOME.lon},${HOME.lat};${p.lon},${p.lat}?overview=false`);
  const route = (await r.json()).routes?.[0];
  return route ? { minutes: Math.max(1, Math.round(route.duration / 60)), km: Math.round(route.distance / 100) / 10, delay: 0, traffic: false } : null;
}

/** Lo de ahora para cada sitio; si una consulta falla, lo último que se supo. `fresh`: alguien ha pulsado actualizar. */
export async function tripsNow(places: Place[], fresh = false): Promise<Record<string, TripNow | null>> {
  const out: Record<string, TripNow | null> = {};
  const manual = fresh && Date.now() - lastManual > MANUAL_MIN_MS;
  if (manual) lastManual = Date.now();
  const maxAge = manual ? 0 : peak() ? PEAK_MS : OFF_PEAK_MS;
  await Promise.all(
    places.map(async (p) => {
      const id = `${p.lat},${p.lon}`;
      const hit = cache.get(id);
      if (hit && Date.now() - hit.at < maxAge) return void (out[p.id] = { ...hit.trip, at: hit.at });
      try {
        const trip = await route(p);
        if (trip) cache.set(id, { at: Date.now(), trip });
        out[p.id] = trip ? { ...trip, at: Date.now() } : hit ? { ...hit.trip, at: hit.at } : null;
      } catch {
        out[p.id] = hit?.trip ?? null;
      }
    }),
  );
  return out;
}

/** La forma de cada ruta (no cambia con el tráfico): se pide una vez a OSRM y se guarda para siempre. */
const SHAPES = new URL('../routes.json', import.meta.url);
let shapes: Record<string, [number, number][]> = {};
try {
  shapes = JSON.parse(readFileSync(SHAPES, 'utf8'));
} catch {}

export async function shapesFor(places: Place[]): Promise<Record<string, [number, number][]>> {
  const out: Record<string, [number, number][]> = {};
  let changed = false;
  await Promise.all(
    places.map(async (p) => {
      const id = `${p.lat},${p.lon}`;
      if (!shapes[id]) {
        try {
          const r = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${HOME.lon},${HOME.lat};${p.lon},${p.lat}?overview=full&geometries=geojson`);
          const coords: [number, number][] | undefined = (await r.json()).routes?.[0]?.geometry?.coordinates;
          if (coords) {
            shapes[id] = coords.map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]);
            changed = true;
          }
        } catch {}
      }
      if (shapes[id]) out[p.id] = shapes[id];
    }),
  );
  if (changed) writeFileSync(SHAPES, JSON.stringify(shapes));
  return out;
}

/** La clave también hace falta en el mapa (las teselas se piden desde la tablet o el móvil, en casa). */
export const mapKey = () => key();

/** El mapa en una página suelta, para abrirlo en el navegador: http://<puente>:8787/traffic */
export async function trafficPage(places: Place[]): Promise<string> {
  const [trips, sh] = await Promise.all([tripsNow(places), shapesFor(places)]);
  return mapHtml({
    home: HOME,
    tomtomKey: key(),
    routes: places.map((p, i) => ({
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      shape: sh[p.id],
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      label: trips[p.id] ? `${trips[p.id]!.minutes} min` : '—',
    })),
  });
}
