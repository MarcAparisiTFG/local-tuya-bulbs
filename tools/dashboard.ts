// El resumen del inicio (tiempo, sol, mar, avisos, gasolina, luz) guardado en el puente: así la tablet y los móviles
// no preguntan cada uno por su cuenta. Y lo que gastan las luces de casa, que sólo sabe el puente.
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAlerts, fetchFuel, fetchPower, fetchSea, fetchWeather } from '../src/dashboard/sources';
import type { House } from './house';

/** Cada dato, como mucho tan a menudo como cambia de verdad. */
function cached<T>(ms: number, load: () => Promise<T>) {
  let value: T | null = null;
  let at = 0;
  let pending: Promise<void> | null = null;
  return async (): Promise<T | null> => {
    if (Date.now() - at > ms && !pending) {
      pending = load()
        .then((v) => {
          value = v;
          at = Date.now();
        })
        .catch((e) => console.log(`Inicio: ${(e as Error).message}`))
        .finally(() => (pending = null));
      // la primera vez se espera; luego se contesta con lo guardado mientras se renueva
      if (!value) await pending;
    }
    return value;
  };
}

const MIN = 60 * 1000;
const weather = cached(20 * MIN, fetchWeather);
const sea = cached(60 * MIN, fetchSea);
const alerts = cached(20 * MIN, fetchAlerts);
const fuel = cached(3 * 60 * MIN, fetchFuel);
const power = cached(30 * MIN, fetchPower);

// Una bombilla Muvit de 806 lm gasta unos 9 W a tope; encendida al mínimo, poco más de 1 W
const watts = (on: boolean, brightness: number) => (on ? 1 + 8 * (brightness / 100) : 0.3);

const ENERGY = new URL('../energy.json', import.meta.url);
type Energy = { day: string; kwh: number; euros: number };

export function startEnergy(house: House) {
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  let e: Energy = { day: today(), kwh: 0, euros: 0 };
  try {
    const saved = JSON.parse(readFileSync(ENERGY, 'utf8')) as Energy;
    if (saved.day === today()) e = saved;
  } catch {}
  let last = Date.now();
  // las luces, calculadas; los enchufes, lo que ellos mismos miden
  const nowWatts = () =>
    house.bulbs.reduce((sum, b) => {
      const s = house.get(b.id);
      return sum + (s.known ? watts(s.look.on, s.look.brightness) : 0);
    }, 0) + house.plugWatts();
  // cada minuto, lo que han gastado las luces desde la última vez, al precio de la luz de esa hora
  const tick = async () => {
    const now = Date.now();
    const hours = (now - last) / 3_600_000;
    last = now;
    if (e.day !== today()) e = { day: today(), kwh: 0, euros: 0 };
    const w = nowWatts();
    const kwh = (w * hours) / 1000;
    const price = (await power())?.now ?? 0.15;
    e.kwh += kwh;
    e.euros += kwh * price;
    writeFileSync(ENERGY, JSON.stringify(e));
  };
  setInterval(tick, MIN);
  return {
    now: nowWatts,
    today: () => e,
  };
}

export async function dashboard(energy: ReturnType<typeof startEnergy>) {
  const [w, s, a, f, p] = await Promise.all([weather(), sea(), alerts(), fuel(), power()]);
  const t = energy.today();
  return {
    weather: w,
    sea: s,
    alerts: a ?? [],
    fuel: f ?? [],
    power: p,
    energy: { watts: Math.round(energy.now() * 10) / 10, kwh: Math.round(t.kwh * 1000) / 1000, euros: Math.round(t.euros * 1000) / 1000 },
  };
}
