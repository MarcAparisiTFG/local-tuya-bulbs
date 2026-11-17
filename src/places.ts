import { HOME } from './home';
import type { Place } from './types';

// Sitios a los que vais a menudo y cuánto se tarda en coche desde casa. Buscar, con Photon (OpenStreetMap).
// El tiempo lo da el puente de casa, con el tráfico de ahora (TomTom); sin puente, la ruta sin tráfico (OSRM).

/** Casa: se configura en home.ts. */
export { HOME };

export type Found = { name: string; detail: string; lat: number; lon: number };

export async function searchPlaces(q: string): Promise<Found[]> {
  if (q.trim().length < 3) return [];
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q.trim())}&lat=${HOME.lat}&lon=${HOME.lon}&limit=6&lang=default`);
  const j = await r.json();
  return (j.features ?? []).map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => {
    const p = f.properties;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    return {
      name: p.name ?? street ?? p.city ?? q,
      detail: [p.name ? street : '', p.city ?? p.locality ?? p.county].filter(Boolean).join(' · '),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    };
  });
}

/** `delay`: minutos de más por atascos; `traffic`: si el tiempo cuenta el tráfico de ahora */
export type Trip = { minutes: number; km: number; delay?: number; traffic?: boolean; /** cuándo se miró (ms) */ at?: number };

const trips = new Map<string, { at: number; trip: Trip }>();

/** Minutos y kilómetros en coche desde casa; se guarda unos minutos para no preguntar de más. */
export async function tripTo(p: Place): Promise<Trip | null> {
  const key = `${p.lat},${p.lon}`;
  const hit = trips.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.trip;
  try {
    const r = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${HOME.lon},${HOME.lat};${p.lon},${p.lat}?overview=false`);
    const route = (await r.json()).routes?.[0];
    if (!route) return null;
    const trip = { minutes: Math.max(1, Math.round(route.duration / 60)), km: Math.round(route.distance / 100) / 10 };
    trips.set(key, { at: Date.now(), trip });
    return trip;
  } catch {
    return hit?.trip ?? null;
  }
}

export type Shape = [number, number][];
export type TripsView = { trips: Record<string, Trip | null>; shapes: Record<string, Shape>; mapKey?: string | null };

/** Tiempos y rutas de todos los sitios: del puente de casa si lo hay (con tráfico), si no directamente sin tráfico. */
export async function loadTrips(places: Place[], hubUrl?: string, fresh = false): Promise<TripsView> {
  if (hubUrl) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(`${hubUrl}/trips${fresh ? '?fresh=1' : ''}`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (r.ok) {
        const j = await r.json();
        return { trips: j.trips ?? {}, shapes: j.shapes ?? {}, mapKey: j.mapKey };
      }
    } catch {}
  }
  const trips: Record<string, Trip | null> = {};
  const shapes: Record<string, Shape> = {};
  await Promise.all(
    places.map(async (p) => {
      trips[p.id] = await tripTo(p);
      const s = await shapeTo(p);
      if (s) shapes[p.id] = s;
    }),
  );
  return { trips, shapes };
}

export const tripsFor = async (places: Place[], hubUrl?: string, fresh = false) => (await loadTrips(places, hubUrl, fresh)).trips;

const shapeCache = new Map<string, Shape>();

/** La forma de la ruta, para dibujarla en el mapa (sin puente: directamente de OSRM). */
async function shapeTo(p: Place): Promise<Shape | null> {
  const key = `${p.lat},${p.lon}`;
  if (shapeCache.has(key)) return shapeCache.get(key)!;
  try {
    const r = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${HOME.lon},${HOME.lat};${p.lon},${p.lat}?overview=full&geometries=geojson`);
    const coords: [number, number][] | undefined = (await r.json()).routes?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const shape = coords.map(([lon, lat]) => [lat, lon] as [number, number]);
    shapeCache.set(key, shape);
    return shape;
  } catch {
    return null;
  }
}

/** Abre Google Maps con la ruta en coche hasta el sitio (con el tráfico de ese momento). */
export const mapsUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`;

export const tripText = (t: Trip) => (t.minutes < 60 ? `${t.minutes} min` : `${Math.floor(t.minutes / 60)} h ${String(t.minutes % 60).padStart(2, '0')}`);
