import { Look } from '../types';
import { lookToDps } from '../look';
import { Dps } from './device';
import { createLink } from './createLink';
import { Link, LinkTarget } from './link';

// Una conexión por bombilla, abierta bajo demanda y reabierta si se cae.
// La bombilla admite muy pocas conexiones locales a la vez: se cierran todas al irse la app a segundo plano.
const links = new Map<string, Promise<Link>>();
// Quién escucha los avisos de cada bombilla (la tarjeta y el detalle pueden estar a la vez)
const listeners = new Map<string, Set<(dps: Dps) => void>>();
const keyOf = (b: LinkTarget) => `${b.id}|${b.ip}|${b.key}`;

function link(b: LinkTarget): Promise<Link> {
  const k = keyOf(b);
  let p = links.get(k);
  if (!p) {
    // sólo se olvida si sigue siendo la actual: una vieja que se cierra tarde no debe tirar la nueva
    // (si no, se abre otra y la anterior queda abierta ocupando a la bombilla)
    const forget = () => {
      if (links.get(k) === mine) links.delete(k);
    };
    const mine: Promise<Link> = createLink(b).then((l) => {
      l.onClose = forget;
      l.onStatus = (dps) => listeners.get(k)?.forEach((cb) => cb(dps));
      return l;
    });
    mine.catch(forget);
    links.set(k, mine);
    p = mine;
  }
  return p;
}

async function withLink<T>(b: LinkTarget, fn: (l: Link) => Promise<T>): Promise<T> {
  try {
    return await fn(await link(b));
  } catch {
    // una vez más con conexión nueva (suele ser un socket que se había cerrado); la vieja se cierra
    const k = keyOf(b);
    const old = links.get(k);
    links.delete(k);
    old?.then((l) => l.close()).catch(() => {});
    return fn(await link(b));
  }
}

export const getStatus = (b: LinkTarget): Promise<Dps> => withLink(b, (l) => l.getStatus());
export const setDps = (b: LinkTarget, dps: Dps) => withLink(b, (l) => l.setDps(dps));
export const applyLook = (b: LinkTarget, look: Look) => setDps(b, lookToDps(look));
/**
 * Mientras se arrastra: el mismo comando que al soltar, por el camino rápido si lo hay (el puente).
 * Se probó el DPS 28 (control_data) para esto y esta bombilla no lo aplica bien al mantener el dedo.
 */
export const applyLive = (b: LinkTarget, look: Look) => withLink(b, (l) => (l.setLive ? l.setLive(lookToDps(look)) : l.setDps(lookToDps(look))));

/** Recibe los cambios que hagan otros (interruptor, otra app). Devuelve la función para dejar de escuchar. */
export async function watch(b: LinkTarget, cb: (dps: Dps) => void): Promise<() => void> {
  await link(b);
  const k = keyOf(b);
  const set = listeners.get(k) ?? new Set();
  listeners.set(k, set);
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

export function closeAll() {
  for (const p of links.values()) p.then((l) => l.close()).catch(() => {});
  links.clear();
}
