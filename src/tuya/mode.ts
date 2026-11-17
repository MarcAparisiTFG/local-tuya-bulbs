import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Plug } from '../types';
import { HAS_TCP } from './sockets';

// Cómo llega la app a las bombillas:
//  native → por sus propios sockets (la app compilada)
//  bridge → a través del puente de casa (navegador o Expo Go con `npm run bridge` encendido)
//  demo   → bombillas simuladas
export type Mode = 'native' | 'bridge' | 'demo';

const BRIDGE_PORT = 8787;
let mode: Mode = HAS_TCP ? 'native' : 'demo';
let bridgeUrl = '';

export const getMode = () => mode;
export const getBridgeUrl = () => bridgeUrl;

export type BridgeBulb = { id: string; name: string; ip: string };
/** Una toma de enchufe tal como la da el puente (sin clave) */
export type BridgePlug = { id: string; devId: string; dp: string; name: string; ip: string; version?: string };

/** El puente corre en el mismo ordenador que sirve la app: en la web, el de la página; en Expo Go, el de Metro. */
export function bridgeHost() {
  if (Platform.OS === 'web') return typeof location !== 'undefined' ? location.hostname : 'localhost';
  return (Constants.expoConfig?.hostUri ?? '').split(':')[0] || 'localhost';
}

/**
 * Busca el puente de casa; devuelve sus bombillas, o null si no está. Sin sockets propios es el del ordenador que
 * sirve la app (si no, demostración). La app compilada usa el que se guardó al traer las bombillas (`hub`): si está
 * encendido va a través de él, porque las bombillas aceptan una sola conexión; si no, va directa.
 */
export async function detectMode(hub?: string): Promise<{ bulbs: BridgeBulb[]; plugs: BridgePlug[] } | null> {
  if (HAS_TCP && !hub) return null;
  const url = `http://${HAS_TCP ? hub : bridgeHost()}:${BRIDGE_PORT}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const r = await fetch(`${url}/bulbs`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const bulbs = (await r.json()) as BridgeBulb[];
    mode = 'bridge';
    bridgeUrl = url;
    // un puente de antes de los enchufes no tiene /plugs
    const plugs = await fetch(`${url}/plugs`, { signal: ctrl.signal })
      .then((p) => (p.ok ? (p.json() as Promise<BridgePlug[]>) : []))
      .catch(() => []);
    return { bulbs, plugs };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ExportedBulb = { id: string; name: string; ip: string; key: string };

/** Pide al puente de casa las bombillas con sus claves (una vez, con el código que enseña al arrancar). */
export type Exported = { bulbs: ExportedBulb[]; plugs?: Plug[]; tv?: { ip: string; user: string; pass: string } | null };

export async function importFromMac(host: string, code: string): Promise<Exported> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`http://${host.trim()}:${BRIDGE_PORT}/export?code=${encodeURIComponent(code.trim())}`, { signal: ctrl.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? 'El puente no responde');
    // el puente antiguo devolvía sólo la lista de bombillas
    return Array.isArray(body) ? { bulbs: body } : (body as Exported);
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError' ? 'No llego al puente: ¿está el puente encendido y en el mismo Wi-Fi?' : (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
