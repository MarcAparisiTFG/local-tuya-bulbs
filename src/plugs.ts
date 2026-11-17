// Los enchufes, sin nada de React: lo usan la app y el puente (tools/bridge.ts).
import type { TuyaVersion } from './tuya/device';
import type { LinkTarget } from './tuya/link';
import type { Plug } from './types';

/** Lo que trae devices.json de cada aparato (tinytuya wizard). */
export type RawDevice = {
  id?: string;
  name?: string;
  ip?: string;
  key?: string;
  version?: string | number;
  category?: string;
  mapping?: Record<string, { code?: string }>;
};

// En Tuya, «cz» es un enchufe y «pc» una regleta o enchufe de varias tomas; «dj» es una bombilla.
const PLUG_CATEGORIES = new Set(['cz', 'pc', 'kg']);

export const isPlugDevice = (d: RawDevice) =>
  PLUG_CATEGORIES.has(d.category ?? '') || (!!d.mapping && !d.mapping['20'] && Object.values(d.mapping).some((m) => /^switch_\d+$/.test(m.code ?? '')));

/** Una bombilla de las de la app (DPS 20 y siguientes): lo que no sea enchufe, si el mapa no dice lo contrario. */
export const isBulbDevice = (d: RawDevice) => !isPlugDevice(d) && (!d.mapping || !!d.mapping['20']);

/** El número de las tomas de un enchufe (los DPS `switch_N`); sin mapa, una sola en el DPS 1. */
export function outletDps(d: RawDevice): string[] {
  const dps = Object.entries(d.mapping ?? {})
    .filter(([, m]) => /^switch_\d+$/.test(m.code ?? ''))
    .map(([dp]) => dp)
    .sort((a, b) => Number(a) - Number(b));
  return dps.length ? dps : ['1'];
}

export const versionOf = (v: RawDevice['version']): TuyaVersion => (String(v ?? '') === '3.4' ? '3.4' : '3.3');

/** Las tomas de un enchufe de devices.json, cada una como aparato propio. */
export function outletsOf(d: RawDevice): Plug[] {
  if (!d.id) return [];
  const dps = outletDps(d);
  const base = d.name ?? 'Enchufe';
  return dps.map((dp) => ({
    id: `${d.id}:${dp}`,
    devId: d.id!,
    dp,
    name: dps.length > 1 ? `${base} ${dp}` : base,
    room: '',
    ip: d.ip && d.ip !== 'Auto' ? d.ip : '',
    key: d.key ?? '',
    version: versionOf(d.version),
  }));
}

/** Con qué se conecta una toma: el enchufe entero (las tomas del mismo comparten conexión). */
export const plugTarget = (p: Plug): LinkTarget => ({ id: p.devId, ip: p.ip, key: p.key, version: versionOf(p.version) });

/** Los DPS de consumo del enchufe entero (no de cada toma): 19 W/10, 20 V/10, 18 mA. */
export const plugWatts = (dps: Record<string, unknown>): number | undefined => (typeof dps['19'] === 'number' ? dps['19'] / 10 : undefined);

/** Las tomas agrupadas por enchufe, para mandar un solo comando a cada uno. */
export function byDevice<T extends { devId: string }>(list: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  list.forEach((p) => m.set(p.devId, [...(m.get(p.devId) ?? []), p]));
  return m;
}
